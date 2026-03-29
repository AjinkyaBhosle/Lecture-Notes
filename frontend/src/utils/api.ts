import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const API_BASE = `${BACKEND_URL}/api`;

// ─── Types ────────────────────────────────────────────
export interface Lecture {
  id: string;
  title: string;
  status: string;
  duration_seconds: number;
  transcript: string | null;
  segments: TranscriptSegment[] | null;
  audio_uri: string | null;
  structured_notes: StructuredNotes | null;
  flashcards: Flashcard[] | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface StructuredNotes {
  title: string;
  summary: string;
  sections: { heading: string; points: string[]; key_concepts: string[] }[];
  key_takeaways: string[];
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

// ─── Local Storage (AsyncStorage) ─────────────────────
const LECTURES_KEY = '@lectures';
const FOLDERS_KEY = '@folders';

function genId(): string {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

const storage = {
  async getLectures(): Promise<Lecture[]> {
    const data = await AsyncStorage.getItem(LECTURES_KEY);
    return data ? JSON.parse(data) : [];
  },

  async saveLectures(lectures: Lecture[]): Promise<void> {
    await AsyncStorage.setItem(LECTURES_KEY, JSON.stringify(lectures));
  },

  async getFolders(): Promise<Folder[]> {
    const data = await AsyncStorage.getItem(FOLDERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async saveFolders(folders: Folder[]): Promise<void> {
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  },
};

// ─── API (Combines local storage + thin backend proxy) ─
export const api = {
  // ── Lectures (Local Storage) ──
  async createLecture(title: string = 'Untitled Lecture', folder_id?: string): Promise<Lecture> {
    const now = new Date().toISOString();
    const lecture: Lecture = {
      id: genId(),
      title,
      status: 'recorded',
      duration_seconds: 0,
      transcript: null,
      segments: null,
      audio_uri: null,
      structured_notes: null,
      flashcards: null,
      folder_id: folder_id || null,
      created_at: now,
      updated_at: now,
    };
    const lectures = await storage.getLectures();
    lectures.unshift(lecture);
    await storage.saveLectures(lectures);
    return lecture;
  },

  async listLectures(): Promise<Lecture[]> {
    return storage.getLectures();
  },

  async getLecture(id: string): Promise<Lecture> {
    const lectures = await storage.getLectures();
    const lecture = lectures.find((l) => l.id === id);
    if (!lecture) throw new Error('Lecture not found');
    return lecture;
  },

  async updateLecture(id: string, data: { title?: string; folder_id?: string | null }): Promise<Lecture> {
    const lectures = await storage.getLectures();
    const idx = lectures.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error('Lecture not found');
    if (data.title !== undefined) lectures[idx].title = data.title;
    if (data.folder_id !== undefined) lectures[idx].folder_id = data.folder_id;
    lectures[idx].updated_at = new Date().toISOString();
    await storage.saveLectures(lectures);
    return lectures[idx];
  },

  async deleteLecture(id: string): Promise<void> {
    const lectures = await storage.getLectures();
    await storage.saveLectures(lectures.filter((l) => l.id !== id));
  },

  async _updateLectureField(id: string, updates: Partial<Lecture>): Promise<void> {
    const lectures = await storage.getLectures();
    const idx = lectures.findIndex((l) => l.id === id);
    if (idx === -1) return;
    lectures[idx] = { ...lectures[idx], ...updates, updated_at: new Date().toISOString() };
    await storage.saveLectures(lectures);
  },

  // ── AI Processing (Backend Proxy) ──
  async transcribeAudio(lectureId: string, fileUri: string, duration: number, language: string = 'en'): Promise<string> {
    // Save audio URI locally
    await api._updateLectureField(lectureId, { status: 'transcribing', duration_seconds: duration, audio_uri: fileUri });

    const formData = new FormData();
    formData.append('file', { uri: fileUri, type: 'audio/m4a', name: `${lectureId}.m4a` } as any);

    const url = `${API_BASE}/transcribe?language=${language}`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!res.ok) {
      await api._updateLectureField(lectureId, { status: 'error' });
      const err = await res.text();
      throw new Error(err || 'Transcription failed');
    }
    const data = await res.json();
    await api._updateLectureField(lectureId, {
      transcript: data.transcript,
      segments: data.segments || [],
      status: 'generating_notes',
    });
    return data.transcript;
  },

  async generateNotes(lectureId: string, transcript: string): Promise<StructuredNotes> {
    await api._updateLectureField(lectureId, { status: 'generating_notes' });

    const res = await fetch(`${API_BASE}/generate-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) {
      await api._updateLectureField(lectureId, { status: 'error' });
      const err = await res.text();
      throw new Error(err || 'Note generation failed');
    }
    const data = await res.json();
    const notes = data.notes as StructuredNotes;
    await api._updateLectureField(lectureId, {
      structured_notes: notes,
      status: 'completed',
      title: notes.title || 'Untitled Lecture',
    });
    return notes;
  },

  async processLecture(lectureId: string, fileUri: string, duration: number, language: string = 'en'): Promise<Lecture> {
    // Step 1: Transcribe
    const transcript = await api.transcribeAudio(lectureId, fileUri, duration, language);
    // Step 2: Generate notes
    await api.generateNotes(lectureId, transcript);
    // Return updated lecture
    return api.getLecture(lectureId);
  },

  async generateFlashcards(lectureId: string): Promise<{ flashcards: Flashcard[]; count: number }> {
    const lecture = await api.getLecture(lectureId);
    if (lecture.flashcards && lecture.flashcards.length > 0) {
      return { flashcards: lecture.flashcards, count: lecture.flashcards.length };
    }
    if (!lecture.structured_notes) throw new Error('No notes available');

    const res = await fetch(`${API_BASE}/generate-flashcards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: lecture.structured_notes }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Flashcard generation failed');
    }
    const data = await res.json();
    await api._updateLectureField(lectureId, { flashcards: data.flashcards });
    return data;
  },

  // ── Folders (Local Storage) ──
  async listFolders(): Promise<Folder[]> {
    return storage.getFolders();
  },

  async createFolder(name: string, color: string = '#4F46E5'): Promise<Folder> {
    const folder: Folder = { id: genId(), name, color, created_at: new Date().toISOString() };
    const folders = await storage.getFolders();
    folders.unshift(folder);
    await storage.saveFolders(folders);
    return folder;
  },

  async deleteFolder(id: string): Promise<void> {
    const folders = await storage.getFolders();
    await storage.saveFolders(folders.filter((f) => f.id !== id));
    // Unassign lectures
    const lectures = await storage.getLectures();
    const updated = lectures.map((l) => l.folder_id === id ? { ...l, folder_id: null } : l);
    await storage.saveLectures(updated);
  },

  // No audio URL needed anymore - audio is deleted after processing
  getAudioUrl: (_id: string): string => '',
};

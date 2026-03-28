const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const API_BASE = `${BACKEND_URL}/api`;

async function request(path: string, options?: RequestInit) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface Lecture {
  id: string;
  title: string;
  status: string;
  duration_seconds: number;
  transcript: string | null;
  structured_notes: StructuredNotes | null;
  flashcards: Flashcard[] | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StructuredNotes {
  title: string;
  summary: string;
  sections: {
    heading: string;
    points: string[];
    key_concepts: string[];
  }[];
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
  lecture_count: number;
  created_at: string;
}

export interface ProcessingStatus {
  lecture_id: string;
  status: string;
  step: string;
  progress: number;
  message: string;
}

export const api = {
  // Lectures
  createLecture: (title: string = 'Untitled Lecture', folder_id?: string): Promise<Lecture> =>
    request('/lectures', {
      method: 'POST',
      body: JSON.stringify({ title, folder_id: folder_id || null }),
    }),

  listLectures: (): Promise<Lecture[]> => request('/lectures'),

  getLecture: (id: string): Promise<Lecture> => request(`/lectures/${id}`),

  deleteLecture: (id: string) =>
    request(`/lectures/${id}`, { method: 'DELETE' }),

  updateLecture: (id: string, data: { title?: string; folder_id?: string | null }): Promise<Lecture> =>
    request(`/lectures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadAudio: async (lectureId: string, fileUri: string, duration: number): Promise<any> => {
    const formData = new FormData();
    const fileInfo = {
      uri: fileUri,
      type: 'audio/m4a',
      name: `${lectureId}.m4a`,
    };
    formData.append('file', fileInfo as any);

    const url = `${API_BASE}/lectures/${lectureId}/upload-audio?duration=${duration}`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  processLecture: (id: string, language: string = 'en'): Promise<Lecture> =>
    request(`/lectures/${id}/process?language=${language}`, { method: 'POST' }),

  getProcessingStatus: (id: string): Promise<ProcessingStatus> =>
    request(`/lectures/${id}/status`),

  getAudioUrl: (id: string): string =>
    `${API_BASE}/lectures/${id}/audio`,

  generateFlashcards: (id: string): Promise<{ flashcards: Flashcard[]; count: number }> =>
    request(`/lectures/${id}/flashcards`, { method: 'POST' }),

  // Folders
  listFolders: (): Promise<Folder[]> => request('/folders'),

  createFolder: (name: string, color: string = '#4F46E5'): Promise<Folder> =>
    request('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),

  deleteFolder: (id: string) =>
    request(`/folders/${id}`, { method: 'DELETE' }),
};

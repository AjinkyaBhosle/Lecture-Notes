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

export interface ProcessingStatus {
  lecture_id: string;
  status: string;
  step: string;
  progress: number;
  message: string;
}

export const api = {
  createLecture: (title: string = 'Untitled Lecture'): Promise<Lecture> =>
    request('/lectures', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  listLectures: (): Promise<Lecture[]> => request('/lectures'),

  getLecture: (id: string): Promise<Lecture> => request(`/lectures/${id}`),

  deleteLecture: (id: string) =>
    request(`/lectures/${id}`, { method: 'DELETE' }),

  updateLecture: (id: string, title: string): Promise<Lecture> =>
    request(`/lectures/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
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
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
};


export interface TranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum SessionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface UserProgress {
  sessionsCompleted: number;
  currentLevel: 'Iniciante' | 'Intermediário' | 'Avançado';
  lastLessonDate: string | null;
  masteredTopics: string[];
  userAvatar?: string; // Base64 image
}

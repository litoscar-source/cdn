export enum UserRole {
  ADMIN = 'Administrador',
  COACH = 'Treinador',
  STAFF = 'Staff'
}

export enum AttendanceStatus {
  PRESENT = 'Presente',
  ABSENT = 'Ausente',
  LATE = 'Atrasado',
  INJURED = 'Lesionado'
}

export interface User {
  id: string;
  name: string;
  username: string; // Changed from email
  role: UserRole;
  password?: string;
  allowedSquads?: string[]; // IDs of squads this user can manage
}

export interface Squad {
  id: string;
  name: string; // e.g., "Sub-11", "Seniores"
}

export interface Player {
  id: string;
  squadId: string;
  name: string;
  address: string;
  birthDate: string;
  jerseyNumber: number | string;
  jerseyName: string;
  kitSize: string;
  tracksuitSize: string;
  notes: string;
  photoUrl?: string;
  // New fields
  emergencyName?: string;
  emergencyContact?: string;
}

export interface TrainingSession {
  id: string;
  squadId: string;
  date: string; // ISO Date string
  time: string;
  description: string;
  drills?: string; // AI Generated content
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  playerId: string;
  status: AttendanceStatus;
}

export interface Match {
  id: string;
  squadId: string;
  date: string;
  time: string;
  opponent: string;
  location: 'Casa' | 'Fora';
  convokedIds: string[]; // List of player IDs
}

export type ViewState = 'DASHBOARD' | 'PLAYERS' | 'TRAINING' | 'MATCHES' | 'ADMIN' | 'AI_ASSISTANT';
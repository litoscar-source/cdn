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
  username: string;
  role: UserRole;
  password?: string;
  allowedSquads?: string[];
}

export interface Squad {
  id: string;
  name: string;
}

// New Interface for detailed player stats
export interface PlayerStats {
  technique: number; // 0-100
  speed: number;
  tactical: number;
  physical: number;
  behavior: string;
  strongFoot: 'Direito' | 'Esquerdo' | 'Ambos';
  positions: string;
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
  emergencyName?: string;
  emergencyContact?: string;
  // New: Sports Sheet
  sportsDetails?: PlayerStats;
}

export interface TrainingSession {
  id: string;
  squadId: string;
  date: string;
  time: string;
  description: string;
  // Removed drills (AI)
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  playerId: string;
  status: AttendanceStatus;
}

// Game Management Types
export interface MatchEvent {
  type: 'GOAL' | 'SUBSTITUTION' | 'CARD_YELLOW' | 'CARD_RED';
  minute: number;
  playerId: string;
  playerOutId?: string; // For substitutions
  note?: string;
}

export interface MatchData {
  starters: string[]; // IDs of players starting
  substitutes: string[]; // IDs of players on bench (legacy, prefer dynamic calculation)
  formation: string; // e.g., "4-3-3", "4-4-2"
  events: MatchEvent[];
  playerMinutes: Record<string, number>; // Map playerId -> minutes played
  currentPeriod: 'PRE' | '1H' | 'HT' | '2H' | 'FT';
  timer: number; // Current second of the match
  isTimerRunning: boolean; // Controls if the timer is ticking
  // NEW: Coordinates for tactics board
  playerPositions: Record<string, {x: number, y: number}>; // x, y in percentages (0-100)
}

export interface Match {
  id: string;
  squadId: string;
  date: string;
  time: string;
  opponent: string;
  location: 'Casa' | 'Fora';
  convokedIds: string[];
  notes?: string;
  // New Fields
  playerKit?: string;
  goalkeeperKit?: string;
  gameData?: MatchData; // Stores the live game state
}

export type ViewState = 'DASHBOARD' | 'PLAYERS' | 'TRAINING' | 'MATCHES' | 'ADMIN';
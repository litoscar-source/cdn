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

export interface Exercise {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  type: 'WARMUP' | 'TECHNICAL' | 'TACTICAL' | 'PHYSICAL' | 'GAME';
  animationData?: string; // JSON string for tactics board state
}

export interface TrainingSession {
  id: string;
  squadId: string;
  date: string;
  time: string;
  description: string;
  notes?: string; // Added notes field
  exercises?: Exercise[];
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  playerId: string;
  status: AttendanceStatus;
}

// Game Management Types
export interface MatchEvent {
  id: string;
  type: 'GOAL' | 'SUBSTITUTION' | 'CARD_YELLOW' | 'CARD_RED';
  timestamp: number;
  minute: number;
  playerId: string;
  subInId?: string;
  playerOutId?: string;
  note?: string;
}

export interface MatchStats {
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  possession: number;
}

export interface MatchData {
  starters: string[]; // IDs of players CURRENTLY on the field
  startingXI: string[]; // IDs of players who STARTED the game (Historical)
  substitutes: string[]; // IDs of players on bench
  formation: string; // e.g., "4-3-3", "4-4-2"
  events: MatchEvent[];
  playerMinutes: Record<string, number>; // Map playerId -> minutes played
  currentPeriod: 'PRE' | '1H' | 'HT' | '2H' | 'FT';
  timer: number; // Current second of the match
  totalTime?: number; // Total duration in seconds
  startTime?: number; // Timestamp when the match started
  isTimerRunning: boolean; // Controls if the timer is ticking
  lastUpdateTimestamp?: number; // For robust time tracking
  // NEW: Coordinates for tactics board
  playerPositions: Record<string, {x: number, y: number}>; // x, y in percentages (0-100)
  stats?: MatchStats;
}

export interface Match {
  id: string;
  squadId: string;
  date: string;
  time: string;
  meetingTime?: string; // Hora de concentração
  matchType?: 'Oficial' | 'Treino' | 'Torneio'; // Tipo de jogo
  opponent: string;
  location: 'Casa' | 'Fora';
  venue?: string; // Specific field name (especially for Away games)
  convokedIds: string[];
  notes?: string;
  // New Fields
  playerKit?: string;
  goalkeeperKit?: string;
  gameData?: MatchData; // Stores the live game state
}

export interface ClubSettings {
  logoUrl?: string;
}

export type ViewState = 'DASHBOARD' | 'PLAYERS' | 'TRAINING' | 'MATCHES' | 'CONVOCATION' | 'ADMIN';
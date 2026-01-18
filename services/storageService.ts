import { User, Squad, Player, TrainingSession, AttendanceRecord, Match } from '../types';
import { MOCK_USERS, INITIAL_SQUADS, MOCK_PLAYERS } from '../constants';

// Keys
const KEYS = {
  USERS: 'coachpro_users',
  SQUADS: 'coachpro_squads',
  PLAYERS: 'coachpro_players',
  SESSIONS: 'coachpro_sessions',
  ATTENDANCE: 'coachpro_attendance',
  MATCHES: 'coachpro_matches',
  CURRENT_USER: 'coachpro_current_user'
};

// Generic Helpers
const get = <T>(key: string, defaultVal: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultVal;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultVal;
  }
};

const set = <T>(key: string, val: T): void => {
  localStorage.setItem(key, JSON.stringify(val));
};

// Data Services
export const storageService = {
  // Users
  getUsers: () => get<User[]>(KEYS.USERS, MOCK_USERS),
  saveUsers: (users: User[]) => set(KEYS.USERS, users),
  
  // Squads
  getSquads: () => get<Squad[]>(KEYS.SQUADS, INITIAL_SQUADS),
  saveSquads: (squads: Squad[]) => set(KEYS.SQUADS, squads),
  
  // Players
  getPlayers: () => get<Player[]>(KEYS.PLAYERS, MOCK_PLAYERS),
  savePlayers: (players: Player[]) => set(KEYS.PLAYERS, players),
  
  // Sessions
  getSessions: () => get<TrainingSession[]>(KEYS.SESSIONS, []),
  saveSessions: (sessions: TrainingSession[]) => set(KEYS.SESSIONS, sessions),
  
  // Attendance
  getAttendance: () => get<AttendanceRecord[]>(KEYS.ATTENDANCE, []),
  saveAttendance: (records: AttendanceRecord[]) => set(KEYS.ATTENDANCE, records),

  // Matches
  getMatches: () => get<Match[]>(KEYS.MATCHES, []),
  saveMatches: (matches: Match[]) => set(KEYS.MATCHES, matches),

  // Auth
  login: (username: string, password: string): User | null => {
    const users = get<User[]>(KEYS.USERS, MOCK_USERS);
    // Strict comparison
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },
  logout: () => localStorage.removeItem(KEYS.CURRENT_USER),
  getCurrentUser: (): User | null => get<User | null>(KEYS.CURRENT_USER, null)
};
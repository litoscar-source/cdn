import { User, Squad, Player, TrainingSession, AttendanceRecord, Match } from '../types';
import { supabase } from './supabaseClient';

// Helper to map DB result to types if necessary, though we used quoted columns in SQL to match keys.

export const storageService = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) { console.error('Error fetching users:', error); return []; }
    return data || [];
  },
  
  saveUsers: async (users: User[]) => {
    // In a real scenario we would optimize this, but for sync compatibility we upsert
    // WARNING: This replaces local storage logic. In a real DB app, you usually insert/update single items.
    // To keep the app logic simple without rewriting the whole App.tsx state management:
    // We will loop and upsert. Ideally, App.tsx should call specific add/update functions.
    
    // For this migration, we assume the App.tsx sends the WHOLE array. 
    // We will iterate and upsert based on ID.
    for (const u of users) {
       const { error } = await supabase.from('users').upsert(u);
       if(error) console.error('Error saving user', u.name, error);
    }
  },

  deleteUser: async (id: string) => {
      await supabase.from('users').delete().eq('id', id);
  },

  // --- SQUADS ---
  getSquads: async (): Promise<Squad[]> => {
    const { data, error } = await supabase.from('squads').select('*');
    if (error) { console.error('Error fetching squads:', error); return []; }
    return data || [];
  },
  
  saveSquads: async (squads: Squad[]) => {
    for (const s of squads) {
        await supabase.from('squads').upsert(s);
    }
  },

  deleteSquad: async (id: string) => {
      await supabase.from('squads').delete().eq('id', id);
  },

  // --- PLAYERS ---
  getPlayers: async (): Promise<Player[]> => {
    const { data, error } = await supabase.from('players').select('*');
    if (error) { console.error('Error fetching players:', error); return []; }
    return data || [];
  },

  savePlayers: async (players: Player[]) => {
     for (const p of players) {
         await supabase.from('players').upsert(p);
     }
  },

  deletePlayer: async (id: string) => {
      await supabase.from('players').delete().eq('id', id);
  },

  // --- SESSIONS ---
  getSessions: async (): Promise<TrainingSession[]> => {
    const { data, error } = await supabase.from('sessions').select('*');
    if (error) { console.error('Error fetching sessions:', error); return []; }
    return data || [];
  },

  saveSessions: async (sessions: TrainingSession[]) => {
     for(const s of sessions) {
         await supabase.from('sessions').upsert(s);
     }
  },

  deleteSession: async (id: string) => {
      await supabase.from('sessions').delete().eq('id', id);
  },

  // --- ATTENDANCE ---
  getAttendance: async (): Promise<AttendanceRecord[]> => {
    const { data, error } = await supabase.from('attendance').select('*');
    if (error) { console.error('Error fetching attendance:', error); return []; }
    return data || [];
  },

  saveAttendance: async (records: AttendanceRecord[]) => {
     // This list can be huge. In a real app, optimize. 
     // We will upsert in batches or just the changed ones if refactored.
     // For now, adhering to the "save list" pattern:
     if(records.length > 0) {
        const { error } = await supabase.from('attendance').upsert(records);
        if (error) console.error('Error saving attendance', error);
     }
  },

  deleteAttendance: async (playerId: string, sessionId: string) => {
      await supabase.from('attendance').delete().match({ playerId, sessionId });
  },

  // --- MATCHES ---
  getMatches: async (): Promise<Match[]> => {
    const { data, error } = await supabase.from('matches').select('*');
    if (error) { console.error('Error fetching matches:', error); return []; }
    return data || [];
  },

  saveMatches: async (matches: Match[]) => {
      for(const m of matches) {
          await supabase.from('matches').upsert(m);
      }
  },

  deleteMatch: async (id: string) => {
      await supabase.from('matches').delete().eq('id', id);
  },

  // --- AUTH (Simplified for this app structure) ---
  // Note: Standard Supabase Auth uses email/password. 
  // Since this app uses a custom "User Table" approach, we keep fetching from table.
  
  logout: () => {
    localStorage.removeItem('coachpro_current_user');
  },
  
  getCurrentUser: (): User | null => {
      const stored = localStorage.getItem('coachpro_current_user');
      return stored ? JSON.parse(stored) : null;
  },
  
  persistLogin: (user: User) => {
      localStorage.setItem('coachpro_current_user', JSON.stringify(user));
  }
};
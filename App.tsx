import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, Squad, Player, TrainingSession, AttendanceRecord, ViewState, UserRole, AttendanceStatus, Match, MatchData, MatchEvent, Exercise 
} from './types';
import TacticsBoard from './components/TacticsBoard';
import { storageService } from './services/storageService';
import { generateConvocationPDF, generateMatchSheetPDF, generateTrainingSessionPDF } from './services/pdfService';
import { CLUB_NAME } from './constants';
import Layout from './components/Layout';
import PlayerForm from './components/PlayerForm';
import { 
  Plus, Search, Filter, Trash2, Edit2, Check, X as XIcon, AlertCircle, Clock, UserPlus, UserCircle, CalendarDays, Flag, Copy, FileDown, Loader2, Play, Pause, Shirt, Shield, ArrowRightLeft, FileText, Maximize2, Minimize2, UserCheck, Printer, Trophy, Minus, PlusCircle, ChevronLeft, Settings as SettingsIcon, Upload, ArrowRight, ArrowLeft
} from 'lucide-react';

const App: React.FC = () => {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [isLoading, setIsLoading] = useState(false);
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  // UI State
  const [isLoginView, setIsLoginView] = useState(true);
  const [selectedLoginUserId, setSelectedLoginUserId] = useState('');
  const [loginPassword, setLoginPassword] = useState(''); 
  const [loginError, setLoginError] = useState('');

  const [editingPlayer, setEditingPlayer] = useState<Player | null | undefined>(undefined); 
  const [selectedSquadFilter, setSelectedSquadFilter] = useState<string>('all');
  
  // Training/Attendance UI State
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Partial<TrainingSession>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTrainingTab, setActiveTrainingTab] = useState<'ATTENDANCE' | 'EXERCISES'>('ATTENDANCE');
  const [editingExercise, setEditingExercise] = useState<Partial<Exercise> | null>(null);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [isExerciseFullscreen, setIsExerciseFullscreen] = useState(false);
  const [fullscreenExerciseId, setFullscreenExerciseId] = useState<string | null>(null);

  // Matches UI State
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Partial<Match>>({});
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Game Day UI State
  const [activeGameTab, setActiveGameTab] = useState<'TACTICS' | 'LIVE'>('TACTICS');
  const [liveTab, setLiveTab] = useState<'GAME' | 'STATS' | 'SUBS'>('GAME');
  const [mobileLiveTab, setMobileLiveTab] = useState<'FIELD' | 'BENCH'>('FIELD');
  
  // Tactics Selection State
  const [selectedTacticsPlayerId, setSelectedTacticsPlayerId] = useState<string | null>(null);
  const [isLiveGameFullscreen, setIsLiveGameFullscreen] = useState(false);
  
  // Club Settings
  const [clubLogoUrl, setClubLogoUrl] = useState<string>('');

  // --- TIMER LOGIC ---
  const timerRef = useRef<any>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Wake Lock Management
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err: any) {
      // Ignore if not allowed by policy
      if (err.name === 'NotAllowedError' || err.message.includes('permissions policy')) {
        console.warn('Wake Lock not available in this environment.');
      } else {
        console.error('Wake Lock error:', err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (e) { /* ignore */ }
      wakeLockRef.current = null;
    }
  };

  // Derived state for timer
  const activeMatch = useMemo(() => matches.find(m => m.id === selectedMatchId), [matches, selectedMatchId]);
  const isTimerRunning = activeMatch?.gameData?.isTimerRunning && 
                         (activeMatch?.gameData?.currentPeriod === '1H' || activeMatch?.gameData?.currentPeriod === '2H');

  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && isTimerRunning) {
            requestWakeLock();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTimerRunning]);

  // Timer Tick
  useEffect(() => {
    if (isTimerRunning) {
        // Request Wake Lock if not active
        if (!wakeLockRef.current) requestWakeLock();

        if (!timerRef.current) {
            // Run more frequently to avoid visual stutter
            timerRef.current = setInterval(() => {
                setMatches(prevMatches => {
                    let hasChanges = false;
                    const newMatches = prevMatches.map(m => {
                        if (m.id === selectedMatchId && m.gameData?.isTimerRunning) {
                             const now = Date.now();
                             const lastUpdate = m.gameData.lastUpdateTimestamp || (now - 1000);
                             const deltaMs = now - lastUpdate;
                             
                             // Only update if at least 1 second has passed
                             if (deltaMs < 1000) return m;

                             const deltaSeconds = Math.floor(deltaMs / 1000);
                             const newTimer = m.gameData.timer + deltaSeconds;
                             
                             // Preserve the remainder milliseconds to prevent time drift
                             const remainder = deltaMs % 1000;
                             const newLastUpdate = now - remainder;

                             // Update Minutes Played logic
                             const newPlayerMinutes = { ...m.gameData.playerMinutes };
                             
                             // Check if we crossed a minute boundary
                             const oldTotalMin = Math.floor(m.gameData.timer / 60);
                             const newTotalMin = Math.floor(newTimer / 60);
                             
                             if (newTotalMin > oldTotalMin) {
                                 const minutesToAdd = newTotalMin - oldTotalMin;
                                 m.gameData.starters.forEach(pid => {
                                     newPlayerMinutes[pid] = (newPlayerMinutes[pid] || 0) + minutesToAdd;
                                 });
                             }
                             
                             hasChanges = true;
                             return {
                                 ...m,
                                 gameData: {
                                     ...m.gameData,
                                     timer: newTimer,
                                     lastUpdateTimestamp: newLastUpdate,
                                     playerMinutes: newPlayerMinutes
                                 }
                             };
                        }
                        return m;
                    });
                    
                    // Only trigger re-render if state actually changed
                    return hasChanges ? newMatches : prevMatches;
                });
            }, 200); 
        }
    } else {
        // Stop Timer & Release Lock
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        releaseWakeLock();
    }

    return () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        releaseWakeLock();
    };
  }, [isTimerRunning, selectedMatchId]);

  const toggleFullscreen = () => {
    if (!isLiveGameFullscreen) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.warn(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
            });
        }
        setIsLiveGameFullscreen(true);
    } else {
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        setIsLiveGameFullscreen(false);
    }
  };

  // Initial Load & Admin Check
  useEffect(() => {
    const init = async () => {
        try {
            setIsLoading(true);
            
            // Load Settings immediately (for Login Logo)
            const settings = await storageService.getClubSettings();
            if (settings.logoUrl) setClubLogoUrl(settings.logoUrl);

            // We need to fetch users to display the login dropdown
            let loadedUsers = await storageService.getUsers();
            
            // --- SEED DEFAULT ADMIN IF NO USERS EXIST ---
            if (loadedUsers.length === 0) {
                const generateId = () => {
                    return typeof crypto !== 'undefined' && crypto.randomUUID 
                        ? crypto.randomUUID() 
                        : Math.random().toString(36).substring(2, 15);
                };
                
                const defaultAdmin: User = {
                    id: generateId(),
                    name: 'Administrador',
                    username: 'admin',
                    role: UserRole.ADMIN,
                    password: '1212',
                    allowedSquads: []
                };
                await storageService.saveUsers([defaultAdmin]);
                loadedUsers = [defaultAdmin];
            } else {
                // Ensure Admin has correct password (migration for dev)
                const adminUser = loadedUsers.find(u => u.username === 'admin');
                if (adminUser && adminUser.password !== '1212') {
                    adminUser.password = '1212';
                    await storageService.saveUsers([adminUser]);
                    // Update local state
                    loadedUsers = loadedUsers.map(u => u.id === adminUser.id ? adminUser : u);
                }
            }

            setUsers(loadedUsers);
            
            const user = storageService.getCurrentUser();
            if (user) {
              // Verify if user still exists in DB (security check)
              const validUser = loadedUsers.find(u => u.id === user.id);
              if (validUser) {
                  setCurrentUser(validUser); // Update with fresh data (e.g. if role changed)
                  setIsLoginView(false);
                  await loadData();
              } else {
                  storageService.logout();
                  setIsLoginView(true);
              }
            }
        } catch (error) {
            console.error("Initialization error:", error);
            // Fallback to ensure UI doesn't hang
            setUsers([{
                id: 'fallback-admin',
                name: 'Administrador (Offline)',
                username: 'admin',
                role: UserRole.ADMIN,
                password: '1212',
                allowedSquads: []
            }]);
        } finally {
            setIsLoading(false);
        }
    };
    init();
  }, []);

  const loadData = async () => {
    try {
        // Parallel fetching for performance
        const [u, s, p, sess, att, m] = await Promise.all([
            storageService.getUsers().catch(() => []),
            storageService.getSquads().catch(() => []),
            storageService.getPlayers().catch(() => []),
            storageService.getSessions().catch(() => []),
            storageService.getAttendance().catch(() => []),
            storageService.getMatches().catch(() => [])
        ]);
        
        if (u.length > 0) setUsers(u);
        setSquads(s);
        setPlayers(p);
        setSessions(sess);
        setAttendance(att);
        setMatches(m);

        // Load Settings
        const settings = await storageService.getClubSettings().catch(() => ({}));
        if (settings.logoUrl) setClubLogoUrl(settings.logoUrl);
    } catch (e) {
        console.error("Error loading data:", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if(!selectedLoginUserId) return;
    
    setIsLoading(true);
    try {
        // Always re-fetch users on login attempt to ensure we have latest passwords
        const latestUsers = await storageService.getUsers();
        
        // If fetch fails (e.g. offline), fallback to the currently loaded users
        const activeUsers = latestUsers.length > 0 ? latestUsers : users;
        setUsers(activeUsers);
        
        const user = activeUsers.find(u => u.id === selectedLoginUserId);
        if (user) {
            // Strict Password Check
            if (user.password !== loginPassword) {
                setLoginError('Password incorreta.');
                return;
            }

            storageService.persistLogin(user);
            setCurrentUser(user);
            await loadData();
            setIsLoginView(false);
        } else {
            setLoginError('Utilizador não encontrado.');
        }
    } catch (error) {
        console.error("Login error:", error);
        setLoginError('Erro ao tentar iniciar sessão.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = () => {
    storageService.logout();
    setCurrentUser(null);
    setIsLoginView(true);
    setSelectedLoginUserId('');
    setLoginPassword('');
    setLoginError('');
  };

  // --- Helper: Visible Squads for Current User ---
  const visibleSquads = useMemo(() => {
    if (!currentUser) return [];
    // SECURITY FIX: Explicit check for 'admin' username to ensure access even if Role string mismatch in DB
    if (currentUser.role === UserRole.ADMIN || currentUser.username === 'admin') return squads;
    if (!currentUser.allowedSquads || currentUser.allowedSquads.length === 0) return [];
    return squads.filter(s => currentUser.allowedSquads?.includes(s.id));
  }, [squads, currentUser]);

  const visiblePlayers = useMemo(() => {
    const squadIds = visibleSquads.map(s => s.id);
    return players.filter(p => squadIds.includes(p.squadId));
  }, [players, visibleSquads]);

  // --- Logic for Players ---
  const savePlayer = async (player: Player) => {
    let updatedPlayers;
    if (players.find(p => p.id === player.id)) {
      updatedPlayers = players.map(p => p.id === player.id ? player : p);
    } else {
      updatedPlayers = [...players, player];
    }
    setPlayers(updatedPlayers); // Optimistic Update
    setEditingPlayer(undefined);
    await storageService.savePlayers([player]); // Save to DB
  };

  const deletePlayer = async (id: string) => {
    if (confirm("Tem a certeza que deseja eliminar este atleta?")) {
      const updated = players.filter(p => p.id !== id);
      setPlayers(updated); // Optimistic
      await storageService.deletePlayer(id); // DB
    }
  };

  const filteredPlayers = useMemo(() => {
    let filtered = visiblePlayers;
    if (selectedSquadFilter !== 'all') {
      filtered = filtered.filter(p => p.squadId === selectedSquadFilter);
    }
    return filtered.sort((a,b) => (a.jerseyNumber as number) - (b.jerseyNumber as number));
  }, [visiblePlayers, selectedSquadFilter]);

  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return '-';
    const birth = new Date(birthDateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const copySquadList = () => {
    if (selectedSquadFilter === 'all') {
        alert("Por favor selecione um escalão específico para exportar a listagem.");
        return;
    }
    const squad = squads.find(s => s.id === selectedSquadFilter);
    let text = `LISTAGEM - ${squad?.name.toUpperCase()}\n\n`;
    filteredPlayers.forEach(p => {
        text += `${p.jerseyNumber}. ${p.name} (${calculateAge(p.birthDate)} anos)\n`;
    });
    
    navigator.clipboard.writeText(text);
    alert("Listagem copiada para a área de transferência!");
  };

  // --- Logic for Training ---
  const openSessionModal = (session?: TrainingSession) => {
      setEditingSession(session || { date: new Date().toISOString().split('T')[0], time: '19:00', squadId: visibleSquads[0]?.id });
      setIsSessionModalOpen(true);
  }

  const saveSession = async () => {
    if (!editingSession.date || !editingSession.squadId) return;
    
    let sessionToSave: TrainingSession;
    let updatedSessions = [...sessions];

    if (editingSession.id) {
        // Edit
        sessionToSave = { ...editingSession } as TrainingSession;
        updatedSessions = updatedSessions.map(s => s.id === editingSession.id ? sessionToSave : s);
    } else {
        // Create
        sessionToSave = {
            id: crypto.randomUUID(),
            date: editingSession.date!,
            squadId: editingSession.squadId!,
            time: editingSession.time || '19:00',
            description: editingSession.description || 'Treino',
            notes: editingSession.notes || ''
        };
        updatedSessions.push(sessionToSave);
    }
    
    setSessions(updatedSessions); // Optimistic
    setIsSessionModalOpen(false);
    setEditingSession({});
    await storageService.saveSessions([sessionToSave]); // DB
  };

  const deleteSession = async (id: string) => {
      if(confirm('Eliminar esta sessão de treino? Os registos de presença serão perdidos.')) {
          const updated = sessions.filter(s => s.id !== id);
          setSessions(updated);
          if (selectedSessionId === id) setSelectedSessionId(null);
          await storageService.deleteSession(id);
      }
  };

  // --- Exercise Management ---
  const openExerciseModal = (exercise?: Exercise) => {
    if (exercise) {
      setEditingExercise({ ...exercise });
    } else {
      setEditingExercise({
        id: crypto.randomUUID(),
        name: '',
        description: '',
        duration: 10,
        type: 'TECHNICAL',
        animationData: ''
      });
    }
    setIsExerciseModalOpen(true);
  };

  const saveExercise = async () => {
    if (!editingExercise || !editingExercise.name || !selectedSessionId) return;

    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return;

    const updatedExercises = session.exercises ? [...session.exercises] : [];
    const existingIndex = updatedExercises.findIndex(e => e.id === editingExercise.id);

    if (existingIndex >= 0) {
      updatedExercises[existingIndex] = editingExercise as Exercise;
    } else {
      updatedExercises.push(editingExercise as Exercise);
    }

    const updatedSession = { ...session, exercises: updatedExercises };
    const updatedSessions = sessions.map(s => s.id === selectedSessionId ? updatedSession : s);
    
    setSessions(updatedSessions);
    // Persist changes
    await storageService.saveSessions([updatedSession]);
    
    setIsExerciseModalOpen(false);
    setEditingExercise(null);
  };

  const deleteExercise = async (exerciseId: string) => {
    if (!selectedSessionId || !confirm('Eliminar exercício?')) return;

    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return;

    const updatedExercises = session.exercises?.filter(e => e.id !== exerciseId) || [];
    const updatedSession = { ...session, exercises: updatedExercises };
    const updatedSessions = sessions.map(s => s.id === selectedSessionId ? updatedSession : s);

    setSessions(updatedSessions);
    await storageService.saveSessions([updatedSession]);
  };

  const toggleAttendance = async (playerId: string, sessionId: string, status: AttendanceStatus) => {
    const existingIndex = attendance.findIndex(a => a.playerId === playerId && a.sessionId === sessionId);
    let newAttendance = [...attendance];
    let recordToSave: AttendanceRecord;

    if (existingIndex >= 0) {
      if (newAttendance[existingIndex].status === status) {
        // Toggle OFF - Remove
        await storageService.deleteAttendance(playerId, sessionId);
        newAttendance.splice(existingIndex, 1);
        setAttendance(newAttendance);
        return;
      } else {
        newAttendance[existingIndex].status = status;
        recordToSave = newAttendance[existingIndex];
      }
    } else {
      recordToSave = { id: crypto.randomUUID(), playerId, sessionId, status };
      newAttendance.push(recordToSave);
    }
    setAttendance(newAttendance);
    await storageService.saveAttendance([recordToSave]);
  };

  const getAttendanceStatus = (playerId: string, sessionId: string | null) => {
    if (!sessionId) return undefined;
    const record = attendance.find(a => a.playerId === playerId && a.sessionId === sessionId);
    return record?.status;
  };

  const downloadTrainingPDF = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if(!session) return;
    const squad = squads.find(s => s.id === session.squadId);
    if(!squad) return;

    try {
        await generateTrainingSessionPDF(session, squad, players, attendance);
    } catch(e) {
        console.error(e);
        alert("Erro ao gerar PDF.");
    }
  }

  // --- Logic for Matches (Convocatórias & Game Day) ---
  const openMatchModal = (match?: Match) => {
      setEditingMatch(match || { 
          date: new Date().toISOString().split('T')[0], 
          time: '15:00', 
          squadId: visibleSquads[0]?.id,
          location: 'Casa',
          venue: ''
      });
      setIsMatchModalOpen(true);
  }

  const saveMatch = async () => {
    if (!editingMatch.date || !editingMatch.squadId || !editingMatch.opponent) return;

    let matchToSave: Match;
    let updatedMatches = [...matches];
    
    if (editingMatch.id) {
        matchToSave = { ...editingMatch } as Match;
        updatedMatches = updatedMatches.map(m => m.id === editingMatch.id ? matchToSave : m);
    } else {
        matchToSave = {
            id: crypto.randomUUID(),
            squadId: editingMatch.squadId!,
            date: editingMatch.date!,
            time: editingMatch.time || '15:00',
            opponent: editingMatch.opponent!,
            location: editingMatch.location as 'Casa' | 'Fora' || 'Casa',
            venue: editingMatch.venue,
            convokedIds: [],
            notes: editingMatch.notes || '',
            playerKit: editingMatch.playerKit,
            goalkeeperKit: editingMatch.goalkeeperKit
        };
        updatedMatches.push(matchToSave);
    }
    setMatches(updatedMatches);
    setIsMatchModalOpen(false);
    setEditingMatch({});
    await storageService.saveMatches([matchToSave]);
  };

  const deleteMatch = async (id: string) => {
      if(confirm('Eliminar este jogo? Todos os dados (golos, estatísticas) serão perdidos e removidos do histórico dos atletas.')) {
          const updated = matches.filter(m => m.id !== id);
          setMatches(updated);
          if (selectedMatchId === id) setSelectedMatchId(null);
          await storageService.deleteMatch(id);
      }
  };

  const updateMatchGameData = async (matchId: string, data: Partial<MatchData>, persist: boolean = true) => {
      let matchToUpdate: Match | undefined;
      const updatedMatches = matches.map(m => {
          if (m.id === matchId) {
              const prevData = m.gameData || {
                  starters: [],
                  startingXI: [],
                  substitutes: [],
                  formation: '4-3-3',
                  events: [],
                  playerMinutes: {},
                  playerPositions: {},
                  currentPeriod: 'PRE',
                  timer: 0,
                  isTimerRunning: false
              };
              matchToUpdate = { ...m, gameData: { ...prevData, ...data } };
              return matchToUpdate;
          }
          return m;
      });
      setMatches(updatedMatches);
      if(matchToUpdate && persist) await storageService.saveMatches([matchToUpdate]);
  };

  const toggleConvocation = async (matchId: string, playerId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    let newConvoked = [...(match.convokedIds || [])];
    let updatedGameData = match.gameData;

    if (newConvoked.includes(playerId)) {
      // Remove
      newConvoked = newConvoked.filter(id => id !== playerId);
      if (match.gameData) {
          updatedGameData = {
              ...match.gameData,
              starters: (match.gameData.starters || []).filter(id => id !== playerId),
              startingXI: (match.gameData.startingXI || []).filter(id => id !== playerId),
              substitutes: (match.gameData.substitutes || []).filter(id => id !== playerId)
          };
      }
    } else {
      // Add
      newConvoked.push(playerId);
    }

    const updatedMatch = { ...match, convokedIds: newConvoked, gameData: updatedGameData };
    const updatedMatches = matches.map(m => m.id === matchId ? updatedMatch : m);
    
    setMatches(updatedMatches);
    await storageService.saveMatches([updatedMatch]);
  };

  // Helper to toggle starter status directly from list
  const toggleStarterStatus = (matchId: string, playerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      const currentStarters = match.gameData?.starters || [];
      const currentStartingXI = match.gameData?.startingXI || [];
      
      let newStarters = [...currentStarters];
      let newStartingXI = [...currentStartingXI];

      if (newStarters.includes(playerId)) {
          // Move to Bench
          newStarters = newStarters.filter(id => id !== playerId);
          // Also remove from historical starting XI if we are still in setup phase (not live)
          // For simplicity, we always sync them in this view
          newStartingXI = newStartingXI.filter(id => id !== playerId);
      } else {
          // Move to Starters
          newStarters.push(playerId);
          if (!newStartingXI.includes(playerId)) newStartingXI.push(playerId);
      }

      updateMatchGameData(matchId, { starters: newStarters, startingXI: newStartingXI });
  };

  // --- LIVE GAME LOGIC ---
  const handleSubstitution = (matchId: string, playerOutId: string, playerInId: string) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      const newStarters = (match.gameData?.starters || []).filter(id => id !== playerOutId);
      newStarters.push(playerInId);
      
      const minute = Math.ceil((match.gameData?.timer || 0) / 60);
      const subEvent: MatchEvent = {
          id: crypto.randomUUID(),
          type: 'SUBSTITUTION',
          timestamp: match.gameData?.timer || 0,
          minute,
          playerId: playerInId,
          subInId: playerInId,
          playerOutId: playerOutId
      };
      const newEvents = [...(match.gameData?.events || []), subEvent];
      
      updateMatchGameData(matchId, { starters: newStarters, events: newEvents });
  };

  const deleteEvent = (matchId: string, eventId: string) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      const newEvents = match.gameData?.events?.filter(e => e.id !== eventId) || [];
      updateMatchGameData(matchId, { events: newEvents });
  };

  const toggleTimer = (matchId: string) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;
      const isRunning = match.gameData?.isTimerRunning || false;
      
      const updates: Partial<MatchData> = { isTimerRunning: !isRunning };
      if (!isRunning) {
          // Starting
          updates.lastUpdateTimestamp = Date.now();
      } else {
          updates.lastUpdateTimestamp = undefined;
      }

      updateMatchGameData(matchId, updates);
  };

  const setGamePeriod = (matchId: string, period: MatchData['currentPeriod']) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      const currentPeriod = match.gameData?.currentPeriod;
      let currentTotal = match.gameData?.totalTime || 0;
      
      // If we are leaving an active period, add its duration to total
      if (currentPeriod === '1H' || currentPeriod === '2H') {
          currentTotal += (match.gameData?.timer || 0);
      }

      updateMatchGameData(matchId, { 
          currentPeriod: period, 
          isTimerRunning: false, 
          timer: 0,
          lastUpdateTimestamp: undefined,
          totalTime: currentTotal
      });
  };

  const handlePlayerGoal = (matchId: string, playerId: string, delta: number) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      let newEvents = [...(match.gameData?.events || [])];
      
      if (delta > 0) {
          // Add Goal
          const minute = Math.ceil((match.gameData?.timer || 0) / 60);
          const newEvent: MatchEvent = {
              id: crypto.randomUUID(),
              type: 'GOAL',
              timestamp: match.gameData?.timer || 0,
              minute,
              playerId: playerId
          };
          newEvents.push(newEvent);
      } else {
          // Remove Last Goal for this player
          // Find the last goal event index for this player
          // We iterate backwards
          let indexToRemove = -1;
          for (let i = newEvents.length - 1; i >= 0; i--) {
              if (newEvents[i].type === 'GOAL' && newEvents[i].playerId === playerId) {
                  indexToRemove = i;
                  break;
              }
          }
          if (indexToRemove !== -1) {
              newEvents.splice(indexToRemove, 1);
          }
      }
      
      updateMatchGameData(matchId, { events: newEvents });
  };

  const handleOpponentGoal = (matchId: string, action: 'ADD' | 'REMOVE') => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      const events = match.gameData?.events || [];
      
      if (action === 'ADD') {
          const minute = Math.ceil((match.gameData?.timer || 0) / 60);
          const newEvent: MatchEvent = {
              id: crypto.randomUUID(),
              type: 'GOAL',
              timestamp: match.gameData?.timer || 0,
              minute,
              playerId: 'opponent' // Reserved ID for opponent
          };
          updateMatchGameData(matchId, { events: [...events, newEvent] });
      } else {
          // Remove last opponent goal
          // We need to find the last goal with playerId 'opponent'
          const oppGoals = events.filter(e => e.type === 'GOAL' && e.playerId === 'opponent');
          if (oppGoals.length > 0) {
              // Remove one instance
              const lastGoal = oppGoals[oppGoals.length - 1];
              // We can't identify easily without ID in event, but let's filter by index or reference
              // Simpler: filter out ONE opponent goal
              const indexToRemove = events.lastIndexOf(lastGoal);
              const newEvents = [...events];
              if (indexToRemove !== -1) newEvents.splice(indexToRemove, 1);
              updateMatchGameData(matchId, { events: newEvents });
          }
      }
  };
  
  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- PDF ---
  const downloadConvocationPDF = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const squad = squads.find(s => s.id === match.squadId);
    const convokedPlayers = players.filter(p => match.convokedIds?.includes(p.id));

    if (squad && convokedPlayers.length > 0) {
      setIsGeneratingPdf(true);
      try {
        await generateConvocationPDF(match, squad, convokedPlayers, clubLogoUrl);
      } catch (e) {
        console.error(e);
        alert("Erro ao gerar PDF.");
      } finally {
        setIsGeneratingPdf(false);
      }
    } else {
      alert("É necessário ter atletas convocados para gerar o PDF.");
    }
  };

  const downloadMatchSheetPDF = async (matchId: string) => {
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      const squad = squads.find(s => s.id === match.squadId);
      if (squad) {
          try {
              await generateMatchSheetPDF(match, squad, players);
          } catch(e) { console.error(e); alert("Erro ao gerar Ficha de Jogo."); }
      }
  }

  const handleStatUpdate = (matchId: string, statType: keyof MatchStats, change: number) => {
      const match = matches.find(m => m.id === matchId);
      if (!match) return;

      const currentStats = match.gameData?.stats || {
          homeGoals: 0, awayGoals: 0, 
          homeShots: 0, awayShots: 0,
          homeCorners: 0, awayCorners: 0,
          homeFouls: 0, awayFouls: 0,
          homeYellowCards: 0, awayYellowCards: 0,
          homeRedCards: 0, awayRedCards: 0,
          possession: 50
      };

      const newValue = (currentStats[statType] || 0) + change;
      if (newValue < 0) return; // No negative stats

      const newStats = { ...currentStats, [statType]: newValue };
      updateMatchGameData(matchId, { stats: newStats });
  };

  const copyConvocation = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const squad = squads.find(s => s.id === match.squadId);
    const convokedPlayers = players.filter(p => match.convokedIds?.includes(p.id));
    
    let text = `CONVOCATÓRIA ${squad?.name.toUpperCase()}\n`;
    text += `Vs: ${match.opponent} (${match.location})\n`;
    text += `Data: ${match.date} ${match.time}\n`;
    if(match.playerKit) text += `Equip: ${match.playerKit}\n`;
    if(match.venue) text += `Local: ${match.venue}\n`;
    if (match.notes) text += `Obs: ${match.notes}\n`;
    text += `\nATLETAS:\n`;
    convokedPlayers.forEach(p => {
      text += `- ${p.name} (${p.jerseyNumber})\n`;
    });
    
    navigator.clipboard.writeText(text);
    alert("Convocatória copiada!");
  };

  // --- Logic for Admin ---
  const [newUser, setNewUser] = useState<Partial<User>>({ role: UserRole.STAFF, name: '', username: '', password: '', allowedSquads: [] });
  const [newSquadName, setNewSquadName] = useState('');

  const saveUser = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) {
        alert("Por favor preencha nome, username e password.");
        return;
    }
    
    const u: User = {
      id: newUser.id || crypto.randomUUID(), // Update existing or create new
      name: newUser.name!,
      username: newUser.username!,
      role: newUser.role || UserRole.STAFF,
      password: newUser.password!, // In real app, never save plain text
      allowedSquads: newUser.allowedSquads
    };
    
    // If updating, replace in array, else append
    let updatedUsers = [...users];
    if (newUser.id) {
        updatedUsers = updatedUsers.map(user => user.id === newUser.id ? u : user);
    } else {
        updatedUsers.push(u);
    }
    
    setUsers(updatedUsers);
    setNewUser({ role: UserRole.STAFF, name: '', username: '', password: '', allowedSquads: [] });
    await storageService.saveUsers([u]);
  };

  const startEditUser = (user: User) => {
      setNewUser({ ...user });
  }

  const cancelEditUser = () => {
      setNewUser({ role: UserRole.STAFF, name: '', username: '', password: '', allowedSquads: [] });
  }

  const handleUserSquadChange = (squadId: string) => {
    setNewUser(prev => {
        const current = prev.allowedSquads || [];
        if (current.includes(squadId)) {
            return { ...prev, allowedSquads: current.filter(id => id !== squadId) };
        } else {
            return { ...prev, allowedSquads: [...current, squadId] };
        }
    });
  };
  
  const deleteUser = async (id: string) => {
      if(confirm('Eliminar utilizador?')) {
          const updated = users.filter(u => u.id !== id);
          setUsers(updated);
          await storageService.deleteUser(id);
      }
  }

  const addSquad = async () => {
    if(!newSquadName) return;
    const s: Squad = { id: crypto.randomUUID(), name: newSquadName };
    const updated = [...squads, s];
    setSquads(updated);
    setNewSquadName('');
    await storageService.saveSquads([s]);
  }
  
  const deleteSquad = async (id: string) => {
      if(confirm('Eliminar escalão? Todos os dados associados serão perdidos visualmente.')) {
          const updated = squads.filter(s => s.id !== id);
          setSquads(updated);
          await storageService.deleteSquad(id);
      }
  }

  // Common Input Class
  const inputClass = "w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900 placeholder-slate-400";

  // --- Render ---

  if (isLoginView) {
    const handlePinClick = (digit: string) => {
        if (loginPassword.length < 4) {
            setLoginPassword(prev => prev + digit);
        }
    };

    const handlePinBackspace = () => {
        setLoginPassword(prev => prev.slice(0, -1));
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleLogin(e);
    };

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center">
          <div className="mb-6 text-center">
              {clubLogoUrl ? (
                  <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                      <img src={clubLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                  </div>
              ) : (
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                      <Shield className="w-8 h-8" />
                  </div>
              )}
              <h1 className="text-xl font-bold text-slate-800">{CLUB_NAME}</h1>
              <p className="text-slate-500 text-sm">Gestão de Equipa</p>
          </div>

          <form onSubmit={handlePinSubmit} className="w-full space-y-6">
            <div className="relative">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Quem és tu?</label>
              <select 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer disabled:opacity-50"
                value={selectedLoginUserId}
                disabled={isLoading}
                onChange={(e) => {
                    setSelectedLoginUserId(e.target.value);
                    setLoginError('');
                    setLoginPassword('');
                }}
              >
                <option value="">{isLoading ? 'A carregar...' : 'Selecionar Treinador...'}</option>
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {selectedLoginUserId && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-center gap-4 mb-6">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${loginPassword.length > i ? 'bg-emerald-500 scale-110' : 'bg-slate-200'}`} />
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button 
                                key={num}
                                type="button"
                                onClick={() => handlePinClick(num.toString())}
                                className="h-14 rounded-xl bg-slate-50 border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 text-xl font-bold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center"
                            >
                                {num}
                            </button>
                        ))}
                        <div className="flex items-center justify-center">
                             {/* Empty slot for alignment */}
                        </div>
                        <button 
                            type="button"
                            onClick={() => handlePinClick('0')}
                            className="h-14 rounded-xl bg-slate-50 border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 text-xl font-bold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center"
                        >
                            0
                        </button>
                        <button 
                            type="button"
                            onClick={handlePinBackspace}
                            className="h-14 rounded-xl bg-red-50 border-b-4 border-red-100 active:border-b-0 active:translate-y-1 text-red-500 hover:bg-red-100 transition flex items-center justify-center"
                        >
                            <Minus className="w-6 h-6" />
                        </button>
                    </div>

                    {loginError && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center mb-4 animate-pulse">
                            <AlertCircle className="w-4 h-4 mr-2" /> {loginError}
                        </div>
                    )}
                    
                    <button 
                        disabled={loginPassword.length < 1 || isLoading}
                        className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center text-lg"
                    >
                      {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'ENTRAR'}
                    </button>
                </div>
            )}
          </form>
        </div>
        <div className="mt-8 text-slate-500 text-xs opacity-50">
            v2.0 Mobile Optimized
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser!} currentView={currentView} onNavigate={setCurrentView} onLogout={handleLogout}>
      
      {/* DASHBOARD VIEW */}
      {currentView === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-slate-500 text-sm font-medium mb-1">Meus Atletas</h3>
              <p className="text-3xl font-bold text-slate-800">{visiblePlayers.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-slate-500 text-sm font-medium mb-1">Escalões</h3>
              <p className="text-3xl font-bold text-emerald-600">{visibleSquads.length}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h3 className="text-lg font-bold text-slate-800 mb-4">Próximos Treinos</h3>
             {sessions.filter(s => visibleSquads.map(sq=>sq.id).includes(s.squadId)).length === 0 ? (
               <p className="text-slate-500 italic">Sem treinos agendados.</p>
             ) : (
               <div className="space-y-3">
                 {sessions
                   .filter(s => visibleSquads.map(sq=>sq.id).includes(s.squadId))
                   .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                   .slice(0, 5)
                   .map(s => (
                   <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="mb-2 sm:mb-0">
                        <div className="font-semibold text-slate-800">{squads.find(sq => sq.id === s.squadId)?.name}</div>
                        <div className="text-sm text-slate-500">{s.date} às {s.time}</div>
                      </div>
                      <div className="text-sm px-3 py-1 bg-white rounded border border-slate-200 text-slate-600 self-start sm:self-center">
                        {s.description}
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      {/* PLAYERS VIEW */}
      {currentView === 'PLAYERS' && (
        <>
          {editingPlayer !== undefined ? (
            <PlayerForm 
              player={editingPlayer} 
              squads={visibleSquads} 
              onSave={savePlayer} 
              onCancel={() => setEditingPlayer(undefined)}
              matches={matches}
              attendance={attendance}
            />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative w-full md:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input placeholder="Procurar atleta..." className={`pl-10 pr-4 ${inputClass} w-full md:w-64`} />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select 
                    value={selectedSquadFilter}
                    onChange={(e) => setSelectedSquadFilter(e.target.value)}
                    className={`${inputClass} bg-white w-full sm:w-auto`}
                  >
                    <option value="all">Todos os meus Escalões</option>
                    {visibleSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                   <button 
                    onClick={copySquadList}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
                    title="Exportar Listagem"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    <span className="md:hidden lg:inline">Listagem</span>
                  </button>
                  <button 
                    onClick={() => setEditingPlayer(null)}
                    className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="md:hidden lg:inline">Novo</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 font-semibold text-slate-600 text-sm">#</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm">Nome</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm">Idade</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm hidden md:table-cell">Escalão</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm hidden lg:table-cell">Posições</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPlayers.map(player => (
                        <tr key={player.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => setEditingPlayer(player)}>
                           <td className="p-4 text-slate-500 font-mono">{player.jerseyNumber}</td>
                          <td className="p-4 flex items-center">
                            {player.photoUrl ? (
                                <img src={player.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover mr-3 border border-slate-200" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3 text-slate-500"><UserCircle className="w-5 h-5"/></div>
                            )}
                            <div>
                                <div className="font-medium text-slate-900">{player.name}</div>
                                <div className="text-xs text-slate-500 md:hidden">{squads.find(s => s.id === player.squadId)?.name}</div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-700 font-medium">
                            {calculateAge(player.birthDate)}
                          </td>
                          <td className="p-4 hidden md:table-cell">
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold">
                              {squads.find(s => s.id === player.squadId)?.name}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-600 hidden lg:table-cell">
                             {player.sportsDetails?.positions || '-'}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setEditingPlayer(player)} className="p-1 text-slate-400 hover:text-blue-600 transition inline-block"><Edit2 className="w-5 h-5"/></button>
                            <button onClick={() => deletePlayer(player.id)} className="p-1 text-slate-400 hover:text-red-600 transition ml-3 inline-block"><Trash2 className="w-5 h-5"/></button>
                          </td>
                        </tr>
                      ))}
                      {filteredPlayers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum atleta encontrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredPlayers.map(player => (
                        <div key={player.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition active:bg-slate-100 cursor-pointer" onClick={() => setEditingPlayer(player)}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="relative shrink-0">
                                     {player.photoUrl ? (
                                        <img src={player.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><UserCircle className="w-8 h-8"/></div>
                                    )}
                                    <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white">
                                        {player.jerseyNumber}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 truncate">{player.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                         <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{squads.find(s => s.id === player.squadId)?.name}</span>
                                         <span>• {calculateAge(player.birthDate)} anos</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center pl-2 shrink-0">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); deletePlayer(player.id); }} 
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                                >
                                    <Trash2 className="w-5 h-5"/>
                                </button>
                                <ChevronLeft className="w-5 h-5 text-slate-300 rotate-180 ml-1" />
                            </div>
                        </div>
                    ))}
                    {filteredPlayers.length === 0 && (
                         <div className="p-8 text-center text-slate-500 italic">Nenhum atleta encontrado.</div>
                    )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CONVOCATION VIEW */}
      {currentView === 'CONVOCATION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
            <div className={`lg:col-span-1 flex flex-col h-full space-y-4 ${selectedMatchId ? 'hidden lg:flex' : 'flex'}`}>
                 <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">Convocatórias</h2>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                {matches
                  .filter(m => visibleSquads.map(s => s.id).includes(m.squadId))
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(match => (
                  <div 
                    key={match.id}
                    className={`p-4 rounded-lg cursor-pointer transition border relative group ${
                      selectedMatchId === match.id 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                    onClick={() => setSelectedMatchId(match.id)}
                  >
                    <div className="font-bold flex justify-between items-start">
                      <div>
                        <div>{match.opponent}</div>
                        <div className="text-xs font-normal opacity-80">{match.location}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${selectedMatchId === match.id ? 'bg-emerald-500' : 'bg-slate-100 text-slate-500'}`}>
                        {squads.find(s => s.id === match.squadId)?.name}
                      </span>
                    </div>
                    <div className="text-sm mt-2 opacity-90 flex items-center">
                       <CalendarDays className="w-3 h-3 mr-1"/> {match.date} {match.time}
                    </div>
                    <div className="mt-2 text-xs flex items-center gap-2 opacity-80">
                        <UserCheck className="w-3 h-3" /> {match.convokedIds?.length || 0} Convocados
                    </div>
                  </div>
                ))}
                {matches.length === 0 && <p className="text-slate-500 italic p-4">Sem jogos criados. Crie um jogo no menu "Jogos" primeiro.</p>}
              </div>
            </div>

            <div className={`lg:col-span-2 h-full flex flex-col ${selectedMatchId ? 'flex' : 'hidden lg:flex'}`}>
                {selectedMatchId ? (
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                      {/* Mobile Back Button */}
                      <div className="lg:hidden p-2 bg-slate-100 border-b border-slate-200 flex items-center">
                          <button onClick={() => setSelectedMatchId(null)} className="flex items-center text-slate-600 font-medium px-2 py-1">
                              <ChevronLeft className="w-5 h-5 mr-1" /> Voltar à Lista
                          </button>
                      </div>

                      {/* Header */}
                      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-3">
                         <div>
                             <h3 className="font-bold text-slate-800 text-lg">
                                 Convocatória vs {matches.find(m => m.id === selectedMatchId)?.opponent}
                             </h3>
                             <p className="text-sm text-slate-500">Selecione os atletas para o jogo.</p>
                         </div>
                        <div className="flex space-x-2 w-full sm:w-auto justify-end">
                           <button onClick={() => copyConvocation(selectedMatchId)} title="Copiar Texto" className="p-2 text-slate-500 hover:bg-slate-200 rounded flex items-center gap-2">
                               <Copy className="w-4 h-4"/> <span className="hidden sm:inline text-sm">Copiar</span>
                           </button>
                           <button onClick={() => downloadConvocationPDF(selectedMatchId)} title="Gerar PDF" className="px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded flex items-center gap-2 shadow-sm">
                               {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
                               <span className="hidden sm:inline text-sm">PDF Convocatória</span>
                           </button>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm sticky top-0 z-10">
                                <span className="font-bold text-slate-700">Atletas Disponíveis</span>
                                <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-bold">
                                    {matches.find(m => m.id === selectedMatchId)?.convokedIds?.length || 0} Selecionados
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {players
                                .filter(p => p.squadId === matches.find(m => m.id === selectedMatchId)?.squadId)
                                .map(player => {
                                 const isSelected = matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(player.id);
                                 
                                 return (
                                   <div 
                                     key={player.id} 
                                     onClick={() => toggleConvocation(selectedMatchId, player.id)}
                                     className={`flex items-center p-3 rounded-lg border cursor-pointer transition relative group ${
                                       isSelected 
                                         ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                                         : 'bg-white border-slate-200 hover:border-emerald-200'
                                     }`}
                                   >
                                      <div className={`w-6 h-6 rounded border mr-3 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-slate-50'}`}>
                                         {isSelected && <Check className="w-4 h-4 text-white" />}
                                      </div>
                                      <div className="flex-1">
                                         <div className="text-sm font-medium text-slate-800">
                                             {player.name}
                                         </div>
                                         <div className="text-xs text-slate-500">#{player.jerseyNumber} | {player.sportsDetails?.positions || 'S/ Pos'}</div>
                                      </div>
                                   </div>
                                 )
                               })}
                         </div>
                      </div>
                   </div>
                   </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <UserCheck className="w-16 h-16 mb-4 opacity-20" />
                        <p>Selecione um jogo para gerir a convocatória</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* MATCHES VIEW */}
      {currentView === 'MATCHES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
            <div className={`lg:col-span-1 flex flex-col h-full space-y-4 ${selectedMatchId ? 'hidden lg:flex' : 'flex'}`}>
                 <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">Jogos</h2>
                 <button 
                  onClick={() => openMatchModal()}
                  className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                 >
                   <Plus className="w-5 h-5" />
                 </button>
              </div>

              {isMatchModalOpen && (
                <div className="bg-white p-4 rounded-lg shadow border border-emerald-100 mb-4 animate-in fade-in slide-in-from-top-2">
                   <div className="space-y-3">
                     <div className="grid grid-cols-2 gap-2">
                        <input type="date" className={inputClass} value={editingMatch.date} onChange={e => setEditingMatch({...editingMatch, date: e.target.value})} />
                        <input type="time" className={inputClass} value={editingMatch.time} onChange={e => setEditingMatch({...editingMatch, time: e.target.value})} />
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-500 font-bold ml-1">Hora Concentração</label>
                            <input type="time" className={inputClass} value={editingMatch.meetingTime || ''} onChange={e => setEditingMatch({...editingMatch, meetingTime: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold ml-1">Tipo de Jogo</label>
                            <select className={inputClass} value={editingMatch.matchType || 'Oficial'} onChange={e => setEditingMatch({...editingMatch, matchType: e.target.value as any})}>
                                <option value="Oficial">Oficial</option>
                                <option value="Treino">Treino</option>
                                <option value="Torneio">Torneio</option>
                            </select>
                        </div>
                     </div>
                     <input placeholder="Adversário" className={inputClass} value={editingMatch.opponent} onChange={e => setEditingMatch({...editingMatch, opponent: e.target.value})} />
                     <div className="grid grid-cols-2 gap-2">
                         <input placeholder="Kit Jogador" className={inputClass} value={editingMatch.playerKit || ''} onChange={e => setEditingMatch({...editingMatch, playerKit: e.target.value})} />
                         <input placeholder="Kit GR" className={inputClass} value={editingMatch.goalkeeperKit || ''} onChange={e => setEditingMatch({...editingMatch, goalkeeperKit: e.target.value})} />
                     </div>
                     <textarea placeholder="Comentários / Crónica de Jogo..." className={inputClass} value={editingMatch.notes || ''} onChange={e => setEditingMatch({...editingMatch, notes: e.target.value})} rows={3} />
                     <select className={inputClass} value={editingMatch.location} onChange={e => setEditingMatch({...editingMatch, location: e.target.value as any})}>
                       <option value="Casa">Casa</option>
                       <option value="Fora">Fora</option>
                     </select>
                     
                     <input 
                        placeholder="Recinto / Campo (Opcional)" 
                        className={inputClass} 
                        value={editingMatch.venue || ''} 
                        onChange={e => setEditingMatch({...editingMatch, venue: e.target.value})} 
                     />

                     <select className={inputClass} value={editingMatch.squadId} onChange={e => setEditingMatch({...editingMatch, squadId: e.target.value})}>
                       <option value="">Escalão...</option>
                       {visibleSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                     <div className="flex gap-2">
                         <button onClick={() => setIsMatchModalOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded">Cancelar</button>
                         <button onClick={saveMatch} className="flex-1 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Guardar</button>
                     </div>
                   </div>
                </div>
              )}

              <div className="space-y-2 flex-1 overflow-y-auto">
                {matches
                  .filter(m => visibleSquads.map(s => s.id).includes(m.squadId))
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(match => (
                  <div 
                    key={match.id}
                    className={`p-4 rounded-lg cursor-pointer transition border relative group ${
                      selectedMatchId === match.id 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                    onClick={() => setSelectedMatchId(match.id)}
                  >
                    <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteMatch(match.id); }}
                            className="p-1 bg-white/20 hover:bg-red-500 hover:text-white rounded text-inherit opacity-0 group-hover:opacity-100 transition"
                            title="Eliminar Jogo"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); openMatchModal(match); }}
                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-inherit opacity-0 group-hover:opacity-100 transition"
                            title="Editar"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="font-bold flex justify-between items-start">
                      <div>
                        <div>{match.opponent}</div>
                        <div className="text-xs font-normal opacity-80">{match.location} {match.venue ? `(${match.venue})` : ''}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${selectedMatchId === match.id ? 'bg-emerald-500' : 'bg-slate-100 text-slate-500'}`}>
                        {squads.find(s => s.id === match.squadId)?.name}
                      </span>
                    </div>
                    <div className="text-sm mt-2 opacity-90 flex items-center">
                       <CalendarDays className="w-3 h-3 mr-1"/> {match.date} {match.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`lg:col-span-2 h-full flex flex-col ${selectedMatchId ? 'flex' : 'hidden lg:flex'}`}>
                {selectedMatchId ? (
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                      {/* Mobile Back Button */}
                      <div className="lg:hidden p-2 bg-slate-100 border-b border-slate-200 flex items-center">
                          <button onClick={() => setSelectedMatchId(null)} className="flex items-center text-slate-600 font-medium px-2 py-1">
                              <ChevronLeft className="w-5 h-5 mr-1" /> Voltar à Lista
                          </button>
                      </div>

                      {/* Match Header */}
                      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-3">
                         <div className="flex gap-2 overflow-x-auto pb-1 w-full sm:w-auto no-scrollbar">
                             <button 
                                onClick={() => setActiveGameTab('TACTICS')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${activeGameTab === 'TACTICS' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                             >
                                 Titulares
                             </button>
                             <button 
                                onClick={() => setActiveGameTab('LIVE')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap flex-shrink-0 flex items-center ${activeGameTab === 'LIVE' ? 'bg-red-600 text-white animate-pulse' : 'text-slate-600 hover:bg-slate-200'}`}
                             >
                                 <Play className="w-3 h-3 mr-1" /> Jogo
                             </button>
                         </div>
                        <div className="flex space-x-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                           <button onClick={() => downloadMatchSheetPDF(selectedMatchId)} title="Ficha de Jogo" className="p-2 text-slate-500 hover:bg-slate-200 rounded"><Printer className="w-4 h-4"/></button>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                          
                          {/* STARTERS SELECTION (LEFT/RIGHT) */}
                          {activeGameTab === 'TACTICS' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                                  {/* Left Column: Bench / Convoked but not Starters */}
                                  <div className="bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                                      <div className="p-3 bg-slate-50 border-b font-bold text-slate-700 flex justify-between items-center">
                                          <span>Disponíveis / Banco</span>
                                          <span className="bg-slate-200 px-2 py-0.5 rounded text-xs font-mono">
                                              {players.filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id) && !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id)).length}
                                          </span>
                                      </div>
                                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                          {players
                                              .filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id))
                                              .filter(p => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id))
                                              .map(p => (
                                                  <div key={p.id} onClick={(e) => toggleStarterStatus(selectedMatchId, p.id, e)} className="p-3 border rounded hover:bg-emerald-50 cursor-pointer flex justify-between items-center group transition bg-white">
                                                      <div className="flex items-center">
                                                          <span className="w-8 h-8 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-xs font-bold mr-3 text-slate-600">{p.jerseyNumber}</span>
                                                          <div className="flex flex-col">
                                                              <span className="font-medium text-slate-800">{p.name}</span>
                                                              <span className="text-xs text-slate-400">{p.sportsDetails?.positions || 'S/ Pos'}</span>
                                                          </div>
                                                      </div>
                                                      <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-transform group-hover:translate-x-1" />
                                                  </div>
                                              ))
                                          }
                                          {players.filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id) && !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id)).length === 0 && (
                                              <div className="text-center p-8 text-slate-400 italic">Todos os convocados estão titulares.</div>
                                          )}
                                      </div>
                                  </div>

                                  {/* Right Column: Starters */}
                                  <div className="bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                                      <div className="p-3 bg-emerald-50 border-b border-emerald-100 font-bold text-emerald-800 flex justify-between items-center">
                                          <span>Titulares (11 Inicial)</span>
                                          <span className="bg-emerald-200 px-2 py-0.5 rounded text-xs font-mono text-emerald-900">
                                              {matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.length || 0}
                                          </span>
                                      </div>
                                      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-emerald-50/30">
                                          {players
                                              .filter(p => matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id))
                                              .map(p => (
                                                  <div key={p.id} onClick={(e) => toggleStarterStatus(selectedMatchId, p.id, e)} className="p-3 border border-emerald-200 bg-white rounded hover:bg-red-50 hover:border-red-200 cursor-pointer flex justify-between items-center group transition shadow-sm">
                                                      <ArrowLeft className="w-5 h-5 text-emerald-300 group-hover:text-red-500 transition-transform group-hover:-translate-x-1" />
                                                      <div className="flex items-center justify-end flex-1">
                                                          <div className="flex flex-col items-end mr-3">
                                                              <span className="font-medium text-slate-800 group-hover:text-red-700">{p.name}</span>
                                                              <span className="text-xs text-slate-400 group-hover:text-red-400">{p.sportsDetails?.positions || 'S/ Pos'}</span>
                                                          </div>
                                                          <span className="w-8 h-8 bg-emerald-100 text-emerald-800 border border-emerald-200 group-hover:bg-red-100 group-hover:text-red-800 group-hover:border-red-200 rounded-full flex items-center justify-center text-xs font-bold transition-colors">{p.jerseyNumber}</span>
                                                      </div>
                                                  </div>
                                              ))
                                          }
                                           {(!matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.length) && (
                                              <div className="text-center p-8 text-slate-400 italic flex flex-col items-center">
                                                  <UserCheck className="w-12 h-12 mb-2 opacity-20" />
                                                  Selecione jogadores da lista à esquerda para definir o 11 inicial.
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* LIVE GAME TAB (FULLSCREEN OPTIMIZED) */}
                          {activeGameTab === 'LIVE' && matches.find(m => m.id === selectedMatchId) && (
                              <div className={`flex flex-col h-full space-y-3 ${isLiveGameFullscreen ? 'fixed inset-0 z-50 bg-slate-100 p-0 md:p-4 h-[100dvh]' : ''}`}>
                                  {/* Scoreboard / Timer */}
                                  <div className="bg-slate-900 text-white md:rounded-xl shadow-lg flex flex-col shrink-0 overflow-hidden relative">
                                      {/* Floating Fullscreen Button */}
                                      <button 
                                        onClick={toggleFullscreen} 
                                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"
                                        title={isLiveGameFullscreen ? "Sair de Ecrã Inteiro" : "Ecrã Inteiro"}
                                      >
                                          {isLiveGameFullscreen ? <Minimize2 className="w-5 h-5"/> : <Maximize2 className="w-5 h-5"/>}
                                      </button>

                                      {/* Top Section: Score & Timer */}
                                      <div className="p-3 pt-8 md:pt-4 flex flex-col items-center gap-3">
                                          {/* Timer Display */}
                                          <div className="flex flex-col items-center gap-2 mb-2">
                                              {/* Period Label */}
                                              <div className="text-emerald-400 font-bold uppercase tracking-widest text-sm animate-pulse">
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod === '1H' && '1ª Parte'}
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod === '2H' && '2ª Parte'}
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod === 'HT' && 'Intervalo'}
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod === 'FT' && 'Fim de Jogo'}
                                                  {!matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod && 'Pré-Jogo'}
                                              </div>
                                              <div className="flex items-center gap-3 bg-black/40 px-6 py-2 rounded-2xl border border-white/10 backdrop-blur-sm">
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? 
                                                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]"/> : 
                                                    <span className="w-3 h-3 rounded-full bg-slate-500"/>
                                                  }
                                                  <span className="font-mono font-bold tracking-widest text-4xl md:text-5xl text-white tabular-nums shadow-black drop-shadow-md">
                                                      {formatTime(
                                                          matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod === 'FT' 
                                                          ? (matches.find(m => m.id === selectedMatchId)?.gameData?.totalTime || 0) 
                                                          : (matches.find(m => m.id === selectedMatchId)?.gameData?.timer || 0)
                                                      )}
                                                  </span>
                                              </div>
                                              
                                              {/* Big Play/Pause Button */}
                                              <button 
                                                onClick={() => toggleTimer(selectedMatchId!)}
                                                className={`mt-2 w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95 shadow-lg border-4 border-slate-900 ${matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                                              >
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                                              </button>
                                          </div>

                                          {/* Score Display (Big & Bold) */}
                                          <div className="flex items-center justify-center gap-4 md:gap-8 w-full">
                                              <div className="flex flex-col items-center">
                                                  <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Nós</span>
                                                  <span className="text-5xl md:text-6xl font-mono font-bold text-emerald-400 leading-none">
                                                      {matches.find(m => m.id === selectedMatchId)?.gameData?.events?.filter(e => e.type === 'GOAL' && e.playerId !== 'opponent').length || 0}
                                                  </span>
                                              </div>
                                              <div className="text-xl text-slate-600 font-bold opacity-30">VS</div>
                                              <div className="flex flex-col items-center">
                                                  <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Eles</span>
                                                  <div className="flex items-center gap-2">
                                                     <span className="text-5xl md:text-6xl font-mono font-bold text-red-400 leading-none">
                                                         {matches.find(m => m.id === selectedMatchId)?.gameData?.events?.filter(e => e.type === 'GOAL' && e.playerId === 'opponent').length || 0}
                                                     </span>
                                                     <div className="flex flex-col gap-1 ml-1">
                                                         <button onClick={() => handleOpponentGoal(selectedMatchId!, 'ADD')} className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-green-400 transition"><PlusCircle className="w-3 h-3"/></button>
                                                         <button onClick={() => handleOpponentGoal(selectedMatchId!, 'REMOVE')} className="p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-red-400 transition"><Minus className="w-3 h-3"/></button>
                                                     </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Period Controls (Scrollable on Mobile) */}
                                      <div className="bg-slate-800 p-2 flex overflow-x-auto gap-2 no-scrollbar border-t border-slate-700">
                                          {['1H', 'HT', '2H', 'FT'].map((p, index) => {
                                              const current = matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod;
                                              const isActive = current === p;
                                              return (
                                                  <button 
                                                    key={p || index}
                                                    onClick={() => setGamePeriod(selectedMatchId, p as any)}
                                                    className={`flex-1 py-3 px-3 md:px-4 rounded text-sm md:text-base font-bold whitespace-nowrap transition active:scale-95 flex flex-col items-center justify-center min-w-[80px] ${isActive ? 'bg-slate-700 text-white shadow-inner ring-1 ring-emerald-500/50' : 'bg-slate-900/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                                  >
                                                      {p === '1H' && '1ª PARTE'}
                                                      {p === 'HT' && 'INTERVALO'}
                                                      {p === '2H' && '2ª PARTE'}
                                                      {p === 'FT' && 'FIM'}
                                                      {isActive && <div className="h-1 w-full max-w-[20px] bg-emerald-500 rounded-full mt-1"/>}
                                                  </button>
                                              )
                                          })}
                                      </div>
                                  </div>

                                  {/* Live Tabs (Game / Stats / Subs) */}
                                  <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                      <button onClick={() => setLiveTab('GAME')} className={`flex-1 py-2 text-sm font-bold rounded transition ${liveTab === 'GAME' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>JOGO</button>
                                      <button onClick={() => setLiveTab('STATS')} className={`flex-1 py-2 text-sm font-bold rounded transition ${liveTab === 'STATS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>ESTATÍSTICAS</button>
                                      <button onClick={() => setLiveTab('SUBS')} className={`flex-1 py-2 text-sm font-bold rounded transition ${liveTab === 'SUBS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>SUBSTITUIÇÕES</button>
                                  </div>

                                  {/* Main Content Area */}
                                  <div className="flex-1 overflow-hidden flex flex-col relative">
                                      
                                      {/* GAME VIEW (Field + Bench) */}
                                      {liveTab === 'GAME' && (
                                          <div className="flex-1 flex flex-col md:flex-row gap-4 px-2 md:px-0 pb-2 overflow-hidden">
                                              
                                              {/* Mobile Tabs Switcher for Field/Bench */}
                                              <div className="flex md:hidden bg-slate-200 p-1 rounded-lg shrink-0 shadow-inner mb-2">
                                                  <button 
                                                    onClick={() => setMobileLiveTab('FIELD')}
                                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition flex items-center justify-center gap-2 ${mobileLiveTab === 'FIELD' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
                                                  >
                                                      <Shirt className="w-4 h-4" />
                                                      EM CAMPO
                                                  </button>
                                                  <button 
                                                    onClick={() => setMobileLiveTab('BENCH')}
                                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition flex items-center justify-center gap-2 ${mobileLiveTab === 'BENCH' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
                                                  >
                                                      <UserCheck className="w-4 h-4" />
                                                      SUPLENTES
                                                  </button>
                                              </div>

                                              {/* FIELD PLAYERS LIST */}
                                              <div className={`${mobileLiveTab === 'FIELD' ? 'flex' : 'hidden'} md:flex flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex-col shadow-sm`}>
                                                  <div className="p-3 border-b border-slate-100 bg-emerald-50 text-emerald-800 font-bold text-sm flex justify-between shrink-0 items-center">
                                                      <span className="flex items-center"><Shirt className="w-4 h-4 mr-2"/> JOGADORES EM CAMPO</span>
                                                      <span className="text-xs font-normal bg-emerald-100 px-2 py-0.5 rounded text-emerald-700">Minutos</span>
                                                  </div>
                                                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                                                     {players
                                                        .filter(p => matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id))
                                                        .map(p => {
                                                            const goals = matches.find(m => m.id === selectedMatchId)?.gameData?.events?.filter(e => e.type === 'GOAL' && e.playerId === p.id).length || 0;
                                                            return (
                                                            <div key={p.id} className="flex flex-col border rounded-lg bg-white shadow-sm p-3 gap-3">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex items-center">
                                                                        <span className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold mr-3 shadow-sm text-sm">{p.jerseyNumber}</span>
                                                                        <div>
                                                                            <div className="font-bold text-slate-800 leading-tight text-base">{p.name}</div>
                                                                            {goals > 0 && (
                                                                                <div className="flex items-center text-xs text-yellow-600 font-bold mt-0.5">
                                                                                    <Trophy className="w-3 h-3 mr-1 fill-yellow-500" /> {goals} {goals === 1 ? 'Golo' : 'Golos'}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-mono font-bold text-slate-600 text-xl bg-slate-100 px-2 py-1 rounded">
                                                                        {matches.find(m => m.id === selectedMatchId)?.gameData?.playerMinutes?.[p.id] || 0}'
                                                                    </span>
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                                                    {/* Goal Controls */}
                                                                    <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 flex-1 justify-between px-1">
                                                                        <button 
                                                                            onClick={() => handlePlayerGoal(selectedMatchId!, p.id, -1)}
                                                                            disabled={goals === 0}
                                                                            className={`p-3 md:p-2 flex items-center justify-center ${goals === 0 ? 'text-slate-300' : 'text-slate-600'}`}
                                                                        >
                                                                            <Minus className="w-4 h-4" />
                                                                        </button>
                                                                        <span className="font-bold text-slate-800">{goals}</span>
                                                                        <button 
                                                                            onClick={() => handlePlayerGoal(selectedMatchId!, p.id, 1)}
                                                                            className="p-3 md:p-2 flex items-center justify-center text-emerald-600 active:scale-95 transition"
                                                                        >
                                                                            <Plus className="w-4 h-4" />
                                                                        </button>
                                                                    </div>

                                                                    {/* Sub Out */}
                                                                    <div className="relative flex-1">
                                                                        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center justify-center font-bold h-full py-2 cursor-pointer hover:bg-red-100 transition">
                                                                            <ArrowRightLeft className="w-4 h-4 mr-2" /> SAIR
                                                                        </div>
                                                                        <select 
                                                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                                                            onChange={(e) => {
                                                                                if (e.target.value) {
                                                                                    handleSubstitution(selectedMatchId, p.id, e.target.value);
                                                                                    e.target.value = '';
                                                                                }
                                                                            }}
                                                                            defaultValue=""
                                                                        >
                                                                            <option value="" disabled>Substituir por...</option>
                                                                            {players
                                                                                .filter(sub => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(sub.id))
                                                                                .filter(sub => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(sub.id))
                                                                                .map(sub => (
                                                                                    <option key={sub.id} value={sub.id}>Entra: #{sub.jerseyNumber} {sub.name}</option>
                                                                                ))
                                                                            }
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )})}
                                                        {players.filter(p => matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id)).length === 0 && (
                                                            <div className="text-center p-8 text-slate-400 italic">
                                                                Nenhum jogador em campo.
                                                            </div>
                                                        )}
                                                  </div>
                                              </div>

                                               {/* BENCH LIST */}
                                               <div className={`${mobileLiveTab === 'BENCH' ? 'flex' : 'hidden'} md:flex w-full md:w-1/3 bg-white rounded-xl border border-slate-200 overflow-hidden flex-col shadow-sm`}>
                                                  <div className="p-3 border-b border-slate-100 bg-slate-50 text-slate-600 font-bold text-sm flex justify-between items-center shrink-0">
                                                      <span className="flex items-center"><UserCheck className="w-4 h-4 mr-2"/> BANCO</span>
                                                      <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-600">
                                                        {players.filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id))
                                                        .filter(p => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id)).length}
                                                      </span>
                                                  </div>
                                                  <div className="overflow-y-auto p-2 space-y-2">
                                                      {players
                                                        .filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id))
                                                        .filter(p => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id))
                                                        .map(p => (
                                                            <div key={p.id} className="flex justify-between bg-white border rounded-lg items-center p-3 shadow-sm">
                                                                <div className="flex items-center">
                                                                    <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold mr-3 text-sm border border-slate-200">
                                                                        {p.jerseyNumber}
                                                                    </span>
                                                                    <div>
                                                                        <div className="font-medium text-slate-800">{p.name}</div>
                                                                        <div className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                                                            {matches.find(m => m.id === selectedMatchId)?.gameData?.playerMinutes?.[p.id] || 0}' jogados
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* Quick Sub IN Logic */}
                                                                <div className="relative">
                                                                     <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center font-bold px-3 py-2 text-xs cursor-pointer hover:bg-emerald-100 transition">
                                                                        <ArrowRightLeft className="w-3 h-3 mr-1.5" /> ENTRAR
                                                                     </div>
                                                                    <select 
                                                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                                                        onChange={(e) => {
                                                                            if (e.target.value) {
                                                                                handleSubstitution(selectedMatchId, e.target.value, p.id);
                                                                                e.target.value = ''; // Reset select
                                                                            }
                                                                        }}
                                                                        defaultValue=""
                                                                    >
                                                                        <option value="" disabled>Substituir quem...</option>
                                                                        {matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.map(starterId => {
                                                                            const starter = players.find(sp => sp.id === starterId);
                                                                            return <option key={starterId} value={starterId}>Sai: #{starter?.jerseyNumber} {starter?.name}</option>
                                                                        })}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {players.filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id) && !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id)).length === 0 && (
                                                            <div className="text-center p-8 text-slate-400 italic">
                                                                Banco vazio.
                                                            </div>
                                                        )}
                                                  </div>
                                               </div>
                                          </div>
                                      )}

                                      {/* STATS VIEW */}
                                      {liveTab === 'STATS' && (
                                          <div className="flex-1 overflow-y-auto p-4">
                                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                  {[
                                                      { label: 'Remates', key: 'homeShots' },
                                                      { label: 'Cantos', key: 'homeCorners' },
                                                      { label: 'Faltas', key: 'homeFouls' },
                                                      { label: 'Amarelos', key: 'homeYellowCards' },
                                                      { label: 'Vermelhos', key: 'homeRedCards' },
                                                      { label: 'Posse (%)', key: 'possession' }
                                                  ].map((stat, index) => {
                                                      const value = matches.find(m => m.id === selectedMatchId)?.gameData?.stats?.[stat.key as keyof MatchStats] || 0;
                                                      return (
                                                          <div key={stat.key || index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                                                              <span className="text-slate-500 text-sm font-bold uppercase mb-2">{stat.label}</span>
                                                              <div className="flex items-center gap-4">
                                                                  <button onClick={() => handleStatUpdate(selectedMatchId, stat.key as keyof MatchStats, -1)} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"><Minus className="w-5 h-5"/></button>
                                                                  <span className="text-3xl font-mono font-bold text-slate-800 w-12 text-center">{value}</span>
                                                                  <button onClick={() => handleStatUpdate(selectedMatchId, stat.key as keyof MatchStats, 1)} className="w-10 h-10 rounded-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-700 transition"><Plus className="w-5 h-5"/></button>
                                                              </div>
                                                          </div>
                                                      )
                                                  })}
                                              </div>
                                          </div>
                                      )}

                                      {/* SUBS VIEW */}
                                      {liveTab === 'SUBS' && (
                                          <div className="flex-1 overflow-y-auto p-4">
                                              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                  <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">Histórico de Substituições</div>
                                                  <div className="divide-y divide-slate-100">
                                                      {matches.find(m => m.id === selectedMatchId)?.gameData?.events?.filter(e => e.type === 'SUBSTITUTION').length === 0 ? (
                                                          <div className="p-8 text-center text-slate-400 italic">Sem substituições registadas.</div>
                                                      ) : (
                                                          matches.find(m => m.id === selectedMatchId)?.gameData?.events
                                                              ?.filter(e => e.type === 'SUBSTITUTION')
                                                              .sort((a,b) => b.timestamp - a.timestamp)
                                                              .map(event => {
                                                                  const playerIn = players.find(p => p.id === event.subInId);
                                                                  const playerOut = players.find(p => p.id === event.playerOutId);
                                                                  return (
                                                                      <div key={event.id} className="p-4 flex items-center justify-between">
                                                                          <div className="flex items-center gap-4">
                                                                              <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{Math.floor((event.timestamp - (matches.find(m => m.id === selectedMatchId)?.gameData?.startTime || 0)) / 60)}'</span>
                                                                              <div className="flex flex-col">
                                                                                  <div className="flex items-center text-emerald-600 font-medium">
                                                                                      <ArrowRight className="w-4 h-4 mr-1" /> Entra: {playerIn?.name}
                                                                                  </div>
                                                                                  <div className="flex items-center text-red-500 text-sm">
                                                                                      <ArrowLeft className="w-4 h-4 mr-1" /> Sai: {playerOut?.name}
                                                                                  </div>
                                                                              </div>
                                                                          </div>
                                                                          <button onClick={() => deleteEvent(selectedMatchId!, event.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                                                      </div>
                                                                  )
                                                              })
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                       </div>
                    </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Flag className="w-12 h-12 mb-2 opacity-50" />
                    <p>Selecione um jogo</p>
                 </div>
                )}
            </div>
        </div>
      )}

      {/* TRAINING VIEW */}
      {currentView === 'TRAINING' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List of Sessions */}
            <div className={`lg:col-span-1 space-y-4 ${selectedSessionId ? 'hidden lg:block' : 'block'}`}>
              <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">Sessões</h2>
                 <button 
                  onClick={() => openSessionModal()}
                  className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                 >
                   <Plus className="w-5 h-5" />
                 </button>
              </div>

              {isSessionModalOpen && (
                 <div className="bg-white p-4 rounded-lg shadow border border-emerald-100 mb-4 animate-in fade-in slide-in-from-top-2">
                   <div className="space-y-3">
                     <input type="date" className={inputClass} value={editingSession.date} onChange={e => setEditingSession({...editingSession, date: e.target.value})} />
                     <input type="time" className={inputClass} value={editingSession.time} onChange={e => setEditingSession({...editingSession, time: e.target.value})} />
                     <select className={inputClass} value={editingSession.squadId} onChange={e => setEditingSession({...editingSession, squadId: e.target.value})}>
                       <option value="">Escalão...</option>
                       {visibleSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                     <input placeholder="Descrição..." className={inputClass} value={editingSession.description} onChange={e => setEditingSession({...editingSession, description: e.target.value})} />
                     <textarea placeholder="Observações do treino..." rows={3} className={inputClass} value={editingSession.notes || ''} onChange={e => setEditingSession({...editingSession, notes: e.target.value})} />
                     <div className="flex gap-2">
                        <button onClick={() => setIsSessionModalOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded">Cancelar</button>
                        <button onClick={saveSession} className="flex-1 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Guardar</button>
                     </div>
                   </div>
                </div>
              )}

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {sessions
                  .filter(s => visibleSquads.map(sq=>sq.id).includes(s.squadId))
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(session => (
                  <div 
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`p-4 rounded-lg cursor-pointer transition border relative group ${
                      selectedSessionId === session.id 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                     <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                            className="p-1 bg-white/20 hover:bg-red-500 hover:text-white rounded text-inherit opacity-0 group-hover:opacity-100 transition"
                            title="Eliminar Treino"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); openSessionModal(session); }}
                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-inherit opacity-0 group-hover:opacity-100 transition"
                            title="Editar"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="font-bold flex justify-between">
                      <span>{session.date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${selectedSessionId === session.id ? 'bg-emerald-500' : 'bg-slate-100 text-slate-500'}`}>
                        {squads.find(s => s.id === session.squadId)?.name}
                      </span>
                    </div>
                    <div className="text-sm mt-1 opacity-90">{session.time} - {session.description}</div>
                  </div>
                ))}
                {sessions.filter(s => visibleSquads.map(sq=>sq.id).includes(s.squadId)).length === 0 && (
                     <div className="text-center p-8 text-slate-400 italic">
                         Sem treinos agendados.
                     </div>
                )}
              </div>
            </div>

            {/* Session Details (Attendance & Exercises) */}
            <div className={`lg:col-span-2 ${selectedSessionId ? 'block' : 'hidden lg:block'}`}>
               {selectedSessionId ? (
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                   {/* Mobile Back Button */}
                   <div className="lg:hidden p-2 bg-slate-100 border-b border-slate-200 flex items-center rounded-t-xl">
                       <button onClick={() => setSelectedSessionId(null)} className="flex items-center text-slate-600 font-medium px-2 py-1">
                           <ChevronLeft className="w-5 h-5 mr-1" /> Voltar à Lista
                       </button>
                   </div>
                   
                   {/* Tabs Header */}
                   <div className="flex border-b border-slate-200 bg-slate-50 lg:rounded-t-xl">
                       <button 
                        onClick={() => setActiveTrainingTab('ATTENDANCE')}
                        className={`flex-1 py-3 px-4 font-bold text-sm flex items-center justify-center transition ${activeTrainingTab === 'ATTENDANCE' ? 'bg-white text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:bg-slate-100'}`}
                       >
                           <UserCheck className="w-4 h-4 mr-2" /> Presenças
                       </button>
                       <button 
                        onClick={() => setActiveTrainingTab('EXERCISES')}
                        className={`flex-1 py-3 px-4 font-bold text-sm flex items-center justify-center transition ${activeTrainingTab === 'EXERCISES' ? 'bg-white text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:bg-slate-100'}`}
                       >
                           <Play className="w-4 h-4 mr-2" /> Exercícios
                       </button>
                   </div>
                   
                   {/* ATTENDANCE TAB */}
                   {activeTrainingTab === 'ATTENDANCE' && (
                       <div className="flex flex-col h-full overflow-hidden">
                           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                              <div className="flex items-center">
                                  <h3 className="font-bold text-slate-700 flex items-center mr-3">
                                    Registo de Presenças
                                  </h3>
                                  <div className="text-xs text-slate-500">
                                    {sessions.find(s => s.id === selectedSessionId)?.date}
                                  </div>
                              </div>
                              <button onClick={() => downloadTrainingPDF(selectedSessionId)} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded flex items-center text-xs font-bold">
                                  <FileDown className="w-4 h-4 mr-1" /> PDF
                              </button>
                           </div>
                           
                           <div className="p-2 md:p-4 overflow-y-auto flex-1">
                              {players
                                .filter(p => p.squadId === sessions.find(s => s.id === selectedSessionId)?.squadId)
                                .map(player => {
                                  const status = getAttendanceStatus(player.id, selectedSessionId);
                                  return (
                                    <div key={player.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded">
                                       <div className="flex items-center mb-2 sm:mb-0">
                                         <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 mr-3">
                                           {player.jerseyNumber}
                                         </div>
                                         <div>
                                           <div className="font-medium text-slate-800">{player.name}</div>
                                         </div>
                                       </div>
                                       <div className="flex space-x-1 justify-end">
                                          {[
                                            { s: AttendanceStatus.PRESENT, icon: Check, color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', active: 'bg-emerald-600 text-white' },
                                            { s: AttendanceStatus.ABSENT, icon: XIcon, color: 'bg-red-100 text-red-700 hover:bg-red-200', active: 'bg-red-600 text-white' },
                                            { s: AttendanceStatus.LATE, icon: Clock, color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200', active: 'bg-yellow-600 text-white' },
                                            { s: AttendanceStatus.INJURED, icon: AlertCircle, color: 'bg-orange-100 text-orange-700 hover:bg-orange-200', active: 'bg-orange-600 text-white' },
                                          ].map((opt, index) => (
                                            <button
                                              key={opt.s || index}
                                              onClick={() => toggleAttendance(player.id, selectedSessionId, opt.s)}
                                              className={`p-3 sm:p-2 rounded-lg transition flex-1 sm:flex-none justify-center items-center flex ${status === opt.s ? opt.active : opt.color}`}
                                              title={opt.s}
                                            >
                                              <opt.icon className="w-5 h-5 sm:w-4 sm:h-4" />
                                            </button>
                                          ))}
                                       </div>
                                    </div>
                                  );
                                })}
                           </div>
                       </div>
                   )}

                   {/* EXERCISES TAB */}
                   {activeTrainingTab === 'EXERCISES' && (
                       <div className="flex flex-col h-full overflow-hidden relative">
                           {/* Exercise List */}
                           <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${editingExercise ? 'hidden' : 'block'}`}>
                               <div className="flex justify-between items-center mb-4">
                                   <h3 className="font-bold text-slate-700">Plano de Treino</h3>
                                   <div className="flex gap-2">
                                       <button 
                                        onClick={() => {
                                            const exercises = sessions.find(s => s.id === selectedSessionId)?.exercises;
                                            if (exercises && exercises.length > 0) {
                                                setFullscreenExerciseId(exercises[0].id);
                                                setIsExerciseFullscreen(true);
                                            } else {
                                                alert("Adicione exercícios primeiro.");
                                            }
                                        }}
                                        className="px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center text-sm font-bold shadow-sm"
                                       >
                                           <Maximize2 className="w-4 h-4 mr-2"/> Modo Apresentação
                                       </button>
                                       <button 
                                        onClick={() => openExerciseModal()}
                                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center text-sm font-bold shadow-sm"
                                       >
                                           <Plus className="w-4 h-4 mr-2"/> Adicionar Exercício
                                       </button>
                                   </div>
                               </div>

                               {sessions.find(s => s.id === selectedSessionId)?.exercises?.length === 0 && (
                                   <div className="text-center p-8 text-slate-400 italic border-2 border-dashed border-slate-200 rounded-xl">
                                       Nenhum exercício adicionado.
                                   </div>
                               )}

                               {sessions.find(s => s.id === selectedSessionId)?.exercises?.map((exercise, idx) => (
                                   <div key={exercise.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition group">
                                       <div className="p-4 flex justify-between items-start bg-slate-50 border-b border-slate-100">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded">#{idx + 1}</span>
                                                    <h4 className="font-bold text-slate-800">{exercise.name}</h4>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {exercise.duration} min</span>
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">{exercise.type}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openExerciseModal(exercise)} className="p-2 text-blue-500 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4"/></button>
                                                <button onClick={() => deleteExercise(exercise.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                       </div>
                                       <div className="p-4">
                                           <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{exercise.description}</p>
                                           
                                           {/* Mini Tactics Board Preview */}
                                           <div className="h-48 bg-emerald-600 rounded-lg border-2 border-white shadow-inner relative overflow-hidden group-hover:scale-[1.01] transition-transform">
                                                <TacticsBoard initialData={exercise.animationData} readOnly={true} />
                                                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors pointer-events-none"/>
                                           </div>
                                       </div>
                                   </div>
                               ))}
                           </div>

                           {/* Exercise Editor (Overlay) */}
                           {isExerciseModalOpen && editingExercise && (
                               <div className="absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-bottom-4">
                                   <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                       <h3 className="font-bold text-slate-800 flex items-center">
                                           {editingExercise.id ? 'Editar Exercício' : 'Novo Exercício'}
                                       </h3>
                                       <div className="flex gap-2">
                                           <button onClick={() => setIsExerciseModalOpen(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded text-sm font-bold">Cancelar</button>
                                           <button onClick={saveExercise} className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-sm font-bold shadow-sm">Guardar</button>
                                       </div>
                                   </div>
                                   <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                           <div className="space-y-4">
                                               <div>
                                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Exercício</label>
                                                   <input 
                                                    className={inputClass} 
                                                    value={editingExercise.name} 
                                                    onChange={e => setEditingExercise({...editingExercise, name: e.target.value})}
                                                    placeholder="Ex: Rondo 4v2"
                                                   />
                                               </div>
                                               <div className="grid grid-cols-2 gap-4">
                                                   <div>
                                                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duração (min)</label>
                                                       <input 
                                                        type="number"
                                                        className={inputClass} 
                                                        value={editingExercise.duration} 
                                                        onChange={e => setEditingExercise({...editingExercise, duration: parseInt(e.target.value) || 0})}
                                                       />
                                                   </div>
                                                   <div>
                                                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                                       <select 
                                                        className={inputClass}
                                                        value={editingExercise.type}
                                                        onChange={e => setEditingExercise({...editingExercise, type: e.target.value as any})}
                                                       >
                                                           <option value="WARMUP">Aquecimento</option>
                                                           <option value="TECHNICAL">Técnico</option>
                                                           <option value="TACTICAL">Tático</option>
                                                           <option value="PHYSICAL">Físico</option>
                                                           <option value="GAME">Jogo</option>
                                                       </select>
                                                   </div>
                                               </div>
                                               <div>
                                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição / Instruções</label>
                                                   <textarea 
                                                    className={inputClass} 
                                                    rows={6}
                                                    value={editingExercise.description} 
                                                    onChange={e => setEditingExercise({...editingExercise, description: e.target.value})}
                                                    placeholder="Descreva o exercício, objetivos e regras..."
                                                   />
                                               </div>
                                           </div>
                                           
                                           <div className="flex flex-col h-[400px] md:h-auto border rounded-xl overflow-hidden shadow-sm">
                                               <div className="bg-slate-800 text-white px-3 py-2 text-xs font-bold flex justify-between items-center">
                                                   <span>Quadro Tático / Animação</span>
                                                   <span className="opacity-50">Arraste os elementos</span>
                                               </div>
                                               <div className="flex-1 bg-emerald-600 relative">
                                                   <TacticsBoard 
                                                    initialData={editingExercise.animationData} 
                                                    onSave={(data) => setEditingExercise({...editingExercise, animationData: data})}
                                                   />
                                               </div>
                                           </div>
                                       </div>
                                   </div>
                               </div>
                           )}

                           {/* Fullscreen Presentation Mode */}
                           {isExerciseFullscreen && (
                               <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col md:flex-row">
                                   {/* Sidebar List */}
                                   <div className="w-full md:w-80 bg-slate-800 border-b md:border-b-0 md:border-r border-slate-700 flex flex-col h-1/3 md:h-full">
                                       <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                                           <h3 className="text-white font-bold">Exercícios</h3>
                                           <button onClick={() => setIsExerciseFullscreen(false)} className="text-slate-400 hover:text-white"><Minimize2 className="w-5 h-5"/></button>
                                       </div>
                                       <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                           {sessions.find(s => s.id === selectedSessionId)?.exercises?.map((ex, idx) => (
                                               <button 
                                                key={ex.id}
                                                onClick={() => setFullscreenExerciseId(ex.id)}
                                                className={`w-full text-left p-3 rounded-lg transition ${fullscreenExerciseId === ex.id ? 'bg-emerald-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}`}
                                               >
                                                   <div className="text-xs opacity-70 font-bold mb-1">Exercício #{idx + 1}</div>
                                                   <div className="font-bold truncate">{ex.name}</div>
                                                   <div className="text-xs mt-1 flex gap-2 opacity-70">
                                                       <span>{ex.duration} min</span>
                                                       <span>• {ex.type}</span>
                                                   </div>
                                               </button>
                                           ))}
                                       </div>
                                   </div>
                                   
                                   {/* Main Stage */}
                                   <div className="flex-1 flex flex-col h-2/3 md:h-full bg-slate-900 relative">
                                       {fullscreenExerciseId && (() => {
                                           const ex = sessions.find(s => s.id === selectedSessionId)?.exercises?.find(e => e.id === fullscreenExerciseId);
                                           if (!ex) return null;
                                           return (
                                               <>
                                                   <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur text-white p-4 rounded-xl max-w-md pointer-events-none">
                                                       <h2 className="text-xl font-bold mb-1">{ex.name}</h2>
                                                       <p className="text-sm opacity-80 whitespace-pre-wrap">{ex.description}</p>
                                                   </div>
                                                   <div className="flex-1 p-4">
                                                       <div className="w-full h-full bg-emerald-600 rounded-xl border-4 border-slate-700 shadow-2xl overflow-hidden relative">
                                                            <TacticsBoard initialData={ex.animationData} readOnly={true} />
                                                       </div>
                                                   </div>
                                               </>
                                           )
                                       })()}
                                   </div>
                               </div>
                           )}
                       </div>
                   )}

                 </div>
               ) : (
                 <div className="h-[200px] lg:h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <CalendarDays className="w-12 h-12 mb-2 opacity-50" />
                    <p>Selecione um treino</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN VIEW - Protected by Role Check */}
      {currentView === 'ADMIN' && (currentUser?.role === UserRole.ADMIN || currentUser?.username === 'admin') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Club Settings */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                <SettingsIcon className="w-5 h-5 mr-2" /> Definições do Clube
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                  <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Logotipo do Clube</label>
                      <div className="flex gap-2 mb-2">
                          <input 
                            type="text" 
                            placeholder="URL da imagem..." 
                            className={inputClass}
                            value={clubLogoUrl}
                            onChange={(e) => {
                                const newUrl = e.target.value;
                                setClubLogoUrl(newUrl);
                                storageService.saveClubSettings({ logoUrl: newUrl });
                            }}
                          />
                      </div>
                      <div className="relative">
                          <input 
                              type="file" 
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                      if (file.size > 500000) { // 500KB limit check
                                          alert("A imagem é muito grande. Por favor use uma imagem com menos de 500KB.");
                                          return;
                                      }
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                          const base64String = reader.result as string;
                                          setClubLogoUrl(base64String);
                                          storageService.saveClubSettings({ logoUrl: base64String });
                                      };
                                      reader.readAsDataURL(file);
                                  }
                              }}
                          />
                          <button className="w-full py-2 bg-slate-100 text-slate-600 rounded border border-dashed border-slate-300 hover:bg-slate-200 flex items-center justify-center gap-2">
                              <Upload className="w-4 h-4" /> Carregar Ficheiro (Max 500KB)
                          </button>
                      </div>
                  </div>
                  {clubLogoUrl && (
                      <div className="w-16 h-16 border rounded flex items-center justify-center bg-slate-50">
                          <img src={clubLogoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                  )}
              </div>
              <p className="text-xs text-slate-500 mt-2">Este logotipo aparecerá no canto superior direito das convocatórias.</p>
           </div>

           {/* Squad Management */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                <Filter className="w-5 h-5 mr-2" /> Gestão de Escalões
              </h3>
              
              <div className="flex gap-2 mb-6">
                <input 
                  placeholder="Novo escalão (ex: Sub-13)..." 
                  className={`flex-1 ${inputClass}`}
                  value={newSquadName}
                  onChange={(e) => setNewSquadName(e.target.value)}
                />
                <button onClick={addSquad} className="px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><Plus/></button>
              </div>

              <ul className="space-y-2">
                {squads.map(s => (
                  <li key={s.id} className="flex justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 items-center">
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-500">{players.filter(p => p.squadId === s.id).length} atletas</span>
                        <button onClick={() => deleteSquad(s.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </li>
                ))}
              </ul>
           </div>

           {/* User Management */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                <UserPlus className="w-5 h-5 mr-2" /> Gestão de Utilizadores
              </h3>
              
              <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-sm font-bold text-slate-500 uppercase flex justify-between">
                    {newUser.id ? `Editar Utilizador` : 'Adicionar Novo'}
                    {newUser.id && (
                        <button onClick={cancelEditUser} className="text-xs text-red-500 flex items-center hover:underline">
                            <XIcon className="w-3 h-3 mr-1" /> Cancelar
                        </button>
                    )}
                </h4>
                <input 
                  placeholder="Nome" 
                  className={inputClass}
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
                <input 
                  placeholder="Username (Login)" 
                  className={inputClass}
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  disabled={!!newUser.id && newUser.username === 'admin'} // Protect admin username
                />
                 <input 
                  type="text"
                  placeholder={newUser.id ? "Nova Password (deixe em branco para manter)" : "Password"} 
                  className={inputClass}
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                />
                <select 
                  className={inputClass}
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                  disabled={newUser.username === 'admin'} // Cannot demote main admin
                >
                  <option value={UserRole.ADMIN}>Administrador</option>
                  <option value={UserRole.COACH}>Treinador</option>
                  <option value={UserRole.STAFF}>Staff</option>
                </select>

                {(newUser.role === UserRole.COACH || newUser.role === UserRole.STAFF) && (
                   <div className="p-2 bg-white border rounded">
                      <p className="text-xs font-semibold mb-2">Acesso a Escalões:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {squads.map(s => (
                          <label key={s.id} className="flex items-center text-sm">
                             <input 
                               type="checkbox" 
                               className="mr-2"
                               checked={newUser.allowedSquads?.includes(s.id)}
                               onChange={() => handleUserSquadChange(s.id)}
                             />
                             {s.name}
                          </label>
                        ))}
                      </div>
                   </div>
                )}

                <button onClick={saveUser} className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-900 font-medium">
                    {newUser.id ? 'Atualizar Utilizador' : 'Adicionar Utilizador'}
                </button>
              </div>

              <div className="space-y-2">
                 {users.map(u => (
                   <div key={u.id} className="p-3 border rounded-lg flex justify-between items-center group">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                            {u.name}
                            {u.username === 'admin' && <Shield className="w-3 h-3 text-emerald-600" />}
                        </div>
                        <div className="text-xs text-slate-500">@{u.username}</div>
                        {u.role !== UserRole.ADMIN && u.allowedSquads && u.allowedSquads.length > 0 && (
                          <div className="text-xs text-emerald-600 mt-1">
                             Gere: {squads.filter(s => u.allowedSquads?.includes(s.id)).map(s => s.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded">{u.role}</span>
                        <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditUser(u)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center">
                                <Edit2 className="w-3 h-3 mr-1"/> Editar
                            </button>
                            {u.username !== 'admin' && (
                                <button onClick={() => deleteUser(u.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center">
                                    <Trash2 className="w-3 h-3 mr-1"/> Eliminar
                                </button>
                            )}
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

    </Layout>
  );
};

export default App;
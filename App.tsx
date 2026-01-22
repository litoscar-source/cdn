import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, Squad, Player, TrainingSession, AttendanceRecord, ViewState, UserRole, AttendanceStatus, Match, MatchData 
} from './types';
import { storageService } from './services/storageService';
import { generateConvocationPDF, generateMatchSheetPDF, generateTrainingSessionPDF } from './services/pdfService';
import { CLUB_NAME, CLUB_LOGO_URL } from './constants';
import Layout from './components/Layout';
import PlayerForm from './components/PlayerForm';
import { 
  Plus, Search, Filter, Trash2, Edit2, Check, X as XIcon, AlertCircle, Clock, Save, UserPlus, Users, UserCircle, CalendarDays, KeyRound, Flag, Copy, FileDown, Loader2, Play, Pause, Square, Shirt, Shield, ArrowRightLeft, FileText, Move, Maximize2, Minimize2, UserMinus, UserCheck, Printer, RefreshCcw
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

  // Matches UI State
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Partial<Match>>({});
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Game Day UI State
  const [activeGameTab, setActiveGameTab] = useState<'LINEUP' | 'TACTICS' | 'LIVE'>('LINEUP');
  
  // Tactics Selection State
  const [selectedTacticsPlayerId, setSelectedTacticsPlayerId] = useState<string | null>(null);
  const [isTacticsFullscreen, setIsTacticsFullscreen] = useState(false);
  const [isLiveGameFullscreen, setIsLiveGameFullscreen] = useState(false);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  // --- TIMER LOGIC ---
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer Tick
  useEffect(() => {
    if (selectedMatchId && matches.length > 0) {
      const match = matches.find(m => m.id === selectedMatchId);
      
      // Only tick if period is active AND timer is running
      if (match?.gameData?.isTimerRunning && (match.gameData.currentPeriod === '1H' || match.gameData.currentPeriod === '2H')) {
          if (!timerRef.current) {
            timerRef.current = setInterval(() => {
                setMatches(prevMatches => {
                    return prevMatches.map(m => {
                        if (m.id === selectedMatchId && m.gameData?.isTimerRunning) {
                             const newTimer = m.gameData.timer + 1;
                             
                             // Update Minutes Played every 60s
                             const newPlayerMinutes = { ...m.gameData.playerMinutes };
                             
                             // We update minute count every 60 seconds of game time
                             if (newTimer > 0 && newTimer % 60 === 0) {
                                 m.gameData.starters.forEach(pid => {
                                     newPlayerMinutes[pid] = (newPlayerMinutes[pid] || 0) + 1;
                                 });
                             }
                             
                             return {
                                 ...m,
                                 gameData: {
                                     ...m.gameData,
                                     timer: newTimer,
                                     playerMinutes: newPlayerMinutes
                                 }
                             };
                        }
                        return m;
                    });
                });
            }, 1000); 
          }
      } else {
          if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
          }
      }
    }
  }, [selectedMatchId, matches]);

  // Initial Load & Admin Check
  useEffect(() => {
    const init = async () => {
        setIsLoading(true);
        // We need to fetch users to display the login dropdown
        let loadedUsers = await storageService.getUsers();
        
        // --- SEED DEFAULT ADMIN IF NO USERS EXIST ---
        if (loadedUsers.length === 0) {
            const defaultAdmin: User = {
                id: crypto.randomUUID(),
                name: 'Administrador',
                username: 'admin',
                role: UserRole.ADMIN,
                password: '123',
                allowedSquads: []
            };
            await storageService.saveUsers([defaultAdmin]);
            loadedUsers = [defaultAdmin];
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
        setIsLoading(false);
    };
    init();
  }, []);

  const loadData = async () => {
    // Parallel fetching for performance
    const [u, s, p, sess, att, m] = await Promise.all([
        storageService.getUsers(),
        storageService.getSquads(),
        storageService.getPlayers(),
        storageService.getSessions(),
        storageService.getAttendance(),
        storageService.getMatches()
    ]);
    
    setUsers(u);
    setSquads(s);
    setPlayers(p);
    setSessions(sess);
    setAttendance(att);
    setMatches(m);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if(!selectedLoginUserId) return;
    
    // Always re-fetch users on login attempt to ensure we have latest passwords
    const latestUsers = await storageService.getUsers();
    setUsers(latestUsers);
    
    const user = latestUsers.find(u => u.id === selectedLoginUserId);
    if (user) {
        // Strict Password Check
        if (user.password !== loginPassword) {
            setLoginError('Password incorreta.');
            return;
        }

        storageService.persistLogin(user);
        setCurrentUser(user);
        setIsLoading(true);
        await loadData();
        setIsLoading(false);
        setIsLoginView(false);
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
    if (currentUser.role === UserRole.ADMIN) return squads;
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
          location: 'Casa'
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

  const updateMatchGameData = async (matchId: string, data: Partial<MatchData>) => {
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
      if(matchToUpdate) await storageService.saveMatches([matchToUpdate]);
  };

  const toggleConvocation = async (matchId: string, playerId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    let newConvoked = [...match.convokedIds];
    let updatedGameData = match.gameData;

    if (newConvoked.includes(playerId)) {
      // Remove
      newConvoked = newConvoked.filter(id => id !== playerId);
      if (match.gameData) {
          updatedGameData = {
              ...match.gameData,
              starters: match.gameData.starters.filter(id => id !== playerId),
              startingXI: (match.gameData.startingXI || []).filter(id => id !== playerId),
              substitutes: match.gameData.substitutes.filter(id => id !== playerId)
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

  // --- TACTICS BOARD LOGIC (DRAG & DROP) ---
  const handlePointerDown = (e: React.PointerEvent, playerId: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingPlayerId(playerId);
      // Ensure player is in starters if not already
      const match = matches.find(m => m.id === selectedMatchId);
      if (match && !match.gameData?.starters.includes(playerId)) {
          const newStarters = [...(match.gameData?.starters || []), playerId];
          const newStartingXI = [...(match.gameData?.startingXI || []), playerId];
          updateMatchGameData(match.id, {
              starters: newStarters,
              startingXI: newStartingXI
          });
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!draggingPlayerId || !fieldRef.current || !selectedMatchId) return;
      
      const rect = fieldRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      const match = matches.find(m => m.id === selectedMatchId);
      if (match) {
           const currentPositions = match.gameData?.playerPositions || {};
           updateMatchGameData(selectedMatchId, {
               playerPositions: { ...currentPositions, [draggingPlayerId]: { x, y } }
           });
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setDraggingPlayerId(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Also support click-to-place for non-drag interaction
  const handleFieldClick = (e: React.MouseEvent) => {
      if (!selectedTacticsPlayerId || !selectedMatchId || !fieldRef.current) return;
      
      const rect = fieldRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const match = matches.find(m => m.id === selectedMatchId);
      if(match) {
          const currentStarters = match.gameData?.starters || [];
          let newStarters = [...currentStarters];
          if(!newStarters.includes(selectedTacticsPlayerId)) newStarters.push(selectedTacticsPlayerId);
          
          // Sync Starting XI
          const currentStartingXI = match.gameData?.startingXI || [];
          let newStartingXI = [...currentStartingXI];
          if(!newStartingXI.includes(selectedTacticsPlayerId)) newStartingXI.push(selectedTacticsPlayerId);

          updateMatchGameData(selectedMatchId, {
              starters: newStarters,
              startingXI: newStartingXI,
              playerPositions: { ...(match.gameData?.playerPositions || {}), [selectedTacticsPlayerId]: { x, y } }
          });
          setSelectedTacticsPlayerId(null);
      }
  };

  const removeStarter = (playerId: string) => {
      if (!selectedMatchId) return;
      const match = matches.find(m => m.id === selectedMatchId);
      if(!match) return;
      
      const newStarters = (match.gameData?.starters || []).filter(id => id !== playerId);
      const newStartingXI = (match.gameData?.startingXI || []).filter(id => id !== playerId);
      
      updateMatchGameData(selectedMatchId, { starters: newStarters, startingXI: newStartingXI });
  };

  // --- LIVE GAME LOGIC ---
  const handleSubstitution = (matchId: string, playerOutId: string, playerInId: string) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      const newStarters = (match.gameData?.starters || []).filter(id => id !== playerOutId);
      newStarters.push(playerInId);
      
      updateMatchGameData(matchId, { starters: newStarters });
  };

  const toggleTimer = (matchId: string) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;
      const isRunning = match.gameData?.isTimerRunning || false;
      updateMatchGameData(matchId, { isTimerRunning: !isRunning });
  };

  const setGamePeriod = (matchId: string, period: MatchData['currentPeriod']) => {
      const match = matches.find(m => m.id === matchId);
      // Reset timer to 0 when changing period
      updateMatchGameData(matchId, { currentPeriod: period, isTimerRunning: false, timer: 0 });
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
    const convokedPlayers = players.filter(p => match.convokedIds.includes(p.id));

    if (squad && convokedPlayers.length > 0) {
      setIsGeneratingPdf(true);
      try {
        await generateConvocationPDF(match, squad, convokedPlayers);
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

  const copyConvocation = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const squad = squads.find(s => s.id === match.squadId);
    const convokedPlayers = players.filter(p => match.convokedIds.includes(p.id));
    
    let text = `CONVOCATÓRIA ${squad?.name.toUpperCase()}\n`;
    text += `Vs: ${match.opponent} (${match.location})\n`;
    text += `Data: ${match.date} ${match.time}\n`;
    if(match.playerKit) text += `Equip: ${match.playerKit}\n`;
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
  const loginInputClass = "w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-900 placeholder-slate-400";

  // --- Render ---

  if (isLoginView) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h1 className="text-xl font-bold text-center text-slate-800 mb-8">{CLUB_NAME}</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Selecionar Utilizador</label>
              <select 
                className={loginInputClass}
                value={selectedLoginUserId}
                onChange={(e) => {
                    setSelectedLoginUserId(e.target.value);
                    setLoginError('');
                }}
              >
                <option value="">Selecione...</option>
                {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password"
                className={loginInputClass}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Introduza a sua password"
              />
            </div>

            {loginError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" /> {loginError}
                </div>
            )}
            
            <button className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition shadow-lg mt-4 flex justify-center items-center">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
            </button>
          </form>
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
                   .sort((a,b) => new Date(a.date).getTime() - new Date(a.date).getTime())
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
                <div className="overflow-x-auto">
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
                        <tr key={player.id} className="hover:bg-slate-50 transition">
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
                          <td className="p-4 text-right whitespace-nowrap">
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
              </div>
            </div>
          )}
        </>
      )}

      {/* MATCHES VIEW */}
      {currentView === 'MATCHES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
            <div className="lg:col-span-1 flex flex-col h-full space-y-4">
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
                     <input placeholder="Adversário" className={inputClass} value={editingMatch.opponent} onChange={e => setEditingMatch({...editingMatch, opponent: e.target.value})} />
                     <div className="grid grid-cols-2 gap-2">
                         <input placeholder="Kit Jogador" className={inputClass} value={editingMatch.playerKit || ''} onChange={e => setEditingMatch({...editingMatch, playerKit: e.target.value})} />
                         <input placeholder="Kit GR" className={inputClass} value={editingMatch.goalkeeperKit || ''} onChange={e => setEditingMatch({...editingMatch, goalkeeperKit: e.target.value})} />
                     </div>
                     <textarea placeholder="Notas / Observações de jogo..." className={inputClass} value={editingMatch.notes || ''} onChange={e => setEditingMatch({...editingMatch, notes: e.target.value})} rows={3} />
                     <select className={inputClass} value={editingMatch.location} onChange={e => setEditingMatch({...editingMatch, location: e.target.value as any})}>
                       <option value="Casa">Casa</option>
                       <option value="Fora">Fora</option>
                     </select>
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
                    <button 
                        onClick={(e) => { e.stopPropagation(); openMatchModal(match); }}
                        className="absolute top-2 right-2 p-1 bg-white/20 hover:bg-white/40 rounded text-inherit opacity-0 group-hover:opacity-100 transition"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>

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
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 h-full flex flex-col">
                {selectedMatchId ? (
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                      {/* Match Header */}
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                         <div className="flex gap-2 overflow-x-auto pb-1">
                             <button 
                                onClick={() => setActiveGameTab('LINEUP')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeGameTab === 'LINEUP' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                             >
                                 Convocatória
                             </button>
                             <button 
                                onClick={() => setActiveGameTab('TACTICS')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeGameTab === 'TACTICS' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                             >
                                 Titulares
                             </button>
                             <button 
                                onClick={() => setActiveGameTab('LIVE')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap flex items-center ${activeGameTab === 'LIVE' ? 'bg-red-600 text-white animate-pulse' : 'text-slate-600 hover:bg-slate-200'}`}
                             >
                                 <Play className="w-3 h-3 mr-1" /> Jogo
                             </button>
                         </div>
                        <div className="flex space-x-2">
                           <button onClick={() => downloadMatchSheetPDF(selectedMatchId)} title="Ficha de Jogo" className="p-2 text-slate-500 hover:bg-slate-200 rounded"><Printer className="w-4 h-4"/></button>
                           <button onClick={() => copyConvocation(selectedMatchId)} title="Copiar Convocatória" className="p-2 text-slate-500 hover:bg-slate-200 rounded"><Copy className="w-4 h-4"/></button>
                           <button onClick={() => downloadConvocationPDF(selectedMatchId)} title="PDF Convocatória" className="p-2 text-emerald-600 hover:bg-emerald-100 rounded">
                               {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
                           </button>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                          
                          {/* CONVOCATORIA TAB */}
                          {activeGameTab === 'LINEUP' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {players
                                   .filter(p => p.squadId === matches.find(m => m.id === selectedMatchId)?.squadId)
                                   .map(player => {
                                     const isSelected = matches.find(m => m.id === selectedMatchId)?.convokedIds.includes(player.id);
                                     const isStarter = matches.find(m => m.id === selectedMatchId)?.gameData?.starters.includes(player.id);
                                     
                                     return (
                                       <div 
                                         key={player.id} 
                                         onClick={() => toggleConvocation(selectedMatchId, player.id)}
                                         className={`flex flex-col p-3 rounded-lg border cursor-pointer transition relative group ${
                                           isSelected 
                                             ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                                             : 'bg-white border-slate-200 hover:border-emerald-200'
                                         }`}
                                       >
                                          <div className="flex items-center">
                                            <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                                               {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="flex-1">
                                               <div className="text-sm font-medium text-slate-800 flex justify-between items-center">
                                                   <span>{player.name}</span>
                                                   {isSelected && (
                                                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isStarter ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                          {isStarter ? 'Titular' : 'Banco'}
                                                      </span>
                                                   )}
                                               </div>
                                               <div className="text-xs text-slate-500">#{player.jerseyNumber} | {player.sportsDetails?.positions || 'S/ Pos'}</div>
                                            </div>
                                          </div>
                                          
                                          {/* Explicit Actions for Convoked Players */}
                                          {isSelected && (
                                              <div className="mt-2 pt-2 border-t border-emerald-100 flex gap-2">
                                                  <button 
                                                    onClick={(e) => toggleStarterStatus(selectedMatchId, player.id, e)}
                                                    className={`flex-1 text-xs py-1 rounded text-center transition ${isStarter ? 'bg-white border border-slate-200 text-slate-600' : 'bg-emerald-600 text-white'}`}
                                                  >
                                                      {isStarter ? 'Mover p/ Banco' : 'Definir Titular'}
                                                  </button>
                                              </div>
                                          )}
                                       </div>
                                     )
                                   })}
                             </div>
                          )}

                          {/* TACTICS / STARTERS TAB (VISUAL BOARD) */}
                          {activeGameTab === 'TACTICS' && (
                              <div className={`flex flex-col gap-4 ${isTacticsFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4' : 'h-full'}`}>
                                  <div className={`flex justify-between items-center ${isTacticsFullscreen ? 'text-white' : 'text-slate-600'}`}>
                                     <div className="text-xs font-mono">
                                       Arraste os jogadores para o campo para definir a equipa.
                                     </div>
                                     <button onClick={() => setIsTacticsFullscreen(!isTacticsFullscreen)} className="p-2 rounded hover:bg-white/10">
                                         {isTacticsFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                                     </button>
                                  </div>

                                  <div className="flex flex-col md:flex-row gap-4 h-full min-h-[500px]">
                                      {/* Bench List (Suplentes) */}
                                      <div className={`w-full md:w-1/3 bg-white border border-slate-200 rounded-lg flex flex-col ${isTacticsFullscreen ? 'bg-slate-800 border-slate-700' : ''}`}>
                                          <div className={`p-2 border-b text-xs font-bold uppercase ${isTacticsFullscreen ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-50 text-slate-500'}`}>
                                              Suplentes / Não Escalados
                                          </div>
                                          <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                               {players
                                                .filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds.includes(p.id))
                                                .filter(p => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters.includes(p.id))
                                                .map(p => (
                                                    <div 
                                                        key={p.id} 
                                                        onClick={() => setSelectedTacticsPlayerId(p.id === selectedTacticsPlayerId ? null : p.id)}
                                                        className={`flex items-center p-2 rounded cursor-pointer border ${selectedTacticsPlayerId === p.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105' : isTacticsFullscreen ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                                                    >
                                                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-2 ${selectedTacticsPlayerId === p.id ? 'bg-white text-emerald-600' : 'bg-slate-400 text-slate-800'}`}>
                                                            {p.jerseyNumber}
                                                        </span>
                                                        <span className="text-sm font-medium">{p.name}</span>
                                                    </div>
                                                ))}
                                          </div>
                                      </div>

                                      {/* Field */}
                                      <div 
                                        ref={fieldRef}
                                        className="flex-1 relative bg-emerald-600 rounded-lg border-4 border-white shadow-inner overflow-hidden select-none touch-none" 
                                        onClick={handleFieldClick}
                                        onPointerMove={handlePointerMove}
                                      >
                                           {/* Field Lines */}
                                           <div className="absolute inset-4 border-2 border-white/40 opacity-70 pointer-events-none"></div>
                                           <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/40 -translate-y-1/2 pointer-events-none"></div>
                                           <div className="absolute top-1/2 left-1/2 w-32 h-32 border-2 border-white/40 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                                           
                                           {/* Players on Field */}
                                           {matches.find(m => m.id === selectedMatchId)?.gameData?.starters.map(playerId => {
                                               const player = players.find(p => p.id === playerId);
                                               const pos = matches.find(m => m.id === selectedMatchId)?.gameData?.playerPositions?.[playerId] || {x: 50, y: 50};
                                               
                                               return (
                                                   <div 
                                                     key={playerId}
                                                     className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-move transition-transform hover:scale-110 z-10"
                                                     style={{ left: `${pos.x}%`, top: `${pos.y}%`, touchAction: 'none' }}
                                                     onPointerDown={(e) => handlePointerDown(e, playerId)}
                                                     onPointerUp={handlePointerUp}
                                                   >
                                                       <div className={`w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-bold text-white border-2 shadow-lg text-lg ${draggingPlayerId === playerId ? 'bg-yellow-500 border-white scale-125 z-50' : 'bg-red-600 border-white'}`}>
                                                           {player?.jerseyNumber}
                                                       </div>
                                                       <div className="mt-1 px-1 bg-black/50 text-white text-[10px] lg:text-xs rounded backdrop-blur-sm whitespace-nowrap">
                                                           {player?.name.split(' ')[0]}
                                                       </div>
                                                       <button 
                                                         className="absolute -top-1 -right-1 bg-white text-red-600 rounded-full p-0.5 shadow hover:scale-110 opacity-80 hover:opacity-100"
                                                         onClick={(e) => { e.stopPropagation(); removeStarter(playerId); }}
                                                         onPointerDown={(e) => e.stopPropagation()}
                                                       >
                                                           <XIcon className="w-3 h-3 lg:w-4 lg:h-4"/>
                                                       </button>
                                                   </div>
                                               )
                                           })}

                                           {/* Guide Text */}
                                           {!matches.find(m => m.id === selectedMatchId)?.gameData?.starters.length && (
                                               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                   <span className="text-white/30 text-2xl font-bold uppercase">Campo de Jogo</span>
                                               </div>
                                           )}
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* LIVE GAME TAB (FULLSCREEN OPTIMIZED) */}
                          {activeGameTab === 'LIVE' && matches.find(m => m.id === selectedMatchId) && (
                              <div className={`flex flex-col h-full space-y-4 ${isLiveGameFullscreen ? 'fixed inset-0 z-50 bg-slate-100 p-2 md:p-4' : ''}`}>
                                  {/* Scoreboard / Timer */}
                                  <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex justify-between items-center shrink-0">
                                      <div>
                                          <div className="text-xs text-slate-400 uppercase flex items-center gap-2">
                                              Tempo de Jogo
                                              {matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? 
                                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> : 
                                                <span className="w-2 h-2 rounded-full bg-slate-500"/>
                                              }
                                          </div>
                                          <div className="flex items-center gap-4">
                                              <div className={`font-mono font-bold tracking-wider text-emerald-400 ${isLiveGameFullscreen ? 'text-5xl' : 'text-4xl'}`}>
                                                  {formatTime(matches.find(m => m.id === selectedMatchId)?.gameData?.timer || 0)}
                                              </div>
                                              <button 
                                                onClick={() => toggleTimer(selectedMatchId!)}
                                                className={`rounded-full border flex items-center justify-center transition active:scale-95 ${isLiveGameFullscreen ? 'w-16 h-16' : 'p-2'} ${matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-emerald-500/20 border-emerald-500 text-emerald-500'}`}
                                              >
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? <Pause className={`${isLiveGameFullscreen ? 'w-8 h-8' : 'w-5 h-5'}`} /> : <Play className={`${isLiveGameFullscreen ? 'w-8 h-8' : 'w-5 h-5'}`} />}
                                              </button>
                                          </div>
                                      </div>
                                      
                                      <div className="flex flex-col items-end space-y-2">
                                          <button onClick={() => setIsLiveGameFullscreen(!isLiveGameFullscreen)} className="text-slate-400 hover:text-white mb-2">
                                              {isLiveGameFullscreen ? <Minimize2 className="w-6 h-6"/> : <Maximize2 className="w-6 h-6"/>}
                                          </button>
                                          <div className="flex space-x-1">
                                              {['1H', 'HT', '2H', 'FT'].map((p) => {
                                                  const current = matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod;
                                                  return (
                                                      <button 
                                                        key={p}
                                                        onClick={() => setGamePeriod(selectedMatchId, p as any)}
                                                        className={`px-3 py-2 rounded text-xs font-bold transition ${current === p ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                                      >
                                                          {p === '1H' ? '1ª' : p === 'HT' ? 'INT' : p === '2H' ? '2ª' : 'FIM'}
                                                      </button>
                                                  )
                                              })}
                                          </div>
                                      </div>
                                  </div>

                                  {/* Active Players (Starters) - Minute Tracking */}
                                  <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                                      <div className="p-3 border-b border-slate-100 bg-emerald-50 text-emerald-800 font-bold text-sm flex justify-between shrink-0">
                                          <span>Em Campo (Titulares)</span>
                                          <span>Minutos</span>
                                      </div>
                                      <div className="overflow-y-auto flex-1 p-2 space-y-2">
                                         {players
                                            .filter(p => matches.find(m => m.id === selectedMatchId)?.gameData?.starters.includes(p.id))
                                            .map(p => (
                                                <div key={p.id} className={`flex justify-between items-center border rounded-lg bg-white shadow-sm ${isLiveGameFullscreen ? 'p-4' : 'p-2'}`}>
                                                    <div className="flex items-center">
                                                        <span className={`rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold mr-3 ${isLiveGameFullscreen ? 'w-10 h-10 text-lg' : 'w-6 h-6 text-xs'}`}>{p.jerseyNumber}</span>
                                                        <span className={`font-medium text-slate-800 ${isLiveGameFullscreen ? 'text-lg' : 'text-base'}`}>{p.name}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        <span className={`font-mono font-bold text-slate-700 ${isLiveGameFullscreen ? 'text-2xl' : 'text-lg'}`}>
                                                            {matches.find(m => m.id === selectedMatchId)?.gameData?.playerMinutes?.[p.id] || 0}'
                                                        </span>
                                                        {/* Sub OUT Button - Styled as a button for better touch, using select overlay */}
                                                        <div className="relative">
                                                            <div className={`bg-red-50 text-red-700 border border-red-200 rounded flex items-center justify-center font-medium ${isLiveGameFullscreen ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs'}`}>
                                                                <ArrowRightLeft className={`mr-1 ${isLiveGameFullscreen ? 'w-4 h-4' : 'w-3 h-3'}`} /> Sair
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
                                                                {/* Only show convoked players NOT on field */}
                                                                {players
                                                                    .filter(sub => matches.find(m => m.id === selectedMatchId)?.convokedIds.includes(sub.id))
                                                                    .filter(sub => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters.includes(sub.id))
                                                                    .map(sub => (
                                                                        <option key={sub.id} value={sub.id}>Entra: #{sub.jerseyNumber} {sub.name}</option>
                                                                    ))
                                                                }
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                      </div>
                                  </div>

                                   {/* Bench - Logic: Convoked MINUS Starters */}
                                   <div className={`bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col shrink-0 ${isLiveGameFullscreen ? 'h-1/4' : 'h-1/3'}`}>
                                      <div className="p-2 border-b border-slate-200 text-slate-500 font-bold text-xs">Banco (Suplentes)</div>
                                      <div className="overflow-y-auto p-2 space-y-1">
                                          {players
                                            .filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds.includes(p.id))
                                            .filter(p => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters.includes(p.id))
                                            .map(p => (
                                                <div key={p.id} className={`flex justify-between bg-white border rounded items-center ${isLiveGameFullscreen ? 'p-3' : 'p-2'}`}>
                                                    <span className={`${isLiveGameFullscreen ? 'text-base' : 'text-sm'}`}>{p.jerseyNumber}. {p.name}</span>
                                                    
                                                    {/* Quick Sub IN Logic */}
                                                    <div className="relative">
                                                         <div className={`bg-emerald-50 text-emerald-700 border border-emerald-200 rounded flex items-center justify-center font-medium ${isLiveGameFullscreen ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs'}`}>
                                                            <ArrowRightLeft className={`mr-1 ${isLiveGameFullscreen ? 'w-4 h-4' : 'w-3 h-3'}`} /> Entrar
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
                                                            {matches.find(m => m.id === selectedMatchId)?.gameData?.starters.map(starterId => {
                                                                const starter = players.find(sp => sp.id === starterId);
                                                                return <option key={starterId} value={starterId}>Sai: #{starter?.jerseyNumber} {starter?.name}</option>
                                                            })}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                      </div>
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
            <div className="lg:col-span-1 space-y-4">
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
                     <button 
                        onClick={(e) => { e.stopPropagation(); openSessionModal(session); }}
                        className="absolute top-2 right-2 p-1 bg-white/20 hover:bg-white/40 rounded text-inherit opacity-0 group-hover:opacity-100 transition"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>

                    <div className="font-bold flex justify-between">
                      <span>{session.date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${selectedSessionId === session.id ? 'bg-emerald-500' : 'bg-slate-100 text-slate-500'}`}>
                        {squads.find(s => s.id === session.squadId)?.name}
                      </span>
                    </div>
                    <div className="text-sm mt-1 opacity-90">{session.time} - {session.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Sheet */}
            <div className="lg:col-span-2">
               {selectedSessionId ? (
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                   <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                      <div className="flex items-center">
                          <h3 className="font-bold text-slate-700 flex items-center mr-3">
                            <UserCircle className="w-5 h-5 mr-2 text-emerald-600" />
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
                                  ].map((opt) => (
                                    <button
                                      key={opt.s}
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
      {currentView === 'ADMIN' && currentUser?.role === UserRole.ADMIN && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
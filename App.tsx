import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, Squad, Player, TrainingSession, AttendanceRecord, ViewState, UserRole, AttendanceStatus, Match, MatchData, MatchEvent 
} from './types';
import { storageService } from './services/storageService';
import { generateConvocationPDF, generateMatchSheetPDF, generateTrainingSessionPDF } from './services/pdfService';
import { CLUB_NAME, CLUB_LOGO_URL } from './constants';
import Layout from './components/Layout';
import PlayerForm from './components/PlayerForm';
import { 
  Plus, Search, Filter, Trash2, Edit2, Check, X as XIcon, AlertCircle, Clock, Save, UserPlus, Users, UserCircle, CalendarDays, KeyRound, Flag, Copy, FileDown, Loader2, Play, Pause, Square, Shirt, Shield, ArrowRightLeft, FileText, Move, Maximize2, Minimize2, UserMinus, UserCheck, Printer, RefreshCcw, Trophy, Minus, PlusCircle, RotateCcw, Smartphone
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
  const [mobileLiveTab, setMobileLiveTab] = useState<'FIELD' | 'BENCH'>('FIELD');
  
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

  const deleteSession = async (id: string) => {
      if(confirm('Eliminar esta sessão de treino? Os registos de presença serão perdidos.')) {
          const updated = sessions.filter(s => s.id !== id);
          setSessions(updated);
          if (selectedSessionId === id) setSelectedSessionId(null);
          await storageService.deleteSession(id);
      }
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

  // --- TACTICS BOARD LOGIC (DRAG & DROP) ---
  const handlePointerDown = (e: React.PointerEvent, playerId: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingPlayerId(playerId);
      // Ensure player is in starters if not already
      const match = matches.find(m => m.id === selectedMatchId);
      if (match && !match.gameData?.starters?.includes(playerId)) {
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
      
      // We could also record an event here
      const minute = Math.ceil((match.gameData?.timer || 0) / 60);
      const subEvent: MatchEvent = {
          type: 'SUBSTITUTION',
          minute,
          playerId: playerInId,
          playerOutId: playerOutId
      };
      const newEvents = [...(match.gameData?.events || []), subEvent];
      
      updateMatchGameData(matchId, { starters: newStarters, events: newEvents });
  };

  const toggleTimer = (matchId: string) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;
      const isRunning = match.gameData?.isTimerRunning || false;
      updateMatchGameData(matchId, { isTimerRunning: !isRunning });
  };

  const setGamePeriod = (matchId: string, period: MatchData['currentPeriod']) => {
      const match = matches.find(m => m.id === matchId);
      if(!match) return;

      // Smart Logic: Stop timer on HT or FT, Reset timer on new periods
      const shouldStop = period === 'HT' || period === 'FT';
      
      updateMatchGameData(matchId, { 
          currentPeriod: period, 
          isTimerRunning: false, 
          timer: 0 
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
              type: 'GOAL',
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
              type: 'GOAL',
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
                                     const isSelected = matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(player.id);
                                     const isStarter = matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(player.id);
                                     
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
                                                .filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id))
                                                .filter(p => !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id))
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
                                           {matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.map(playerId => {
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
                                           {!matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.length && (
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
                              <div className={`flex flex-col h-full space-y-3 ${isLiveGameFullscreen ? 'fixed inset-0 z-50 bg-slate-100 p-0 md:p-4' : ''}`}>
                                  {/* Scoreboard / Timer */}
                                  <div className="bg-slate-900 text-white md:rounded-xl shadow-lg flex flex-col shrink-0 overflow-hidden relative">
                                      {/* Floating Fullscreen Button */}
                                      <button 
                                        onClick={() => setIsLiveGameFullscreen(!isLiveGameFullscreen)} 
                                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"
                                        title={isLiveGameFullscreen ? "Sair de Ecrã Inteiro" : "Ecrã Inteiro"}
                                      >
                                          {isLiveGameFullscreen ? <Minimize2 className="w-5 h-5"/> : <Maximize2 className="w-5 h-5"/>}
                                      </button>

                                      {/* Top Section: Score & Timer */}
                                      <div className="p-3 pt-8 md:pt-4 flex flex-col items-center gap-3">
                                          {/* Timer Display */}
                                          <div className="flex items-center gap-3 bg-black/30 px-4 py-1 rounded-full border border-white/10">
                                              {matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? 
                                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"/> : 
                                                <span className="w-2 h-2 rounded-full bg-slate-500"/>
                                              }
                                              <span className="font-mono font-bold tracking-widest text-2xl md:text-3xl text-white tabular-nums">
                                                  {formatTime(matches.find(m => m.id === selectedMatchId)?.gameData?.timer || 0)}
                                              </span>
                                               <button 
                                                onClick={() => toggleTimer(selectedMatchId!)}
                                                className={`ml-2 p-1 rounded-full flex items-center justify-center transition active:scale-95 ${matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? 'bg-yellow-500 text-slate-900' : 'bg-emerald-600 text-white'}`}
                                              >
                                                  {matches.find(m => m.id === selectedMatchId)?.gameData?.isTimerRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
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
                                          {['1H', 'HT', '2H', 'FT'].map((p) => {
                                              const current = matches.find(m => m.id === selectedMatchId)?.gameData?.currentPeriod;
                                              const isActive = current === p;
                                              return (
                                                  <button 
                                                    key={p}
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

                                  {/* Mobile Tabs Switcher */}
                                  <div className="flex md:hidden bg-slate-200 p-1 rounded-lg mx-2 shrink-0 shadow-inner">
                                      <button 
                                        onClick={() => setMobileLiveTab('FIELD')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition flex items-center justify-center gap-2 ${mobileLiveTab === 'FIELD' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
                                      >
                                          <Shirt className="w-4 h-4" />
                                          EM CAMPO ({players.filter(p => matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id)).length})
                                      </button>
                                      <button 
                                        onClick={() => setMobileLiveTab('BENCH')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition flex items-center justify-center gap-2 ${mobileLiveTab === 'BENCH' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
                                      >
                                          <UserCheck className="w-4 h-4" />
                                          SUPLENTES ({players.filter(p => matches.find(m => m.id === selectedMatchId)?.convokedIds?.includes(p.id) && !matches.find(m => m.id === selectedMatchId)?.gameData?.starters?.includes(p.id)).length})
                                      </button>
                                  </div>

                                  {/* Main Content Area - Split View on Desktop, Tabbed on Mobile */}
                                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 px-2 md:px-0 pb-2">
                                      
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
                                                        <span className="text-slate-800 font-medium text-base">
                                                            <b className="mr-2 text-slate-500">#{p.jerseyNumber}</b> {p.name}
                                                        </span>
                                                        
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

    </Layout>
  );
};

export default App;
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Squad, Player, TrainingSession, AttendanceRecord, ViewState, UserRole, AttendanceStatus, Match 
} from './types';
import { storageService } from './services/storageService';
import { generateTrainingPlan } from './services/geminiService';
import Layout from './components/Layout';
import PlayerForm from './components/PlayerForm';
import { 
  Plus, Search, Filter, Trash2, Edit2, Check, X as XIcon, AlertCircle, Clock, Save, BrainCircuit, UserPlus, Shield, Users, UserCircle, CalendarDays, KeyRound, Flag, Copy, MapPin, FileText
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
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [editingPlayer, setEditingPlayer] = useState<Player | null | undefined>(undefined); 
  const [selectedSquadFilter, setSelectedSquadFilter] = useState<string>('all');
  
  // Training/Attendance UI State
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionData, setNewSessionData] = useState<Partial<TrainingSession>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Matches UI State
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [newMatchData, setNewMatchData] = useState<Partial<Match>>({});
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // AI State
  const [aiPromptData, setAiPromptData] = useState({ focus: '', duration: 90, squadId: '' });
  const [aiResponse, setAiResponse] = useState<string>('');

  // Initial Load
  useEffect(() => {
    const user = storageService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setIsLoginView(false);
      loadData();
    }
  }, []);

  const loadData = () => {
    setUsers(storageService.getUsers());
    setSquads(storageService.getSquads());
    setPlayers(storageService.getPlayers());
    setSessions(storageService.getSessions());
    setAttendance(storageService.getAttendance());
    setMatches(storageService.getMatches());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = storageService.login(loginUsername, loginPassword);
    if (user) {
      setCurrentUser(user);
      setIsLoginView(false);
      loadData();
    } else {
      alert("Credenciais inválidas.");
    }
  };

  const handleLogout = () => {
    storageService.logout();
    setCurrentUser(null);
    setIsLoginView(true);
    setLoginUsername('');
    setLoginPassword('');
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
  const savePlayer = (player: Player) => {
    let updatedPlayers;
    if (players.find(p => p.id === player.id)) {
      updatedPlayers = players.map(p => p.id === player.id ? player : p);
    } else {
      updatedPlayers = [...players, player];
    }
    setPlayers(updatedPlayers);
    storageService.savePlayers(updatedPlayers);
    setEditingPlayer(undefined);
  };

  const deletePlayer = (id: string) => {
    if (confirm("Tem a certeza que deseja eliminar este atleta?")) {
      const updated = players.filter(p => p.id !== id);
      setPlayers(updated);
      storageService.savePlayers(updated);
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
  const createSession = () => {
    if (!newSessionData.date || !newSessionData.squadId) return;
    const session: TrainingSession = {
      id: crypto.randomUUID(),
      date: newSessionData.date!,
      squadId: newSessionData.squadId!,
      time: newSessionData.time || '19:00',
      description: newSessionData.description || 'Treino'
    };
    const updatedSessions = [...sessions, session];
    setSessions(updatedSessions);
    storageService.saveSessions(updatedSessions);
    setIsCreatingSession(false);
    setNewSessionData({});
  };

  const toggleAttendance = (playerId: string, sessionId: string, status: AttendanceStatus) => {
    const existingIndex = attendance.findIndex(a => a.playerId === playerId && a.sessionId === sessionId);
    let newAttendance = [...attendance];
    if (existingIndex >= 0) {
      if (newAttendance[existingIndex].status === status) {
        newAttendance.splice(existingIndex, 1); 
      } else {
        newAttendance[existingIndex].status = status;
      }
    } else {
      newAttendance.push({ id: crypto.randomUUID(), playerId, sessionId, status });
    }
    setAttendance(newAttendance);
    storageService.saveAttendance(newAttendance);
  };

  const getAttendanceStatus = (playerId: string, sessionId: string | null) => {
    if (!sessionId) return undefined;
    const record = attendance.find(a => a.playerId === playerId && a.sessionId === sessionId);
    return record?.status;
  };

  // --- Logic for Matches (Convocatórias) ---
  const createMatch = () => {
    if (!newMatchData.date || !newMatchData.squadId || !newMatchData.opponent) return;
    const match: Match = {
      id: crypto.randomUUID(),
      squadId: newMatchData.squadId!,
      date: newMatchData.date!,
      time: newMatchData.time || '15:00',
      opponent: newMatchData.opponent!,
      location: newMatchData.location as 'Casa' | 'Fora' || 'Casa',
      convokedIds: []
    };
    const updated = [...matches, match];
    setMatches(updated);
    storageService.saveMatches(updated);
    setIsCreatingMatch(false);
    setNewMatchData({});
  };

  const toggleConvocation = (matchId: string, playerId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    let newConvoked = [...match.convokedIds];
    if (newConvoked.includes(playerId)) {
      newConvoked = newConvoked.filter(id => id !== playerId);
    } else {
      newConvoked.push(playerId);
    }

    const updatedMatches = matches.map(m => m.id === matchId ? { ...m, convokedIds: newConvoked } : m);
    setMatches(updatedMatches);
    storageService.saveMatches(updatedMatches);
  };

  const copyConvocation = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const squad = squads.find(s => s.id === match.squadId);
    const convokedPlayers = players.filter(p => match.convokedIds.includes(p.id));
    
    let text = `CONVOCATÓRIA ${squad?.name.toUpperCase()}\n`;
    text += `Vs: ${match.opponent} (${match.location})\n`;
    text += `Data: ${match.date} ${match.time}\n\n`;
    text += `ATLETAS:\n`;
    convokedPlayers.forEach(p => {
      text += `- ${p.name} (${p.jerseyNumber})\n`;
    });
    
    navigator.clipboard.writeText(text);
    alert("Convocatória copiada!");
  };

  // --- Weekly Stats Logic ---
  const weeklyStats = useMemo(() => {
    // Determine start/end of current week
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const weekSessions = sessions.filter(s => {
      const d = new Date(s.date);
      return d >= startOfWeek && d <= endOfWeek && visibleSquads.map(sq=>sq.id).includes(s.squadId);
    });
    const sessionIds = weekSessions.map(s => s.id);
    const weekAttendance = attendance.filter(a => sessionIds.includes(a.sessionId));
    
    return {
      absent: weekAttendance.filter(a => a.status === AttendanceStatus.ABSENT).length,
      late: weekAttendance.filter(a => a.status === AttendanceStatus.LATE).length,
      injured: weekAttendance.filter(a => a.status === AttendanceStatus.INJURED).length
    };
  }, [sessions, attendance, visibleSquads]);

  // --- Logic for Admin ---
  const [newUser, setNewUser] = useState<Partial<User>>({ role: UserRole.STAFF, name: '', username: '', allowedSquads: [] });
  
  const handleUserSquadChange = (squadId: string) => {
    let current = newUser.allowedSquads || [];
    if (current.includes(squadId)) {
      current = current.filter(id => id !== squadId);
    } else {
      current = [...current, squadId];
    }
    setNewUser({ ...newUser, allowedSquads: current });
  };

  const addUser = () => {
    if (!newUser.name || !newUser.username) return;
    const u: User = {
      id: crypto.randomUUID(),
      name: newUser.name!,
      username: newUser.username!,
      role: newUser.role || UserRole.STAFF,
      password: '123',
      allowedSquads: newUser.allowedSquads
    };
    const updated = [...users, u];
    setUsers(updated);
    storageService.saveUsers(updated);
    setNewUser({ role: UserRole.STAFF, name: '', username: '', allowedSquads: [] });
  };

  const resetPassword = (userId: string) => {
    const updated = users.map(u => u.id === userId ? { ...u, password: '123' } : u);
    setUsers(updated);
    storageService.saveUsers(updated);
    alert("Password reposta para '123'.");
  };
  
  const [newSquadName, setNewSquadName] = useState('');
  const addSquad = () => {
    if(!newSquadName) return;
    const s: Squad = { id: crypto.randomUUID(), name: newSquadName };
    const updated = [...squads, s];
    setSquads(updated);
    storageService.saveSquads(updated);
    setNewSquadName('');
  }

  // Common Input Class
  const inputClass = "w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900 placeholder-slate-400";
  const loginInputClass = "w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-900 placeholder-slate-400";

  // --- Render ---

  if (isLoginView) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex justify-center mb-6">
             <div className="bg-emerald-600 p-3 rounded-xl">
               <Shield className="w-8 h-8 text-white" />
             </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">CDN Team Manager</h1>
          <p className="text-center text-slate-500 mb-8">Gestão Profissional</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input 
                type="text" 
                className={loginInputClass}
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Ex: admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                className={loginInputClass}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="********"
              />
            </div>
            <button className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition shadow-lg">
              Entrar
            </button>
            <div className="text-xs text-center text-slate-400 mt-4">
              Demo: admin / 123
            </div>
          </form>
        </div>
      </div>
    );
  }

  // AI Handler
  const handleAiGenerate = async () => {
    setIsLoading(true);
    setAiResponse('');
    const squad = squads.find(s => s.id === aiPromptData.squadId);
    if (!squad) { alert("Selecione um escalão."); setIsLoading(false); return; }
    const playerCount = players.filter(p => p.squadId === squad.id).length;
    const plan = await generateTrainingPlan(squad, aiPromptData.focus, aiPromptData.duration, playerCount);
    setAiResponse(plan);
    setIsLoading(false);
  };

  return (
    <Layout user={currentUser!} currentView={currentView} onNavigate={setCurrentView} onLogout={handleLogout}>
      
      {/* DASHBOARD VIEW */}
      {currentView === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-slate-500 text-sm font-medium mb-1">Meus Atletas</h3>
              <p className="text-2xl md:text-3xl font-bold text-slate-800">{visiblePlayers.length}</p>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="text-slate-500 text-sm font-medium mb-1">Faltas (Semana)</h3>
               <p className="text-2xl md:text-3xl font-bold text-red-600">{weeklyStats.absent}</p>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="text-slate-500 text-sm font-medium mb-1">Atrasos (Semana)</h3>
               <p className="text-2xl md:text-3xl font-bold text-yellow-600">{weeklyStats.late}</p>
            </div>
             <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="text-slate-500 text-sm font-medium mb-1">Lesionados</h3>
               <p className="text-2xl md:text-3xl font-bold text-orange-600">{weeklyStats.injured}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h3 className="text-lg font-bold text-slate-800 mb-4">Próximos Treinos (Meus Escalões)</h3>
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
                        <th className="p-4 font-semibold text-slate-600 text-sm hidden lg:table-cell">Emergência</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPlayers.map(player => (
                        <tr key={player.id} className="hover:bg-slate-50 transition">
                           <td className="p-4 text-slate-500 font-mono">{player.jerseyNumber}</td>
                          <td className="p-4">
                            <div className="font-medium text-slate-900">{player.name}</div>
                            <div className="text-xs text-slate-500 md:hidden">{squads.find(s => s.id === player.squadId)?.name}</div>
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
                            {player.emergencyName && (
                              <div>
                                <span className="font-medium">{player.emergencyName}</span>
                                <div className="text-xs text-slate-400">{player.emergencyContact}</div>
                              </div>
                            )}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
                 <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">Jogos</h2>
                 <button 
                  onClick={() => setIsCreatingMatch(!isCreatingMatch)}
                  className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                 >
                   <Plus className="w-5 h-5" />
                 </button>
              </div>

              {isCreatingMatch && (
                <div className="bg-white p-4 rounded-lg shadow border border-emerald-100 mb-4 animate-in fade-in slide-in-from-top-2">
                   <div className="space-y-3">
                     <input type="date" className={inputClass} onChange={e => setNewMatchData({...newMatchData, date: e.target.value})} />
                     <input type="time" className={inputClass} defaultValue="15:00" onChange={e => setNewMatchData({...newMatchData, time: e.target.value})} />
                     <input placeholder="Adversário" className={inputClass} onChange={e => setNewMatchData({...newMatchData, opponent: e.target.value})} />
                     <select className={inputClass} onChange={e => setNewMatchData({...newMatchData, location: e.target.value as any})}>
                       <option value="Casa">Casa</option>
                       <option value="Fora">Fora</option>
                     </select>
                     <select className={inputClass} onChange={e => setNewMatchData({...newMatchData, squadId: e.target.value})}>
                       <option value="">Escalão...</option>
                       {visibleSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                     <button onClick={createMatch} className="w-full py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Criar Jogo</button>
                   </div>
                </div>
              )}

              <div className="space-y-2 lg:h-[500px] overflow-y-auto">
                {matches
                  .filter(m => visibleSquads.map(s => s.id).includes(m.squadId))
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(match => (
                  <div 
                    key={match.id}
                    onClick={() => setSelectedMatchId(match.id)}
                    className={`p-4 rounded-lg cursor-pointer transition border ${
                      selectedMatchId === match.id 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
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
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
                {selectedMatchId ? (
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <div className="flex items-center">
                            <Flag className="w-5 h-5 mr-2 text-emerald-600" />
                            <h3 className="font-bold text-slate-700">Convocatória</h3>
                        </div>
                        <button onClick={() => copyConvocation(selectedMatchId)} className="flex items-center text-xs bg-white border px-2 py-1 rounded hover:bg-slate-50 text-slate-600">
                           <Copy className="w-3 h-3 mr-1"/> <span className="hidden sm:inline">Copiar Texto</span>
                        </button>
                      </div>
                      <div className="p-4 overflow-y-auto flex-1">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {players
                               .filter(p => p.squadId === matches.find(m => m.id === selectedMatchId)?.squadId)
                               .map(player => {
                                 const isSelected = matches.find(m => m.id === selectedMatchId)?.convokedIds.includes(player.id);
                                 return (
                                   <div 
                                     key={player.id} 
                                     onClick={() => toggleConvocation(selectedMatchId, player.id)}
                                     className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                                       isSelected 
                                         ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                                         : 'bg-white border-slate-200 hover:border-emerald-200'
                                     }`}
                                   >
                                      <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                                         {isSelected && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <div className="flex-1">
                                         <div className="text-sm font-medium text-slate-800">{player.name}</div>
                                         <div className="text-xs text-slate-500">#{player.jerseyNumber}</div>
                                      </div>
                                   </div>
                                 )
                               })}
                         </div>
                      </div>
                      <div className="p-4 border-t border-slate-100 text-xs text-slate-500 text-right">
                         Total Convocados: {matches.find(m => m.id === selectedMatchId)?.convokedIds.length}
                      </div>
                   </div>
                ) : (
                  <div className="h-[200px] lg:h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Flag className="w-12 h-12 mb-2 opacity-50" />
                    <p>Selecione um jogo</p>
                 </div>
                )}
            </div>
        </div>
      )}

      {/* TRAINING & ATTENDANCE VIEW */}
      {currentView === 'TRAINING' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List of Sessions */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800">Sessões</h2>
                 <button 
                  onClick={() => setIsCreatingSession(!isCreatingSession)}
                  className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                 >
                   <Plus className="w-5 h-5" />
                 </button>
              </div>

              {isCreatingSession && (
                <div className="bg-white p-4 rounded-lg shadow border border-emerald-100 mb-4 animate-in fade-in slide-in-from-top-2">
                   <div className="space-y-3">
                     <input type="date" className={inputClass} onChange={e => setNewSessionData({...newSessionData, date: e.target.value})} />
                     <input type="time" className={inputClass} defaultValue="19:00" onChange={e => setNewSessionData({...newSessionData, time: e.target.value})} />
                     <select className={inputClass} onChange={e => setNewSessionData({...newSessionData, squadId: e.target.value})}>
                       <option value="">Escalão...</option>
                       {visibleSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                     <input placeholder="Descrição..." className={inputClass} onChange={e => setNewSessionData({...newSessionData, description: e.target.value})} />
                     <button onClick={createSession} className="w-full py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Criar Treino</button>
                   </div>
                </div>
              )}

              <div className="space-y-2 max-h-[300px] lg:max-h-[500px] overflow-y-auto">
                {sessions
                  .filter(s => visibleSquads.map(sq=>sq.id).includes(s.squadId))
                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(session => (
                  <div 
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`p-4 rounded-lg cursor-pointer transition border ${
                      selectedSessionId === session.id 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
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
                      <h3 className="font-bold text-slate-700 flex items-center">
                        <UserCircle className="w-5 h-5 mr-2 text-emerald-600" />
                        Registo de Presenças
                      </h3>
                      <div className="text-xs text-slate-500">
                        {sessions.find(s => s.id === selectedSessionId)?.date}
                      </div>
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

      {/* AI ASSISTANT VIEW */}
      {currentView === 'AI_ASSISTANT' && (
        <div className="max-w-4xl mx-auto space-y-6">
           <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 rounded-2xl shadow-lg text-white">
              <h2 className="text-2xl font-bold flex items-center mb-2">
                <BrainCircuit className="w-8 h-8 mr-3" />
                Assistente de Treino IA
              </h2>
              <p className="opacity-90 max-w-xl">
                Gere planos de treino completos adaptados ao seu escalão, número de jogadores e foco técnico/tático em segundos.
              </p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-800 mb-4">Configuração</h3>
                    
                    <div className="space-y-4">
                       <div>
                         <label className="block text-sm font-medium text-slate-600 mb-1">Escalão</label>
                         <select 
                            className={inputClass}
                            value={aiPromptData.squadId}
                            onChange={(e) => setAiPromptData({...aiPromptData, squadId: e.target.value})}
                         >
                           <option value="">Selecione...</option>
                           {visibleSquads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                         </select>
                       </div>

                       <div>
                         <label className="block text-sm font-medium text-slate-600 mb-1">Foco do Treino</label>
                         <input 
                            placeholder="Ex: Finalização..."
                            className={inputClass}
                            value={aiPromptData.focus}
                            onChange={(e) => setAiPromptData({...aiPromptData, focus: e.target.value})}
                         />
                       </div>

                       <div>
                         <label className="block text-sm font-medium text-slate-600 mb-1">Duração (Min)</label>
                         <input 
                            type="number"
                            className={inputClass}
                            value={aiPromptData.duration}
                            onChange={(e) => setAiPromptData({...aiPromptData, duration: parseInt(e.target.value)})}
                         />
                       </div>

                       <button 
                         onClick={handleAiGenerate}
                         disabled={isLoading}
                         className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex justify-center items-center font-medium disabled:opacity-50"
                       >
                         {isLoading ? 'A Gerar...' : 'Gerar Plano'}
                       </button>
                    </div>
                 </div>
              </div>

              <div className="md:col-span-2">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
                   {aiResponse ? (
                     <div className="prose prose-emerald max-w-none">
                       <pre className="whitespace-pre-wrap font-sans text-slate-700">{aiResponse}</pre>
                     </div>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400">
                       <BrainCircuit className="w-16 h-16 mb-4 opacity-20" />
                       <p>Configure e clique em "Gerar Plano" para ver a sugestão da IA.</p>
                     </div>
                   )}
                </div>
              </div>
           </div>
        </div>
      )}

      {/* ADMIN VIEW */}
      {currentView === 'ADMIN' && (
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
                    <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-500">{players.filter(p => p.squadId === s.id).length} atletas</span>
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
                <h4 className="text-sm font-bold text-slate-500 uppercase">Adicionar Novo</h4>
                <input 
                  placeholder="Nome" 
                  className={inputClass}
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
                <input 
                  placeholder="Username" 
                  className={inputClass}
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                />
                <select 
                  className={inputClass}
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
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

                <button onClick={addUser} className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-900 font-medium">Adicionar Utilizador</button>
              </div>

              <div className="space-y-2">
                 {users.map(u => (
                   <div key={u.id} className="p-3 border rounded-lg flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800">{u.name}</div>
                        <div className="text-xs text-slate-500">@{u.username}</div>
                        {u.role !== UserRole.ADMIN && u.allowedSquads && u.allowedSquads.length > 0 && (
                          <div className="text-xs text-emerald-600 mt-1">
                             Gere: {squads.filter(s => u.allowedSquads?.includes(s.id)).map(s => s.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded">{u.role}</span>
                        <button 
                           onClick={() => resetPassword(u.id)}
                           className="text-xs text-blue-500 hover:text-blue-700 underline flex items-center"
                        >
                           <KeyRound className="w-3 h-3 mr-1"/> Reset PW
                        </button>
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
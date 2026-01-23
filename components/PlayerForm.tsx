import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Player, Squad, Match } from '../types';
import { Save, X, Activity, User as UserIcon, BarChart3, Camera, Upload } from 'lucide-react';

interface PlayerFormProps {
  player?: Player | null; // null means new player
  squads: Squad[];
  matches?: Match[]; // Optional for new players
  onSave: (player: Player) => void;
  onCancel: () => void;
}

const PlayerForm: React.FC<PlayerFormProps> = ({ player, squads, matches = [], onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'INFO' | 'SPORTS' | 'STATS'>('INFO');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<Partial<Player>>({
    name: '',
    squadId: squads[0]?.id || '',
    address: '',
    birthDate: '',
    jerseyNumber: '',
    jerseyName: '',
    kitSize: 'M',
    tracksuitSize: 'M',
    notes: '',
    photoUrl: '',
    emergencyName: '',
    emergencyContact: '',
    sportsDetails: {
        technique: 50,
        speed: 50,
        tactical: 50,
        physical: 50,
        behavior: '',
        strongFoot: 'Direito',
        positions: ''
    }
  });

  useEffect(() => {
    if (player) {
      setFormData(player);
    }
  }, [player]);

  // Calculate Statistics
  const playerStats = useMemo(() => {
    if (!player) return null;

    let totalMatches = 0;
    let totalConvocations = 0;
    let totalStarts = 0;
    let totalBenchStarts = 0;
    let totalMinutes = 0;
    
    const matchHistory = matches
        .filter(m => m.convokedIds?.includes(player.id))
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(m => {
            const minutes = m.gameData?.playerMinutes?.[player.id] || 0;
            const wasStarter = m.gameData?.startingXI 
                ? m.gameData.startingXI.includes(player.id)
                : m.gameData?.starters?.includes(player.id);
            
            return {
                id: m.id,
                date: m.date,
                opponent: m.opponent,
                minutes,
                wasStarter,
                wasBench: !wasStarter
            };
        });

    matchHistory.forEach(h => {
        totalConvocations++;
        if (h.wasStarter) totalStarts++;
        else totalBenchStarts++;
        totalMinutes += h.minutes;
        if (h.minutes > 0) totalMatches++;
    });

    return {
        totalMatches,
        totalConvocations,
        totalStarts,
        totalBenchStarts,
        totalMinutes,
        history: matchHistory
    };
  }, [player, matches]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.squadId) {
      alert("Por favor preencha o nome e o escalão.");
      return;
    }
    
    const newPlayer: Player = {
      id: player?.id || crypto.randomUUID(),
      ...formData as Player,
      jerseyNumber: Number(formData.jerseyNumber)
    };
    onSave(newPlayer);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatsChange = (field: string, value: any) => {
     setFormData(prev => ({
         ...prev,
         sportsDetails: {
             ...prev.sportsDetails!,
             [field]: value
         }
     }));
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // Simple size check (max 1MB to avoid localStorage issues)
          if (file.size > 1024 * 1024) {
              alert("A imagem é demasiado grande. Por favor escolha uma imagem menor que 1MB.");
              return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const triggerFileInput = () => {
      fileInputRef.current?.click();
  };

  const inputClasses = "w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900 placeholder-slate-400";

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col h-full max-h-[85vh]">
      <div className="flex justify-between items-center p-6 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">
          {player ? 'Editar Atleta' : 'Novo Atleta'}
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('INFO')}
            className={`flex-1 min-w-[120px] py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'INFO' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
             <UserIcon className="w-4 h-4 mr-2" /> Dados Pessoais
          </button>
          <button 
            onClick={() => setActiveTab('SPORTS')}
            className={`flex-1 min-w-[120px] py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'SPORTS' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
             <Activity className="w-4 h-4 mr-2" /> Ficha Desportiva
          </button>
          {player && (
             <button 
                onClick={() => setActiveTab('STATS')}
                className={`flex-1 min-w-[120px] py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'STATS' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <BarChart3 className="w-4 h-4 mr-2" /> Estatísticas
             </button>
          )}
      </div>

      <div className="overflow-y-auto p-6 flex-1">
      <form id="playerForm" onSubmit={handleSubmit} className="space-y-4">
        
        {activeTab === 'INFO' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Photo Section */}
          <div className="md:col-span-2 flex flex-col items-center justify-center mb-4">
              <div 
                className="w-32 h-32 rounded-full bg-slate-100 border-4 border-slate-200 flex items-center justify-center overflow-hidden relative cursor-pointer group"
                onClick={triggerFileInput}
              >
                  {formData.photoUrl ? (
                      <img src={formData.photoUrl} alt="Atleta" className="w-full h-full object-cover" />
                  ) : (
                      <UserIcon className="w-12 h-12 text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                  </div>
              </div>
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload}
              />
              <button type="button" onClick={triggerFileInput} className="mt-2 text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center">
                  <Upload className="w-4 h-4 mr-1" /> Carregar Foto
              </button>
              <p className="text-xs text-slate-400 mt-1">Clique para carregar ou tirar foto</p>
          </div>

          {/* Personal Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input name="name" required value={formData.name} onChange={handleChange} className={inputClasses} />
            </div>
            
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Nascimento</label>
                  <input type="date" name="birthDate" required value={formData.birthDate} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Escalão</label>
                    <select name="squadId" required value={formData.squadId} onChange={handleChange} className={inputClasses}>
                        <option value="">Selecione...</option>
                        {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Morada</label>
              <input name="address" value={formData.address} onChange={handleChange} className={inputClasses} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Emergência</label>
                    <input name="emergencyName" value={formData.emergencyName} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contato Emergência</label>
                    <input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className={inputClasses} />
                </div>
            </div>
          </div>

          {/* Sport Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nº Camisola</label>
                <input type="number" name="jerseyNumber" value={formData.jerseyNumber} onChange={handleChange} className={inputClasses} />
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Costas</label>
                <input name="jerseyName" value={formData.jerseyName} onChange={handleChange} className={inputClasses} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tamanho Kit</label>
                <input name="kitSize" placeholder="Ex: M" value={formData.kitSize} onChange={handleChange} className={inputClasses} />
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tam. Fato Treino</label>
                <input name="tracksuitSize" placeholder="Ex: L" value={formData.tracksuitSize} onChange={handleChange} className={inputClasses} />
              </div>
            </div>

             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Anotações Gerais</label>
                <textarea name="notes" rows={3} value={formData.notes} onChange={handleChange} className={inputClasses} placeholder="Observações médicas, etc." />
            </div>
          </div>
        </div>
        )}

        {activeTab === 'SPORTS' && (
            <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-4">
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Posições Preferidas</label>
                             <input 
                                value={formData.sportsDetails?.positions || ''} 
                                onChange={(e) => handleStatsChange('positions', e.target.value)} 
                                className={inputClasses} 
                                placeholder="Ex: Ponta de Lança, Extremo"
                             />
                        </div>
                         <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Pé Preferencial</label>
                             <select 
                                value={formData.sportsDetails?.strongFoot || 'Direito'} 
                                onChange={(e) => handleStatsChange('strongFoot', e.target.value)} 
                                className={inputClasses}
                             >
                                 <option value="Direito">Direito</option>
                                 <option value="Esquerdo">Esquerdo</option>
                                 <option value="Ambos">Ambos</option>
                             </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Comportamento</label>
                             <textarea 
                                rows={2}
                                value={formData.sportsDetails?.behavior || ''} 
                                onChange={(e) => handleStatsChange('behavior', e.target.value)} 
                                className={inputClasses} 
                                placeholder="Assiduidade, atitude, etc."
                             />
                        </div>
                     </div>

                     <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-slate-700">Avaliação Técnica (0-100)</h3>
                        
                        {[
                            { label: 'Técnica', key: 'technique' },
                            { label: 'Velocidade', key: 'speed' },
                            { label: 'Tática', key: 'tactical' },
                            { label: 'Físico', key: 'physical' },
                        ].map((stat) => (
                            <div key={stat.key}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span>{stat.label}</span>
                                    <span className="font-bold">{(formData.sportsDetails as any)?.[stat.key]}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={(formData.sportsDetails as any)?.[stat.key]} 
                                    onChange={(e) => handleStatsChange(stat.key, parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                            </div>
                        ))}
                     </div>
                 </div>
            </div>
        )}

        {activeTab === 'STATS' && playerStats && (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                        <div className="text-3xl font-bold text-emerald-600">{playerStats.totalMinutes}</div>
                        <div className="text-xs text-slate-500 uppercase font-semibold mt-1">Minutos Jogados</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                        <div className="text-3xl font-bold text-slate-700">{playerStats.totalConvocations}</div>
                        <div className="text-xs text-slate-500 uppercase font-semibold mt-1">Convocatórias</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                        <div className="text-3xl font-bold text-slate-700">{playerStats.totalStarts}</div>
                        <div className="text-xs text-slate-500 uppercase font-semibold mt-1">Titularidades</div>
                    </div>
                     <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                        <div className="text-3xl font-bold text-slate-700">{playerStats.totalBenchStarts}</div>
                        <div className="text-xs text-slate-500 uppercase font-semibold mt-1">Começou no Banco</div>
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 border-b">
                            <tr>
                                <th className="p-3">Data</th>
                                <th className="p-3">Adversário</th>
                                <th className="p-3">Condição</th>
                                <th className="p-3 text-right">Minutos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {playerStats.history.map(h => (
                                <tr key={h.id}>
                                    <td className="p-3 text-slate-600">{h.date}</td>
                                    <td className="p-3 font-medium text-slate-800">{h.opponent}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${h.wasStarter ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {h.wasStarter ? 'Titular' : 'Banco'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-700">
                                        {h.minutes}'
                                    </td>
                                </tr>
                            ))}
                            {playerStats.history.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">Sem histórico de jogos.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </form>
      </div>

      <div className="flex justify-end p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Atleta
          </button>
        </div>
    </div>
  );
};

export default PlayerForm;
import React, { useState, useEffect } from 'react';
import { Player, Squad } from '../types';
import { Save, X, Activity, User as UserIcon } from 'lucide-react';

interface PlayerFormProps {
  player?: Player | null; // null means new player
  squads: Squad[];
  onSave: (player: Player) => void;
  onCancel: () => void;
}

const PlayerForm: React.FC<PlayerFormProps> = ({ player, squads, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'INFO' | 'SPORTS'>('INFO');
  
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

      <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('INFO')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'INFO' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
             <UserIcon className="w-4 h-4 mr-2" /> Dados Pessoais
          </button>
          <button 
            onClick={() => setActiveTab('SPORTS')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'SPORTS' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
             <Activity className="w-4 h-4 mr-2" /> Ficha Desportiva
          </button>
      </div>

      <div className="overflow-y-auto p-6 flex-1">
      <form id="playerForm" onSubmit={handleSubmit} className="space-y-4">
        
        {activeTab === 'INFO' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
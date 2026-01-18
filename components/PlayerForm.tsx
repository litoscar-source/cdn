import React, { useState, useEffect } from 'react';
import { Player, Squad } from '../types';
import { Save, X } from 'lucide-react';

interface PlayerFormProps {
  player?: Player | null; // null means new player
  squads: Squad[];
  onSave: (player: Player) => void;
  onCancel: () => void;
}

const PlayerForm: React.FC<PlayerFormProps> = ({ player, squads, onSave, onCancel }) => {
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
    emergencyContact: ''
  });

  useEffect(() => {
    if (player) {
      setFormData(player);
    }
  }, [player]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!formData.name || !formData.squadId) {
      alert("Por favor preencha o nome e o escalão.");
      return;
    }
    
    const newPlayer: Player = {
      id: player?.id || crypto.randomUUID(),
      ...formData as Player,
      jerseyNumber: Number(formData.jerseyNumber) // Ensure number type
    };
    onSave(newPlayer);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inputClasses = "w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900 placeholder-slate-400";

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">
          {player ? 'Editar Atleta' : 'Novo Atleta'}
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Personal Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={inputClasses}
              />
            </div>
            
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Nascimento</label>
                  <input
                    type="date"
                    name="birthDate"
                    required
                    value={formData.birthDate}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Escalão</label>
                    <select
                        name="squadId"
                        required
                        value={formData.squadId}
                        onChange={handleChange}
                        className={inputClasses}
                    >
                        <option value="">Selecione...</option>
                        {squads.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Morada</label>
              <input
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Emergência</label>
                    <input
                        name="emergencyName"
                        value={formData.emergencyName}
                        onChange={handleChange}
                        className={inputClasses}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contato Emergência</label>
                    <input
                        name="emergencyContact"
                        value={formData.emergencyContact}
                        onChange={handleChange}
                        className={inputClasses}
                    />
                </div>
            </div>
          </div>

          {/* Sport Info */}
          <div className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nº Camisola</label>
                <input
                  type="number"
                  name="jerseyNumber"
                  value={formData.jerseyNumber}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Costas</label>
                <input
                  name="jerseyName"
                  value={formData.jerseyName}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tamanho Kit</label>
                <input
                  name="kitSize"
                  placeholder="Ex: M"
                  value={formData.kitSize}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tam. Fato Treino</label>
                <input
                  name="tracksuitSize"
                  placeholder="Ex: L"
                  value={formData.tracksuitSize}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Anotações</label>
          <textarea
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Observações técnicas, médicas, etc."
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Atleta
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlayerForm;
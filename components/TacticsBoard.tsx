import React, { useState, useRef, useEffect } from 'react';
import { Circle, Square, ArrowRight, MousePointer2, Eraser, Play, Pause, Save, RotateCcw, Plus, Trash2, ChevronLeft, ChevronRight, Goal } from 'lucide-react';

interface TacticsBoardProps {
  initialData?: string;
  onSave?: (data: string) => void;
  readOnly?: boolean;
}

interface BoardItem {
  id: string;
  type: 'ATTACKER' | 'DEFENDER' | 'BALL' | 'CONE' | 'GOAL';
  x: number;
  y: number;
  label?: string; // For jersey numbers
}

interface BoardPath {
  id: string;
  type: 'RUN' | 'PASS' | 'DRIBBLE';
  points: { x: number; y: number }[];
}

interface Frame {
  id: string;
  items: BoardItem[];
  paths: BoardPath[];
  note?: string;
}

const TacticsBoard: React.FC<TacticsBoardProps> = ({ initialData, onSave, readOnly = false }) => {
  const [frames, setFrames] = useState<Frame[]>([{ id: '1', items: [], paths: [] }]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  
  const [selectedTool, setSelectedTool] = useState<'SELECT' | 'ATTACKER' | 'DEFENDER' | 'BALL' | 'CONE' | 'GOAL' | 'RUN' | 'PASS' | 'DRIBBLE' | 'ERASER'>('SELECT');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  
  const boardRef = useRef<HTMLDivElement>(null);
  const playbackTimeoutRef = useRef<any>(null);

  // Load Data
  useEffect(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(initialData);
        if (parsed.frames) {
            setFrames(parsed.frames);
        } else if (parsed.items) {
            // Migration for old single-frame data
            setFrames([{ id: '1', items: parsed.items, paths: parsed.paths || [] }]);
        }
      } catch (e) {
        console.error("Failed to parse tactics data", e);
      }
    }
  }, [initialData]);

  // Playback Logic
  useEffect(() => {
    if (isPlaying) {
      playbackTimeoutRef.current = setTimeout(() => {
        setPlaybackIndex(prev => {
          const next = prev + 1;
          if (next >= frames.length) {
            setIsPlaying(false);
            return 0; // Reset or Stop? Let's reset to 0 but stop playing
          }
          return next;
        });
      }, 1000); // 1 second per frame
    } else {
      clearTimeout(playbackTimeoutRef.current);
    }
    return () => clearTimeout(playbackTimeoutRef.current);
  }, [isPlaying, playbackIndex, frames.length]);

  // Sync playback index with edit index when not playing
  useEffect(() => {
      if (!isPlaying) {
          setPlaybackIndex(currentFrameIndex);
      }
  }, [currentFrameIndex, isPlaying]);

  const currentFrame = isPlaying ? frames[playbackIndex] : frames[currentFrameIndex];

  const updateCurrentFrame = (newItems: BoardItem[], newPaths: BoardPath[]) => {
      const newFrames = [...frames];
      newFrames[currentFrameIndex] = { ...newFrames[currentFrameIndex], items: newItems, paths: newPaths };
      setFrames(newFrames);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Clamp to 0-100
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    return { x, y };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly || isPlaying) return;
    const { x, y } = getCoordinates(e);

    if (selectedTool === 'SELECT') {
        // Drag logic could go here, but for now let's just support click-to-move in future or simple add/delete
        // For "Drag", we need to identify the item under cursor.
        // Simple implementation: If click on item, start dragging it.
        const threshold = 5;
        const clickedItem = currentFrame.items.find(i => Math.abs(i.x - x) < threshold && Math.abs(i.y - y) < threshold);
        if (clickedItem) {
            // Start dragging (simplified: remove and re-add as "moving" or just update position on move)
            // For this version, let's just support adding. Dragging is complex without a dedicated hook.
            // Let's implement a simple "Move closest" if tool is SELECT
            const moveHandler = (moveEvent: MouseEvent | TouchEvent) => {
                const moveCoords = getCoordinates(moveEvent as any);
                const updatedItems = currentFrame.items.map(i => i.id === clickedItem.id ? { ...i, x: moveCoords.x, y: moveCoords.y } : i);
                updateCurrentFrame(updatedItems, currentFrame.paths);
            };
            const upHandler = () => {
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('touchmove', moveHandler as any);
                window.removeEventListener('mouseup', upHandler);
                window.removeEventListener('touchend', upHandler);
            };
            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('touchmove', moveHandler as any, { passive: false });
            window.addEventListener('mouseup', upHandler);
            window.addEventListener('touchend', upHandler);
        }
        return;
    }

    if (selectedTool === 'ERASER') {
      const threshold = 5;
      const itemToRemove = currentFrame.items.find(i => Math.abs(i.x - x) < threshold && Math.abs(i.y - y) < threshold);
      if (itemToRemove) {
          updateCurrentFrame(currentFrame.items.filter(i => i.id !== itemToRemove.id), currentFrame.paths);
          return;
      }
      // Also erase paths?
      return;
    }

    if (['ATTACKER', 'DEFENDER', 'BALL', 'CONE', 'GOAL'].includes(selectedTool)) {
      const newItem: BoardItem = {
        id: crypto.randomUUID(),
        type: selectedTool as any,
        x,
        y
      };
      updateCurrentFrame([...currentFrame.items, newItem], currentFrame.paths);
    } else if (['RUN', 'PASS', 'DRIBBLE'].includes(selectedTool)) {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly || isPlaying) return;
    if (isDrawing) {
      const { x, y } = getCoordinates(e);
      setCurrentPath(prev => [...prev, { x, y }]);
    }
  };

  const handlePointerUp = () => {
    if (readOnly || isPlaying) return;
    if (isDrawing) {
      setIsDrawing(false);
      if (currentPath.length > 1) {
        const newPath: BoardPath = {
          id: crypto.randomUUID(),
          type: selectedTool as any,
          points: currentPath
        };
        updateCurrentFrame(currentFrame.items, [...currentFrame.paths, newPath]);
      }
      setCurrentPath([]);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(JSON.stringify({ frames }));
    }
  };

  const handleClearFrame = () => {
      if(confirm('Limpar este passo?')) {
          updateCurrentFrame([], []);
      }
  };

  const addFrame = () => {
      // Duplicate current frame
      const newFrame = {
          id: crypto.randomUUID(),
          items: currentFrame.items.map(i => ({...i})), // Deep copy items
          paths: [] // Usually paths are per-step actions, so maybe clear them? Or keep? Let's clear paths for new step movement.
      };
      const newFrames = [...frames];
      newFrames.splice(currentFrameIndex + 1, 0, newFrame);
      setFrames(newFrames);
      setCurrentFrameIndex(currentFrameIndex + 1);
  };

  const deleteFrame = () => {
      if (frames.length <= 1) return;
      if (confirm('Eliminar este passo?')) {
          const newFrames = frames.filter((_, i) => i !== currentFrameIndex);
          setFrames(newFrames);
          setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1));
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2 p-2 bg-white border-b border-slate-200 shrink-0 items-center justify-between">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            <button onClick={() => setSelectedTool('SELECT')} className={`p-2 rounded ${selectedTool === 'SELECT' ? 'bg-slate-200' : 'hover:bg-slate-100'}`} title="Mover"><MousePointer2 className="w-4 h-4"/></button>
            <div className="w-px bg-slate-200 mx-1"/>
            <button onClick={() => setSelectedTool('ATTACKER')} className={`p-2 rounded ${selectedTool === 'ATTACKER' ? 'bg-red-100 border-red-300 border' : 'hover:bg-slate-100'}`} title="Atacante"><Circle className="w-4 h-4 fill-red-500 text-red-600"/></button>
            <button onClick={() => setSelectedTool('DEFENDER')} className={`p-2 rounded ${selectedTool === 'DEFENDER' ? 'bg-blue-100 border-blue-300 border' : 'hover:bg-slate-100'}`} title="Defensor"><Circle className="w-4 h-4 fill-blue-500 text-blue-600"/></button>
            <button onClick={() => setSelectedTool('BALL')} className={`p-2 rounded ${selectedTool === 'BALL' ? 'bg-yellow-100 border-yellow-300 border' : 'hover:bg-slate-100'}`} title="Bola"><Circle className="w-3 h-3 fill-white text-black border border-black rounded-full"/></button>
            <button onClick={() => setSelectedTool('GOAL')} className={`p-2 rounded ${selectedTool === 'GOAL' ? 'bg-slate-200 border-slate-400 border' : 'hover:bg-slate-100'}`} title="Baliza"><Goal className="w-4 h-4 text-slate-800"/></button>
            <button onClick={() => setSelectedTool('CONE')} className={`p-2 rounded ${selectedTool === 'CONE' ? 'bg-orange-100 border-orange-300 border' : 'hover:bg-slate-100'}`} title="Cone"><Square className="w-3 h-3 fill-orange-500 text-orange-600 rotate-45"/></button>
            <div className="w-px bg-slate-200 mx-1"/>
            <button onClick={() => setSelectedTool('RUN')} className={`p-2 rounded ${selectedTool === 'RUN' ? 'bg-slate-200' : 'hover:bg-slate-100'}`} title="Corrida"><ArrowRight className="w-4 h-4"/></button>
            <button onClick={() => setSelectedTool('PASS')} className={`p-2 rounded ${selectedTool === 'PASS' ? 'bg-slate-200' : 'hover:bg-slate-100'}`} title="Passe"><ArrowRight className="w-4 h-4 border-b border-dashed"/></button>
            <button onClick={() => setSelectedTool('DRIBBLE')} className={`p-2 rounded ${selectedTool === 'DRIBBLE' ? 'bg-slate-200' : 'hover:bg-slate-100'}`} title="Drible">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c2-2 2-2 4 0s2 2 4 0 2-2 4 0 2 2 4 0 2-2 4 0"/></svg>
            </button>
            <div className="w-px bg-slate-200 mx-1"/>
            <button onClick={() => setSelectedTool('ERASER')} className={`p-2 rounded ${selectedTool === 'ERASER' ? 'bg-red-100 text-red-600' : 'hover:bg-slate-100'}`} title="Apagar"><Eraser className="w-4 h-4"/></button>
            <button onClick={handleClearFrame} className="p-2 rounded hover:bg-red-100 text-red-600" title="Limpar Passo"><RotateCcw className="w-4 h-4"/></button>
          </div>
          <button onClick={handleSave} className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-2 text-sm font-bold shadow-sm"><Save className="w-4 h-4"/> <span className="hidden sm:inline">Guardar</span></button>
        </div>
      )}

      {/* Board Area */}
      <div className="relative flex-1 bg-emerald-600 overflow-hidden border-2 border-white shadow-inner select-none touch-none m-2 rounded-xl"
           ref={boardRef}
           onMouseDown={handlePointerDown}
           onMouseMove={handlePointerMove}
           onMouseUp={handlePointerUp}
           onMouseLeave={handlePointerUp}
           onTouchStart={handlePointerDown}
           onTouchMove={handlePointerMove}
           onTouchEnd={handlePointerUp}
      >
        {/* Field Markings */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white -translate-x-1/2"/>
            <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"/>
            <div className="absolute top-0 left-0 right-0 h-full border-2 border-white m-4"/>
            <div className="absolute top-1/2 left-0 w-16 h-32 border-2 border-white -translate-y-1/2 border-l-0"/>
            <div className="absolute top-1/2 right-0 w-16 h-32 border-2 border-white -translate-y-1/2 border-r-0"/>
        </div>

        {/* Paths */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {currentFrame.paths.map(path => {
                const d = `M ${path.points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
                return (
                    <g key={path.id}>
                        <path 
                            d={d} 
                            stroke={path.type === 'PASS' ? '#fbbf24' : 'white'} 
                            strokeWidth="2" 
                            fill="none" 
                            strokeDasharray={path.type === 'PASS' ? '5,5' : path.type === 'DRIBBLE' ? '2,2' : 'none'}
                            className={isPlaying ? 'animate-dash' : ''}
                        />
                        {path.points.length > 1 && (
                            <circle cx={path.points[path.points.length-1].x} cy={path.points[path.points.length-1].y} r="2" fill="white" />
                        )}
                    </g>
                )
            })}
            {isDrawing && currentPath.length > 1 && (
                <path 
                    d={`M ${currentPath.map(p => `${p.x} ${p.y}`).join(' L ')}`} 
                    stroke="white" 
                    strokeWidth="2" 
                    fill="none" 
                    opacity="0.5"
                />
            )}
        </svg>

        {/* Items - With Transition for Animation */}
        {currentFrame.items.map(item => (
            <div 
                key={item.id}
                className="absolute -ml-3 -mt-3 flex items-center justify-center transition-all duration-1000 ease-in-out"
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
                {item.type === 'ATTACKER' && <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold text-white">A</div>}
                {item.type === 'DEFENDER' && <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold text-white">D</div>}
                {item.type === 'BALL' && <div className="w-3 h-3 bg-white rounded-full border border-black shadow-sm"/>}
                {item.type === 'CONE' && <div className="w-4 h-4 bg-orange-500 rotate-45 border border-white shadow-sm"/>}
                {item.type === 'GOAL' && <div className="w-12 h-6 border-2 border-white bg-white/20 shadow-sm"/>}
            </div>
        ))}
      </div>

      {/* Animation / Frame Controls */}
      <div className="p-2 bg-white border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
              <button 
                onClick={() => { setIsPlaying(!isPlaying); setPlaybackIndex(0); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition shadow-sm ${isPlaying ? 'bg-red-100 text-red-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                  {isPlaying ? <><Pause className="w-4 h-4"/> Parar</> : <><Play className="w-4 h-4"/> Play</>}
              </button>
              
              {!readOnly && (
                  <div className="flex items-center bg-slate-100 rounded-lg p-1 ml-2">
                      <button onClick={() => setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1))} disabled={currentFrameIndex === 0 || isPlaying} className="p-1 hover:bg-white rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
                      <span className="px-3 text-xs font-bold text-slate-600">Passo {currentFrameIndex + 1} / {frames.length}</span>
                      <button onClick={() => setCurrentFrameIndex(Math.min(frames.length - 1, currentFrameIndex + 1))} disabled={currentFrameIndex === frames.length - 1 || isPlaying} className="p-1 hover:bg-white rounded disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
                  </div>
              )}
          </div>

          {!readOnly && (
              <div className="flex gap-2">
                  <button onClick={deleteFrame} disabled={frames.length <= 1} className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30" title="Eliminar Passo"><Trash2 className="w-4 h-4"/></button>
                  <button onClick={addFrame} className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-bold" title="Duplicar passo atual para animar movimento">
                      <Plus className="w-3 h-3"/> Adicionar Movimento
                  </button>
              </div>
          )}
      </div>

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          animation: dash 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default TacticsBoard;

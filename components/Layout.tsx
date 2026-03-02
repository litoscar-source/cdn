import React from 'react';
import { User, ViewState, UserRole } from '../types';
import { CLUB_NAME } from '../constants';
import { 
  Users, 
  CalendarDays, 
  Settings, 
  LogOut, 
  LayoutDashboard,
  UserCircle,
  Flag,
  UserCheck
} from 'lucide-react';

interface LayoutProps {
  user: User;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, currentView, onNavigate, onLogout, children }) => {

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => {
    // Hide Admin tab if not admin (Explicit username check added for fallback safety)
    if (view === 'ADMIN' && user.role !== UserRole.ADMIN && user.username !== 'admin') return null;

    const isActive = currentView === view;
    return (
      <button
        onClick={() => {
          onNavigate(view);
        }}
        className={`flex items-center w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1 ${
          isActive 
            ? 'bg-emerald-600 text-white shadow-lg' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-slate-400'}`} />
        {label}
      </button>
    );
  };

  const MobileNavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => {
    if (view === 'ADMIN' && user.role !== UserRole.ADMIN && user.username !== 'admin') return null;
    const isActive = currentView === view;
    return (
      <button
        onClick={() => onNavigate(view)}
        className={`flex flex-col items-center justify-center min-w-[70px] py-2 px-1 rounded-lg transition-all active:scale-95 ${
          isActive 
            ? 'bg-emerald-600 text-white shadow-md' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-white' : 'text-slate-400'}`} />
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-white">
        <div className="p-6 border-b border-slate-800 flex items-center justify-center flex-col">
          <h1 className="text-sm font-bold tracking-tight text-center leading-tight">{CLUB_NAME}</h1>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase mb-2">Menu Principal</p>
            <NavItem view="DASHBOARD" icon={LayoutDashboard} label="Visão Geral" />
            <NavItem view="PLAYERS" icon={Users} label="Atletas" />
            <NavItem view="TRAINING" icon={CalendarDays} label="Treinos" />
            <NavItem view="CONVOCATION" icon={UserCheck} label="Convocatórias" />
            <NavItem view="MATCHES" icon={Flag} label="Jogos" />
            
            {(user.role === UserRole.ADMIN || user.username === 'admin') && (
               <>
                <div className="mt-6 mb-2 border-t border-slate-800"></div>
                <p className="px-4 text-xs font-semibold text-slate-500 uppercase mb-2">Administração</p>
                <NavItem view="ADMIN" icon={Settings} label="Definições" />
               </>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center px-4 py-3 bg-slate-800 rounded-lg mb-2">
             <UserCircle className="w-8 h-8 text-slate-400 mr-3" />
             <div className="flex-1 min-w-0">
               <p className="text-sm font-medium text-white truncate">{user.name}</p>
               <p className="text-xs text-slate-400 truncate">{user.role}</p>
             </div>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center justify-center w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header & Top Nav */}
        <div className="md:hidden flex flex-col bg-slate-900 text-white shadow-md z-30 sticky top-0 shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                 <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-white shadow-inner">
                        {CLUB_NAME.substring(0, 2)}
                    </div>
                    <div>
                        <h1 className="text-sm font-bold leading-tight">{CLUB_NAME}</h1>
                        <p className="text-[10px] text-slate-400 leading-none">Gestor de Equipa</p>
                    </div>
                 </div>
                 <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-400 transition">
                    <LogOut className="w-5 h-5" />
                 </button>
            </div>
            
            {/* Horizontal Scrollable Nav */}
            <nav className="flex overflow-x-auto no-scrollbar py-2 px-2 gap-1 bg-slate-800/50 backdrop-blur-sm border-b border-slate-800/50">
                <MobileNavItem view="DASHBOARD" icon={LayoutDashboard} label="Geral" />
                <MobileNavItem view="PLAYERS" icon={Users} label="Atletas" />
                <MobileNavItem view="TRAINING" icon={CalendarDays} label="Treinos" />
                <MobileNavItem view="CONVOCATION" icon={UserCheck} label="Convocatórias" />
                <MobileNavItem view="MATCHES" icon={Flag} label="Jogos" />
                {(user.role === UserRole.ADMIN || user.username === 'admin') && (
                    <MobileNavItem view="ADMIN" icon={Settings} label="Admin" />
                )}
            </nav>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-slate-100">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Server,
  Cpu,
  Layers,
  Users,
  ShieldAlert,
  Sliders,
  Radio,
  X,
  Zap,
  Shield,
  User as UserIcon,
  BookOpen,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenGuide?: () => void;
  serverCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenGuide,
  serverCount = 0,
  isOpen = false,
  onClose
}) => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const navItems = [
    {
      id: 'servers',
      label: isAdmin ? 'Game Servers' : 'My Servers',
      icon: Server,
      badge: serverCount
    },
    { id: 'nodes', label: 'Nodes & Clusters', icon: Cpu, adminOnly: true },
    { id: 'templates', label: 'Templates Library', icon: Layers, adminOnly: true },
    { id: 'users', label: 'User Accounts', icon: Users, adminOnly: true },
    { id: 'audit', label: 'Audit Logs', icon: ShieldAlert, adminOnly: true },
    { id: 'settings', label: 'System & Security', icon: Sliders, adminOnly: true },
    { id: 'profile', label: 'My Account & Security', icon: UserIcon }
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onClose) onClose();
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full py-5 px-3">
      <div className="space-y-6">
        {/* Mobile Header in Drawer */}
        <div className="flex lg:hidden items-center justify-between px-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm text-white font-['Rajdhani',sans-serif]">NAVIGATION</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div>
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono mb-2">
            {isAdmin ? 'Infrastructure & Controls' : 'Personal Cluster'}
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const Icon = item.icon;
              const active = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all group min-h-[44px] ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {onOpenGuide && (
              <button
                onClick={() => {
                  onOpenGuide();
                  if (onClose) onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 border border-transparent transition-all group min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4 shrink-0 text-cyan-500/80 group-hover:text-cyan-400" />
                  <span>Getting Started Guide</span>
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Playit.gg Active Status Indicator */}
        <div className="rounded-xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950/80 p-3.5 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-medium mb-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold font-mono">
              <Radio className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
              <span>PLAYIT.GG ROUTER</span>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Zero-port-forward tunneling daemon active across local host nodes.
          </p>
        </div>
      </div>

      {/* Footer Mobile User + System Version */}
      <div className="space-y-3 pt-4 border-t border-slate-800/60">
        <div className="lg:hidden flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
          <button
            onClick={() => handleNavClick('profile')}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-slate-300">
              {user?.role === 'ADMIN' ? (
                <Shield className="h-3.5 w-3.5 text-cyan-400" />
              ) : (
                <UserIcon className="h-3.5 w-3.5 text-slate-400" />
              )}
            </div>
            <div>
              <div className="font-semibold text-white truncate max-w-[120px]">{user?.username}</div>
              <div className="text-[10px] text-cyan-400 font-mono">{user?.role}</div>
            </div>
          </button>
          <button
            onClick={logout}
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>Docker Engine v24.0.7</span>
          <span className="text-emerald-400 font-semibold">Ready</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-slate-800/80 bg-[#090d16] flex-col shrink-0 min-h-[calc(100vh-4rem)]">
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop & Slide-out */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          {/* Slide-out Panel */}
          <div className="relative w-72 max-w-[85vw] bg-[#090d16] border-r border-slate-800 h-full z-10 shadow-2xl flex flex-col overflow-y-auto">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};

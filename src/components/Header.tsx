import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import { SystemMetrics } from '../types';
import {
  Cpu,
  HardDrive,
  LogOut,
  User as UserIcon,
  Shield,
  Activity,
  Zap,
  Menu,
  X,
  BookOpen
} from 'lucide-react';

interface HeaderProps {
  activeTab?: string;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  onNavigateToProfile?: () => void;
  onOpenGuide?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isMobileMenuOpen = false,
  onToggleMobileMenu,
  onNavigateToProfile,
  onOpenGuide
}) => {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const data = await api.getSystemMetrics();
        setMetrics(data);
      } catch (err) {}
    };
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800/80 bg-[#0c121e]/95 px-3 sm:px-6 backdrop-blur-md">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Mobile Hamburger Toggle Button */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
            className="flex h-10 w-10 lg:hidden items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400 focus:outline-none transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-white flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-['Rajdhani',sans-serif]">
              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                {settings.panel_name || 'ZYROCLOUD'}
              </span>
              <span className="hidden xs:inline-block text-[9px] sm:text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 shrink-0">
                PROD-v1.0
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-none">Node: Master (127.0.0.1)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time System Metrics Strip (Desktop / Large Tablet) */}
      {metrics && (
        <div className="hidden xl:flex items-center gap-5 px-4 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 font-mono text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>CPU:</span>
            <span className="font-semibold text-white">{metrics.cpu_percent.toFixed(1)}%</span>
            <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(metrics.cpu_percent, 100)}%` }}
              />
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-purple-400" />
            <span>RAM:</span>
            <span className="font-semibold text-white">
              {(metrics.memory_used_mb / 1024).toFixed(1)} / {(metrics.memory_total_mb / 1024).toFixed(0)} GB
            </span>
            <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${metrics.memory_percent}%` }}
              />
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
            <span>NVMe:</span>
            <span className="font-semibold text-white">{metrics.disk_percent}%</span>
          </div>
        </div>
      )}

      {/* User Info & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            title="Getting Started Guide"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold font-mono transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Guide</span>
          </button>
        )}

        {/* User Pill Button */}
        <button
          onClick={onNavigateToProfile}
          title="Manage Account Profile"
          className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all text-xs cursor-pointer group"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-300 group-hover:text-cyan-400">
            {user?.role === 'ADMIN' ? (
              <Shield className="h-4 w-4 text-cyan-400" />
            ) : (
              <UserIcon className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div className="text-left hidden sm:block">
            <div className="font-semibold text-white leading-tight truncate max-w-[100px] sm:max-w-[140px] group-hover:text-cyan-300">
              {user?.username}
            </div>
            <div className="text-[10px] text-cyan-400/90 font-mono tracking-wider">{user?.role}</div>
          </div>
        </button>

        <button
          onClick={logout}
          title="Sign Out"
          className="flex h-9 w-9 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-rose-500/40 hover:bg-rose-950/30 hover:text-rose-400 transition-all shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

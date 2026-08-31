import React, { useState } from 'react';
import {
  X,
  Zap,
  Server,
  Radio,
  FolderLock,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Shield,
  BookOpen
} from 'lucide-react';

interface OnboardingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateServer?: () => void;
  isAdmin?: boolean;
}

export const OnboardingGuideModal: React.FC<OnboardingGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenCreateServer,
  isAdmin = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (neverShowAgain) {
      localStorage.setItem('zyrocloud_hide_onboarding', 'true');
    }
    onClose();
  };

  const steps = [
    {
      title: 'Welcome to ZyroCloud Panel',
      badge: 'OVERVIEW',
      icon: Zap,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
      description:
        'ZyroCloud is your self-hosted game server management platform with Docker container isolation, built-in Playit.gg zero-port-forward tunneling, and multi-user RBAC security.',
      points: [
        'Local Node cluster running lightweight background daemons.',
        'Zero router port-forwarding required using Playit.gg integration.',
        'True hardware metrics with real-time CPU, RAM, and NVMe disk tracking.'
      ]
    },
    {
      title: 'Isolated File System Architecture',
      badge: 'SECURITY',
      icon: FolderLock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
      description:
        'Every game server runs in its own isolated filesystem sandbox. The File Manager strictly accesses the server data directory.',
      points: [
        'User File Manager operates exclusively within /var/lib/zyrocloud/servers/<id>/data/ and displays as / in the UI.',
        'Internal system directories (config, runtime, logs, backups, tmp) remain completely hidden and protected.',
        'Rigorous path traversal and symlink escape defenses enforced on all backend API routes.'
      ]
    },
    {
      title: 'Playit.gg Zero-Port Tunneling',
      badge: 'NETWORKING',
      icon: Radio,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      description:
        'Allow friends and players worldwide to join your servers instantly without exposing your home router IP or opening router ports.',
      points: [
        'Dedicated background Playit tunnel daemon for each game server.',
        'Unique secure tunnel address (e.g. your-server.playit.gg:25565).',
        'One-click Claim Secret setup from the Playit.gg tab inside each server.'
      ]
    },
    {
      title: 'Role-Based Access & Node Clusters',
      badge: 'RBAC',
      icon: Shield,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      description:
        'Administrators maintain global cluster control, while normal Users manage only their explicitly assigned game servers.',
      points: [
        'ADMINs can provision nodes, install game templates, configure OAuth, and audit logs.',
        'USERs have streamlined dashboards focused exclusively on managing their active game servers.',
        'OAuth authentication support for Google and Discord single sign-on.'
      ]
    }
  ];

  const active = steps[currentStep];
  const Icon = active.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-[#0c121e] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm text-white font-['Rajdhani',sans-serif] tracking-wider">
              ZYROCLOUD QUICK START GUIDE
            </span>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step Indicator */}
          <div className="flex items-center justify-between gap-2">
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`flex-1 h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                    : idx < currentStep
                    ? 'bg-cyan-900'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          {/* Active Step Content */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${active.bgColor} ${active.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                  {active.badge} • STEP {currentStep + 1} OF {steps.length}
                </span>
                <h3 className="text-lg font-bold text-white mt-1 font-['Rajdhani',sans-serif]">
                  {active.title}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {active.description}
            </p>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-2.5">
              {active.points.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/60">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer self-start sm:self-auto">
            <input
              type="checkbox"
              checked={neverShowAgain}
              onChange={(e) => setNeverShowAgain(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Don't show this guide on startup</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Previous
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all flex items-center gap-1.5"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  handleClose();
                  if (isAdmin && onOpenCreateServer) {
                    onOpenCreateServer();
                  }
                }}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center gap-1.5"
              >
                <span>{isAdmin ? 'Get Started & Create Server' : 'Explore My Servers'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

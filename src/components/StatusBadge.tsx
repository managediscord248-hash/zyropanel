import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'md' }) => {
  const norm = (status || '').toUpperCase();

  let bg = 'bg-slate-800/80 text-slate-300 border-slate-700';
  let dotColor = 'bg-slate-400';
  let pulse = false;

  switch (norm) {
    case 'RUNNING':
    case 'ONLINE':
    case 'CONNECTED':
      bg = 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20';
      dotColor = 'bg-emerald-400';
      pulse = true;
      break;
    case 'AWAITING_CLAIM':
      bg = 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20';
      dotColor = 'bg-cyan-400';
      pulse = true;
      break;
    case 'STARTING':
    case 'INSTALLING':
    case 'CONNECTING':
      bg = 'bg-amber-950/60 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20';
      dotColor = 'bg-amber-400';
      pulse = true;
      break;
    case 'STOPPED':
    case 'OFFLINE':
      bg = 'bg-slate-900/80 text-slate-400 border-slate-700/60';
      dotColor = 'bg-slate-500';
      pulse = false;
      break;
    case 'CRASHED':
    case 'ERROR':
      bg = 'bg-rose-950/60 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20';
      dotColor = 'bg-rose-400';
      pulse = true;
      break;
    case 'NOT_CONFIGURED':
      bg = 'bg-slate-900/80 text-slate-400 border-slate-700/60';
      dotColor = 'bg-slate-500';
      pulse = false;
      break;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium tracking-wide',
    lg: 'px-3 py-1.5 text-sm font-medium tracking-wide'
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border uppercase ${sizeClasses} ${bg} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      <span>{norm.replace('_', ' ')}</span>
    </span>
  );
};

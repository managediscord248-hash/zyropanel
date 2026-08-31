import React, { useState, useEffect } from 'react';
import { AuditLogItem } from '../types';
import { api } from '../services/api';
import { ShieldAlert, RefreshCw, Filter, ShieldCheck, Clock, User, Globe } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(150);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (!filterAction) return true;
    return log.action.toLowerCase().includes(filterAction.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(filterAction.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(filterAction.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white font-['Rajdhani',sans-serif] tracking-wide flex flex-wrap items-center gap-2">
            <span>TAMPER-RESISTANT AUDIT LOGS</span>
            <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              {logs.length} EVENTS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically structured telemetry of all administrative and lifecycle operations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="Filter by action or keyword..."
            className="rounded-xl border border-slate-800 bg-[#0c121e] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={loadLogs}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden sm:block rounded-2xl border border-slate-800 bg-[#0c121e]/90 overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] text-slate-400 uppercase">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No audit events recorded matching current criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => {
                  const isPower = log.action.startsWith('POWER_');
                  const isDelete = log.action.startsWith('DELETE_');
                  const isCreate = log.action.startsWith('CREATE_');

                  let badgeColor = 'bg-slate-800 text-slate-300';
                  if (isPower) badgeColor = 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60';
                  else if (isDelete) badgeColor = 'bg-rose-950/80 text-rose-300 border border-rose-800/60';
                  else if (isCreate) badgeColor = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60';

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{log.resource_type}</td>
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs max-w-md truncate">
                        {log.details || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                      <td className="py-3 px-4 text-right text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0c121e]/90 p-8 text-center text-slate-500 text-xs">
            No audit events recorded matching current criteria.
          </div>
        ) : (
          filtered.map((log) => {
            const isPower = log.action.startsWith('POWER_');
            const isDelete = log.action.startsWith('DELETE_');
            const isCreate = log.action.startsWith('CREATE_');

            let badgeColor = 'bg-slate-800 text-slate-300';
            if (isPower) badgeColor = 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60';
            else if (isDelete) badgeColor = 'bg-rose-950/80 text-rose-300 border border-rose-800/60';
            else if (isCreate) badgeColor = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60';

            return (
              <div key={log.id} className="rounded-xl border border-slate-800 bg-[#0c121e]/90 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${badgeColor}`}>
                    {log.action}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 font-mono">{log.resource_type}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{log.ip_address || '127.0.0.1'}</span>
                </div>

                {log.details && (
                  <p className="text-slate-400 text-xs bg-slate-900/60 rounded-lg p-2 font-sans border border-slate-800/40 break-words">
                    {log.details}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

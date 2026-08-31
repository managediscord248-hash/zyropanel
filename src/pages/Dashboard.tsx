import React, { useState, useEffect } from 'react';
import { ServerItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { CreateServerModal } from '../components/CreateServerModal';
import {
  Server,
  Plus,
  Play,
  Square,
  RotateCw,
  Search,
  ExternalLink,
  Cpu,
  Layers,
  Radio,
  Zap,
  Globe,
  Terminal,
  FolderOpen
} from 'lucide-react';

interface DashboardProps {
  onSelectServer: (serverId: string, initialTab?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectServer }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [poweringMap, setPoweringMap] = useState<Record<string, boolean>>({});

  const loadServers = async () => {
    try {
      const list = await api.getServers();
      setServers(list);
    } catch (err) {
      console.error('Failed to load servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePower = async (e: React.MouseEvent, serverId: string, action: 'start' | 'stop' | 'restart') => {
    e.stopPropagation();
    setPoweringMap((prev) => ({ ...prev, [serverId]: true }));
    try {
      await api.powerAction(serverId, action);
      await loadServers();
    } catch (err: any) {
      alert(`Power action error: ${err.message}`);
    } finally {
      setPoweringMap((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.docker_image.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white font-['Rajdhani',sans-serif] tracking-wide flex items-center gap-2 sm:gap-2.5">
            <span>GAME SERVER INSTANCES</span>
            <span className="text-[10px] sm:text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              {servers.length} ACTIVE
            </span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Monitor container lifecycle, interactive console streams, files, and Playit tunnel endpoints.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20 active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>PROVISION SERVER</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers by name, game image, or ID..."
            className="w-full rounded-xl border border-slate-800 bg-[#0c121e]/90 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
        </div>
      </div>

      {/* Servers Grid */}
      {loading && servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent mb-3" />
          <span>Querying Docker container daemon...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0c121e]/40 p-8 sm:p-12 text-center">
          <Server className="mx-auto h-10 w-10 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No Game Servers Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search ? 'No servers match your current search query.' : 'Get started by provisioning your first dedicated game server container.'}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Server</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((srv) => {
            const isRunning = srv.status === 'RUNNING';
            const primaryPort = srv.ports?.find((p) => p.is_primary)?.host_port || 25565;
            const playit = srv.playit_tunnel;
            const isPowering = poweringMap[srv.id];

            return (
              <div
                key={srv.id}
                onClick={() => onSelectServer(srv.id)}
                className="group relative rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-5 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-950/20 transition-all cursor-pointer flex flex-col justify-between"
              >
                {/* Server Header */}
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/80 text-cyan-400 group-hover:border-cyan-500/40 transition-colors">
                        <Server className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors truncate">
                          {srv.name}
                        </h3>
                        <div className="text-[10px] sm:text-[11px] font-mono text-slate-400 flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
                          <span>Port: {primaryPort}</span>
                          <span>•</span>
                          <span className="truncate max-w-[100px] sm:max-w-[130px]">{srv.docker_image.split(':')[0]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={srv.status} size="sm" />
                    </div>
                  </div>

                  {srv.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3 sm:mb-4 leading-relaxed">
                      {srv.description}
                    </p>
                  )}

                  {/* Playit zero-port domain pill if active */}
                  {playit?.tunnel_address && playit.status === 'CONNECTED' && (
                    <div className="mb-3 sm:mb-4 flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">{playit.tunnel_address}</span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-400 shrink-0 ml-1">PLAYIT</span>
                    </div>
                  )}

                  {/* Quota specs strip */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[10px] sm:text-[11px] font-mono text-slate-300 mb-3 sm:mb-4">
                    <div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase">RAM</div>
                      <div className="font-semibold text-white truncate">{srv.ram_limit_mb} MB</div>
                    </div>
                    <div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase">vCPU</div>
                      <div className="font-semibold text-white truncate">{srv.cpu_limit} Cores</div>
                    </div>
                    <div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase">Disk</div>
                      <div className="font-semibold text-white truncate">{srv.disk_limit_gb} GB</div>
                    </div>
                  </div>
                </div>

                {/* Bottom Quick Bar & Power Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectServer(srv.id, 'console');
                      }}
                      title="Console"
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition-colors"
                    >
                      <Terminal className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectServer(srv.id, 'files');
                      }}
                      title="Files"
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition-colors"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectServer(srv.id, 'playit');
                      }}
                      title="Playit Tunnel"
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition-colors"
                    >
                      <Radio className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Power Button Group */}
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <>
                        <button
                          disabled={isPowering}
                          onClick={(e) => handlePower(e, srv.id, 'restart')}
                          title="Restart Container"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:border-cyan-500/40 transition-colors"
                        >
                          <RotateCw className="h-3 w-3" />
                          <span>Restart</span>
                        </button>
                        <button
                          disabled={isPowering}
                          onClick={(e) => handlePower(e, srv.id, 'stop')}
                          title="Stop Container"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-800/80 bg-rose-950/40 text-[11px] font-medium text-rose-300 hover:bg-rose-900/60 transition-colors"
                        >
                          <Square className="h-3 w-3" />
                          <span>Stop</span>
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={isPowering}
                        onClick={(e) => handlePower(e, srv.id, 'start')}
                        title="Start Container"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 font-bold text-[11px] text-slate-950 hover:bg-emerald-400 transition-colors shadow-sm shadow-emerald-500/20"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>Start</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Provision Server Wizard Modal */}
      <CreateServerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(newId) => {
          loadServers();
          onSelectServer(newId);
        }}
      />
    </div>
  );
};

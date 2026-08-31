import React, { useState, useEffect } from 'react';
import { TemplateItem, NodeItem, User } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Server,
  Cpu,
  HardDrive,
  Layers,
  Sparkles,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (serverId: string) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(user?.id || '');
  const [dockerImage, setDockerImage] = useState('itzg/minecraft-server:latest');
  const [startupCommand, setStartupCommand] = useState('java -Xms1G -Xmx2G -jar paper.jar nogui');
  const [primaryPort, setPrimaryPort] = useState<number>(25565);
  const [ramLimitMb, setRamLimitMb] = useState<number>(2048);
  const [cpuLimit, setCpuLimit] = useState<number>(2.0);
  const [diskLimitGb, setDiskLimitGb] = useState<number>(20);
  const [autoRestart, setAutoRestart] = useState<boolean>(true);
  const [envVars, setEnvVars] = useState<string>('{"TYPE": "PAPER", "EULA": "TRUE"}');

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const [tmpls, nds] = await Promise.all([api.getTemplates(), api.getNodes()]);
        setTemplates(tmpls);
        setNodes(nds);

        if (tmpls.length > 0) {
          handleTemplateSelect(tmpls[0]);
        }
        if (nds.length > 0) {
          setSelectedNodeId(nds[0].id);
        }

        if (user?.role === 'ADMIN') {
          const usrs = await api.getUsers();
          setUsers(usrs);
        }
      } catch (err) {}
    };

    loadData();
  }, [isOpen]);

  const handleTemplateSelect = (tmpl: TemplateItem) => {
    setSelectedTemplateId(tmpl.id);
    setName(`${tmpl.game} Server #${Math.floor(100 + Math.random() * 900)}`);
    setDockerImage(tmpl.docker_image);
    setStartupCommand(tmpl.startup_command);
    setPrimaryPort(tmpl.default_port);
    setRamLimitMb(tmpl.default_ram_mb);
    setCpuLimit(tmpl.default_cpu_limit);
    setEnvVars(tmpl.environment_variables || '{}');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for the server.');
      return;
    }
    if (!selectedNodeId) {
      setError('Please choose an active compute node.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name,
        description,
        node_id: selectedNodeId,
        template_id: selectedTemplateId || undefined,
        owner_id: user?.role === 'ADMIN' ? selectedOwnerId : undefined,
        docker_image: dockerImage,
        startup_command: startupCommand,
        primary_port: Number(primaryPort),
        ram_limit_mb: Number(ramLimitMb),
        cpu_limit: Number(cpuLimit),
        disk_limit_gb: Number(diskLimitGb),
        auto_restart: autoRestart,
        environment_variables: envVars
      };

      const created = await api.createServer(payload);
      onSuccess(created.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to provision server container.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0c121e] p-6 shadow-2xl shadow-cyan-950/30 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-['Rajdhani',sans-serif] tracking-wide">
                PROVISION NEW GAME SERVER
              </h2>
              <p className="text-xs text-slate-400">
                Deploys an isolated Docker container with zero-port-forward Playit tunnel integration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-950/40 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Template Fast Picker */}
          <div>
            <label className="block text-slate-300 font-semibold mb-2 font-mono uppercase tracking-wider">
              1. Choose Game / Application Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {templates.map((tmpl) => {
                const isSel = selectedTemplateId === tmpl.id;
                return (
                  <button
                    type="button"
                    key={tmpl.id}
                    onClick={() => handleTemplateSelect(tmpl)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSel
                        ? 'border-cyan-500 bg-cyan-950/30 text-white shadow-sm shadow-cyan-500/30'
                        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>{tmpl.name}</span>
                      {isSel && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{tmpl.game}</div>
                    <div className="text-[10px] text-cyan-400 font-mono mt-1">
                      {tmpl.default_ram_mb}MB RAM | Port {tmpl.default_port}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Server Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Server Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Survival SMP"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Target Compute Node *</label>
              <select
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.ip_address}) - {node.cpu_cores} Cores / {Math.round(node.total_memory_mb / 1024)}GB
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Admin Owner Override */}
          {user?.role === 'ADMIN' && users.length > 0 && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">Assigned Owner (Admin Only)</label>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.email}) - {u.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Resource Allocation Sliders */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-4">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>Container Hardware Quotas</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* RAM */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>RAM Limit:</span>
                  <span className="font-mono text-cyan-400 font-bold">{ramLimitMb} MB</span>
                </div>
                <input
                  type="range"
                  min="512"
                  max="16384"
                  step="512"
                  value={ramLimitMb}
                  onChange={(e) => setRamLimitMb(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* CPU */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>vCPU Cores:</span>
                  <span className="font-mono text-purple-400 font-bold">{cpuLimit} Cores</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8.0"
                  step="0.5"
                  value={cpuLimit}
                  onChange={(e) => setCpuLimit(Number(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              {/* Disk */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Disk Storage:</span>
                  <span className="font-mono text-emerald-400 font-bold">{diskLimitGb} GB</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={diskLimitGb}
                  onChange={(e) => setDiskLimitGb(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Port and Docker Image Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Primary Host Port</label>
              <input
                type="number"
                value={primaryPort}
                onChange={(e) => setPrimaryPort(Number(e.target.value))}
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-medium mb-1">Docker Image</label>
              <input
                type="text"
                value={dockerImage}
                onChange={(e) => setDockerImage(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Startup Command */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Startup Command</label>
            <input
              type="text"
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Submit / Cancel Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 sm:py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 sm:py-2 font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Deploy Game Server</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

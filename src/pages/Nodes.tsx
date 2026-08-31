import React, { useState, useEffect } from 'react';
import { NodeItem } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { LocalNodeSetupModal } from '../components/LocalNodeSetupModal';
import { Cpu, Plus, Server, Activity, HardDrive, Trash2, X, CheckCircle2, Terminal, Settings } from 'lucide-react';

export const Nodes: React.FC = () => {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLocalNodeSetup, setShowLocalNodeSetup] = useState(false);

  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [daemonPort, setDaemonPort] = useState(8000);
  const [cpuCores, setCpuCores] = useState(8);
  const [ramMb, setRamMb] = useState(16384);
  const [diskGb, setDiskGb] = useState(250);

  const loadNodes = async () => {
    try {
      const data = await api.getNodes();
      setNodes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
  }, []);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createNode({
        name,
        ip_address: ip,
        daemon_port: Number(daemonPort),
        cpu_cores: Number(cpuCores),
        total_memory_mb: Number(ramMb),
        total_disk_gb: Number(diskGb)
      });
      setShowAddModal(false);
      setName('');
      setIp('');
      loadNodes();
    } catch (err: any) {
      alert(`Error registering node: ${err.message}`);
    }
  };

  const handleDeleteNode = async (nodeId: string, nodeName: string) => {
    if (!confirm(`Delete node '${nodeName}'?`)) return;
    try {
      await api.deleteNode(nodeId);
      loadNodes();
    } catch (err: any) {
      alert(`Error deleting node: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white font-['Rajdhani',sans-serif] tracking-wide flex items-center gap-2">
            <span>CLUSTER COMPUTE NODES</span>
            <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              {nodes.length} NODES
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Distributed Linux host daemons running Docker container engines & Playit tunnels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowLocalNodeSetup(true)}
            className="flex items-center gap-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all shadow-sm cursor-pointer"
          >
            <Terminal className="h-4 w-4 text-cyan-400" />
            <span>LOCAL NODE SETUP</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>REGISTER NEW NODE</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-6 space-y-4 hover:border-cyan-500/30 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-cyan-400">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{node.name}</h3>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {node.ip_address}:{node.daemon_port}
                  </div>
                </div>
              </div>
              <StatusBadge status={node.status} size="sm" />
            </div>

            <div className="grid grid-cols-3 gap-3 py-3 px-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">CPU Cores</div>
                <div className="font-bold text-white">{node.cpu_cores} Cores</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Total Memory</div>
                <div className="font-bold text-white">{Math.round(node.total_memory_mb / 1024)} GB</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Total Disk</div>
                <div className="font-bold text-white">{node.total_disk_gb} GB</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
              <span className="truncate max-w-[240px]">Docker: {node.docker_version}</span>
              {node.name.toLowerCase().includes('local node') ? (
                <button
                  onClick={() => setShowLocalNodeSetup(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded bg-cyan-950/40 border border-cyan-800/40 cursor-pointer"
                >
                  <Settings className="h-3 w-3" />
                  <span>Configure Node</span>
                </button>
              ) : (
                <button
                  onClick={() => handleDeleteNode(node.id, node.name)}
                  className="text-rose-400 hover:text-rose-300 p-1 rounded cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Local Node Setup Modal */}
      <LocalNodeSetupModal
        isOpen={showLocalNodeSetup}
        onClose={() => setShowLocalNodeSetup(false)}
        onSuccess={() => {
          loadNodes();
        }}
      />

      {/* Add Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0c121e] p-5 sm:p-6 text-xs shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-white font-['Rajdhani',sans-serif] text-base uppercase">
                Register External Compute Node
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNode} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Node Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. US-East Dedicated-01"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">IP Address / FQDN</label>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.1.100"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">vCPU Cores</label>
                  <input
                    type="number"
                    value={cpuCores}
                    onChange={(e) => setCpuCores(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">RAM (MB)</label>
                  <input
                    type="number"
                    value={ramMb}
                    onChange={(e) => setRamMb(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Disk (GB)</label>
                  <input
                    type="number"
                    value={diskGb}
                    onChange={(e) => setDiskGb(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 shadow-md shadow-cyan-500/20 transition-all"
                >
                  Register Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


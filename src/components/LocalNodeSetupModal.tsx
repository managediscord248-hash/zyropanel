import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Terminal,
  Cpu,
  HardDrive,
  FolderLock,
  Radio,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Zap,
  Server,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { NodeItem } from '../types';

interface LocalNodeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (node: NodeItem) => void;
}

export const LocalNodeSetupModal: React.FC<LocalNodeSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  // Form fields matching user specification
  const [name, setName] = useState('Local Node (Master)');
  const [location, setLocation] = useState('Localhost / Primary Host');
  const [description, setDescription] = useState('Primary Docker Container Engine & Tunnel Daemon');

  const [cpuPercent, setCpuPercent] = useState(100);
  const [ramGb, setRamGb] = useState(16);
  const [storageGb, setStorageGb] = useState(250);

  const [dockerStorageDir, setDockerStorageDir] = useState('/var/lib/zyrocloud/nodes/local-node');
  const [serverDataDir, setServerDataDir] = useState('/var/lib/zyrocloud/servers');
  const [portRange, setPortRange] = useState('25565-30000');
  const [enablePlayit, setEnablePlayit] = useState(true);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleStartSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsExecuting(true);
    setIsCompleted(false);
    setLogs([
      '================================================',
      '        ZYROCLOUD LOCAL NODE SETUP',
      '================================================',
      `Node Name: ${name}`,
      `Node Location: ${location}`,
      `Node Description: ${description}`,
      '',
      `CPU Allocation (%): ${cpuPercent}%`,
      `RAM Allocation (GB): ${ramGb} GB`,
      `Storage Allocation (GB): ${storageGb} GB`,
      '',
      `Docker Storage Directory: [${dockerStorageDir}]`,
      `Server Data Directory: [${serverDataDir}]`,
      `Node Port Range: [${portRange}]`,
      `Enable Playit: [${enablePlayit ? 'Y' : 'n'}]`,
      '================================================',
      'Configuring Local Node...'
    ]);

    const stepLogs = [
      'Installing required dependencies...',
      'Installing/configuring Docker...',
      'Creating isolated directories...',
      'Registering Local Node...',
      'Testing Docker...',
      'Testing storage...',
      'Testing network...'
    ];

    try {
      // Step-by-step feedback
      for (let i = 0; i < stepLogs.length; i++) {
        await new Promise((r) => setTimeout(r, 200));
        setLogs((prev) => [...prev, stepLogs[i]]);
      }

      const res = await api.setupLocalNode({
        name,
        location,
        description,
        cpu_allocation_percent: Number(cpuPercent),
        ram_allocation_gb: Number(ramGb),
        storage_allocation_gb: Number(storageGb),
        docker_storage_dir: dockerStorageDir,
        server_data_dir: serverDataDir,
        port_range: portRange,
        enable_playit: enablePlayit
      });

      if (res.logs && res.logs.length > 0) {
        setLogs(res.logs);
      } else {
        setLogs((prev) => [
          ...prev,
          '================================================',
          'LOCAL NODE READY ✓',
          '================================================'
        ]);
      }

      setIsCompleted(true);
      if (onSuccess && res.node) {
        onSuccess(res.node);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Setup encountered an error');
      setLogs((prev) => [...prev, `[ERROR] ${err.message || 'Failed'}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setIsCompleted(false);
    setIsExecuting(false);
    setLogs([]);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0c121e] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Rajdhani',sans-serif] tracking-wider flex items-center gap-2">
                <span>ZYROCLOUD LOCAL NODE SETUP</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
                  DAEMON INIT
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Provision isolated Docker host engine & tunnel networking
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExecuting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* ASCII Banner Box */}
          <div className="font-mono text-[11px] sm:text-xs text-cyan-400 bg-slate-950 border border-cyan-900/60 rounded-xl p-4 shadow-inner">
            <div className="text-center font-bold tracking-wider text-cyan-300">
              ================================================<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ZYROCLOUD LOCAL NODE SETUP<br />
              ================================================
            </div>
          </div>

          {!isExecuting && logs.length === 0 ? (
            /* Setup Parameters Form */
            <form onSubmit={handleStartSetup} className="space-y-5">
              {/* Identity Details */}
              <div className="space-y-3">
                <div className="text-[11px] font-mono font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Node Metadata</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      Node Name: <span className="text-cyan-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Local Node (Master)"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono placeholder-slate-600 focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      Node Location:
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Localhost / Primary Host"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono placeholder-slate-600 focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-mono font-medium mb-1">
                    Node Description:
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Primary Docker Container Engine & Tunnel Daemon"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono placeholder-slate-600 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>
              </div>

              {/* Hardware Allocations */}
              <div className="space-y-3 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-mono font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Hardware Capacity Allocation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      CPU Allocation (%):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={cpuPercent}
                        onChange={(e) => setCpuPercent(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono focus:border-cyan-500/60 focus:outline-none pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      RAM Allocation (GB):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="512"
                        value={ramGb}
                        onChange={(e) => setRamGb(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono focus:border-cyan-500/60 focus:outline-none pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">GB</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      Storage Allocation (GB):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="10"
                        max="10000"
                        value={storageGb}
                        onChange={(e) => setStorageGb(Number(e.target.value))}
                        required
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono focus:border-cyan-500/60 focus:outline-none pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">GB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Directories & Port Range */}
              <div className="space-y-3 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-mono font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <FolderLock className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Filesystem Paths & Networking</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      Docker Storage Directory:
                    </label>
                    <input
                      type="text"
                      value={dockerStorageDir}
                      onChange={(e) => setDockerStorageDir(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono text-[11px] focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      Server Data Directory:
                    </label>
                    <input
                      type="text"
                      value={serverDataDir}
                      onChange={(e) => setServerDataDir(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono text-[11px] focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      Node Port Range:
                    </label>
                    <input
                      type="text"
                      value={portRange}
                      onChange={(e) => setPortRange(e.target.value)}
                      required
                      placeholder="25565-30000"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-white font-mono focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-mono font-medium mb-1">
                      Enable Playit.gg Tunnels:
                    </label>
                    <div className="flex items-center gap-3 py-1">
                      <button
                        type="button"
                        onClick={() => setEnablePlayit(true)}
                        className={`flex-1 py-2 px-3 rounded-xl border font-mono font-bold text-xs transition-all ${
                          enablePlayit
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        [Y] Yes (Enabled)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnablePlayit(false)}
                        className={`flex-1 py-2 px-3 rounded-xl border font-mono font-bold text-xs transition-all ${
                          !enablePlayit
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                            : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        [n] No (Disabled)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>START LOCAL NODE SETUP</span>
                </button>
              </div>
            </form>
          ) : (
            /* Live Execution Terminal */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${isExecuting ? 'bg-amber-400 animate-ping' : isCompleted ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="font-mono text-slate-300 font-medium">
                    {isExecuting ? 'Executing configuration & service tests...' : isCompleted ? 'Setup Execution Complete' : 'Setup Finished'}
                  </span>
                </div>
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    LOCAL NODE READY ✓
                  </span>
                )}
              </div>

              {/* Terminal Screen */}
              <div className="rounded-xl border border-slate-800 bg-black/95 p-4 font-mono text-xs sm:text-sm text-slate-200 shadow-inner overflow-y-auto max-h-[380px] space-y-1 scrollbar-thin">
                {logs.map((line, idx) => {
                  const isHeader = line.includes('===') || line.includes('ZYROCLOUD LOCAL NODE SETUP');
                  const isSuccess = line.includes('LOCAL NODE READY') || line.includes('[OK]') || line.includes('✓');
                  const isStep = line.endsWith('...') || line.startsWith('Testing') || line.startsWith('Installing') || line.startsWith('Creating') || line.startsWith('Registering');
                  
                  return (
                    <div
                      key={idx}
                      className={`${
                        isSuccess
                          ? 'text-emerald-400 font-bold text-sm'
                          : isHeader
                          ? 'text-cyan-400 font-bold'
                          : isStep
                          ? 'text-cyan-200'
                          : 'text-slate-300'
                      }`}
                    >
                      {line || '\u00A0'}
                    </div>
                  );
                })}
                <div ref={terminalEndRef} />
              </div>

              {/* Completion Controls */}
              {isCompleted && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reconfigure Setup Parameters</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Finish & Return to Node Cluster</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

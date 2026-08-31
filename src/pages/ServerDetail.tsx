import React, { useState, useEffect, useRef } from 'react';
import { ServerItem, ServerStats, FileItem, BackupItem, PlayitTunnel } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import {
  Server,
  Terminal,
  FolderOpen,
  Radio,
  Archive,
  Sliders,
  Play,
  Square,
  RotateCw,
  Skull,
  ArrowLeft,
  Copy,
  Check,
  Upload,
  Plus,
  Trash2,
  Download,
  FileText,
  Folder,
  Save,
  Globe,
  HardDrive,
  Cpu,
  Activity,
  Send,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface ServerDetailProps {
  serverId: string;
  initialTab?: string;
  onBack: () => void;
}

export const ServerDetail: React.FC<ServerDetailProps> = ({ serverId, initialTab = 'overview', onBack }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [server, setServer] = useState<ServerItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [powerLoading, setPowerLoading] = useState(false);

  // -------------------------------------------------------------
  // Console Tab State
  // -------------------------------------------------------------
  const [consoleLogs, setConsoleLogs] = useState<string>('');
  const [commandInput, setCommandInput] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // -------------------------------------------------------------
  // Files Tab State
  // -------------------------------------------------------------
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // Playit Tab State
  // -------------------------------------------------------------
  const [playitStatus, setPlayitStatus] = useState<PlayitTunnel | null>(null);
  const [playitLogs, setPlayitLogs] = useState<string>('');
  const [playitLoading, setPlayitLoading] = useState(false);

  // -------------------------------------------------------------
  // Backups Tab State
  // -------------------------------------------------------------
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [backupName, setBackupName] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);

  // -------------------------------------------------------------
  // Settings Tab State
  // -------------------------------------------------------------
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editStartup, setEditStartup] = useState('');
  const [editRam, setEditRam] = useState<number>(2048);
  const [editCpu, setEditCpu] = useState<number>(2.0);
  const [editDisk, setEditDisk] = useState<number>(20);
  const [editEnv, setEditEnv] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Load Server Data
  const loadServer = async () => {
    try {
      const data = await api.getServer(serverId);
      setServer(data);
      setEditName(data.name);
      setEditImage(data.docker_image);
      setEditStartup(data.startup_command);
      setEditRam(data.ram_limit_mb);
      setEditCpu(data.cpu_limit);
      setEditDisk(data.disk_limit_gb);
      setEditEnv(data.environment_variables);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const s = await api.getServerStats(serverId);
      setStats(s);
    } catch (err) {}
  };

  useEffect(() => {
    loadServer();
    loadStats();
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, [serverId]);

  // -------------------------------------------------------------
  // WebSocket Console Connection
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'console') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('zyrocloud_token') || '';
    const wsUrl = `${protocol}//${window.location.host}/ws/console/${serverId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'logs') {
          setConsoleLogs(msg.data);
        } else if (msg.type === 'output' || msg.type === 'command_output') {
          setConsoleLogs((prev) => prev + '\n' + msg.data);
        }
      } catch (err) {}
    };

    // Fallback polling for initial logs
    api.getServerLogs(serverId).then((res) => {
      if (res.logs) setConsoleLogs(res.logs);
    }).catch(() => {});

    return () => {
      ws.close();
    };
  }, [activeTab, serverId]);

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, autoScroll]);

  // -------------------------------------------------------------
  // File Manager Handlers
  // -------------------------------------------------------------
  const loadFiles = async (p: string = currentPath) => {
    setFileLoading(true);
    try {
      const list = await api.listFiles(serverId, p);
      setFiles(list);
      setCurrentPath(p);
      setEditingFile(null);
    } catch (err: any) {
      alert(`File manager error: ${err.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'files') {
      loadFiles('');
    }
  }, [activeTab, serverId]);

  const handleOpenFile = async (item: FileItem) => {
    if (item.is_directory) {
      loadFiles(item.path);
    } else {
      try {
        const res = await api.readFile(serverId, item.path);
        setEditingFile({ path: item.path, content: res.content });
      } catch (err: any) {
        alert(`Cannot open file: ${err.message}`);
      }
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    try {
      await api.writeFile(serverId, editingFile.path, editingFile.content);
      alert('File saved successfully!');
    } catch (err: any) {
      alert(`Error saving file: ${err.message}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const full = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
      await api.createDirectory(serverId, full);
      setNewFolderName('');
      setShowNewFolderModal(false);
      loadFiles(currentPath);
    } catch (err: any) {
      alert(`Error creating directory: ${err.message}`);
    }
  };

  const handleDeleteItem = async (p: string) => {
    if (!confirm(`Are you sure you want to delete '${p}'? This action cannot be undone.`)) return;
    try {
      await api.deleteFile(serverId, p);
      loadFiles(currentPath);
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const isBase64 = typeof content === 'string' && content.startsWith('data:');
          const payloadContent = isBase64 ? content.split(',')[1] : content;

          const res = await fetch(`/api/servers/${serverId}/files/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('zyrocloud_token')}`
            },
            body: JSON.stringify({
              directory: currentPath,
              filename: file.name,
              content: payloadContent,
              is_base64: isBase64
            })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Upload failed');
          }
          loadFiles(currentPath);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err: any) {
          alert(`Upload error: ${err.message}`);
        }
      };

      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.yml') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.properties') ||
        file.name.endsWith('.cfg') ||
        file.name.endsWith('.conf') ||
        file.name.endsWith('.sh') ||
        file.name.endsWith('.log')
      ) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // Playit Handlers
  // -------------------------------------------------------------
  const loadPlayit = async () => {
    try {
      const [status, logs] = await Promise.all([
        api.getPlayitStatus(serverId),
        api.getPlayitLogs(serverId)
      ]);
      setPlayitStatus(status);
      setPlayitLogs(logs.logs);
    } catch (err) {}
  };

  useEffect(() => {
    if (activeTab === 'playit') {
      loadPlayit();
      const interval = setInterval(loadPlayit, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, serverId]);

  const handlePlayitAction = async (action: 'start' | 'stop' | 'restart' | 'reset') => {
    setPlayitLoading(true);
    try {
      if (action === 'start') await api.startPlayit(serverId);
      else if (action === 'stop') await api.stopPlayit(serverId);
      else if (action === 'restart') await api.restartPlayit(serverId);
      else if (action === 'reset') {
        if (!confirm('Are you sure you want to reset Playit tunnel configuration? This will stop the daemon and delete local agent secret keys so you can re-claim it.')) return;
        await api.resetPlayit(serverId);
      }
      await loadPlayit();
    } catch (err: any) {
      alert(`Playit tunnel action error: ${err.message}`);
    } finally {
      setPlayitLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Backup Handlers
  // -------------------------------------------------------------
  const loadBackups = async () => {
    try {
      const list = await api.getBackups(serverId);
      setBackups(list);
    } catch (err) {}
  };

  useEffect(() => {
    if (activeTab === 'backups') {
      loadBackups();
    }
  }, [activeTab, serverId]);

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      await api.createBackup(serverId, backupName || `Snapshot_${Date.now()}`);
      setBackupName('');
      await loadBackups();
    } catch (err: any) {
      alert(`Backup error: ${err.message}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? Current server configuration will be replaced.')) return;
    try {
      await api.restoreBackup(serverId, backupId);
      alert('Backup snapshot restored successfully!');
      loadServer();
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Delete this backup snapshot?')) return;
    try {
      await api.deleteBackup(serverId, backupId);
      loadBackups();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // Power Controls
  // -------------------------------------------------------------
  const handlePower = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
    setPowerLoading(true);
    try {
      await api.powerAction(serverId, action);
      await loadServer();
      await loadStats();
    } catch (err: any) {
      alert(`Power action failed: ${err.message}`);
    } finally {
      setPowerLoading(false);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    const cmd = commandInput.trim();
    setCommandInput('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'command', command: cmd }));
    } else {
      try {
        const res = await api.sendCommand(serverId, cmd);
        setConsoleLogs((prev) => `${prev}\n> ${cmd}\n${res.output}`);
      } catch (err: any) {
        alert(`Command execution error: ${err.message}`);
      }
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateServer(serverId, {
        name: editName,
        docker_image: editImage,
        startup_command: editStartup,
        ram_limit_mb: editRam,
        cpu_limit: editCpu,
        disk_limit_gb: editDisk,
        environment_variables: editEnv
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      loadServer();
    } catch (err: any) {
      alert(`Settings update error: ${err.message}`);
    }
  };

  const handleDeleteServer = async () => {
    if (!confirm(`CRITICAL: Are you absolutely sure you want to delete server '${server?.name}'? All container instances and files will be permanently erased.`)) return;
    try {
      await api.deleteServer(serverId);
      onBack();
    } catch (err: any) {
      alert(`Failed to delete server: ${err.message}`);
    }
  };

  if (loading || !server) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 text-xs">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent mb-3" />
        <span>Loading server instance...</span>
      </div>
    );
  }

  const primaryPort = server.ports?.find((p) => p.is_primary)?.host_port || 25565;
  const isRunning = server.status === 'RUNNING';

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: Server },
    { id: 'console', label: 'Interactive Console', icon: Terminal },
    { id: 'files', label: 'File Manager', icon: FolderOpen },
    { id: 'playit', label: 'Playit Tunnel', icon: Radio },
    { id: 'backups', label: 'Backups', icon: Archive },
    { id: 'settings', label: 'Configuration', icon: Sliders }
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 sm:pb-5">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white transition-colors mt-0.5 sm:mt-0"
            title="Back to Servers"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-xl font-bold text-white font-['Rajdhani',sans-serif] tracking-wide truncate max-w-[200px] sm:max-w-md">
                {server.name}
              </h1>
              <StatusBadge status={server.status} size="sm" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400 mt-1">
              <span>Port: {primaryPort}</span>
              <span>•</span>
              <span className="text-cyan-400 font-bold truncate max-w-[140px] sm:max-w-[220px]">{server.docker_image}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">ID: {server.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Global Power Action Strip */}
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <>
              <button
                disabled={powerLoading}
                onClick={() => handlePower('restart')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors active:scale-95"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Restart</span>
              </button>
              <button
                disabled={powerLoading}
                onClick={() => handlePower('stop')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-800/80 bg-rose-950/50 text-xs font-bold text-rose-300 hover:bg-rose-900/60 transition-colors active:scale-95"
              >
                <Square className="h-3.5 w-3.5" />
                <span>Stop</span>
              </button>
              <button
                disabled={powerLoading}
                onClick={() => handlePower('kill')}
                title="Force Kill Process (SIGKILL)"
                className="flex items-center justify-center h-8 w-8 rounded-xl border border-rose-900 bg-rose-950/80 text-rose-400 hover:bg-rose-900 transition-colors active:scale-95 shrink-0"
              >
                <Skull className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              disabled={powerLoading}
              onClick={() => handlePower('start')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start Server</span>
            </button>
          )}
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-800/80 overflow-x-auto pb-px scrollbar-thin">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold tracking-wide transition-all border-b-2 whitespace-nowrap shrink-0 ${
                active
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------- */}
      {/* 1. OVERVIEW TAB */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-5 sm:space-y-6">
          {/* Live Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* CPU Metric */}
            <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] font-mono">CPU Load</span>
                <Cpu className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white font-mono">
                {stats?.cpu_percent.toFixed(1) || '0.0'}%
              </div>
              <div className="mt-2.5 sm:mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats?.cpu_percent || 0, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                Allocated: {server.cpu_limit} vCPU Cores
              </div>
            </div>

            {/* RAM Metric */}
            <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] font-mono">Memory Usage</span>
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white font-mono truncate">
                {stats?.memory_used_mb || 0} <span className="text-xs sm:text-sm font-normal text-slate-400">/ {server.ram_limit_mb} MB</span>
              </div>
              <div className="mt-2.5 sm:mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats?.memory_percent || 0}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                {(stats?.memory_percent || 0).toFixed(1)}% Memory Pool
              </div>
            </div>

            {/* Disk Metric */}
            <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] font-mono">Disk Storage</span>
                <HardDrive className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white font-mono truncate">
                {stats?.disk_used_gb || 0.5} <span className="text-xs sm:text-sm font-normal text-slate-400">/ {server.disk_limit_gb} GB</span>
              </div>
              <div className="mt-2.5 sm:mt-3 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[8%]" />
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                Root: /var/lib/zyrocloud/servers/{server.id.slice(0, 8)}/
              </div>
            </div>

            {/* Network Traffic */}
            <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] font-mono">Network I/O</span>
                <Globe className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono space-y-0.5 sm:space-y-1 mt-1">
                <div>RX: {((stats?.network_rx_bytes || 0) / (1024 * 1024)).toFixed(2)} MB</div>
                <div>TX: {((stats?.network_tx_bytes || 0) / (1024 * 1024)).toFixed(2)} MB</div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-2 sm:mt-3">
                Uptime: {stats?.uptime_seconds ? `${Math.floor(stats.uptime_seconds / 60)} mins` : 'Offline'}
              </div>
            </div>
          </div>

          {/* Connection Endpoints */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-white font-['Rajdhani',sans-serif] tracking-wider uppercase flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-400" />
              <span>Multiplayer Connection Endpoints</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs font-mono">
              {/* Direct LAN/IP Port */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase">Direct IP / Host Address</div>
                  <div className="font-bold text-white mt-0.5 truncate">127.0.0.1:{primaryPort}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(`127.0.0.1:${primaryPort}`, 'direct')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                >
                  {copiedKey === 'direct' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'direct' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Playit Zero-Port Tunnel */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-emerald-400 uppercase font-semibold">Playit Public Tunnel</div>
                  <div className="font-bold text-emerald-300 mt-0.5 truncate">
                    {(playitStatus?.status === 'ONLINE' || playitStatus?.status === 'CONNECTED') && playitStatus?.tunnel_address
                      ? playitStatus.tunnel_address
                      : playitStatus?.status === 'AWAITING_CLAIM'
                      ? 'Awaiting Claim Code'
                      : 'Tunnel not active'}
                  </div>
                </div>
                {(playitStatus?.status === 'ONLINE' || playitStatus?.status === 'CONNECTED') && playitStatus?.tunnel_address ? (
                  <button
                    onClick={() => copyToClipboard(playitStatus.tunnel_address || '', 'playit')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                  >
                    {copiedKey === 'playit' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedKey === 'playit' ? 'Copied' : 'Copy'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('playit')}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold shrink-0 hover:bg-cyan-500/20 transition-colors"
                  >
                    {playitStatus?.status === 'AWAITING_CLAIM' ? 'Claim Agent' : 'Configure'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 2. INTERACTIVE CONSOLE TAB */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'console' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>WebSocket Log Stream (Connected)</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 accent-cyan-400"
                />
                <span>Auto-Scroll</span>
              </label>
              <button
                onClick={() => setConsoleLogs('')}
                className="px-2 py-1 rounded-md bg-slate-800 text-slate-400 hover:text-white transition-colors text-xs"
              >
                Clear Terminal
              </button>
            </div>
          </div>

          {/* Terminal Display */}
          <div className="h-[360px] sm:h-[460px] rounded-2xl border border-slate-800 bg-[#050811] p-3 sm:p-4 font-mono text-xs text-slate-200 overflow-y-auto shadow-inner leading-relaxed select-text">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5">
              {consoleLogs || '[Terminal] Waiting for container output...'}
            </pre>
            <div ref={consoleEndRef} />
          </div>

          {/* Command Prompt */}
          <form onSubmit={handleSendCommand} className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Send a command (e.g. list, help, say Hello, op player)..."
                className="w-full rounded-xl border border-slate-800 bg-[#0c121e] px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-cyan-500 px-4 sm:px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Execute</span>
            </button>
          </form>

          {/* Fast Command Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 text-xs">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">Quick:</span>
            {['list', 'tps', 'status', 'save-all', 'help'].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => {
                  setCommandInput(cmd);
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 font-mono text-[11px] transition-colors"
              >
                /{cmd}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 3. FILE MANAGER TAB */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Breadcrumb Path Bar & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-mono text-slate-300 overflow-x-auto scrollbar-thin py-0.5">
              <button
                onClick={() => loadFiles('')}
                className="hover:text-cyan-400 font-bold transition-colors shrink-0 flex items-center gap-1 text-cyan-400"
                title="Server Root Directory (/)"
              >
                <Folder className="h-3.5 w-3.5" />
                <span>/</span>
              </button>
              {currentPath.split('/').filter(Boolean).map((segment, idx, arr) => {
                const sub = arr.slice(0, idx + 1).join('/');
                return (
                  <React.Fragment key={sub}>
                    <span className="text-slate-600">/</span>
                    <button
                      onClick={() => loadFiles(sub)}
                      className="hover:text-cyan-400 font-medium text-slate-200 transition-colors shrink-0"
                    >
                      {segment}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload</span>
              </button>
              <button
                onClick={() => setShowNewFolderModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Folder</span>
              </button>
            </div>
          </div>

          {/* New Folder Inline Form */}
          {showNewFolderModal && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 rounded-xl bg-slate-900 border border-cyan-500/40 text-xs">
              <Folder className="h-4 w-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                className="flex-1 min-w-[150px] rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-white focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateFolder}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* File Editor Mode or File Table */}
          {editingFile ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0c121e] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 bg-slate-900/90">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 truncate max-w-[200px] sm:max-w-md">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{editingFile.path}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setEditingFile(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Close Editor
                  </button>
                  <button
                    onClick={handleSaveFile}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save File</span>
                  </button>
                </div>
              </div>
              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                rows={18}
                className="w-full bg-[#050811] p-4 font-mono text-xs text-slate-200 focus:outline-none leading-relaxed"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] text-slate-400 uppercase">
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Modified</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {files.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          Directory is empty.
                        </td>
                      </tr>
                    ) : (
                      files.map((item) => (
                        <tr
                          key={item.path}
                          onClick={() => handleOpenFile(item)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4 font-medium text-white flex items-center gap-2.5">
                            {item.is_directory ? (
                              <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[200px] sm:max-w-xs">{item.name}</span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-400">
                            {item.is_directory ? '-' : `${(item.size / 1024).toFixed(1)} KB`}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-400">
                            {new Date(item.modified_at).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {!item.is_directory && (
                                <a
                                  href={`/api/servers/${serverId}/files/download?path=${encodeURIComponent(item.path)}`}
                                  download
                                  title="Download File"
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteItem(item.path)}
                                title="Delete"
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-950/60 hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 4. PLAYIT.GG TUNNEL TAB */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'playit' && (() => {
        const isOnline = playitStatus?.status === 'ONLINE' || playitStatus?.status === 'CONNECTED';
        const isAwaitingClaim = playitStatus?.status === 'AWAITING_CLAIM';
        const isStopped = playitStatus?.status === 'STOPPED';
        const isStarting = playitStatus?.status === 'STARTING' || playitStatus?.status === 'CONNECTING';
        const isNotConfigured = !playitStatus || playitStatus.status === 'NOT_CONFIGURED';

        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-6 space-y-5">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                    isOnline
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : isAwaitingClaim
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 animate-pulse'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}>
                    <Radio className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-['Rajdhani',sans-serif] tracking-wider">
                      PLAYIT.GG ZERO-PORT-FORWARD TUNNEL
                    </h3>
                    <p className="text-xs text-slate-400">
                      Isolated daemon sandbox &bull; PID: {playitStatus?.process_pid || 'Process Inactive'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isOnline && (
                    <>
                      <button
                        disabled={playitLoading}
                        onClick={() => handlePlayitAction('restart')}
                        className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${playitLoading ? 'animate-spin' : ''}`} />
                        <span>Restart Daemon</span>
                      </button>
                      <button
                        disabled={playitLoading}
                        onClick={() => handlePlayitAction('stop')}
                        className="px-3 py-2 rounded-xl border border-rose-800/80 bg-rose-950/50 text-xs font-bold text-rose-300 hover:bg-rose-900 transition-colors flex items-center gap-1.5"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" />
                        <span>Stop Tunnel</span>
                      </button>
                      <button
                        disabled={playitLoading}
                        onClick={() => handlePlayitAction('reset')}
                        className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-slate-400 hover:text-rose-300 hover:border-rose-800 transition-colors"
                        title="Reset Playit configuration"
                      >
                        Reset
                      </button>
                    </>
                  )}

                  {isAwaitingClaim && (
                    <>
                      {playitStatus?.claim_url && (
                        <a
                          href={playitStatus.claim_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/25"
                        >
                          <span>Claim Agent</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        disabled={playitLoading}
                        onClick={() => handlePlayitAction('stop')}
                        className="px-3 py-2 rounded-xl border border-rose-800/80 bg-rose-950/50 text-xs font-bold text-rose-300 hover:bg-rose-900 transition-colors"
                      >
                        Stop Daemon
                      </button>
                      <button
                        disabled={playitLoading}
                        onClick={() => handlePlayitAction('reset')}
                        className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-slate-400 hover:text-rose-300 transition-colors"
                      >
                        Reset
                      </button>
                    </>
                  )}

                  {isStopped && (
                    <>
                      <button
                        disabled={playitLoading}
                        onClick={() => handlePlayitAction('start')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Start Playit</span>
                      </button>
                      <button
                        disabled={playitLoading}
                        onClick={() => handlePlayitAction('reset')}
                        className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Reset Config
                      </button>
                    </>
                  )}

                  {isNotConfigured && (
                    <button
                      disabled={playitLoading}
                      onClick={() => handlePlayitAction('start')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Start Playit Setup</span>
                    </button>
                  )}

                  {isStarting && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Initializing Daemon...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* State Representation */}
              {isNotConfigured && (
                <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                      <span className="font-bold text-slate-300 uppercase tracking-wider text-sm font-['Rajdhani',sans-serif]">
                        PLAYIT NOT CONFIGURED
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Start Playit setup to connect this node. No port forwarding is required.
                    </p>
                  </div>
                  <button
                    disabled={playitLoading}
                    onClick={() => handlePlayitAction('start')}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-md shadow-cyan-500/20 shrink-0"
                  >
                    Start Playit Setup
                  </button>
                </div>
              )}

              {isStopped && (
                <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                      <span className="font-bold text-slate-300 uppercase tracking-wider text-sm font-['Rajdhani',sans-serif]">
                        PLAYIT DAEMON STOPPED
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      The Playit tunnel daemon process is inactive. Launch it below to resume public routing.
                    </p>
                  </div>
                  <button
                    disabled={playitLoading}
                    onClick={() => handlePlayitAction('start')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-md shadow-emerald-500/20 shrink-0"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Start Playit</span>
                  </button>
                </div>
              )}

              {isAwaitingClaim && (
                <div className="p-5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                      </span>
                      <div>
                        <span className="font-bold text-cyan-200 uppercase tracking-wider text-sm font-['Rajdhani',sans-serif]">
                          PLAYIT AWAITING CLAIM
                        </span>
                        <p className="text-xs text-cyan-300/80 mt-0.5">
                          Playit daemon is running in sandbox (PID: {playitStatus?.process_pid || 'Active'}). Waiting for agent authentication...
                        </p>
                      </div>
                    </div>
                    {playitStatus?.claim_url && (
                      <a
                        href={playitStatus.claim_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/30 transition-all shrink-0"
                      >
                        <span>Claim Agent on Playit.gg</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3.5 rounded-lg bg-slate-900/90 border border-cyan-900/50">
                      <div className="text-[10px] text-slate-400 uppercase">Real Claim Link</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-cyan-300 font-semibold truncate select-all">{playitStatus?.claim_url || 'Detecting claim link...'}</span>
                        {playitStatus?.claim_url && (
                          <button
                            onClick={() => copyToClipboard(playitStatus.claim_url!, 'claim_url')}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white shrink-0"
                            title="Copy Claim URL"
                          >
                            {copiedKey === 'claim_url' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-slate-900/90 border border-cyan-900/50">
                      <div className="text-[10px] text-slate-400 uppercase">Claim Code</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-cyan-300 font-bold tracking-widest truncate select-all">
                          {playitStatus?.claim_code || (playitStatus?.claim_url ? playitStatus.claim_url.split('/').pop() : 'Waiting for code...')}
                        </span>
                        {playitStatus?.claim_code && (
                          <button
                            onClick={() => copyToClipboard(playitStatus.claim_code!, 'claim_code')}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white shrink-0"
                            title="Copy Claim Code"
                          >
                            {copiedKey === 'claim_code' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isOnline && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-xs font-mono">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Daemon Process Status</div>
                    <div className="mt-1">
                      <StatusBadge status="ONLINE" size="sm" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Public Ingress Address</div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-bold text-emerald-300 truncate select-all">{playitStatus?.tunnel_address || 'Connected'}</span>
                      {playitStatus?.tunnel_address && (
                        <button
                          onClick={() => copyToClipboard(playitStatus.tunnel_address!, 'tunnel_addr')}
                          className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white shrink-0"
                          title="Copy Address"
                        >
                          {copiedKey === 'tunnel_addr' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 sm:col-span-2 md:col-span-1">
                    <div className="text-[10px] text-slate-400 uppercase">Daemon Process PID</div>
                    <div className="mt-1 font-bold text-slate-200">
                      {playitStatus?.process_pid || 'Active'}
                    </div>
                  </div>
                </div>
              )}

              {/* Playit Logs Terminal */}
              <div>
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-400 mb-2 uppercase">
                  <span>Daemon Output Logs</span>
                  {playitStatus?.process_pid && (
                    <span className="text-emerald-400 text-[10px] font-normal lowercase">live stream (pid {playitStatus.process_pid})</span>
                  )}
                </div>
                <div className="h-44 sm:h-52 rounded-xl border border-slate-800 bg-[#050811] p-3.5 font-mono text-[11px] text-slate-300 overflow-y-auto">
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {playitLogs || (isNotConfigured ? 'Playit daemon has not been started. Click "Start Playit Setup" above to begin.' : 'No daemon output captured yet.')}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --------------------------------------------------------- */}
      {/* 5. BACKUPS TAB */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'backups' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-[#0c121e]/90">
            <div>
              <h3 className="text-sm font-bold text-white font-['Rajdhani',sans-serif] tracking-wider uppercase">
                WORLD & CONFIG SNAPSHOTS
              </h3>
              <p className="text-xs text-slate-400">
                Complete point-in-time archives stored in /var/lib/zyrocloud/backups/{server.id.slice(0, 8)}/
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="Snapshot label..."
                className="w-full sm:w-auto rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                disabled={backupLoading}
                onClick={handleCreateBackup}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-sm disabled:opacity-50 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Backup</span>
              </button>
            </div>
          </div>

          {/* Backup Snapshots Table */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] text-slate-400 uppercase">
                    <th className="py-3 px-4">Backup Name</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        No backups generated yet. Create one above!
                      </td>
                    </tr>
                  ) : (
                    backups.map((bkp) => (
                      <tr key={bkp.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <Archive className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{bkp.name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {(bkp.size_bytes / (1024 * 1024)).toFixed(1)} MB
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(bkp.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestoreBackup(bkp.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 transition-colors"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(bkp.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-950 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 6. CONFIGURATION & SETTINGS TAB */}
      {/* --------------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-4 sm:p-6 space-y-5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white font-['Rajdhani',sans-serif] tracking-wider uppercase">
                  CONTAINER SPECS & STARTUP PARAMS
                </h3>
                <p className="text-xs text-slate-400">
                  Update hardware limits, Docker image tags, and environment variables.
                </p>
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20 shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </button>
            </div>

            {settingsSaved && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Server configuration saved successfully!</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Server Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Docker Image</label>
                <input
                  type="text"
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Hardware limits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">RAM Limit (MB) {!isAdmin && '(Admin Managed)'}</label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={editRam}
                  onChange={(e) => setEditRam(Number(e.target.value))}
                  className={`w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">vCPU Limit (Cores) {!isAdmin && '(Admin Managed)'}</label>
                <input
                  type="number"
                  step="0.5"
                  disabled={!isAdmin}
                  value={editCpu}
                  onChange={(e) => setEditCpu(Number(e.target.value))}
                  className={`w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Disk Quota (GB) {!isAdmin && '(Admin Managed)'}</label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={editDisk}
                  onChange={(e) => setEditDisk(Number(e.target.value))}
                  className={`w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Startup Command</label>
              <input
                type="text"
                value={editStartup}
                onChange={(e) => setEditStartup(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Environment Variables (JSON)</label>
              <textarea
                value={editEnv}
                onChange={(e) => setEditEnv(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </form>

          {/* Danger Zone (Admin Only) */}
          {isAdmin && (
            <div className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-4 sm:p-6 space-y-3">
              <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2 font-mono uppercase">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Danger Zone</span>
              </h4>
              <p className="text-xs text-rose-300/80">
                Permanently stops and purges this container, isolated filesystem records, allocated ports, and Playit tunnel maps.
              </p>
              <button
                type="button"
                onClick={handleDeleteServer}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-md shadow-rose-600/30"
              >
                Delete Server Permanently
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

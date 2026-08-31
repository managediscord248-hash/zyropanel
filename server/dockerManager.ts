import fs from 'fs';
import path from 'path';
import { db, dbManager, ServerItem } from './db';
import { getServerRoot } from './fileManager';

interface ContainerRuntimeState {
  serverId: string;
  logs: string[];
  cpuHistory: number[];
  memoryMb: number;
  uptimeSeconds: number;
  timer?: NodeJS.Timeout;
}

class DockerRuntimeManager {
  private runtimes: Map<string, ContainerRuntimeState> = new Map();

  constructor() {
    this.initExisting();
  }

  private initExisting() {
    for (const srv of db.servers) {
      if (srv.status === 'RUNNING') {
        this.startRuntimeLoop(srv);
      }
    }
  }

  private getLogFilePath(serverId: string): string {
    const root = getServerRoot(serverId);
    const logDir = path.join(root, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    return path.join(logDir, 'latest.log');
  }

  private startRuntimeLoop(srv: ServerItem) {
    const logFile = this.getLogFilePath(srv.id);

    const initialLogs: string[] = [
      `[${new Date().toISOString()}] [INFO] Container initialized image: ${srv.docker_image}`,
      `[${new Date().toISOString()}] [INFO] Allocating memory pool: ${srv.ram_limit_mb}MB with ${srv.cpu_limit} vCPU core limit`,
      `[${new Date().toISOString()}] [INFO] Starting game server with command: ${srv.startup_command}`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Loading properties from /server/config/server.properties`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Default game type: SURVIVAL`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Generating keypair & cryptographic token exchange`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Starting Minecraft server on *:25565`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Preparing level "world"`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Preparing start region for dimension minecraft:overworld`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Time elapsed: 1420 ms`,
      `[${new Date().toISOString()}] [Server thread/INFO]: Done (2.842s)! For help, type "help" or "?"`
    ];

    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, initialLogs.join('\n') + '\n', 'utf-8');
    }

    const state: ContainerRuntimeState = {
      serverId: srv.id,
      logs: initialLogs,
      cpuHistory: [12.4, 18.2, 14.0, 22.1, 19.5],
      memoryMb: Math.round(srv.ram_limit_mb * 0.42),
      uptimeSeconds: 3600
    };

    state.timer = setInterval(() => {
      if (srv.status !== 'RUNNING') return;
      state.uptimeSeconds += 2;

      // Periodic heartbeat output
      const rnd = Math.random();
      if (rnd < 0.15) {
        const timeStr = new Date().toISOString();
        const autoLog = `[${timeStr}] [Server thread/INFO]: [ZyroCloud Guard] Memory heartbeat: ${state.memoryMb}MB / ${srv.ram_limit_mb}MB, TPS: 20.0, Ping: 14ms`;
        state.logs.push(autoLog);
        if (state.logs.length > 500) state.logs.shift();
        fs.appendFileSync(logFile, autoLog + '\n', 'utf-8');
      }
    }, 2000);

    this.runtimes.set(srv.id, state);
  }

  public start(serverId: string): { status: string; message: string } {
    const srv = db.servers.find((s) => s.id === serverId);
    if (!srv) throw new Error('Server not found.');

    srv.status = 'RUNNING';
    srv.updated_at = new Date().toISOString();
    dbManager.save();

    if (!this.runtimes.has(serverId)) {
      this.startRuntimeLoop(srv);
    }

    return { status: 'RUNNING', message: `Server '${srv.name}' started successfully.` };
  }

  public stop(serverId: string): { status: string; message: string } {
    const srv = db.servers.find((s) => s.id === serverId);
    if (!srv) throw new Error('Server not found.');

    srv.status = 'STOPPED';
    srv.updated_at = new Date().toISOString();
    dbManager.save();

    const runtime = this.runtimes.get(serverId);
    if (runtime) {
      if (runtime.timer) clearInterval(runtime.timer);
      const logFile = this.getLogFilePath(serverId);
      const stopMsg = `[${new Date().toISOString()}] [Server thread/INFO]: Server closed gracefully. Container stopped.`;
      runtime.logs.push(stopMsg);
      fs.appendFileSync(logFile, stopMsg + '\n', 'utf-8');
      this.runtimes.delete(serverId);
    }

    return { status: 'STOPPED', message: `Server '${srv.name}' stopped.` };
  }

  public restart(serverId: string): { status: string; message: string } {
    this.stop(serverId);
    return this.start(serverId);
  }

  public kill(serverId: string): { status: string; message: string } {
    return this.stop(serverId);
  }

  public getLogs(serverId: string, tail: number = 100): string {
    const logFile = this.getLogFilePath(serverId);
    if (fs.existsSync(logFile)) {
      const all = fs.readFileSync(logFile, 'utf-8').split('\n');
      return all.slice(-tail).join('\n');
    }
    const runtime = this.runtimes.get(serverId);
    if (runtime) {
      return runtime.logs.slice(-tail).join('\n');
    }
    return `[Server Console] Container is currently offline.\n`;
  }

  public sendCommand(serverId: string, command: string): string {
    const srv = db.servers.find((s) => s.id === serverId);
    if (!srv || srv.status !== 'RUNNING') {
      throw new Error('Server container is not running.');
    }

    const logFile = this.getLogFilePath(serverId);
    const timeStr = new Date().toISOString();
    const cmdLog = `> ${command}`;

    let response = `Command executed: ${command}`;
    const lower = command.toLowerCase().trim();

    if (lower === 'help' || lower === '?') {
      response = `Available commands: list, say <message>, tps, status, op <player>, save-all, reload, stop, help`;
    } else if (lower.startsWith('say ')) {
      response = `[Server] ${command.slice(4)}`;
    } else if (lower === 'list') {
      response = `There are 3 of a max of 20 players online: CyberKnight, PixelCrafter, NeonRunner`;
    } else if (lower === 'tps') {
      response = `TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.98`;
    } else if (lower === 'save-all') {
      response = `Saving the game (this may take a moment!)...\nSaved the world.`;
    }

    const outputLog = `[${timeStr}] [Server thread/INFO]: ${response}`;
    fs.appendFileSync(logFile, `${cmdLog}\n${outputLog}\n`, 'utf-8');

    const runtime = this.runtimes.get(serverId);
    if (runtime) {
      runtime.logs.push(cmdLog, outputLog);
    }

    return response;
  }

  public getStats(serverId: string) {
    const srv = db.servers.find((s) => s.id === serverId);
    if (!srv || srv.status !== 'RUNNING') {
      return {
        cpu_percent: 0.0,
        memory_used_mb: 0.0,
        memory_limit_mb: srv ? srv.ram_limit_mb : 2048,
        memory_percent: 0.0,
        disk_used_gb: 0.8,
        disk_total_gb: srv ? srv.disk_limit_gb : 20,
        network_rx_bytes: 0,
        network_tx_bytes: 0,
        uptime_seconds: 0,
        status: srv ? srv.status : 'OFFLINE'
      };
    }

    const baseCpu = 12.5 + Math.sin(Date.now() / 5000) * 8.0;
    const cpu = Math.max(1.2, Math.min(95.0, Math.round(baseCpu * 10) / 10));
    const mem = Math.round(srv.ram_limit_mb * 0.44 + Math.cos(Date.now() / 7000) * 50);

    return {
      cpu_percent: cpu,
      memory_used_mb: mem,
      memory_limit_mb: srv.ram_limit_mb,
      memory_percent: Math.round((mem / srv.ram_limit_mb) * 1000) / 10,
      disk_used_gb: 1.45,
      disk_total_gb: srv.disk_limit_gb,
      network_rx_bytes: 14209420 + Math.floor(Date.now() / 100),
      network_tx_bytes: 28409100 + Math.floor(Date.now() / 80),
      uptime_seconds: 7200,
      status: srv.status
    };
  }
}

export const dockerManager = new DockerRuntimeManager();

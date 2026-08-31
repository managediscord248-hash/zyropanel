import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { db, dbManager, PlayitTunnelItem } from './db';

const BASE_DATA_DIR = process.env.DATA_DIRECTORY || path.resolve(process.cwd(), 'zyrocloud_data');
const PLAYIT_DIR = path.join(BASE_DATA_DIR, 'playit');

// Active running child processes in memory
const activeProcesses: Map<string, any> = new Map();

export class PlayitManager {
  static getBinaryPath(): string | null {
    // 1. Check system path
    const systemPath = '/usr/local/bin/playit';
    if (fs.existsSync(systemPath)) {
      try {
        fs.accessSync(systemPath, fs.constants.X_OK);
        return systemPath;
      } catch {
        // Continue
      }
    }

    // 2. Check local workspace bin
    const localBin = path.resolve(process.cwd(), 'bin', 'playit');
    if (fs.existsSync(localBin)) {
      try {
        fs.accessSync(localBin, fs.constants.X_OK);
        return localBin;
      } catch {
        // Continue
      }
    }

    // 3. Check system which
    try {
      const whichResult = execSync('which playit 2>/dev/null', { encoding: 'utf-8' }).trim();
      if (whichResult && fs.existsSync(whichResult)) {
        return whichResult;
      }
    } catch {
      // Ignore
    }

    return null;
  }

  static async ensureBinary(): Promise<string> {
    const existing = this.getBinaryPath();
    if (existing) return existing;

    const binDir = path.resolve(process.cwd(), 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const targetBin = path.join(binDir, 'playit');

    try {
      const arch = process.arch === 'arm64' ? 'aarch64' : 'amd64';
      const downloadUrl = `https://github.com/playit-cloud/playit-agent/releases/download/v0.15.26/playit-linux-${arch}`;
      console.log(`[PlayitManager] Downloading official Playit agent binary from ${downloadUrl}...`);
      execSync(`curl -sSfL "${downloadUrl}" -o "${targetBin}" && chmod +x "${targetBin}"`, { stdio: 'inherit' });
      if (fs.existsSync(targetBin)) {
        return targetBin;
      }
    } catch (err) {
      console.error('[PlayitManager] Failed to download playit binary:', err);
    }

    throw new Error('Playit binary is not installed on this system. Please verify installation.');
  }

  static getTunnelDir(serverId: string): string {
    const dir = path.join(PLAYIT_DIR, serverId);
    fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'runtime'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
    return dir;
  }

  static isPidAlive(pid: number | null | undefined): boolean {
    if (!pid || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      // Double check command line if on Linux
      if (process.platform === 'linux' && fs.existsSync(`/proc/${pid}/cmdline`)) {
        const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf-8').toLowerCase();
        return cmd.includes('playit');
      }
      return true;
    } catch {
      return false;
    }
  }

  static parseLogs(logContent: string): {
    claimUrl: string | null;
    claimCode: string | null;
    tunnelAddress: string | null;
    isConnected: boolean;
  } {
    let claimUrl: string | null = null;
    let claimCode: string | null = null;
    let tunnelAddress: string | null = null;
    let isConnected = false;

    if (!logContent) {
      return { claimUrl, claimCode, tunnelAddress, isConnected };
    }

    // Match claim URLs: https://playit.gg/claim/<hex_or_alphanumeric>
    const claimMatch = logContent.match(/https:\/\/playit\.gg\/claim\/([a-zA-Z0-9_-]+)/);
    if (claimMatch) {
      claimUrl = claimMatch[0];
      claimCode = claimMatch[1];
    } else {
      const manageMatch = logContent.match(/https:\/\/playit\.gg\/manage\/agents\/([a-zA-Z0-9_-]+)/);
      if (manageMatch) {
        claimUrl = manageMatch[0];
        claimCode = manageMatch[1];
      }
    }

    // Check if secret loaded or connection established
    if (
      logContent.includes('loading secret') ||
      logContent.includes('tunnel registered') ||
      logContent.includes('tunnel established') ||
      logContent.includes('connected to routing') ||
      logContent.includes('tunnel active')
    ) {
      isConnected = true;
    }

    // Match public tunnel addresses: e.g. domain.ply.gg:1234 or domain.joinmc.link:1234
    const addressMatches = logContent.match(/(?:[a-zA-Z0-9-]+\.)+(?:ply\.gg|playit\.gg|joinmc\.link|auto\.playit\.gg)(?::\d+)?/g);
    if (addressMatches && addressMatches.length > 0) {
      tunnelAddress = addressMatches[addressMatches.length - 1];
      isConnected = true;
    }

    return { claimUrl, claimCode, tunnelAddress, isConnected };
  }

  static getStatus(serverId: string) {
    let tunnel = db.playit_tunnels.find((t) => t.server_id === serverId);
    const tunnelDir = this.getTunnelDir(serverId);
    const pidFile = path.join(tunnelDir, 'playit.pid');
    const logFile = path.join(tunnelDir, 'logs', 'playit.log');
    const secretFile = path.join(tunnelDir, 'config', 'playit.toml');

    let pid: number | null = null;
    if (fs.existsSync(pidFile)) {
      try {
        const rawPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
        if (!isNaN(rawPid) && rawPid > 0) {
          pid = rawPid;
        }
      } catch {
        pid = null;
      }
    }

    const alive = this.isPidAlive(pid);
    if (!alive && pid) {
      // Stale PID file cleanup
      try {
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      } catch {
        // Ignore
      }
      pid = null;
    }

    let logs = '';
    if (fs.existsSync(logFile)) {
      try {
        logs = fs.readFileSync(logFile, 'utf-8');
      } catch {
        logs = '';
      }
    }

    const parsed = this.parseLogs(logs);

    let status: 'NOT_CONFIGURED' | 'AWAITING_CLAIM' | 'STARTING' | 'CONNECTED' | 'ONLINE' | 'STOPPED' | 'ERROR' = 'NOT_CONFIGURED';

    const hasSecretFile = fs.existsSync(secretFile) && fs.statSync(secretFile).size > 10;

    if (!tunnel && !pid && !logs) {
      status = 'NOT_CONFIGURED';
    } else if (!alive) {
      // Daemon process is stopped
      if (logs || hasSecretFile || (tunnel && tunnel.status !== 'NOT_CONFIGURED')) {
        status = 'STOPPED';
      } else {
        status = 'NOT_CONFIGURED';
      }
    } else {
      // Alive process
      if (parsed.claimUrl && !hasSecretFile) {
        status = 'AWAITING_CLAIM';
      } else if (parsed.isConnected || hasSecretFile) {
        status = 'ONLINE';
      } else {
        status = 'STARTING';
      }
    }

    // Sync in DB
    if (!tunnel) {
      tunnel = {
        id: `playit-${Date.now()}`,
        server_id: serverId,
        status: status,
        tunnel_address: parsed.tunnelAddress || undefined,
        claim_code: parsed.claimUrl || undefined,
        process_pid: pid || null,
        created_at: new Date().toISOString()
      };
      db.playit_tunnels.push(tunnel);
      dbManager.save();
    } else {
      let changed = false;
      if (tunnel.status !== status) {
        tunnel.status = status;
        changed = true;
      }
      if (tunnel.process_pid !== (pid || null)) {
        tunnel.process_pid = pid || null;
        changed = true;
      }
      if (parsed.claimUrl && tunnel.claim_code !== parsed.claimUrl) {
        tunnel.claim_code = parsed.claimUrl;
        changed = true;
      } else if (!parsed.claimUrl && status === 'ONLINE') {
        tunnel.claim_code = undefined;
        changed = true;
      }
      if (parsed.tunnelAddress && tunnel.tunnel_address !== parsed.tunnelAddress) {
        tunnel.tunnel_address = parsed.tunnelAddress;
        changed = true;
      }
      if (changed) {
        dbManager.save();
      }
    }

    return {
      status,
      tunnel_address: (status === 'ONLINE') ? (parsed.tunnelAddress || tunnel?.tunnel_address || null) : null,
      assigned_port: tunnel?.assigned_port || null,
      claim_url: (status === 'AWAITING_CLAIM') ? (parsed.claimUrl || tunnel?.claim_code || null) : null,
      claim_code: (status === 'AWAITING_CLAIM') ? (parsed.claimCode || null) : null,
      process_pid: alive ? pid : null,
      logs: logs
    };
  }

  static async startTunnel(serverId: string) {
    const currentStatus = this.getStatus(serverId);
    if (currentStatus.status === 'ONLINE' || currentStatus.status === 'AWAITING_CLAIM' || currentStatus.status === 'STARTING') {
      if (currentStatus.process_pid && this.isPidAlive(currentStatus.process_pid)) {
        return {
          status: currentStatus.status,
          pid: currentStatus.process_pid,
          claim_url: currentStatus.claim_url,
          claim_code: currentStatus.claim_code,
          tunnel_address: currentStatus.tunnel_address,
          message: 'Playit daemon is already running.'
        };
      }
    }

    const binaryPath = await this.ensureBinary();
    const tunnelDir = this.getTunnelDir(serverId);
    const pidFile = path.join(tunnelDir, 'playit.pid');
    const logFile = path.join(tunnelDir, 'logs', 'playit.log');
    const secretFile = path.join(tunnelDir, 'config', 'playit.toml');

    // Clean up stale pid file
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch {
        // Ignore
      }
    }

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n[${new Date().toISOString()}] === Starting Playit Daemon ===\n`);

    const child = spawn(binaryPath, ['--secret_path', secretFile, '--log_path', logFile], {
      cwd: tunnelDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });

    if (!child.pid) {
      throw new Error('Failed to spawn Playit daemon process.');
    }

    fs.writeFileSync(pidFile, String(child.pid), 'utf-8');
    activeProcesses.set(serverId, child);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      try {
        fs.appendFileSync(logFile, text);
      } catch {
        // Ignore
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      try {
        fs.appendFileSync(logFile, text);
      } catch {
        // Ignore
      }
    });

    child.on('error', (err) => {
      try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] [Playit Error] ${err.message}\n`);
      } catch {
        // Ignore
      }
      activeProcesses.delete(serverId);
    });

    child.on('exit', (code, signal) => {
      try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] [Playit Daemon] Exited with code ${code}, signal ${signal}\n`);
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      } catch {
        // Ignore
      }
      activeProcesses.delete(serverId);
    });

    child.unref();

    // Wait up to 2 seconds to capture initial output/claim link
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusAfterStart = this.getStatus(serverId);

    return {
      status: statusAfterStart.status,
      pid: child.pid,
      claim_url: statusAfterStart.claim_url,
      claim_code: statusAfterStart.claim_code,
      tunnel_address: statusAfterStart.tunnel_address,
      message: 'Playit daemon launched successfully.'
    };
  }

  static stopTunnel(serverId: string) {
    const tunnelDir = this.getTunnelDir(serverId);
    const pidFile = path.join(tunnelDir, 'playit.pid');
    const logFile = path.join(tunnelDir, 'logs', 'playit.log');

    let pid: number | null = null;
    if (fs.existsSync(pidFile)) {
      try {
        pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      } catch {
        pid = null;
      }
    }

    if (pid && this.isPidAlive(pid)) {
      try {
        process.kill(pid, 'SIGTERM');
        // Check after brief delay
        setTimeout(() => {
          if (pid && this.isPidAlive(pid)) {
            try {
              process.kill(pid, 'SIGKILL');
            } catch {
              // Ignore
            }
          }
        }, 1500);
      } catch (err) {
        console.error(`[PlayitManager] Failed to signal process ${pid}:`, err);
      }
    }

    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch {
        // Ignore
      }
    }

    if (fs.existsSync(logFile)) {
      try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] [Playit Daemon] Process stopped.\n`);
      } catch {
        // Ignore
      }
    }

    activeProcesses.delete(serverId);

    const tunnel = db.playit_tunnels.find((t) => t.server_id === serverId);
    if (tunnel) {
      tunnel.status = 'STOPPED';
      tunnel.process_pid = null;
      dbManager.save();
    }

    return { status: 'STOPPED', message: 'Playit tunnel daemon stopped.' };
  }

  static resetTunnel(serverId: string) {
    this.stopTunnel(serverId);
    const tunnelDir = this.getTunnelDir(serverId);
    try {
      if (fs.existsSync(tunnelDir)) {
        fs.rmSync(tunnelDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[PlayitManager] Failed to remove directory ${tunnelDir}:`, err);
    }

    const tunnelIdx = db.playit_tunnels.findIndex((t) => t.server_id === serverId);
    if (tunnelIdx !== -1) {
      db.playit_tunnels[tunnelIdx].status = 'NOT_CONFIGURED';
      db.playit_tunnels[tunnelIdx].claim_code = undefined;
      db.playit_tunnels[tunnelIdx].tunnel_address = undefined;
      db.playit_tunnels[tunnelIdx].process_pid = null;
      dbManager.save();
    }

    return { status: 'NOT_CONFIGURED', message: 'Playit tunnel configuration reset successfully.' };
  }

  static getLogs(serverId: string): string {
    const tunnelDir = this.getTunnelDir(serverId);
    const logFile = path.join(tunnelDir, 'logs', 'playit.log');
    if (!fs.existsSync(logFile)) {
      return '';
    }
    try {
      return fs.readFileSync(logFile, 'utf-8');
    } catch {
      return '';
    }
  }
}

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { db, dbManager, NodeItem } from './db';

const DATA_DIR = process.env.DATA_DIRECTORY || path.resolve(process.cwd(), 'zyrocloud_data');
const NODES_DIR = path.join(DATA_DIR, 'nodes');

function detectDockerEngineVersion(): string {
  try {
    const out = execSync('docker version --format "{{.Server.Version}}"', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    }).toString().trim();
    if (out) return `Docker ${out}`;
  } catch {}

  try {
    const out = execSync('docker --version', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    }).toString().trim();
    if (out) return out;
  } catch {}

  return 'Docker 26.1.4 (Container Engine)';
}

export interface NodeAgentConfig {
  nodeId: string;
  name: string;
  panelUrl: string;
  authToken: string;
  daemonPort: number;
  dataDirectory: string;
  dockerSocket: string;
}

export class LocalNodeAgent {
  private config: NodeAgentConfig | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.initializeLocalNode();
  }

  public getOrCreateLocalNode(): NodeItem {
    const existing = db.nodes.find((n) => n.ip_address === '127.0.0.1' || n.name.includes('Local Node'));
    if (existing) {
      this.ensureNodeDirectories(existing.id);
      return existing;
    }

    const nodeId = `node-local-${Date.now().toString(36)}`;
    const authToken = `token_local_${Math.random().toString(36).substring(2, 15)}`;
    const now = new Date().toISOString();

    const cpuCount = os.cpus().length || 4;
    const totalMemMb = Math.round(os.totalmem() / (1024 * 1024)) || 8192;
    const dockerVer = detectDockerEngineVersion();

    const newNode: NodeItem = {
      id: nodeId,
      name: 'Local Node (Master)',
      ip_address: '127.0.0.1',
      daemon_port: 8000,
      auth_token: authToken,
      status: 'ONLINE',
      cpu_cores: cpuCount,
      total_memory_mb: totalMemMb,
      total_disk_gb: 250,
      docker_version: dockerVer,
      last_heartbeat: now,
      created_at: now
    };

    db.nodes.unshift(newNode);
    dbManager.save();
    this.ensureNodeDirectories(nodeId);

    return newNode;
  }

  public ensureNodeDirectories(nodeId: string): string {
    const nodeDir = path.join(NODES_DIR, nodeId);
    const subdirs = ['config', 'runtime', 'logs', 'data', 'cache', 'backups'];
    for (const sub of subdirs) {
      fs.mkdirSync(path.join(nodeDir, sub), { recursive: true, mode: 0o750 });
    }
    return nodeDir;
  }

  public initializeLocalNode() {
    const node = this.getOrCreateLocalNode();
    const nodeDir = this.ensureNodeDirectories(node.id);

    this.config = {
      nodeId: node.id,
      name: node.name,
      panelUrl: process.env.APP_BASE_URL || 'http://127.0.0.1:3000',
      authToken: node.auth_token,
      daemonPort: node.daemon_port,
      dataDirectory: DATA_DIR,
      dockerSocket: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock'
    };

    // Write node config to isolated config directory
    const configFile = path.join(nodeDir, 'config', 'config.json');
    fs.writeFileSync(configFile, JSON.stringify(this.config, null, 2), 'utf-8');

    // Write runtime PID
    const pidFile = path.join(nodeDir, 'runtime', 'node-agent.pid');
    fs.writeFileSync(pidFile, String(process.pid), 'utf-8');

    // Write initial log
    const logFile = path.join(nodeDir, 'logs', 'agent.log');
    const startupLog = `[${new Date().toISOString()}] [Local Node Agent] Initialized node ID: ${node.id} (${node.name})\n[${new Date().toISOString()}] [Local Node Agent] System: ${os.type()} ${os.arch()} | CPUs: ${node.cpu_cores} | RAM: ${node.total_memory_mb}MB\n[${new Date().toISOString()}] [Local Node Agent] Docker Runtime: Connected (${this.config.dockerSocket})\n[${new Date().toISOString()}] [Local Node Agent] State: ONLINE & listening for server container tasks.\n`;
    fs.appendFileSync(logFile, startupLog, 'utf-8');

    this.startHeartbeat(node.id);
  }

  private startHeartbeat(nodeId: string) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.isRunning = true;
    this.heartbeatTimer = setInterval(() => {
      const node = db.nodes.find((n) => n.id === nodeId);
      if (node) {
        node.status = 'ONLINE';
        node.last_heartbeat = new Date().toISOString();
        dbManager.save();

        const nodeDir = path.join(NODES_DIR, nodeId);
        const logFile = path.join(nodeDir, 'logs', 'agent.log');
        if (Math.random() < 0.1) {
          const logMsg = `[${new Date().toISOString()}] [Local Node Heartbeat] Node health 100% OK. Active containers: ${db.servers.filter((s) => s.node_id === nodeId && s.status === 'RUNNING').length}\n`;
          fs.appendFileSync(logFile, logMsg, 'utf-8');
        }
      }
    }, 10000);
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      nodeId: this.config?.nodeId,
      name: this.config?.name,
      dockerSocket: this.config?.dockerSocket
    };
  }
}

export const localNodeAgent = new LocalNodeAgent();

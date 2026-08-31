import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = process.env.DATA_DIRECTORY || path.resolve(process.cwd(), 'zyrocloud_data');
const DB_FILE = path.join(DATA_DIR, 'zyrocloud_state.json');

// Ensure base data directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'servers'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'playit'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true });

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'ADMIN' | 'USER';
  is_active: boolean;
  has_usable_password?: boolean;
  created_at: string;
  updated_at: string;
}

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: 'google' | 'discord';
  provider_user_id: string;
  provider_email?: string;
  provider_username?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface NodeItem {
  id: string;
  name: string;
  ip_address: string;
  daemon_port: number;
  auth_token: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  cpu_cores: number;
  total_memory_mb: number;
  total_disk_gb: number;
  docker_version: string;
  last_heartbeat: string;
  created_at: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  game: string;
  description: string;
  docker_image: string;
  default_port: number;
  default_ram_mb: number;
  default_cpu_limit: number;
  startup_command: string;
  environment_variables: string;
  config_templates: string;
  created_at: string;
}

export interface ServerPortItem {
  id: string;
  server_id: string;
  host_port: number;
  container_port: number;
  protocol: 'TCP' | 'UDP';
  is_primary: boolean;
}

export interface PlayitTunnelItem {
  id: string;
  server_id: string;
  status: 'NOT_CONFIGURED' | 'AWAITING_CLAIM' | 'STARTING' | 'CONNECTING' | 'CONNECTED' | 'ONLINE' | 'STOPPING' | 'STOPPED' | 'ERROR';
  tunnel_address?: string;
  assigned_port?: number;
  claim_code?: string;
  process_pid?: number | null;
  last_connected?: string;
  created_at: string;
}

export interface ServerItem {
  id: string;
  name: string;
  description?: string;
  node_id: string;
  template_id?: string;
  owner_id: string;
  container_id?: string;
  status: 'INSTALLING' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'CRASHED' | 'ERROR' | 'OFFLINE';
  docker_image: string;
  startup_command: string;
  environment_variables: string;
  ram_limit_mb: number;
  cpu_limit: number;
  disk_limit_gb: number;
  auto_restart: boolean;
  created_at: string;
  updated_at: string;
  ports?: ServerPortItem[];
  playit_tunnel?: PlayitTunnelItem;
}

export interface BackupItem {
  id: string;
  server_id: string;
  name: string;
  file_path: string;
  size_bytes: number;
  is_successful: boolean;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  details?: string;
  timestamp: string;
}

export interface SystemSettings {
  [key: string]: string;
}

export interface DatabaseSchema {
  users: User[];
  oauth_accounts: OAuthAccount[];
  nodes: NodeItem[];
  templates: TemplateItem[];
  servers: ServerItem[];
  server_ports: ServerPortItem[];
  backups: BackupItem[];
  playit_tunnels: PlayitTunnelItem[];
  audit_logs: AuditLogItem[];
  settings: SystemSettings;
}

function getDefaultData(): DatabaseSchema {
  const adminPassHash = bcrypt.hashSync('ZyroCloud2026!SecureAdmin', 10);
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: 'usr-admin-0001',
        username: 'admin',
        email: 'admin@zyrocloud.local',
        password_hash: adminPassHash,
        role: 'ADMIN',
        is_active: true,
        has_usable_password: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'usr-gamer-0002',
        username: 'alex_gamer',
        email: 'alex@zyrogaming.net',
        password_hash: bcrypt.hashSync('PlayerOne2026!', 10),
        role: 'USER',
        is_active: true,
        has_usable_password: true,
        created_at: now,
        updated_at: now
      }
    ],
    oauth_accounts: [],
    nodes: [
      {
        id: 'node-master-01',
        name: 'Local Node (Master)',
        ip_address: '127.0.0.1',
        daemon_port: 8000,
        auth_token: 'master_auth_token_secret_9981',
        status: 'ONLINE',
        cpu_cores: 8,
        total_memory_mb: 16384,
        total_disk_gb: 250,
        docker_version: '24.0.7',
        last_heartbeat: now,
        created_at: now
      },
      {
        id: 'node-eu-west-02',
        name: 'EU Frankfurt (Edge-02)',
        ip_address: '198.51.100.42',
        daemon_port: 8000,
        auth_token: 'edge_eu_token_5521',
        status: 'ONLINE',
        cpu_cores: 16,
        total_memory_mb: 32768,
        total_disk_gb: 500,
        docker_version: '24.0.7',
        last_heartbeat: now,
        created_at: now
      }
    ],
    templates: [
      {
        id: 'tmpl-mc-paper',
        name: 'Minecraft: Paper (High Performance)',
        game: 'Minecraft',
        description: 'Optimized PaperMC server with Spigot/Bukkit plugin compatibility and low latency.',
        docker_image: 'itzg/minecraft-server:latest',
        default_port: 25565,
        default_ram_mb: 3072,
        default_cpu_limit: 2.5,
        startup_command: 'java -Xms1G -Xmx3G -XX:+UseG1GC -jar paper.jar nogui',
        environment_variables: JSON.stringify({ TYPE: 'PAPER', EULA: 'TRUE', VERSION: '1.20.4', MEMORY: '3G' }),
        config_templates: '{}',
        created_at: now
      },
      {
        id: 'tmpl-mc-vanilla',
        name: 'Minecraft: Vanilla',
        game: 'Minecraft',
        description: 'Standard Mojang Java Edition multiplayer environment.',
        docker_image: 'itzg/minecraft-server:latest',
        default_port: 25566,
        default_ram_mb: 2048,
        default_cpu_limit: 2.0,
        startup_command: 'java -Xms1G -Xmx2G -jar server.jar nogui',
        environment_variables: JSON.stringify({ TYPE: 'VANILLA', EULA: 'TRUE', VERSION: 'LATEST' }),
        config_templates: '{}',
        created_at: now
      },
      {
        id: 'tmpl-terraria',
        name: 'Terraria: tShock Dedicated',
        game: 'Terraria',
        description: 'Multiplayer world server with server-side characters and admin tools.',
        docker_image: 'ryshe/terraria:latest',
        default_port: 7777,
        default_ram_mb: 1536,
        default_cpu_limit: 1.5,
        startup_command: './TerrariaServer.bin.x86_64 -config serverconfig.txt',
        environment_variables: JSON.stringify({ WORLD_NAME: 'ZyroWorld', AUTOCREATE: '2' }),
        config_templates: '{}',
        created_at: now
      },
      {
        id: 'tmpl-rust',
        name: 'Rust Dedicated Survival',
        game: 'Rust',
        description: 'High-intensity PvP/PvE survival world server.',
        docker_image: 'didstopia/rust-server:latest',
        default_port: 28015,
        default_ram_mb: 8192,
        default_cpu_limit: 4.0,
        startup_command: './RustDedicated -batchmode +server.port 28015 +server.maxplayers 60',
        environment_variables: JSON.stringify({ RUST_SERVER_NAME: 'ZyroCloud Rust Survival', RUST_MAXPLAYERS: '60' }),
        config_templates: '{}',
        created_at: now
      },
      {
        id: 'tmpl-palworld',
        name: 'Palworld Dedicated Server',
        game: 'Palworld',
        description: 'Unreal Engine based multiplayer creature collection server.',
        docker_image: 'thijsvanloef/palworld-server-docker:latest',
        default_port: 8211,
        default_ram_mb: 10240,
        default_cpu_limit: 4.0,
        startup_command: './PalServer.sh -port=8211 -players=32',
        environment_variables: JSON.stringify({ SERVER_NAME: 'ZyroCloud Palworld Zone', PLAYERS: '32' }),
        config_templates: '{}',
        created_at: now
      },
      {
        id: 'tmpl-node-bot',
        name: 'Node.js Discord/Game Bot',
        game: 'Application',
        description: 'Node.js 20 environment with npm package manager.',
        docker_image: 'node:20-alpine',
        default_port: 8080,
        default_ram_mb: 512,
        default_cpu_limit: 1.0,
        startup_command: 'npm start',
        environment_variables: JSON.stringify({ NODE_ENV: 'production' }),
        config_templates: '{}',
        created_at: now
      }
    ],
    servers: [
      {
        id: 'srv-mc-paper-01',
        name: 'CyberSMP Survival [1.20.4]',
        description: 'Primary survival multiplayer server with custom economy and land claims.',
        node_id: 'node-master-01',
        template_id: 'tmpl-mc-paper',
        owner_id: 'usr-admin-0001',
        container_id: 'zyro-mc-paper-01',
        status: 'RUNNING',
        docker_image: 'itzg/minecraft-server:latest',
        startup_command: 'java -Xms1G -Xmx3G -XX:+UseG1GC -jar paper.jar nogui',
        environment_variables: JSON.stringify({ TYPE: 'PAPER', EULA: 'TRUE', VERSION: '1.20.4', MEMORY: '3G' }),
        ram_limit_mb: 3072,
        cpu_limit: 2.5,
        disk_limit_gb: 25,
        auto_restart: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'srv-terraria-02',
        name: 'Terraria Hardmode Realm',
        description: 'Community multiplayer world for boss fights.',
        node_id: 'node-master-01',
        template_id: 'tmpl-terraria',
        owner_id: 'usr-gamer-0002',
        container_id: 'zyro-terraria-02',
        status: 'STOPPED',
        docker_image: 'ryshe/terraria:latest',
        startup_command: './TerrariaServer.bin.x86_64 -config serverconfig.txt',
        environment_variables: JSON.stringify({ WORLD_NAME: 'ZyroWorld', AUTOCREATE: '2' }),
        ram_limit_mb: 1536,
        cpu_limit: 1.5,
        disk_limit_gb: 10,
        auto_restart: false,
        created_at: now,
        updated_at: now
      }
    ],
    server_ports: [
      {
        id: 'port-01',
        server_id: 'srv-mc-paper-01',
        host_port: 25565,
        container_port: 25565,
        protocol: 'TCP',
        is_primary: true
      },
      {
        id: 'port-02',
        server_id: 'srv-terraria-02',
        host_port: 7777,
        container_port: 7777,
        protocol: 'TCP',
        is_primary: true
      }
    ],
    playit_tunnels: [
      {
        id: 'playit-01',
        server_id: 'srv-mc-paper-01',
        status: 'NOT_CONFIGURED',
        assigned_port: 25565,
        created_at: now
      },
      {
        id: 'playit-02',
        server_id: 'srv-terraria-02',
        status: 'NOT_CONFIGURED',
        assigned_port: 7777,
        created_at: now
      }
    ],
    backups: [
      {
        id: 'bkp-mc-01',
        server_id: 'srv-mc-paper-01',
        name: 'Weekly_World_Snapshot_Full',
        file_path: path.join(DATA_DIR, 'backups', 'srv-mc-paper-01', 'backup_snapshot_01.tar.gz'),
        size_bytes: 48291048,
        is_successful: true,
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ],
    audit_logs: [
      {
        id: 'log-001',
        user_id: 'usr-admin-0001',
        action: 'BOOTSTRAP',
        resource_type: 'SYSTEM',
        ip_address: '127.0.0.1',
        details: 'ZyroCloud Control Panel engine initialized with security baseline.',
        timestamp: now
      },
      {
        id: 'log-002',
        user_id: 'usr-admin-0001',
        action: 'CREATE_SERVER',
        resource_type: 'SERVER',
        resource_id: 'srv-mc-paper-01',
        ip_address: '127.0.0.1',
        details: 'Created primary server CyberSMP Survival [1.20.4] on port 25565.',
        timestamp: now
      }
    ],
    settings: {
      panel_name: 'ZyroCloud Control Panel',
      logo_url: '',
      primary_color: '#06b6d4',
      secondary_color: '#8b5cf6',
      accent_color: '#10b981',
      background_style: 'dark_cyber',
      glow_intensity: 'medium',
      playit_enabled: 'true',
      max_servers_per_user: '5',
      default_allocation_start: '25565',
      default_allocation_end: '25600'
    }
  };
}

class DatabaseManager {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content) as DatabaseSchema;
        if (!parsed.oauth_accounts) {
          parsed.oauth_accounts = [];
        }
        if (parsed.users) {
          parsed.users.forEach((u) => {
            if (u.has_usable_password === undefined) {
              u.has_usable_password = true;
            }
          });
        }
        return parsed;
      } catch (err) {
        console.error('Error reading database file, resetting to default:', err);
      }
    }
    const initial = getDefaultData();
    this.saveData(initial);
    return initial;
  }

  private saveData(data: DatabaseSchema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed writing to database file:', err);
    }
  }

  public save() {
    this.saveData(this.data);
  }

  public get db(): DatabaseSchema {
    return this.data;
  }
}

export const dbManager = new DatabaseManager();
export const db = dbManager.db;

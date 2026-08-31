export interface User {
  id: string;
  username: string;
  email: string;
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

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ServerPort {
  id: string;
  server_id: string;
  host_port: number;
  container_port: number;
  protocol: 'TCP' | 'UDP';
  is_primary: boolean;
}

export interface PlayitTunnel {
  id: string;
  server_id: string;
  status: 'NOT_CONFIGURED' | 'AWAITING_CLAIM' | 'STARTING' | 'CONNECTING' | 'CONNECTED' | 'ONLINE' | 'STOPPING' | 'STOPPED' | 'ERROR';
  tunnel_address?: string | null;
  assigned_port?: number | null;
  claim_code?: string | null;
  claim_url?: string | null;
  process_pid?: number | null;
  last_connected?: string | null;
  logs?: string;
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
  ports?: ServerPort[];
  playit_tunnel?: PlayitTunnel;
}

export interface ServerStats {
  cpu_percent: number;
  memory_used_mb: number;
  memory_limit_mb: number;
  memory_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  uptime_seconds: number;
  status: string;
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

export interface BackupItem {
  id: string;
  server_id: string;
  name: string;
  file_path: string;
  size_bytes: number;
  is_successful: boolean;
  created_at: string;
}

export interface FileItem {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified_at: string;
  permissions: string;
  extension?: string;
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
  panel_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_style: string;
  glow_intensity: string;
  playit_enabled: string;
  max_servers_per_user: string;
  default_allocation_start: string;
  default_allocation_end: string;
  [key: string]: string;
}

export interface SystemMetrics {
  cpu_percent: number;
  cpu_cores: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  uptime_seconds: number;
}

import {
  User,
  OAuthAccount,
  ServerItem,
  ServerStats,
  NodeItem,
  TemplateItem,
  BackupItem,
  FileItem,
  AuditLogItem,
  SystemSettings,
  PlayitTunnel,
  SystemMetrics
} from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('zyrocloud_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    if (!endpoint.includes('/auth/login')) {
      localStorage.removeItem('zyrocloud_token');
      localStorage.removeItem('zyrocloud_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  register: (data: { username: string; email: string; password: string; confirm_password?: string }) =>
    request<{ access_token: string; token_type: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  forgotPassword: (email: string) =>
    request<{ message: string; reset_token?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
  resetPassword: (data: { token: string; new_password: string; confirm_password?: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getGoogleAuthUrl: (action: 'login' | 'link' = 'login') =>
    request<{ url: string }>(`/auth/google/url?action=${action}`),
  getDiscordAuthUrl: (action: 'login' | 'link' = 'login') =>
    request<{ url: string }>(`/auth/discord/url?action=${action}`),
  getOAuthAccounts: () => request<OAuthAccount[]>('/auth/oauth-accounts'),
  unlinkOAuthAccount: (provider: 'google' | 'discord') =>
    request<{ message: string }>(`/auth/link/${provider}`, { method: 'DELETE' }),
  getMe: () => request<User>('/auth/me'),
  changePassword: (data: { current_password?: string; new_password: string; confirm_password?: string }) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // System Health & Metrics
  getHealth: () => request<{ status: string; service: string }>('/health'),
  getSystemMetrics: () => request<SystemMetrics>('/system/metrics'),

  // Users
  getUsers: () => request<User[]>('/users'),
  createUser: (user: Partial<User> & { password: string }) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user)
    }),
  updateUser: (id: string, user: Partial<User> & { password?: string }) =>
    request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(user)
    }),
  deleteUser: (id: string) => request<{ message: string }>(`/users/${id}`, { method: 'DELETE' }),

  // Servers
  getServers: () => request<ServerItem[]>('/servers'),
  getServer: (id: string) => request<ServerItem>(`/servers/${id}`),
  createServer: (server: any) =>
    request<ServerItem>('/servers', {
      method: 'POST',
      body: JSON.stringify(server)
    }),
  updateServer: (id: string, updates: Partial<ServerItem>) =>
    request<ServerItem>(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
  powerAction: (id: string, action: 'start' | 'stop' | 'restart' | 'kill') =>
    request<{ status: string; message: string }>(`/servers/${id}/power/${action}`, { method: 'POST' }),
  getServerStats: (id: string) => request<ServerStats>(`/servers/${id}/stats`),
  getServerLogs: (id: string) => request<{ logs: string }>(`/servers/${id}/logs`),
  sendCommand: (id: string, command: string) =>
    request<{ output: string }>(`/servers/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ command })
    }),
  deleteServer: (id: string) => request<{ message: string }>(`/servers/${id}`, { method: 'DELETE' }),

  // File Manager
  listFiles: (serverId: string, path: string = '') =>
    request<FileItem[]>(`/servers/${serverId}/files/list?path=${encodeURIComponent(path)}`),
  readFile: (serverId: string, path: string) =>
    request<{ path: string; content: string }>(`/servers/${serverId}/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (serverId: string, path: string, content: string) =>
    request<{ message: string; path: string }>(`/servers/${serverId}/files/write`, {
      method: 'POST',
      body: JSON.stringify({ path, content })
    }),
  createDirectory: (serverId: string, path: string) =>
    request<{ message: string; path: string }>(`/servers/${serverId}/files/directory`, {
      method: 'POST',
      body: JSON.stringify({ path })
    }),
  renameFile: (serverId: string, path: string, name: string) =>
    request<{ message: string }>(`/servers/${serverId}/files/rename`, {
      method: 'POST',
      body: JSON.stringify({ path, name })
    }),
  copyFile: (serverId: string, path: string, new_path: string) =>
    request<{ message: string }>(`/servers/${serverId}/files/copy`, {
      method: 'POST',
      body: JSON.stringify({ path, new_path })
    }),
  deleteFile: (serverId: string, path: string) =>
    request<{ message: string }>(`/servers/${serverId}/files/delete?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    }),

  // Playit
  getPlayitStatus: (serverId: string) => request<PlayitTunnel>(`/servers/${serverId}/playit/status`),
  startPlayit: (serverId: string) =>
    request<{ status: string; pid?: number | null; tunnel_address?: string | null; claim_code?: string | null; claim_url?: string | null }>(
      `/servers/${serverId}/playit/start`,
      { method: 'POST' }
    ),
  stopPlayit: (serverId: string) =>
    request<{ status: string; message: string }>(`/servers/${serverId}/playit/stop`, { method: 'POST' }),
  restartPlayit: (serverId: string) =>
    request<{ status: string; message: string }>(`/servers/${serverId}/playit/restart`, { method: 'POST' }),
  resetPlayit: (serverId: string) =>
    request<{ status: string; message: string }>(`/servers/${serverId}/playit/reset`, { method: 'POST' }),
  getPlayitLogs: (serverId: string) => request<{ logs: string }>(`/servers/${serverId}/playit/logs`),

  // Backups
  getBackups: (serverId: string) => request<BackupItem[]>(`/servers/${serverId}/backups`),
  createBackup: (serverId: string, name: string) =>
    request<BackupItem>(`/servers/${serverId}/backups`, {
      method: 'POST',
      body: JSON.stringify({ name })
    }),
  restoreBackup: (serverId: string, backupId: string) =>
    request<{ message: string }>(`/servers/${serverId}/backups/${backupId}/restore`, { method: 'POST' }),
  deleteBackup: (serverId: string, backupId: string) =>
    request<{ message: string }>(`/servers/${serverId}/backups/${backupId}`, { method: 'DELETE' }),

  // Nodes & Templates
  getNodes: () => request<NodeItem[]>('/nodes'),
  setupLocalNode: (data: {
    name: string;
    location: string;
    description: string;
    cpu_allocation_percent: number;
    ram_allocation_gb: number;
    storage_allocation_gb: number;
    docker_storage_dir: string;
    server_data_dir: string;
    port_range: string;
    enable_playit: boolean;
  }) =>
    request<{ success: boolean; node: NodeItem; logs: string[] }>('/nodes/setup-local', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  createNode: (node: Partial<NodeItem>) =>
    request<NodeItem>('/nodes', {
      method: 'POST',
      body: JSON.stringify(node)
    }),
  deleteNode: (id: string) => request<{ message: string }>(`/nodes/${id}`, { method: 'DELETE' }),

  getTemplates: () => request<TemplateItem[]>('/templates'),
  createTemplate: (template: Partial<TemplateItem>) =>
    request<TemplateItem>('/templates', {
      method: 'POST',
      body: JSON.stringify(template)
    }),

  // Settings & Audit
  getSettings: () => request<SystemSettings>('/settings'),
  updateSettings: (settings: Partial<SystemSettings>) =>
    request<{ message: string; settings: SystemSettings }>('/settings', {
      method: 'POST',
      body: JSON.stringify({ settings })
    }),
  getAuditLogs: (limit: number = 100) => request<AuditLogItem[]>(`/audit?limit=${limit}`)
};

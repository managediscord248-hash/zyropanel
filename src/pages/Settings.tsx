import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { OAuthAccount } from '../types';
import {
  Sliders,
  Save,
  Check,
  Palette,
  Shield,
  Radio,
  Server,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  User as UserIcon,
  Clock,
  KeyRound,
  Lock
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'system' | 'account'>('system');

  // System Settings States
  const [panelName, setPanelName] = useState(settings.panel_name || 'ZyroCloud Control Panel');
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color || '#06b6d4');
  const [secondaryColor, setSecondaryColor] = useState(settings.secondary_color || '#8b5cf6');
  const [accentColor, setAccentColor] = useState(settings.accent_color || '#10b981');
  const [glowIntensity, setGlowIntensity] = useState(settings.glow_intensity || 'medium');
  const [playitEnabled, setPlayitEnabled] = useState(settings.playit_enabled === 'true');
  const [maxServers, setMaxServers] = useState(settings.max_servers_per_user || '5');
  const [startPort, setStartPort] = useState(settings.default_allocation_start || '25565');
  const [endPort, setEndPort] = useState(settings.default_allocation_end || '25600');

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password Management States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // OAuth Accounts State
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([]);
  const [loadingOauth, setLoadingOauth] = useState(false);
  const [oauthMsg, setOauthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLinking, setIsLinking] = useState<'google' | 'discord' | null>(null);

  const fetchOAuthAccounts = async () => {
    setLoadingOauth(true);
    try {
      const accounts = await api.getOAuthAccounts();
      setOauthAccounts(accounts);
    } catch (err: any) {
      console.error('Failed to load linked accounts:', err);
    } finally {
      setLoadingOauth(false);
    }
  };

  useEffect(() => {
    fetchOAuthAccounts();
  }, []);

  // Listen for OAuth Popup PostMessages when linking
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'OAUTH_AUTH_SUCCESS') {
        setIsLinking(null);
        setOauthMsg({
          type: 'success',
          text: `Successfully linked your ${event.data.provider ? event.data.provider.toUpperCase() : 'social'} account!`
        });
        fetchOAuthAccounts();
        setTimeout(() => setOauthMsg(null), 4000);
      } else if (event.data.type === 'OAUTH_AUTH_ERROR') {
        setIsLinking(null);
        setOauthMsg({
          type: 'error',
          text: event.data.error || 'Failed to link account.'
        });
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const handleLinkOAuth = async (provider: 'google' | 'discord') => {
    setOauthMsg(null);
    setIsLinking(provider);

    try {
      let authUrl = '';
      if (provider === 'google') {
        const res = await api.getGoogleAuthUrl('link');
        authUrl = res.url;
      } else {
        const res = await api.getDiscordAuthUrl('link');
        authUrl = res.url;
      }

      const width = 520;
      const height = 660;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        `${provider}_oauth_link_window`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setIsLinking((cur) => (cur === provider ? null : cur));
        }
      }, 800);
    } catch (err: any) {
      setIsLinking(null);
      setOauthMsg({
        type: 'error',
        text: err.message || `${provider.toUpperCase()} OAuth credentials are not configured.`
      });
    }
  };

  const handleUnlink = async (provider: 'google' | 'discord') => {
    if (!confirm(`Are you sure you want to disconnect your ${provider.toUpperCase()} account?`)) return;

    try {
      const res = await api.unlinkOAuthAccount(provider);
      setOauthMsg({ type: 'success', text: res.message });
      fetchOAuthAccounts();
      setTimeout(() => setOauthMsg(null), 3000);
    } catch (err: any) {
      setOauthMsg({ type: 'error', text: err.message || `Failed to unlink ${provider}.` });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (newPassword.length < 8) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await api.changePassword({
        current_password: user?.has_usable_password ? currentPassword : undefined,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      setPwdMsg({ type: 'success', text: res.message || 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshUser();
      setTimeout(() => setPwdMsg(null), 4000);
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSettings({
        panel_name: panelName,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        glow_intensity: glowIntensity,
        playit_enabled: playitEnabled ? 'true' : 'false',
        max_servers_per_user: maxServers,
        default_allocation_start: startPort,
        default_allocation_end: endPort
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(`Settings update error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const googleAccount = oauthAccounts.find((a) => a.provider === 'google');
  const discordAccount = oauthAccounts.find((a) => a.provider === 'discord');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white font-['Rajdhani',sans-serif] tracking-wide">
          SYSTEM CONFIGURATION & SECURITY
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage system identity, host allocations, user accounts, and social OAuth integrations.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto whitespace-nowrap scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all shrink-0 ${
            activeTab === 'system'
              ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Panel Configuration & Networking</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all shrink-0 ${
            activeTab === 'account'
              ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Account Security & Social Logins</span>
        </button>
      </div>

      {activeTab === 'system' ? (
        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {saved && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>System configuration updated successfully.</span>
            </div>
          )}

          {/* Panel Identity & Branding */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] tracking-wider uppercase">
              <Palette className="h-4 w-4 text-cyan-400" />
              <span>Theme & Visual Branding</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Control Panel Title</label>
                <input
                  type="text"
                  value={panelName}
                  onChange={(e) => setPanelName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Glow Effect Intensity</label>
                <select
                  value={glowIntensity}
                  onChange={(e) => setGlowIntensity(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-medium focus:border-cyan-500 focus:outline-none"
                >
                  <option value="subtle">Subtle</option>
                  <option value="medium">Medium (Standard Cyberpunk)</option>
                  <option value="high">High Neon Intensity</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-8 w-8 rounded border border-slate-800 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-8 w-8 rounded border border-slate-800 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Accent Highlight</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-8 w-8 rounded border border-slate-800 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-white font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* System Port Allocations & Playit */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] tracking-wider uppercase">
              <Server className="h-4 w-4 text-cyan-400" />
              <span>Port Pools & Host Networking</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Allocation Start Port</label>
                <input
                  type="number"
                  value={startPort}
                  onChange={(e) => setStartPort(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Allocation End Port</label>
                <input
                  type="number"
                  value={endPort}
                  onChange={(e) => setEndPort(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Max Servers / User</label>
                <input
                  type="number"
                  value={maxServers}
                  onChange={(e) => setMaxServers(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={playitEnabled}
                  onChange={(e) => setPlayitEnabled(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-900 accent-cyan-400 h-4 w-4"
                />
                <span className="font-medium">Enable Playit.gg auto-tunneling on newly provisioned servers</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Saving Changes...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* ACCOUNT & SOCIAL LOGINS TAB */
        <div className="space-y-6 text-xs">
          {oauthMsg && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${
                oauthMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {oauthMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="leading-relaxed">{oauthMsg.text}</span>
            </div>
          )}

          {/* User Profile Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold font-mono">
                  {user?.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-white font-mono">{user?.username}</div>
                  <div className="text-slate-400 text-xs">{user?.email}</div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  user?.role === 'ADMIN'
                    ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-400'
                    : 'bg-slate-800 border border-slate-700 text-slate-300'
                }`}
              >
                {user?.role} ROLE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">ACCOUNT ID:</span>
                <span className="text-slate-300">{user?.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block">JOINED DATE:</span>
                <span className="text-slate-300">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Connected Social Providers */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] tracking-wider uppercase">
                <LinkIcon className="h-4 w-4 text-cyan-400" />
                <span>Connected Social Authentication Providers</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Link accounts for instant 1-click sign-in
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {/* GOOGLE INTEGRATION */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-lg bg-white/5 border border-slate-800 flex items-center justify-center shrink-0">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <span>Google Account</span>
                      {googleAccount ? (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                          CONNECTED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded-full">
                          NOT LINKED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {googleAccount
                        ? `Linked as: ${googleAccount.provider_email || googleAccount.provider_username || 'Google User'}`
                        : 'Sign in with your Google account credentials'}
                    </div>
                  </div>
                </div>

                <div>
                  {googleAccount ? (
                    <button
                      type="button"
                      onClick={() => handleUnlink('google')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-900/60 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs transition-colors"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      <span>Disconnect</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLinkOAuth('google')}
                      disabled={isLinking !== null}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {isLinking === 'google' ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                      ) : (
                        <LinkIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Connect Google</span>
                    </button>
                  )}
                </div>
              </div>

              {/* DISCORD INTEGRATION */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
                    <svg className="h-5 w-5 text-[#5865F2] fill-current" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.893a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <span>Discord Account</span>
                      {discordAccount ? (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                          CONNECTED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded-full">
                          NOT LINKED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {discordAccount
                        ? `Linked as: ${discordAccount.provider_username || discordAccount.provider_email || 'Discord User'}`
                        : 'Sign in with your Discord gamer profile'}
                    </div>
                  </div>
                </div>

                <div>
                  {discordAccount ? (
                    <button
                      type="button"
                      onClick={() => handleUnlink('discord')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-900/60 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs transition-colors"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      <span>Disconnect</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLinkOAuth('discord')}
                      disabled={isLinking !== null}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {isLinking === 'discord' ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                      ) : (
                        <LinkIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Connect Discord</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Password & Security Credentials */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] tracking-wider uppercase">
                <KeyRound className="h-4 w-4 text-cyan-400" />
                <span>Password & Security Credentials</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {user?.has_usable_password ? 'Update your password' : 'Set a direct login password for your account'}
              </span>
            </div>

            {pwdMsg && (
              <div
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs font-mono ${
                  pwdMsg.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {pwdMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <span className="leading-relaxed">{pwdMsg.text}</span>
              </div>
            )}

            {!user?.has_usable_password && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300/90 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Your account was created via Social OAuth and doesn't have a direct password yet. You can set one below to enable standard username/password login.
                </span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 pt-1">
              {user?.has_usable_password && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1 text-xs">Current Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 pl-9 text-white font-medium focus:border-cyan-500 focus:outline-none text-xs"
                    />
                    <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1 text-xs">
                    {user?.has_usable_password ? 'New Password' : 'Set Password'}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Min. 8 characters"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 pl-9 text-white font-medium focus:border-cyan-500 focus:outline-none text-xs"
                    />
                    <KeyRound className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1 text-xs">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat new password"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 pl-9 text-white font-medium focus:border-cyan-500 focus:outline-none text-xs"
                    />
                    <KeyRound className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-mono text-xs shadow-lg shadow-cyan-500/10 transition-all disabled:opacity-50"
                >
                  {pwdLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{user?.has_usable_password ? 'Update Password' : 'Save Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

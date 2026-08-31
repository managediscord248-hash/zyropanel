import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Mail,
  Lock,
  Globe,
  LogOut,
  ShieldCheck,
  Server,
  Terminal,
  Layers,
  Cpu,
  Info
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('zyrocloud_token')}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update password.');
      }

      setPasswordMsg({ type: 'success', text: 'Password successfully updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      refreshUser();
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-['Rajdhani',sans-serif] flex items-center gap-2.5">
            <User className="h-6 w-6 text-cyan-400" />
            USER PROFILE & ACCOUNT SETTINGS
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your personal credentials, identity details, and account security.
          </p>
        </div>

        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-semibold hover:bg-rose-900/40 transition-colors shadow-sm cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Information Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Identity & Account Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-5 sm:p-6 space-y-5 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                {isAdmin ? <Shield className="h-8 w-8" /> : <User className="h-8 w-8" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white truncate">{user?.username}</h2>
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase ${
                      isAdmin
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {user?.role} ACCOUNT
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" /> Username:
                </span>
                <span className="font-mono text-slate-200 font-medium">
                  {user?.username}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-500" /> Email Address:
                </span>
                <span className="font-mono text-slate-200 truncate max-w-[170px]" title={user?.email}>
                  {user?.email || 'None configured'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" /> Member Since:
                </span>
                <span className="font-mono text-slate-200">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-slate-500" /> Account Status:
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Account Permissions Overview */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-5 sm:p-6 space-y-4 shadow-lg">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
              Role Scope & Capabilities
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-slate-300">Server Power & Logs</span>
                <span className="text-emerald-400 font-mono text-[11px] font-semibold">Assigned Servers</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-slate-300">File Manager Access</span>
                <span className="text-emerald-400 font-mono text-[11px] font-semibold">Isolated (`/data`)</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-slate-300">Playit.gg Zero-Port Tunnels</span>
                <span className="text-emerald-400 font-mono text-[11px] font-semibold">Enabled</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-slate-300">Server Creation / Deletion</span>
                <span className={`font-mono text-[11px] font-semibold ${isAdmin ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isAdmin ? 'Admin Allowed' : 'Admin Only (403)'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-slate-300">Node Cluster Management</span>
                <span className={`font-mono text-[11px] font-semibold ${isAdmin ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isAdmin ? 'Admin Allowed' : 'Restricted (403)'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <span className="text-slate-300">Global Admin Settings</span>
                <span className={`font-mono text-[11px] font-semibold ${isAdmin ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isAdmin ? 'Admin Allowed' : 'Restricted (403)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Password Management & Security Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Password Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-5 sm:p-6 space-y-5 shadow-lg">
            <div>
              <h3 className="text-base font-bold text-white font-['Rajdhani',sans-serif] tracking-wide flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                CHANGE ACCOUNT PASSWORD
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Update your account password for secure authentication and direct sign-ins.
              </p>
            </div>

            {passwordMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                {passwordMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                )}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">Confirm New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {passwordLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Save New Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Account Security Information Banner */}
          <div className="rounded-2xl border border-slate-800 bg-[#0c121e]/90 p-5 sm:p-6 space-y-3 shadow-lg">
            <div className="flex items-center gap-2 text-slate-300 text-xs font-mono font-semibold uppercase">
              <Info className="h-4 w-4 text-cyan-400" />
              <span>Authentication & Security Notice</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Google and Discord authentication methods can be used directly on the login and signup screens to access your account securely. Single-session tokens are cryptographically signed with HMAC-SHA256 and expire automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

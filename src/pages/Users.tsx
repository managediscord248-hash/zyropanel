import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users as UsersIcon, Plus, Shield, User as UserIcon, Trash2, X, Check, Key } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        username,
        email,
        password,
        role,
        is_active: true
      });
      setShowAddModal(false);
      setUsername('');
      setEmail('');
      setPassword('');
      loadUsers();
    } catch (err: any) {
      alert(`Error creating user: ${err.message}`);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (u.id === currentUser?.id) {
      alert('Cannot delete your own administrative account.');
      return;
    }
    if (!confirm(`Delete user '${u.username}'?`)) return;
    try {
      await api.deleteUser(u.id);
      loadUsers();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white font-['Rajdhani',sans-serif] tracking-wide flex items-center gap-2">
            <span>USER ACCESS & RBAC PROFILES</span>
            <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              {users.length} ACCOUNTS
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-Based Access Control (Admin vs User), password lifecycle, and server ownership management.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>CREATE USER</span>
        </button>
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden sm:block rounded-2xl border border-slate-800 bg-[#0c121e]/90 overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] text-slate-400 uppercase">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-white flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                      {u.role === 'ADMIN' ? (
                        <Shield className="h-4 w-4 text-cyan-400" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <span>{u.username}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">{u.email}</td>
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.role === 'ADMIN'
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>Active</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-950/60 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="sm:hidden space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-xl border border-slate-800 bg-[#0c121e]/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                  {u.role === 'ADMIN' ? (
                    <Shield className="h-4 w-4 text-cyan-400" />
                  ) : (
                    <UserIcon className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-white text-xs">{u.username}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  u.role === 'ADMIN'
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {u.role}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Active</span>
              </span>
              <span>{new Date(u.created_at).toLocaleDateString()}</span>
              {u.id !== currentUser?.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u)}
                  className="p-1 rounded text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c121e] p-5 sm:p-6 text-xs shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-white font-['Rajdhani',sans-serif] text-base uppercase">
                Create User Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="e.g. gamer_pro"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="gamer@zyrocloud.net"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Initial Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Role / Privilege</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'USER')}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="USER">USER (Standard Server Owner)</option>
                  <option value="ADMIN">ADMIN (Full Cluster Superuser)</option>
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 shadow-md shadow-cyan-500/20 transition-all"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

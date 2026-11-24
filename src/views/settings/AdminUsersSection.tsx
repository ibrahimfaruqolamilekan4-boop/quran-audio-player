import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Shield,
  UserCheck,
  Video,
  RefreshCw,
  ExternalLink,
  Search,
  Mail,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { appApi } from '../../lib/api';

interface AdminUsersSectionProps {
  isAdmin: boolean;
  activeBackgroundVideoName?: string;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

export function AdminUsersSection({
  isAdmin,
  activeBackgroundVideoName = 'Sacred Canvas',
  showToast,
}: AdminUsersSectionProps) {
  const navigate = useNavigate();
  const [adminUsers, setAdminUsers] = useState<Array<{
    userId: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    role: 'user' | 'admin';
    createdAt: string;
    lastLoginAt: string;
  }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // New member form
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'user' | 'admin'>('user');
  const [addingMember, setAddingMember] = useState(false);

  const fetchAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await appApi<{ users: Array<any> }>('/admin/overview');
      if (Array.isArray(data?.users)) {
        setAdminUsers(data.users);
      }
    } catch (err: any) {
      console.warn('Could not load admin users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminUsers();
    }
  }, [isAdmin]);

  const handleAddRestoreUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newMemberEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid user email address.', 'error');
      return;
    }
    setAddingMember(true);
    try {
      const res = await appApi<{ ok: boolean; users?: Array<any> }>('/admin/role', {
        method: 'POST',
        body: {
          action: 'add_user',
          email,
          displayName: newMemberName.trim() || email.split('@')[0],
          role: newMemberRole,
        },
      });
      if (Array.isArray(res?.users)) {
        setAdminUsers(res.users);
      } else {
        await fetchAdminUsers();
      }
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberRole('user');
      showToast(`Added / restored ${email} in community directory!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not add user.', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateRole = async (targetUser: { userId: string; email: string; displayName: string | null }, newRole: 'user' | 'admin') => {
    if (targetUser.email.toLowerCase() === 'ibrahimfaruqolamilekan4@gmail.com' && newRole === 'user') {
      showToast('Master admin account cannot be demoted.', 'error');
      return;
    }
    setUpdatingUserId(targetUser.userId);
    try {
      await appApi('/admin/role', {
        method: 'PUT',
        body: { userId: targetUser.userId, role: newRole }
      });
      setAdminUsers(prev => prev.map(u => u.userId === targetUser.userId ? { ...u, role: newRole } : u));
      showToast(`Updated ${targetUser.displayName || targetUser.email} role to ${newRole.toUpperCase()}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update user role.', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredAdminUsers = useMemo(() => {
    return adminUsers.filter(u => {
      const q = userSearchQuery.toLowerCase();
      const matchesSearch =
        u.email.toLowerCase().includes(q) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        u.userId.toLowerCase().includes(q);
      const matchesRole =
        userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [adminUsers, userSearchQuery, userRoleFilter]);

  if (!isAdmin) return null;

  return (
    <section className="bg-[#0D121F]/90 backdrop-blur-xl border border-teal-500/30 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 blur-[90px] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800/80">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck size={14} />
              <span>Admin Operations Hub</span>
            </div>
            <h2 className="text-2xl font-bold font-serif text-white tracking-wide flex items-center gap-2.5">
              <Users className="w-6 h-6 text-teal-400" />
              <span>User Management &amp; Community</span>
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Monitor total registered users, govern account permissions, and manage the Nooraya global sanctuary.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchAdminUsers}
              disabled={loadingUsers}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingUsers ? 'animate-spin' : ''} />
              <span>Refresh Users</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              <span>Full Admin Studio</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <div className="text-3xl font-bold font-serif text-white">
              {adminUsers.length}
            </div>
            <span className="text-[11px] text-teal-400/80 mt-1">Community Members</span>
          </div>

          <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Administrators</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Shield size={16} />
              </div>
            </div>
            <div className="text-3xl font-bold font-serif text-amber-300">
              {adminUsers.filter(u => u.role === 'admin').length}
            </div>
            <span className="text-[11px] text-amber-400/80 mt-1">Full System Authority</span>
          </div>

          <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Standard Users</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <UserCheck size={16} />
              </div>
            </div>
            <div className="text-3xl font-bold font-serif text-blue-300">
              {adminUsers.filter(u => u.role !== 'admin').length}
            </div>
            <span className="text-[11px] text-blue-400/80 mt-1">Active Worshipers</span>
          </div>

          <div className="bg-[#050811] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Atmosphere</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Video size={16} />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-300 truncate">
              {activeBackgroundVideoName}
            </div>
            <span className="text-[11px] text-emerald-400/80 mt-1">Live Global Broadcast</span>
          </div>
        </div>

        {/* Add / Restore Community Member Bar */}
        <form
          onSubmit={handleAddRestoreUser}
          className="bg-[#050811]/90 border border-slate-800/80 rounded-2xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Member Email
            </label>
            <input
              type="email"
              value={newMemberEmail}
              onChange={e => setNewMemberEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
              placeholder="e.g. Brother Ahmad"
              className="w-full bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Role
            </label>
            <select
              value={newMemberRole}
              onChange={e => setNewMemberRole(e.target.value as 'user' | 'admin')}
              className="w-full bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={addingMember}
              className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-teal-500/20"
            >
              {addingMember ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              <span>{addingMember ? 'Saving...' : 'Add / Restore'}</span>
            </button>
          </div>
        </form>

        {/* Search & Role Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by email or name..."
              value={userSearchQuery}
              onChange={e => setUserSearchQuery(e.target.value)}
              className="w-full bg-[#050811] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#050811] border border-slate-800 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setUserRoleFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                userRoleFilter === 'all' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({adminUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('admin')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                userRoleFilter === 'admin' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Admins ({adminUsers.filter(u => u.role === 'admin').length})
            </button>
            <button
              type="button"
              onClick={() => setUserRoleFilter('user')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                userRoleFilter === 'user' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Users ({adminUsers.filter(u => u.role !== 'admin').length})
            </button>
          </div>
        </div>

        {/* Users Directory Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#050811] border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role Authority</th>
                <th className="py-3 px-4 hidden md:table-cell">Joined</th>
                <th className="py-3 px-4 hidden sm:table-cell">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {filteredAdminUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No community members found matching query.
                  </td>
                </tr>
              ) : (
                filteredAdminUsers.map(u => {
                  const isUpdating = updatingUserId === u.userId;
                  const isMasterAdmin = u.email.toLowerCase() === 'ibrahimfaruqolamilekan4@gmail.com';

                  return (
                    <tr key={u.userId} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {u.displayName?.charAt(0) || u.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <span className="font-semibold text-white block truncate">
                              {u.displayName || u.email.split('@')[0]}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <Mail size={10} className="shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Shield size={10} />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <UserCheck size={10} />
                            <span>Worshiper</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Calendar size={12} className="text-slate-500" />
                          <span>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 hidden sm:table-cell">
                        <span className="text-[11px] font-mono">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isMasterAdmin ? (
                          <span className="text-[10px] font-semibold text-teal-400/80 uppercase tracking-wider">
                            Owner / Master
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {u.role === 'admin' ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(u, 'user')}
                                disabled={isUpdating}
                                className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isUpdating ? 'Updating...' : 'Demote to User'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUpdateRole(u, 'admin')}
                                disabled={isUpdating}
                                className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                              >
                                {isUpdating ? 'Updating...' : 'Promote to Admin'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

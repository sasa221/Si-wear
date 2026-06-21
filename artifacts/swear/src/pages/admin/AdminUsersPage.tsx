import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Ban, Eye, Loader2, RefreshCw, ShieldCheck, Unlock, UserCheck, Users } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  dbGetAdminUserDetails,
  dbGetAdminUsers,
  dbSetUserActive,
  dbSetUserBlocked,
  dbSetUserRole,
  type AdminUserDetails,
  type AdminUserStats,
  type AdminUserSummary,
} from "@/lib/userService";

const emptyStats: AdminUserStats = {
  totalUsers: 0,
  activeUsers: 0,
  blockedUsers: 0,
  newUsersThisMonth: 0,
  usersWithOrders: 0,
  totalRevenueEgp: 0,
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || time <= 0) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

export default function AdminUsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminUserStats>(emptyStats);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  const loadUsers = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setLoadError(null);
    try {
      const result = await dbGetAdminUsers();
      setUsers(result.users);
      setStats(result.stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users.";
      setLoadError(message);
      toast({ title: "Users not loaded", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin, loadUsers]);

  if (!isAdmin) return null;

  const viewUser = async (userId: string) => {
    setBusyUserId(userId);
    try {
      const details = await dbGetAdminUserDetails(userId);
      setSelectedUser(details);
    } catch (err) {
      toast({
        title: "User details not loaded",
        description: err instanceof Error ? err.message : "Failed to load user details.",
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleBlocked = async (user: AdminUserSummary) => {
    const nextBlocked = !(user.blocked || !user.isActive);
    setBusyUserId(user.id);
    try {
      await dbSetUserBlocked(user.id, nextBlocked);
      setUsers(prev => prev.map(item =>
        item.id === user.id ? { ...item, blocked: nextBlocked, isActive: !nextBlocked } : item
      ));
      setSelectedUser(prev =>
        prev && prev.id === user.id ? { ...prev, blocked: nextBlocked, isActive: !nextBlocked } : prev
      );
      toast({ title: nextBlocked ? "User blocked" : "User unblocked", description: user.email || user.phone || user.id });
      await loadUsers();
    } catch (err) {
      toast({
        title: "Status not updated",
        description: err instanceof Error ? err.message : "Failed to update user.",
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const updateRole = async (user: AdminUserSummary, role: "customer" | "admin") => {
    setBusyUserId(user.id);
    try {
      await dbSetUserRole(user.id, role);
      toast({ title: role === "admin" ? "User promoted to admin" : "Admin role removed", description: user.email || user.phone || user.id });
      await loadUsers();
      if (selectedUser?.id === user.id) {
        const details = await dbGetAdminUserDetails(user.id);
        setSelectedUser(details);
      }
    } catch (err) {
      toast({
        title: "Role not updated",
        description: err instanceof Error ? err.message : "Failed to update user role.",
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const deactivateUser = async (user: AdminUserSummary) => {
    if (!confirm(`Deactivate "${user.fullName}"? They will be blocked and unable to use checkout/contact.`)) return;
    setBusyUserId(user.id);
    try {
      await dbSetUserActive(user.id, false);
      toast({ title: "User deactivated", description: user.email || user.phone || user.id });
      await loadUsers();
      if (selectedUser?.id === user.id) {
        const details = await dbGetAdminUserDetails(user.id);
        setSelectedUser(details);
      }
    } catch (err) {
      toast({
        title: "User not deactivated",
        description: err instanceof Error ? err.message : "Failed to deactivate user.",
        variant: "destructive",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users },
    { label: "Active Users", value: stats.activeUsers, icon: UserCheck },
    { label: "Blocked Users", value: stats.blockedUsers, icon: Ban },
    { label: "Admins", value: users.filter(user => user.role === "admin").length, icon: ShieldCheck },
    { label: "New This Month", value: stats.newUsersThisMonth, icon: ShieldCheck },
    { label: "With Orders", value: stats.usersWithOrders, icon: Eye },
  ];

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">USERS</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
            Supabase profiles, order totals, messages, and account status.
          </p>
        </div>
        <button
          onClick={() => loadUsers(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-white transition-colors text-xs uppercase tracking-widest"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loadError && (
        <div className="mb-5 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 mb-6">
        {statCards.map(stat => (
          <div key={stat.label} className="bg-card border border-border p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-display font-bold text-white mt-1">{stat.value}</p>
            </div>
            <stat.icon size={20} className="text-primary" />
          </div>
        ))}
      </div>

      <div className="bg-card border border-border overflow-hidden mb-6">
        {loading ? (
          <div className="py-24 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            <span className="uppercase tracking-widest text-sm">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground uppercase tracking-widest text-sm">
            No users found in profiles.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                  <th className="py-3 px-4 font-normal">User ID</th>
                  <th className="py-3 px-4 font-normal">Name</th>
                  <th className="py-3 px-4 font-normal">Email</th>
                  <th className="py-3 px-4 font-normal">Phone</th>
                  <th className="py-3 px-4 font-normal">Role</th>
                  <th className="py-3 px-4 font-normal">Blocked</th>
                  <th className="py-3 px-4 font-normal">Active</th>
                  <th className="py-3 px-4 font-normal">Orders</th>
                  <th className="py-3 px-4 font-normal">Spent</th>
                  <th className="py-3 px-4 font-normal">Last Login</th>
                  <th className="py-3 px-4 font-normal">Created</th>
                  <th className="py-3 px-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const isSelf = currentUser?.id === user.id;
                  const isBusy = busyUserId === user.id;
                  const blockedClass = user.blocked
                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : "border-primary/40 bg-primary/10 text-primary";
                  return (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-background/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{user.id.slice(0, 8)}</td>
                      <td className="py-3 px-4 text-white text-sm">{user.fullName}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">{user.email || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">{user.phone || "-"}</td>
                      <td className="py-3 px-4 text-primary text-xs uppercase tracking-widest font-bold">{user.role}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${blockedClass}`}>
                          {user.blocked ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${
                          user.isActive
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-red-500/40 bg-red-500/10 text-red-400"
                        }`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white">{user.totalOrders}</td>
                      <td className="py-3 px-4 text-white">{user.totalSpentEgp} EGP</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(user.lastLoginAt)}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(user.createdAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => viewUser(user.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-white disabled:opacity-60"
                          >
                            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                            View
                          </button>
                          <button
                            onClick={() => updateRole(user, user.role === "admin" ? "customer" : "admin")}
                            disabled={isBusy || isSelf}
                            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-white disabled:opacity-40"
                          >
                            <ShieldCheck size={12} />
                            {user.role === "admin" ? "Customer" : "Admin"}
                          </button>
                          <button
                            onClick={() => toggleBlocked(user)}
                            disabled={isBusy || isSelf}
                            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-white disabled:opacity-40"
                          >
                            {user.blocked || !user.isActive ? <Unlock size={12} /> : <Ban size={12} />}
                            {user.blocked || !user.isActive ? "Unblock" : "Block"}
                          </button>
                          <button
                            onClick={() => deactivateUser(user)}
                            disabled={isBusy || isSelf || !user.isActive}
                            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-red-400 disabled:opacity-40"
                          >
                            <Ban size={12} />
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="bg-card border border-border p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 border-b border-border pb-4 mb-4">
            <div>
              <h2 className="font-display text-2xl uppercase text-white">{selectedUser.fullName}</h2>
              <p className="text-xs text-muted-foreground break-all">{selectedUser.email || selectedUser.id}</p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="self-start text-xs uppercase tracking-widest text-muted-foreground hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
            <section className="border border-border bg-background/40 p-4">
              <h3 className="font-display uppercase tracking-widest text-white mb-3">Orders</h3>
              {selectedUser.orders.length === 0 ? (
                <p className="text-muted-foreground">No orders.</p>
              ) : selectedUser.orders.slice(0, 5).map(order => (
                <div key={order.id} className="border-b border-border/50 py-2 last:border-0">
                  <p className="text-white">{order.id}</p>
                  <p className="text-xs text-muted-foreground">{order.status} - {order.total} EGP</p>
                </div>
              ))}
            </section>

            <section className="border border-border bg-background/40 p-4">
              <h3 className="font-display uppercase tracking-widest text-white mb-3">Messages</h3>
              {selectedUser.messages.length === 0 ? (
                <p className="text-muted-foreground">No messages.</p>
              ) : selectedUser.messages.slice(0, 5).map(message => (
                <div key={message.id} className="border-b border-border/50 py-2 last:border-0">
                  <p className="text-white">{message.subject}</p>
                  <p className="text-xs text-muted-foreground">{message.status}</p>
                </div>
              ))}
            </section>

            <section className="border border-border bg-background/40 p-4">
              <h3 className="font-display uppercase tracking-widest text-white mb-3">Notifications</h3>
              {selectedUser.notifications.length === 0 ? (
                <p className="text-muted-foreground">No notifications.</p>
              ) : selectedUser.notifications.slice(0, 5).map(notification => (
                <div key={notification.id} className="border-b border-border/50 py-2 last:border-0">
                  <p className="text-white line-clamp-2">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">{notification.read ? "Read" : "Unread"}</p>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

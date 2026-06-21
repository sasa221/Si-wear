import { dbGetAllContactMessages } from "@/lib/contactService";
import { dbGetAllOrders, dbGetNotifications } from "@/lib/orderService";
import {
  SUPABASE_NOT_CONNECTED_MESSAGE,
  formatSupabaseError,
  getSupabaseAccessToken,
  logSupabaseTableError,
  supabase,
  supabaseConfigured,
  useDevOrderMock,
} from "@/lib/supabase";
import type { ContactMessage, Notification, Order } from "@/lib/types";

export const ACCOUNT_RESTRICTED_MESSAGE = "Your account is restricted. Please contact S! Wear support.";

const PROFILES_TABLE = "profiles";

type AdminUsersApiPayload = {
  ok?: boolean;
  users?: AdminUserSummary[];
  stats?: AdminUserStats;
  user?: AdminUserDetails | null;
  message?: string;
  error?: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  blocked: boolean | null;
  is_active: boolean | null;
  last_login_at: string | null;
  created_at: string | null;
};

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  blocked: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpentEgp: number;
  hasOrders: boolean;
}

export interface AdminUserDetails extends AdminUserSummary {
  orders: Order[];
  messages: ContactMessage[];
  notifications: Notification[];
}

export interface AdminUserStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  newUsersThisMonth: number;
  usersWithOrders: number;
  totalRevenueEgp: number;
}

function throwProfileError(message: string): never {
  logSupabaseTableError(PROFILES_TABLE, message);
  throw new Error(formatSupabaseError(message, PROFILES_TABLE));
}

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");
  return base ? `${base}/api${path}` : `/api${path}`;
}

async function readApiPayload(res: Response): Promise<AdminUsersApiPayload> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) as AdminUsersApiPayload : {};
  } catch {
    return { message: text };
  }
}

function apiMessage(payload: AdminUsersApiPayload, fallback: string): string {
  return typeof payload.message === "string" && payload.message
    ? payload.message
    : typeof payload.error === "string" && payload.error
      ? payload.error
      : fallback;
}

async function adminUsersApi(path: string, init: RequestInit = {}, fallback = "User request failed."): Promise<AdminUsersApiPayload> {
  const token = getSupabaseAccessToken();
  if (!token) throw new Error("Admin login is required. Sign in again.");

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error("Users API is not reachable. Start the API server and try again.");
  }

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(apiMessage(payload, fallback));
  }
  return payload;
}

function rowToUser(row: ProfileRow, orders: Order[] = []): AdminUserSummary {
  const activeOrders = orders.filter(order => order.status !== "Cancelled");
  return {
    id: row.id,
    fullName: row.full_name || "Customer",
    email: row.email || "",
    phone: row.phone || "",
    role: row.role || "customer",
    blocked: row.blocked === true,
    isActive: row.is_active !== false,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at || new Date(0).toISOString(),
    totalOrders: orders.length,
    totalSpentEgp: activeOrders.reduce((sum, order) => sum + order.total, 0),
    hasOrders: orders.length > 0,
  };
}

function readDevProfiles(): ProfileRow[] {
  try {
    const users = JSON.parse(localStorage.getItem("swear_users") || "[]");
    if (!Array.isArray(users)) return [];
    return users.map((user: Record<string, any>) => ({
      id: String(user.id || ""),
      full_name: user.name ?? user.fullName ?? null,
      phone: user.phone ?? null,
      email: user.email ?? null,
      role: user.isAdmin ? "admin" : "customer",
      blocked: user.blocked === true,
      is_active: user.isActive !== false,
      last_login_at: user.lastLoginAt ?? null,
      created_at: user.createdAt ?? null,
    })).filter((user: ProfileRow) => user.id);
  } catch {
    return [];
  }
}

function writeDevBlockedStatus(userId: string, blocked: boolean): void {
  try {
    const users = JSON.parse(localStorage.getItem("swear_users") || "[]");
    if (!Array.isArray(users)) return;
    localStorage.setItem("swear_users", JSON.stringify(users.map((user: Record<string, any>) =>
      user.id === userId ? { ...user, blocked, isActive: !blocked } : user
    )));
  } catch {}
}

function buildStats(users: AdminUserSummary[]): AdminUserStats {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return {
    totalUsers: users.length,
    activeUsers: users.filter(user => user.isActive && !user.blocked).length,
    blockedUsers: users.filter(user => user.blocked || !user.isActive).length,
    newUsersThisMonth: users.filter(user => new Date(user.createdAt).getTime() >= startOfMonth).length,
    usersWithOrders: users.filter(user => user.hasOrders).length,
    totalRevenueEgp: users.reduce((sum, user) => sum + user.totalSpentEgp, 0),
  };
}

async function getProfileRows(): Promise<ProfileRow[]> {
  if (!supabaseConfigured || !supabase) {
    if (useDevOrderMock) return readDevProfiles();
    throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
  }

  const { data, error } = await supabase
    .from<ProfileRow>(PROFILES_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throwProfileError(error.message);
  return data ?? [];
}

export async function dbGetCurrentUserAccountStatus(
  userId: string
): Promise<{ blocked: boolean; isActive: boolean } | null> {
  if (!supabaseConfigured || !supabase) {
    const row = readDevProfiles().find(profile => profile.id === userId);
    return row ? { blocked: row.blocked === true, isActive: row.is_active !== false } : null;
  }

  const { data, error } = await supabase
    .from<ProfileRow>(PROFILES_TABLE)
    .select("id,blocked,is_active")
    .eq("id", userId);

  if (error) throwProfileError(error.message);
  const row = data?.[0];
  return row ? { blocked: row.blocked === true, isActive: row.is_active !== false } : null;
}

export async function dbTouchUserLastLogin(userId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throwProfileError(error.message);
}

export async function dbGetAdminUsers(): Promise<{ users: AdminUserSummary[]; stats: AdminUserStats }> {
  if (supabaseConfigured) {
    const payload = await adminUsersApi("/admin/users", {}, "Failed to load users.");
    const users = payload.users ?? [];
    return { users, stats: payload.stats ?? buildStats(users) };
  }

  const [profiles, orders] = await Promise.all([getProfileRows(), dbGetAllOrders()]);
  const ordersByUser = new Map<string, Order[]>();
  for (const order of orders) {
    if (!order.userId) continue;
    ordersByUser.set(order.userId, [...(ordersByUser.get(order.userId) ?? []), order]);
  }

  const users = profiles.map(profile => rowToUser(profile, ordersByUser.get(profile.id) ?? []));
  return { users, stats: buildStats(users) };
}

export async function dbGetAdminUserDetails(userId: string): Promise<AdminUserDetails | null> {
  if (supabaseConfigured) {
    const payload = await adminUsersApi(`/admin/users/${encodeURIComponent(userId)}`, {}, "Failed to load user details.");
    return payload.user ?? null;
  }

  const [profiles, orders, messages, notifications] = await Promise.all([
    getProfileRows(),
    dbGetAllOrders(),
    dbGetAllContactMessages(),
    dbGetNotifications(userId),
  ]);
  const profile = profiles.find(row => row.id === userId);
  if (!profile) return null;
  const userOrders = orders.filter(order => order.userId === userId);
  return {
    ...rowToUser(profile, userOrders),
    orders: userOrders,
    messages: messages.filter(message => message.customerId === userId),
    notifications,
  };
}

export async function dbSetUserBlocked(userId: string, blocked: boolean): Promise<void> {
  if (supabaseConfigured) {
    await adminUsersApi(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ blocked, isActive: !blocked }),
      },
      "Failed to update user status."
    );
    return;
  }

  if (!supabaseConfigured || !supabase) {
    if (!useDevOrderMock) throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
    writeDevBlockedStatus(userId, blocked);
    return;
  }

  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update({ blocked, is_active: !blocked })
    .eq("id", userId);

  if (error) throwProfileError(error.message);
}

export async function dbSetUserActive(userId: string, isActive: boolean): Promise<void> {
  if (supabaseConfigured) {
    await adminUsersApi(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ blocked: !isActive, isActive }),
      },
      "Failed to update user status."
    );
    return;
  }

  await dbSetUserBlocked(userId, !isActive);
}

export async function dbSetUserRole(userId: string, role: "customer" | "admin"): Promise<void> {
  if (supabaseConfigured) {
    await adminUsersApi(
      `/admin/users/${encodeURIComponent(userId)}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role }),
      },
      "Failed to update user role."
    );
    return;
  }

  if (!useDevOrderMock) throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
  try {
    const users = JSON.parse(localStorage.getItem("swear_users") || "[]");
    if (!Array.isArray(users)) return;
    localStorage.setItem("swear_users", JSON.stringify(users.map((user: Record<string, any>) =>
      user.id === userId ? { ...user, isAdmin: role === "admin" } : user
    )));
  } catch {}
}

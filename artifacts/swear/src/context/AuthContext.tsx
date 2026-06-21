import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Order, OrderStatus, Notification } from "@/lib/types";
import {
  dbSaveOrder,
  dbGetAllOrders,
  dbGetUserOrders,
  dbUpdateOrderStatus,
  dbSaveNotification,
  dbGetNotifications,
  dbMarkNotificationRead,
  dbMarkAllNotificationsRead,
} from "@/lib/orderService";
import {
  clearSupabaseAuthSession,
  getStoredSupabaseAuthSession,
  saveSupabaseAuthSession,
  supabase,
  supabaseAuthGetUser,
  supabaseAuthRefreshSession,
  supabaseAuthSignInWithPassword,
  supabaseAuthSignOut,
  supabaseAuthSignUp,
  supabaseConfigured,
  useDevOrderMock,
  type SupabaseAuthUser,
} from "@/lib/supabase";
import { apiUrl } from "@/lib/apiClient";
import { dbTouchUserLastLogin } from "@/lib/userService";

export type { Order, OrderStatus, Notification } from "@/lib/types";
export type { OrderItem, CustomerInfo } from "@/lib/types";

export interface Address {
  id: string;
  label: string;
  governorate: string;
  city: string;
  address: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  isAdmin?: boolean;
  blocked?: boolean;
  isActive?: boolean;
  lastLoginAt?: string | null;
  addresses: Address[];
  createdAt: string;
}

type StoredUser = User & {
  password?: string;
  passwordHash?: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: "customer" | "admin" | string | null;
  blocked: boolean | null;
  is_active: boolean | null;
  last_login_at: string | null;
  created_at: string | null;
};

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (emailOrPhone: string, password: string) => Promise<boolean>;
  loginAdmin: (emailOrPhone: string, password: string) => Promise<boolean>;
  signup: (name: string, phone: string, email: string, password: string) => Promise<SignupResult>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  saveOrder: (order: Order) => Promise<void>;
  getUserOrders: () => Promise<Order[]>;
  getAllOrders: () => Promise<Order[]>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  getNotifications: () => Promise<Notification[]>;
  getUnreadCount: () => Promise<number>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_KEY = "swear_users";
const CURRENT_USER_KEY = "swear_current_user";
const ADMIN_SESSION_KEY = "swear_admin_session";
const PASSWORD_HASH_VERSION = "pw-v1";

interface AdminSession {
  user_id: string;
  email: string;
  role: string;
  loggedInAt: string;
}

interface SignupResult {
  success: boolean;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

function getAdminSessionData(): AdminSession | null {
  try {
    const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;
    const session: AdminSession = JSON.parse(stored);
    if (session.role === "admin" && session.user_id) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

function setAdminSessionData(session: AdminSession | null): void {
  try {
    if (session && session.role === "admin") {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch {}
}

function rowToProfileUser(row: ProfileRow, authUser?: SupabaseAuthUser): User {
  return {
    id: row.id,
    name: row.full_name || (authUser?.user_metadata?.full_name as string | undefined) || authUser?.email || "Customer",
    phone: row.phone || (authUser?.user_metadata?.phone as string | undefined) || "",
    email: row.email || authUser?.email || "",
    isAdmin: row.role === "admin",
    blocked: row.blocked === true,
    isActive: row.is_active !== false,
    lastLoginAt: row.last_login_at,
    addresses: [],
    createdAt: row.created_at || new Date().toISOString(),
  };
}

async function getProfileById(id: string, authUser?: SupabaseAuthUser): Promise<User | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from<ProfileRow>("profiles")
    .select("*")
    .eq("id", id);

  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row ? rowToProfileUser(row, authUser) : null;
}

async function getProfileByPhone(phone: string): Promise<ProfileRow | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from<ProfileRow>("profiles")
    .select("*")
    .eq("phone", phone);

  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

async function createCustomerProfile(
  authUser: SupabaseAuthUser,
  fullName: string,
  phone: string,
  email: string
): Promise<User> {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase is not connected.");
  const now = new Date().toISOString();
  const profile: ProfileRow = {
    id: authUser.id,
    full_name: fullName,
    phone,
    email,
    role: "customer",
    blocked: false,
    is_active: true,
    last_login_at: null,
    created_at: now,
  };

  const { data, error } = await supabase.from<ProfileRow>("profiles").upsert(profile);
  if (error) throw new Error(error.message);
  return rowToProfileUser((data ?? [profile])[0], authUser);
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function getSignupErrorMessage(err: unknown): string {
  const message = getErrorMessage(err);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("email address") && normalized.includes("registered") ||
    normalized.includes("already exists") ||
    normalized.includes("duplicate") && normalized.includes("email")
  ) {
    return "Email already registered";
  }

  if (normalized.includes("duplicate") && normalized.includes("phone")) {
    return "Phone number already registered";
  }

  return message || "Could not create account. Please try again.";
}

async function ensureCustomerProfile(authUser: SupabaseAuthUser): Promise<User> {
  const existing = await getProfileById(authUser.id, authUser);
  if (existing) return existing;

  return createCustomerProfile(
    authUser,
    (authUser.user_metadata?.full_name as string | undefined) || authUser.email || "Customer",
    (authUser.user_metadata?.phone as string | undefined) || "",
    authUser.email || ""
  );
}

async function resolveEmailForLogin(emailOrPhone: string): Promise<string | null> {
  const trimmed = emailOrPhone.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  const profile = await getProfileByPhone(trimmed);
  return profile?.email ?? null;
}

function publicUser(user: StoredUser): User {
  const { password: _password, passwordHash: _passwordHash, ...safeUser } = user;
  delete safeUser.isAdmin;
  return safeUser;
}

function storedUser(user: StoredUser): StoredUser {
  const { password: _password, ...safeUser } = user;
  delete safeUser.isAdmin;
  return safeUser;
}

function readStoredUsers(): StoredUser[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users.map(storedUser)));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function createSalt(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function fallbackHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function digestText(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof TextEncoder !== "undefined") {
    const data = new TextEncoder().encode(value);
    const digest = await subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }
  return fallbackHash(value);
}

async function createPasswordHash(password: string): Promise<string> {
  const salt = createSalt();
  const digest = await digestText(`${salt}:${password}`);
  return `${PASSWORD_HASH_VERSION}:${salt}:${digest}`;
}

async function verifyPasswordHash(passwordHash: string | undefined, password: string): Promise<boolean> {
  if (!passwordHash) return false;
  const [version, salt, digest] = passwordHash.split(":");
  if (version !== PASSWORD_HASH_VERSION || !salt || !digest) return false;
  return digestText(`${salt}:${password}`).then(candidate => candidate === digest);
}

async function getReadyUsers(): Promise<StoredUser[]> {
  const rawUsers = readStoredUsers();
  const normalized: StoredUser[] = [];

  for (const rawUser of rawUsers) {
    if (!rawUser?.id || !rawUser.email) continue;
    const passwordHash = rawUser.passwordHash ||
      (typeof rawUser.password === "string" ? await createPasswordHash(rawUser.password) : undefined);
    normalized.push(storedUser({ ...rawUser, passwordHash }));
  }

  writeStoredUsers(normalized);
  return normalized;
}

function getStatusMessage(orderId: string, status: OrderStatus): string {
  const displayId = `#${orderId}`;
  switch (status) {
    case 'Confirmed': return `Your order ${displayId} has been confirmed.`;
    case 'Preparing': return `Your order ${displayId} is being prepared.`;
    case 'Out for Delivery': return `Your order ${displayId} is out for delivery.`;
    case 'Delivered': return `Your order ${displayId} has been delivered.`;
    case 'Cancelled': return `Your order ${displayId} has been cancelled.`;
    default: return `Your order ${displayId} status updated to ${status}.`;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      return saved ? publicUser(JSON.parse(saved)) : null;
    } catch { return null; }
  });
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => getAdminSessionData());

  useEffect(() => {
    if (useDevOrderMock) {
      getReadyUsers().catch(err => console.error("Failed to prepare local users:", err));
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;

    let cancelled = false;
    const bootstrap = async () => {
      const storedSession = getStoredSupabaseAuthSession();
      if (!storedSession) {
        if (!cancelled) setUser(null);
        return;
      }

      try {
        let session = storedSession;
        const expiresAtMs = session.expiresAt ? session.expiresAt * 1000 : 0;
        if (session.refreshToken && expiresAtMs > 0 && expiresAtMs < Date.now() + 60_000) {
          session = await supabaseAuthRefreshSession(session.refreshToken);
        }

        const authUser = await supabaseAuthGetUser(session.accessToken);
        if (!authUser) throw new Error("Supabase session is invalid.");
        const profile = await ensureCustomerProfile(authUser);
        const lastLoginAt = new Date().toISOString();
        dbTouchUserLastLogin(profile.id).catch(err => console.error("Failed to update last login:", err));
        if (!cancelled) {
          const restoredAdminSession = getAdminSessionData();
          if (profile.isAdmin && restoredAdminSession?.user_id === profile.id) {
            setAdminSession(restoredAdminSession);
          } else {
            setAdminSessionData(null);
            setAdminSession(null);
          }
          setUser({ ...profile, lastLoginAt });
        }
      } catch (err) {
        console.error("Failed to restore Supabase session:", err);
        clearSupabaseAuthSession();
        if (!cancelled) setUser(null);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    } catch {}
  }, [user]);

  const isAdmin = (() => {
    if (user?.isAdmin !== true) return false;
    const session = adminSession ?? getAdminSessionData();
    return session?.role === "admin" && session.user_id === user.id;
  })();

  const login = async (emailOrPhone: string, password: string): Promise<boolean> => {
    try {
      if (supabaseConfigured) {
        const email = await resolveEmailForLogin(emailOrPhone);
        if (!email) return false;
        const session = await supabaseAuthSignInWithPassword(email, password);
        const profile = await ensureCustomerProfile(session.user);
        const lastLoginAt = new Date().toISOString();
        dbTouchUserLastLogin(profile.id).catch(err => console.error("Failed to update last login:", err));
        setAdminSessionData(null);
        setAdminSession(null);
        setUser({ ...profile, lastLoginAt });
        return true;
      }

      if (!useDevOrderMock) return false;
      const users = await getReadyUsers();
      const normalizedLogin = emailOrPhone.trim().toLowerCase();
      const rawLogin = emailOrPhone.trim();
      const found = users.find(u =>
        u.email.toLowerCase() === normalizedLogin || u.phone === rawLogin
      );
      if (!found || !(await verifyPasswordHash(found.passwordHash, password))) return false;
      const lastLoginAt = new Date().toISOString();
      setAdminSessionData(null);
      setAdminSession(null);
      setUser(publicUser({ ...found, lastLoginAt }));
      return true;
    } catch (err) {
      console.error("Login failed:", err);
    }
    return false;
  };

  const loginAdmin = async (emailOrPhone: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(apiUrl("/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailOrPhone.trim(),
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok || !result?.user_id || !result?.session?.access_token) {
        return false;
      }

      const authUser: SupabaseAuthUser = {
        id: result.user_id,
        email: result.email || emailOrPhone.trim(),
      };
      saveSupabaseAuthSession({
        accessToken: result.session.access_token,
        refreshToken: result.session.refresh_token,
        expiresAt: result.session.expires_at,
        user: authUser,
      });

      const nextAdminSession: AdminSession = {
        user_id: result.user_id,
        email: result.email || emailOrPhone.trim(),
        role: "admin",
        loggedInAt: new Date().toISOString(),
      };
      setAdminSessionData(nextAdminSession);
      setAdminSession(nextAdminSession);

      const profile = await getProfileById(result.user_id, authUser).catch(() => null);
      const lastLoginAt = new Date().toISOString();
      dbTouchUserLastLogin(result.user_id).catch(err => console.error("Failed to update last login:", err));
      setUser(profile
        ? { ...profile, isAdmin: true, lastLoginAt }
        : {
            id: result.user_id,
            name: result.email || emailOrPhone.trim(),
            phone: "",
            email: result.email || emailOrPhone.trim(),
            isAdmin: true,
            addresses: [],
            createdAt: lastLoginAt,
            lastLoginAt,
          });
      return true;
    } catch (err) {
      console.error("Admin login failed:", err);
      return false;
    }
  };

  const signup = async (name: string, phone: string, email: string, password: string): Promise<SignupResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    try {
      if (supabaseConfigured) {
        const result = await supabaseAuthSignUp(normalizedEmail, password, {
          full_name: normalizedName,
          phone: normalizedPhone,
        });

        if (result.emailAlreadyRegistered) {
          return { success: false, message: "Email already registered" };
        }

        if (!result.session) {
          if (result.user) {
            return {
              success: true,
              requiresEmailConfirmation: true,
              message: "Account created. Check your email to confirm it, then sign in.",
            };
          }

          return { success: false, message: "Could not create account. Please try again." };
        }

        const profile = await createCustomerProfile(result.session.user, normalizedName, normalizedPhone, normalizedEmail);
        setAdminSessionData(null);
        setAdminSession(null);
        setUser(profile);
        return { success: true };
      }

      if (!useDevOrderMock) {
        return { success: false, message: "Could not create account. Please try again." };
      }
      const users = await getReadyUsers();
      if (users.find(u => u.email.toLowerCase() === normalizedEmail)) {
        return { success: false, message: "Email already registered" };
      }
      const newUser: StoredUser = {
        id: "usr-" + Date.now(),
        name: normalizedName,
        phone: normalizedPhone,
        email: normalizedEmail,
        passwordHash: await createPasswordHash(password),
        addresses: [],
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      writeStoredUsers(users);
      setAdminSessionData(null);
      setAdminSession(null);
      setUser(publicUser(newUser));
      return { success: true };
    } catch (err) {
      console.error("Signup failed:", err);
      return { success: false, message: getSignupErrorMessage(err) };
    }
  };

  const logout = () => {
    if (supabaseConfigured) {
      supabaseAuthSignOut().catch(err => console.error("Supabase logout failed:", err));
      clearSupabaseAuthSession();
    }
    setAdminSession(null);
    setAdminSessionData(null);
    setUser(null);
    console.log("admin session cleared on logout");
  };

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    if (supabaseConfigured && supabase) {
      const next = { ...user, ...data, id: user.id, isAdmin: user.isAdmin };
      setUser(next);
      supabase
        .from("profiles")
        .update({
          full_name: next.name,
          phone: next.phone,
          email: next.email,
        })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.error("Failed to update Supabase profile:", error.message);
        });
      return;
    }

    if (!useDevOrderMock) return;
    try {
      const users = readStoredUsers();
      const idx = users.findIndex(u => u.id === user.id);
      if (idx === -1) return;
      const updated = storedUser({ ...users[idx], ...data, id: user.id });
      users[idx] = updated;
      writeStoredUsers(users);
      setUser(publicUser(updated));
    } catch {}
  };

  const saveOrder = async (order: Order): Promise<void> => {
    await dbSaveOrder(order);
  };

  const getUserOrders = async (): Promise<Order[]> => {
    if (!user) return [];
    return dbGetUserOrders(user.id);
  };

  const getAllOrders = async (): Promise<Order[]> => {
    return dbGetAllOrders();
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus): Promise<void> => {
    const userId = await dbUpdateOrderStatus(orderId, status);
    if (userId && status !== 'Pending') {
      await dbSaveNotification({
        userId,
        orderId,
        message: getStatusMessage(orderId, status),
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  };

  const getNotifications = async (): Promise<Notification[]> => {
    if (!user) return [];
    return dbGetNotifications(user.id);
  };

  const getUnreadCount = async (): Promise<number> => {
    if (!user) return 0;
    const notifs = await dbGetNotifications(user.id);
    return notifs.filter(n => !n.read).length;
  };

  const markNotificationRead = async (id: string): Promise<void> => {
    await dbMarkNotificationRead(id);
  };

  const markAllNotificationsRead = async (): Promise<void> => {
    if (!user) return;
    await dbMarkAllNotificationsRead(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, isAdmin,
      login, loginAdmin, signup, logout, updateProfile,
      saveOrder, getUserOrders, getAllOrders, updateOrderStatus,
      getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

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
  password: string;
  isAdmin?: boolean;
  addresses: Address[];
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (emailOrPhone: string, password: string) => boolean;
  signup: (name: string, phone: string, email: string, password: string) => boolean;
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

function getStatusMessage(orderId: string, status: OrderStatus): string {
  switch (status) {
    case 'Confirmed': return `Your order ${orderId} has been confirmed. We're on it!`;
    case 'Preparing': return `Your order ${orderId} is being prepared for delivery.`;
    case 'Out for Delivery': return `Your order ${orderId} is out for delivery. Expect it soon!`;
    case 'Delivered': return `Your order ${orderId} has been delivered. Enjoy your fit!`;
    case 'Cancelled': return `Your order ${orderId} has been cancelled. Contact us for help.`;
    default: return `Your order ${orderId} status updated to ${status}.`;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("swear_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      const users = localStorage.getItem("swear_users");
      if (!users || JSON.parse(users).length === 0) {
        localStorage.setItem("swear_users", JSON.stringify([{
          id: "admin-001",
          name: "Admin",
          phone: "01220172714",
          email: "admin@swear.com",
          password: "admin123",
          isAdmin: true,
          addresses: [],
          createdAt: new Date().toISOString()
        }]));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem("swear_current_user", JSON.stringify(user));
      } else {
        localStorage.removeItem("swear_current_user");
      }
    } catch {}
  }, [user]);

  const login = (emailOrPhone: string, password: string): boolean => {
    try {
      const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
      const found = users.find(u =>
        (u.email === emailOrPhone || u.phone === emailOrPhone) && u.password === password
      );
      if (found) { setUser(found); return true; }
    } catch {}
    return false;
  };

  const signup = (name: string, phone: string, email: string, password: string): boolean => {
    try {
      const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
      if (users.find(u => u.email === email)) return false;
      const newUser: User = {
        id: "usr-" + Date.now(), name, phone, email, password,
        addresses: [], createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem("swear_users", JSON.stringify(users));
      setUser(newUser);
      return true;
    } catch { return false; }
  };

  const logout = () => setUser(null);

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    try {
      const updated = { ...user, ...data };
      setUser(updated);
      const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) { users[idx] = updated; localStorage.setItem("swear_users", JSON.stringify(users)); }
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
      user, isAdmin: !!user?.isAdmin,
      login, signup, logout, updateProfile,
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

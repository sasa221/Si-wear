import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

export interface CustomerInfo {
  name: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  userId?: string;
  items: OrderItem[];
  total: number;
  deliveryFee: number;
  status: OrderStatus;
  customer: CustomerInfo;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  orderId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (emailOrPhone: string, password: string) => boolean;
  signup: (name: string, phone: string, email: string, password: string) => boolean;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  saveOrder: (order: Order) => void;
  getUserOrders: () => Order[];
  getAllOrders: () => Order[];
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  getNotifications: () => Notification[];
  getUnreadCount: () => number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
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
    const saved = localStorage.getItem("swear_current_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem("swear_current_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("swear_current_user");
    }
  }, [user]);

  const login = (emailOrPhone: string, password: string): boolean => {
    const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
    const found = users.find(u =>
      (u.email === emailOrPhone || u.phone === emailOrPhone) && u.password === password
    );
    if (found) { setUser(found); return true; }
    return false;
  };

  const signup = (name: string, phone: string, email: string, password: string): boolean => {
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
  };

  const logout = () => setUser(null);

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) { users[idx] = updated; localStorage.setItem("swear_users", JSON.stringify(users)); }
  };

  const saveOrder = (order: Order) => {
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    orders.push(order);
    localStorage.setItem("swear_orders", JSON.stringify(orders));
  };

  const getUserOrders = (): Order[] => {
    if (!user) return [];
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    return orders.filter(o => o.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getAllOrders = (): Order[] => {
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const order = orders[idx];
    orders[idx] = { ...order, status };
    localStorage.setItem("swear_orders", JSON.stringify(orders));

    if (order.userId && status !== 'Pending') {
      const notifications: Notification[] = JSON.parse(localStorage.getItem("swear_notifications") || "[]");
      notifications.push({
        id: "notif-" + Date.now(),
        userId: order.userId,
        orderId,
        message: getStatusMessage(orderId, status),
        createdAt: new Date().toISOString(),
        read: false
      });
      localStorage.setItem("swear_notifications", JSON.stringify(notifications));
    }
  };

  const getNotifications = (): Notification[] => {
    if (!user) return [];
    const notifications: Notification[] = JSON.parse(localStorage.getItem("swear_notifications") || "[]");
    return notifications.filter(n => n.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getUnreadCount = (): number => {
    if (!user) return 0;
    const notifications: Notification[] = JSON.parse(localStorage.getItem("swear_notifications") || "[]");
    return notifications.filter(n => n.userId === user.id && !n.read).length;
  };

  const markNotificationRead = (id: string) => {
    const notifications: Notification[] = JSON.parse(localStorage.getItem("swear_notifications") || "[]");
    const idx = notifications.findIndex(n => n.id === id);
    if (idx !== -1) { notifications[idx].read = true; localStorage.setItem("swear_notifications", JSON.stringify(notifications)); }
  };

  const markAllNotificationsRead = () => {
    if (!user) return;
    const notifications: Notification[] = JSON.parse(localStorage.getItem("swear_notifications") || "[]");
    const updated = notifications.map(n => n.userId === user.id ? { ...n, read: true } : n);
    localStorage.setItem("swear_notifications", JSON.stringify(updated));
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

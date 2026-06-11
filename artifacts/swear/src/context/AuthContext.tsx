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

export interface Order {
  id: string;
  userId?: string;
  items: OrderItem[];
  total: number;
  deliveryFee: number;
  status: 'Pending' | 'Confirmed' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  customer: CustomerInfo;
  createdAt: string;
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
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const login = (emailOrPhone: string, password: string) => {
    const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
    const foundUser = users.find(u => 
      (u.email === emailOrPhone || u.phone === emailOrPhone) && u.password === password
    );
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const signup = (name: string, phone: string, email: string, password: string) => {
    const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
    if (users.find(u => u.email === email)) {
      return false;
    }
    const newUser: User = {
      id: "usr-" + Date.now(),
      name,
      phone,
      email,
      password,
      addresses: [],
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem("swear_users", JSON.stringify(users));
    setUser(newUser);
    return true;
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    const users: User[] = JSON.parse(localStorage.getItem("swear_users") || "[]");
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      localStorage.setItem("swear_users", JSON.stringify(users));
    }
  };

  const saveOrder = (order: Order) => {
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    orders.push(order);
    localStorage.setItem("swear_orders", JSON.stringify(orders));
  };

  const getUserOrders = () => {
    if (!user) return [];
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    return orders.filter(o => o.userId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getAllOrders = () => {
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    const orders: Order[] = JSON.parse(localStorage.getItem("swear_orders") || "[]");
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      orders[orderIndex].status = status;
      localStorage.setItem("swear_orders", JSON.stringify(orders));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: !!user?.isAdmin,
      login,
      signup,
      logout,
      updateProfile,
      saveOrder,
      getUserOrders,
      getAllOrders,
      updateOrderStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import { useAuth } from "@/context/AuthContext";
import type { Order } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DollarSign, ShoppingBag, Clock, CheckCircle, Truck, PackageCheck, Loader2, TrendingUp, AlertTriangle, Users, UserCheck, Ban } from "lucide-react";
import { getProductsAsync } from "@/hooks/useProducts";
import { getActiveVariants, type Product } from "@/data/products";
import { dbGetAdminUsers, type AdminUserStats } from "@/lib/userService";

const emptyUserStats: AdminUserStats = {
  totalUsers: 0,
  activeUsers: 0,
  blockedUsers: 0,
  newUsersThisMonth: 0,
  usersWithOrders: 0,
  totalRevenueEgp: 0,
};

function statusClass(status: string) {
  switch (status) {
    case 'Delivered': return 'bg-green-500/20 text-green-500';
    case 'Cancelled': return 'bg-red-500/20 text-red-500';
    case 'Confirmed': return 'bg-blue-500/20 text-blue-500';
    case 'Preparing': return 'bg-orange-500/20 text-orange-400';
    case 'Out for Delivery': return 'bg-purple-500/20 text-purple-500';
    default: return 'bg-yellow-500/20 text-yellow-500';
  }
}

export default function AdminDashboard() {
  const { isAdmin, getAllOrders } = useAuth();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [userStats, setUserStats] = useState<AdminUserStats>(emptyUserStats);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
    }
  }, [isAdmin, setLocation]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.allSettled([getAllOrders(), dbGetAdminUsers(), getProductsAsync({ admin: true })])
      .then(([ordersResult, usersResult, productsResult]) => {
        if (cancelled) return;
        const errors: string[] = [];
        if (ordersResult.status === "fulfilled") {
          setOrders(ordersResult.value);
        } else {
          console.error("Failed to load dashboard orders:", ordersResult.reason);
          errors.push("Failed to load dashboard orders.");
        }
        if (usersResult.status === "fulfilled") {
          setUserStats(usersResult.value.stats);
        } else {
          console.error("Failed to load dashboard users:", usersResult.reason);
          errors.push(usersResult.reason instanceof Error ? usersResult.reason.message : "Failed to load dashboard users.");
        }
        if (productsResult.status === "fulfilled") {
          setProducts(productsResult.value);
        } else {
          console.error("Failed to load dashboard products:", productsResult.reason);
          errors.push(productsResult.reason instanceof Error ? productsResult.reason.message : "Failed to load dashboard products.");
        }
        setLoadError(errors.length > 0 ? errors.join(" ") : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isAdmin, getAllOrders]);

  if (!isAdmin) return null;

  const totalRevenue = orders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + o.total, 0);
  const deliveredOrders = orders.filter(o => o.status === 'Delivered');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeekDate = new Date(now);
  startOfWeekDate.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeekDate.setHours(0, 0, 0, 0);
  const startOfWeek = startOfWeekDate.getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const salesToday = deliveredOrders.filter(order => new Date(order.createdAt).getTime() >= startOfToday).reduce((sum, order) => sum + order.total, 0);
  const salesThisWeek = deliveredOrders.filter(order => new Date(order.createdAt).getTime() >= startOfWeek).reduce((sum, order) => sum + order.total, 0);
  const salesThisMonth = deliveredOrders.filter(order => new Date(order.createdAt).getTime() >= startOfMonth).reduce((sum, order) => sum + order.total, 0);
  
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const confirmedCount = orders.filter(o => o.status === 'Confirmed').length;
  const preparingCount = orders.filter(o => o.status === 'Preparing').length;
  const outForDeliveryCount = orders.filter(o => o.status === 'Out for Delivery').length;
  const deliveredCount = orders.filter(o => o.status === 'Delivered').length;

  const recentOrders = orders.slice(0, 5);
  const ordersByStatus: [string, number][] = [
    ["Pending", pendingCount],
    ["Confirmed", confirmedCount],
    ["Preparing", preparingCount],
    ["Out for Delivery", outForDeliveryCount],
    ["Delivered", deliveredCount],
    ["Cancelled", orders.filter(o => o.status === "Cancelled").length],
  ];
  const topProducts = [...orders
    .filter(order => order.status !== "Cancelled")
    .flatMap(order => order.items)]
    .reduce<Map<string, { name: string; quantity: number }>>((map, item) => {
      const current = map.get(item.productId) ?? { name: item.productName, quantity: 0 };
      current.quantity += item.quantity;
      map.set(item.productId, current);
      return map;
    }, new Map());
  const topSellingProducts = [...topProducts.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const lowStockVariants = products
    .filter(product => product.status === "active")
    .flatMap(product => getActiveVariants(product).map(variant => ({ product, variant })))
    .filter(({ variant }) => variant.stock > 0 && variant.stock <= 3)
    .slice(0, 6);

  const stats = [
    { label: "Sales Today", value: `${salesToday} EGP`, icon: DollarSign, color: "text-primary" },
    { label: "Sales This Week", value: `${salesThisWeek} EGP`, icon: TrendingUp, color: "text-primary" },
    { label: "Sales This Month", value: `${salesThisMonth} EGP`, icon: TrendingUp, color: "text-primary" },
    { label: "Total Revenue", value: `${totalRevenue} EGP`, icon: DollarSign, color: "text-primary" },
    { label: "Total Orders", value: orders.length, icon: ShoppingBag, color: "text-white" },
    { label: "Total Users", value: userStats.totalUsers, icon: Users, color: "text-white" },
    { label: "Active Users", value: userStats.activeUsers, icon: UserCheck, color: "text-primary" },
    { label: "Blocked Users", value: userStats.blockedUsers, icon: Ban, color: "text-red-400" },
    { label: "New Users This Month", value: userStats.newUsersThisMonth, icon: Users, color: "text-primary" },
    { label: "Customers With Orders", value: userStats.usersWithOrders, icon: ShoppingBag, color: "text-white" },
    { label: "Pending", value: pendingCount, icon: Clock, color: "text-yellow-500" },
    { label: "Confirmed", value: confirmedCount, icon: CheckCircle, color: "text-blue-500" },
    { label: "Preparing", value: preparingCount, icon: Truck, color: "text-orange-500" },
    { label: "Out for Delivery", value: outForDeliveryCount, icon: Truck, color: "text-purple-500" },
    { label: "Delivered", value: deliveredCount, icon: PackageCheck, color: "text-green-500" },
  ];

  return (
    <AdminLayout>
      <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white mb-8">DASHBOARD</h1>
      {loadError && (
        <div className="mb-6 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {loadError}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-card border border-border p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`text-3xl font-display font-bold ${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`p-4 rounded-full bg-background border border-border ${stat.color}`}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-12">
        <div className="bg-card border border-border p-5">
          <h2 className="font-display text-xl uppercase tracking-wider text-white mb-4">ORDERS BY STATUS</h2>
          <div className="space-y-2">
            {ordersByStatus.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm border-b border-border/40 pb-2">
                <span className={`px-2 py-1 text-xs uppercase tracking-widest font-bold ${statusClass(String(status))}`}>{status}</span>
                <span className="text-white font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border p-5">
          <h2 className="font-display text-xl uppercase tracking-wider text-white mb-4">TOP SELLING</h2>
          {topSellingProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <div className="space-y-3">
              {topSellingProducts.map(product => (
                <div key={product.name} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white line-clamp-1">{product.name}</span>
                  <span className="text-primary font-bold text-sm">{product.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border p-5">
          <h2 className="font-display text-xl uppercase tracking-wider text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-400" /> LOW STOCK
          </h2>
          {lowStockVariants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No low stock variants.</p>
          ) : (
            <div className="space-y-3">
              {lowStockVariants.map(({ product, variant }) => (
                <div key={variant.id} className="text-sm">
                  <p className="text-white line-clamp-1">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{variant.color} / {variant.size} - <span className="text-yellow-400">{variant.stock} left</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="font-display text-2xl uppercase tracking-wider text-white">RECENT ORDERS</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest">
                <th className="py-4 px-6 font-normal">Order ID</th>
                <th className="py-4 px-6 font-normal">Customer</th>
                <th className="py-4 px-6 font-normal">Status</th>
                <th className="py-4 px-6 font-normal text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-3 uppercase tracking-widest text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      Loading orders...
                    </span>
                  </td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">No orders yet.</td>
                </tr>
              ) : recentOrders.map(order => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="py-4 px-6 font-display text-white text-lg">{order.id}</td>
                  <td className="py-4 px-6">
                    <p className="text-white text-sm">{order.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 text-xs uppercase tracking-widest font-bold ${statusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right text-white font-bold">{order.total} EGP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

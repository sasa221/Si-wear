import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DollarSign, ShoppingBag, Clock, CheckCircle, Truck, PackageCheck } from "lucide-react";

export default function AdminDashboard() {
  const { isAdmin, getAllOrders } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
    }
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  const orders = getAllOrders();
  const totalRevenue = orders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + o.total, 0);
  
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const confirmedCount = orders.filter(o => o.status === 'Confirmed').length;
  const outCount = orders.filter(o => o.status === 'Out for Delivery').length;
  const deliveredCount = orders.filter(o => o.status === 'Delivered').length;

  const recentOrders = orders.slice(0, 5);

  const stats = [
    { label: "Total Revenue", value: `${totalRevenue} EGP`, icon: DollarSign, color: "text-primary" },
    { label: "Total Orders", value: orders.length, icon: ShoppingBag, color: "text-white" },
    { label: "Pending", value: pendingCount, icon: Clock, color: "text-yellow-500" },
    { label: "Confirmed", value: confirmedCount, icon: CheckCircle, color: "text-blue-500" },
    { label: "Out for Delivery", value: outCount, icon: Truck, color: "text-purple-500" },
    { label: "Delivered", value: deliveredCount, icon: PackageCheck, color: "text-green-500" },
  ];

  return (
    <AdminLayout>
      <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white mb-8">DASHBOARD</h1>
      
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
              {recentOrders.length === 0 ? (
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
                    <span className={`px-2 py-1 text-xs uppercase tracking-widest font-bold ${
                      order.status === 'Delivered' ? 'bg-green-500/20 text-green-500' :
                      order.status === 'Cancelled' ? 'bg-red-500/20 text-red-500' :
                      order.status === 'Confirmed' ? 'bg-blue-500/20 text-blue-500' :
                      order.status === 'Out for Delivery' ? 'bg-purple-500/20 text-purple-500' :
                      'bg-yellow-500/20 text-yellow-500'
                    }`}>
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

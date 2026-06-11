import { useAuth, Order } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function AdminOrdersPage() {
  const { isAdmin, getAllOrders, updateOrderStatus } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
    }
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  const orders = getAllOrders();
  
  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === "All" || o.status === filter;
    const matchesSearch = o.id.toLowerCase().includes(search.toLowerCase()) || 
                          o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
                          o.customer.phone.includes(search);
    return matchesFilter && matchesSearch;
  });

  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    updateOrderStatus(orderId, newStatus);
    toast({ title: "Status Updated", description: `Order ${orderId} is now ${newStatus}` });
    // Force re-render would naturally happen if we bound orders to state, but since it's from context and localstorage we might need a small trick.
    // AuthContext currently doesn't expose orders as reactive state, so we reload window or use a tick. For this demo, window.location.reload is fine or we can rely on it picking up next render if we had local state.
    // Let's add a dummy state to force update.
    setSearch(s => s + " ");
    setTimeout(() => setSearch(s => s.trim()), 0);
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white mb-8">ORDERS</h1>
      
      <div className="bg-card border border-border p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {["All", "Pending", "Confirmed", "Out for Delivery", "Delivered", "Cancelled"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs uppercase tracking-widest font-bold whitespace-nowrap transition-colors ${
                filter === f ? 'bg-primary text-black' : 'bg-background text-muted-foreground hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="w-full md:w-64">
          <Input 
            placeholder="Search ID, Name, Phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background rounded-none border-border"
          />
        </div>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/50">
                <th className="py-4 px-4 font-normal">Order ID</th>
                <th className="py-4 px-4 font-normal">Customer</th>
                <th className="py-4 px-4 font-normal">Location</th>
                <th className="py-4 px-4 font-normal">Total</th>
                <th className="py-4 px-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">No orders found.</td>
                </tr>
              ) : filteredOrders.map(order => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-background/20 transition-colors">
                  <td className="py-4 px-4">
                    <p className="font-display text-white text-lg">{order.id}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-white text-sm font-bold">{order.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-white text-sm">{order.customer.governorate}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{order.customer.city}</p>
                  </td>
                  <td className="py-4 px-4 text-white font-bold">{order.total} EGP</td>
                  <td className="py-4 px-4">
                    <select 
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                      className={`h-9 px-3 text-xs uppercase tracking-widest font-bold outline-none cursor-pointer border ${
                        order.status === 'Delivered' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        order.status === 'Cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        order.status === 'Confirmed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                        order.status === 'Out for Delivery' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                        'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      }`}
                    >
                      <option value="Pending" className="bg-background text-foreground">Pending</option>
                      <option value="Confirmed" className="bg-background text-foreground">Confirmed</option>
                      <option value="Out for Delivery" className="bg-background text-foreground">Out for Delivery</option>
                      <option value="Delivered" className="bg-background text-foreground">Delivered</option>
                      <option value="Cancelled" className="bg-background text-foreground">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

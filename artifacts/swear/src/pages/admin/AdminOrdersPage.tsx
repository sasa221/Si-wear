import { useAuth, OrderStatus } from "@/context/AuthContext";
import type { Order } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";

const ALL_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

function statusClass(status: OrderStatus) {
  switch (status) {
    case 'Delivered': return 'bg-green-500/10 text-green-500 border-green-500/30';
    case 'Cancelled': return 'bg-red-500/10 text-red-500 border-red-500/30';
    case 'Confirmed': return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    case 'Preparing': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    case 'Out for Delivery': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    default: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
  }
}

export default function AdminOrdersPage() {
  const { isAdmin, getAllOrders, updateOrderStatus } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  const loadOrders = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders:", err);
      toast({ title: "Error", description: "Failed to load orders. Check your connection.", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAllOrders, toast]);

  useEffect(() => {
    if (!isAdmin) return;
    loadOrders();
  }, [isAdmin, loadOrders]);

  if (!isAdmin) return null;

  const filtered = orders.filter(o => {
    const matchFilter = filter === "All" || o.status === filter;
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      o.id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q) ||
      o.customer.governorate.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast({ title: "Status Updated", description: `Order ${orderId} → ${newStatus}` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">ORDERS</h1>
        <button
          onClick={() => loadOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-white transition-colors text-xs uppercase tracking-widest"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-card border border-border p-4 mb-4 flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-wrap">
          {["All", ...ALL_STATUSES].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold transition-colors ${
                filter === f ? 'bg-primary text-black' : 'bg-background text-muted-foreground hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="w-full md:w-64">
          <Input
            placeholder="Search ID, name, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-background rounded-none border-border"
          />
        </div>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="py-24 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            <span className="uppercase tracking-widest text-sm">Loading orders...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                  <th className="py-3 px-4 font-normal w-8"></th>
                  <th className="py-3 px-4 font-normal">Order</th>
                  <th className="py-3 px-4 font-normal">Customer</th>
                  <th className="py-3 px-4 font-normal">Location</th>
                  <th className="py-3 px-4 font-normal">Items</th>
                  <th className="py-3 px-4 font-normal">Total</th>
                  <th className="py-3 px-4 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-muted-foreground uppercase tracking-widest text-sm">
                      {orders.length === 0 ? "No orders yet." : "No orders match your filter."}
                    </td>
                  </tr>
                ) : filtered.map(order => (
                  <>
                    <tr
                      key={order.id}
                      className="border-b border-border/40 hover:bg-background/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    >
                      <td className="py-3 px-4 text-muted-foreground">
                        {expandedId === order.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-display text-white text-base">{order.id}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-white text-sm font-semibold">{order.customer.name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-white text-sm">{order.customer.governorate}</p>
                        <p className="text-xs text-muted-foreground">{order.customer.city}</p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3 px-4 text-white font-bold text-sm">{order.total} EGP</td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        {updatingId === order.id ? (
                          <Loader2 size={16} className="animate-spin text-primary" />
                        ) : (
                          <select
                            value={order.status}
                            onChange={e => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className={`h-8 px-2 text-xs uppercase tracking-widest font-bold outline-none cursor-pointer border bg-transparent ${statusClass(order.status)}`}
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s} className="bg-[#111] text-white normal-case font-normal">{s}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>

                    {expandedId === order.id && (
                      <tr key={`${order.id}-detail`} className="border-b border-border bg-background/40">
                        <td colSpan={7} className="px-6 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-bold border-b border-border pb-2">Customer Details</p>
                              <div className="space-y-1.5">
                                <div className="flex gap-2"><span className="text-muted-foreground w-24 flex-shrink-0">Name</span><span className="text-white">{order.customer.name}</span></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-24 flex-shrink-0">Phone</span><span className="text-white">{order.customer.phone}</span></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-24 flex-shrink-0">Governorate</span><span className="text-white">{order.customer.governorate}</span></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-24 flex-shrink-0">City</span><span className="text-white">{order.customer.city}</span></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-24 flex-shrink-0">Address</span><span className="text-white">{order.customer.address}</span></div>
                                {order.customer.notes && (
                                  <div className="flex gap-2"><span className="text-muted-foreground w-24 flex-shrink-0">Notes</span><span className="text-white">{order.customer.notes}</span></div>
                                )}
                                <div className="flex gap-2 pt-1"><span className="text-muted-foreground w-24 flex-shrink-0">Payment</span><span className="text-primary font-bold">Cash on Delivery</span></div>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-bold border-b border-border pb-2">Order Items</p>
                              <div className="space-y-2">
                                {order.items.map((item, i) => (
                                  <div key={i} className="border border-border/40 p-3 bg-card">
                                    <p className="text-white font-display uppercase text-sm">{item.productName}</p>
                                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                      <span>Size: <span className="text-white">{item.selectedSize}</span></span>
                                      <span>Color: <span className="text-white">{item.selectedColor}</span></span>
                                      <span>Qty: <span className="text-white">{item.quantity}</span></span>
                                      <span>Price: <span className="text-white">{item.price * item.quantity} EGP</span></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 pt-3 border-t border-border/40 space-y-1 text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Subtotal</span>
                                  <span className="text-white">{order.total - order.deliveryFee - (order.discountAmount ?? 0)} EGP</span>
                                </div>
                                {(order.discountAmount ?? 0) > 0 && (
                                  <div className="flex justify-between text-primary font-bold">
                                    <span>Discount ({order.discountCode})</span>
                                    <span>- {order.discountAmount} EGP</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Shipping</span>
                                  <span className="text-white">{order.deliveryFee === 0 ? 'FREE' : `${order.deliveryFee} EGP`}</span>
                                </div>
                                <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-border/40">
                                  <span className="text-white font-display uppercase tracking-widest">Total</span>
                                  <span className="text-primary text-base">{order.total} EGP</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

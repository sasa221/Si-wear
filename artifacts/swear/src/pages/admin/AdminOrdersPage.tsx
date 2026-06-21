import { useAuth, OrderStatus } from "@/context/AuthContext";
import type { Order } from "@/context/AuthContext";
import { Link, useLocation } from "wouter";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SUPABASE_NOT_CONNECTED_MESSAGE, subscribeToTableChanges, supabaseConfigured, useDevOrderMock } from "@/lib/supabase";
import { dbResolveCancellation, dbUpdateOrderAdminNotes } from "@/lib/orderService";
import { ChevronDown, ChevronUp, Download, Loader2, Printer, RefreshCw } from "lucide-react";

const FILTER_STATUSES = ['All', 'Cancellation Requested', 'Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'] as const;
const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

type StatusFilter = typeof FILTER_STATUSES[number];

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

function cancellationPending(order: Order): boolean {
  return order.cancellationRequested === true || order.cancellationStatus === "Pending";
}

export default function AdminOrdersPage() {
  const { isAdmin, getAllOrders, updateOrderStatus } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [cancellationNoteDrafts, setCancellationNoteDrafts] = useState<Record<string, string>>({});

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
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load orders.", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAllOrders, toast]);

  useEffect(() => {
    if (!isAdmin) return;
    loadOrders();
  }, [isAdmin, loadOrders]);

  useEffect(() => {
    if (!isAdmin || !supabaseConfigured) return;
    return subscribeToTableChanges<Record<string, any>>(
      { table: "orders", channel: "admin-orders" },
      change => {
        if (change.eventType === "INSERT" || change.eventType === "UPDATE") {
          loadOrders();
        }
      }
    );
  }, [isAdmin, loadOrders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return orders.filter(order => {
      const matchFilter =
        filter === "All" ||
        (filter === "Cancellation Requested" ? cancellationPending(order) : order.status === filter);
      const matchSearch = !q ||
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.phone.toLowerCase().includes(q);

      return matchFilter && matchSearch;
    });
  }, [filter, orders, search]);

  if (!isAdmin) return null;

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast({ title: "Status Updated", description: `Order ${orderId} -> ${newStatus}` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update status.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCsv = () => {
    const rows = filtered.map(order => ({
      order_number: order.id,
      customer_name: order.customer.name,
      phone: order.customer.phone,
      governorate: order.customer.governorate,
      city: order.customer.city,
      address: order.customer.address,
      status: order.status,
      cancellation_status: order.cancellationStatus ?? "None",
      total_egp: order.total,
      date: new Date(order.createdAt).toISOString(),
    }));
    const headers = ["order_number", "customer_name", "phone", "governorate", "city", "address", "status", "cancellation_status", "total_egp", "date"];
    const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map(row => headers.map(header => escapeCell(row[header as keyof typeof row])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `swear-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveNotes = async (orderId: string) => {
    const adminNotes = noteDrafts[orderId] ?? "";
    try {
      await dbUpdateOrderAdminNotes(orderId, adminNotes);
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, adminNotes } : order));
      toast({ title: "Notes saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save notes.", variant: "destructive" });
    }
  };

  const handleCancellationDecision = async (order: Order, approved: boolean) => {
    setUpdatingId(order.id);
    try {
      const adminNote = cancellationNoteDrafts[order.id]?.trim();
      await dbResolveCancellation(order.id, approved, adminNote);
      setCancellationNoteDrafts(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      await loadOrders();
      toast({ title: approved ? "Cancellation approved" : "Cancellation rejected" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update cancellation.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">ORDERS</h1>
          <span className="bg-[#39FF14] text-black px-2.5 py-1 text-xs font-black uppercase tracking-widest">
            {filtered.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-white transition-colors text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <Download size={13} />
            CSV
          </button>
          <button
            onClick={() => loadOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-white transition-colors text-xs uppercase tracking-widest"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {!supabaseConfigured && (
        <div className="mb-4 border border-red-500/50 bg-red-500/10 p-4 text-xs uppercase tracking-widest text-red-400">
          <div className="flex flex-wrap items-center gap-2">
            {useDevOrderMock && (
              <span className="bg-primary text-black px-2 py-0.5 font-black">DEV MOCK</span>
            )}
            <span>{SUPABASE_NOT_CONNECTED_MESSAGE}</span>
          </div>
          {useDevOrderMock && (
            <p className="mt-2 text-primary">
              Development only: reading mock orders from this browser localStorage.
            </p>
          )}
        </div>
      )}

      <div className="bg-card border border-border p-4 mb-4 space-y-3">
        <Input
          placeholder="Search customer name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-11 bg-background rounded-none border-border"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTER_STATUSES.map(f => (
            <button
              type="button"
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`shrink-0 border px-3 py-1.5 text-xs uppercase tracking-widest font-bold transition-colors ${
                filter === f
                  ? 'bg-[#39FF14] border-[#39FF14] text-black shadow-[0_0_14px_rgba(57,255,20,0.25)]'
                  : 'bg-background border-border text-muted-foreground hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
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
                  <Fragment key={order.id}>
                    <tr
                      className="border-b border-border/40 hover:bg-background/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    >
                      <td className="py-3 px-4 text-muted-foreground">
                        {expandedId === order.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-display text-white text-base">{order.id}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
                        {cancellationPending(order) && (
                          <span className="mt-2 inline-flex border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-400">
                            Cancellation requested
                          </span>
                        )}
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
                            {ORDER_STATUSES.map(s => (
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

                              {cancellationPending(order) && (
                                <div className="mt-4 border border-red-500/40 bg-red-500/10 p-3">
                                  <p className="text-xs uppercase tracking-widest text-red-400 font-bold mb-2">Cancellation Request</p>
                                  <p className="text-sm text-white mb-3">{order.cancellationReason || "No reason provided."}</p>
                                  <textarea
                                    value={cancellationNoteDrafts[order.id] ?? ""}
                                    onChange={event => setCancellationNoteDrafts(prev => ({ ...prev, [order.id]: event.target.value }))}
                                    placeholder="Admin note for the customer..."
                                    className="mb-3 w-full min-h-16 bg-card border border-red-500/30 p-3 text-sm text-white outline-none focus:border-primary"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={updatingId === order.id}
                                      onClick={() => handleCancellationDecision(order, true)}
                                      className="px-3 py-2 bg-primary text-black text-xs uppercase tracking-widest font-bold disabled:opacity-50"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={updatingId === order.id}
                                      onClick={() => handleCancellationDecision(order, false)}
                                      className="px-3 py-2 border border-border text-white text-xs uppercase tracking-widest font-bold disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="mt-4">
                                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 font-bold">Admin Private Notes</p>
                                <textarea
                                  value={noteDrafts[order.id] ?? order.adminNotes ?? ""}
                                  onChange={event => setNoteDrafts(prev => ({ ...prev, [order.id]: event.target.value }))}
                                  placeholder="Customer confirmed by phone..."
                                  className="w-full min-h-20 bg-card border border-border p-3 text-sm text-white outline-none focus:border-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveNotes(order.id)}
                                  className="mt-2 px-3 py-2 bg-primary text-black text-xs uppercase tracking-widest font-bold"
                                >
                                  Save Notes
                                </button>
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
                                  <span className="text-white">{order.total - order.deliveryFee + (order.discountAmount ?? 0)} EGP</span>
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
                              <Link
                                href={`/admin/orders/${order.id}/print`}
                                className="mt-4 inline-flex items-center gap-2 border border-primary px-3 py-2 text-primary hover:bg-primary hover:text-black text-xs uppercase tracking-widest font-bold transition-colors"
                              >
                                <Printer size={13} /> Print Order
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

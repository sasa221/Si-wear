import { useAuth } from "@/context/AuthContext";
import type { Order, OrderStatus } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { Package, Loader2 } from "lucide-react";
import {
  SUPABASE_NOT_CONNECTED_MESSAGE,
  subscribeToTableChanges,
  supabaseConfigured,
  useDevOrderMock,
} from "@/lib/supabase";

function statusClass(status: string) {
  switch (status) {
    case "Delivered": return "bg-green-500/20 text-green-500";
    case "Cancelled": return "bg-red-500/20 text-red-500";
    case "Confirmed": return "bg-blue-500/20 text-blue-500";
    case "Preparing": return "bg-orange-500/20 text-orange-400";
    case "Out for Delivery": return "bg-purple-500/20 text-purple-400";
    default: return "bg-yellow-500/20 text-yellow-400";
  }
}

function cancellationPending(order: Order): boolean {
  return order.cancellationRequested === true || order.cancellationStatus === "Pending";
}

export default function MyOrdersPage() {
  const { user, getUserOrders } = useAuth();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      setOrders(await getUserOrders());
    } catch (err) {
      console.error("Failed to load customer orders:", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [getUserOrders, user]);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    loadOrders();
  }, [user, setLocation, loadOrders]);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    return subscribeToTableChanges<{ id: string; status: OrderStatus; total_egp: number; created_at: string }>(
      { table: "orders", filter: `user_id=eq.${user.id}`, channel: `customer-orders-${user.id}` },
      change => {
        if (change.eventType === "INSERT") {
          loadOrders();
          return;
        }

        if (change.eventType === "UPDATE") {
          loadOrders();
        }

        if (change.eventType === "DELETE") {
          setOrders(prev => prev.filter(order => order.id !== change.record.id));
        }
      }
    );
  }, [loadOrders, user]);

  if (!user) return null;

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 md:py-12">
      <h1 className="font-display font-black uppercase text-white mb-8"
        style={{ fontSize: "clamp(2rem, 7vw, 4.5rem)", lineHeight: 0.95 }}>
        MY ORDERS
      </h1>

      {!supabaseConfigured && (
        <div className="mb-6 border border-red-500/50 bg-red-500/10 p-4 text-xs uppercase tracking-widest text-red-400">
          <div className="flex flex-wrap items-center gap-2">
            {useDevOrderMock && (
              <span className="bg-primary text-black px-2 py-0.5 font-black">DEV MOCK</span>
            )}
            <span>{SUPABASE_NOT_CONNECTED_MESSAGE}</span>
          </div>
        </div>
      )}

      {loadError && (
        <div className="mb-6 border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="py-24 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="uppercase tracking-widest text-sm">Loading orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card border border-border py-20 px-6 text-center">
          <Package size={40} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-6 text-sm uppercase tracking-widest">No orders yet.</p>
          <Link href="/shop" className="inline-flex h-12 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors">
            START SHOPPING
          </Link>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {orders.map(order => (
              <div key={order.id} className="bg-card border border-border p-4">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-white text-lg leading-none">{order.id}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {new Date(order.createdAt).toLocaleDateString("en-GB")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${statusClass(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                {cancellationPending(order) && (
                  <div className="mb-3 inline-flex border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                    Cancellation pending
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <p className="font-bold text-white text-lg">{order.total} EGP</p>
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-xs text-primary border border-primary px-4 py-2 uppercase tracking-widest font-bold hover:bg-primary hover:text-black transition-colors"
                  >
                    VIEW
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-card border border-border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                  <th className="py-4 px-5 font-normal">Order ID</th>
                  <th className="py-4 px-5 font-normal">Date</th>
                  <th className="py-4 px-5 font-normal">Status</th>
                  <th className="py-4 px-5 font-normal text-right">Total</th>
                  <th className="py-4 px-5 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                    <td className="py-4 px-5 font-display text-white font-bold">{order.id}</td>
                    <td className="py-4 px-5 text-muted-foreground text-sm">{new Date(order.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="py-4 px-5">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`px-2 py-1 text-xs uppercase tracking-widest font-bold ${statusClass(order.status)}`}>
                          {order.status}
                        </span>
                        {cancellationPending(order) && (
                          <span className="border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                            Cancellation pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right text-white font-bold">{order.total} EGP</td>
                    <td className="py-4 px-5 text-right">
                      <Link href={`/orders/${order.id}`} className="text-xs text-primary hover:text-white uppercase tracking-widest border border-primary px-3 py-1.5 hover:bg-primary hover:text-black transition-colors">
                        VIEW
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

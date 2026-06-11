import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { Package } from "lucide-react";

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

export default function MyOrdersPage() {
  const { user, getUserOrders } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  if (!user) return null;

  const orders = getUserOrders();

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 md:py-12">
      <h1 className="font-display font-black uppercase text-white mb-8"
        style={{ fontSize: "clamp(2rem, 7vw, 4.5rem)", lineHeight: 0.95 }}>
        MY ORDERS
      </h1>

      {orders.length === 0 ? (
        <div className="bg-card border border-border py-20 px-6 text-center">
          <Package size={40} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-6 text-sm uppercase tracking-widest">No orders yet.</p>
          <Link href="/shop" className="inline-flex h-12 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors">
            START SHOPPING
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
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

          {/* Desktop table */}
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
                      <span className={`px-2 py-1 text-xs uppercase tracking-widest font-bold ${statusClass(order.status)}`}>
                        {order.status}
                      </span>
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

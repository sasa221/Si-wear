import { useAuth } from "@/context/AuthContext";
import type { Order } from "@/context/AuthContext";
import { useLocation, Link, useParams } from "wouter";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { dbGetOrderById } from "@/lib/orderService";

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

export default function OrderDetailPage() {
  const { user, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    if (!orderId) return;
    dbGetOrderById(orderId)
      .then(found => {
        // Non-admin customers can only see their own orders
        if (found && !isAdmin && found.userId !== user.id) {
          setOrder(null);
        } else {
          setOrder(found);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, orderId, isAdmin]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-24 flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="uppercase tracking-widest text-sm">Loading order...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-display uppercase text-white mb-4">ORDER NOT FOUND</h1>
        <Link href="/my-orders" className="text-primary hover:text-white uppercase tracking-widest text-sm">Return to My Orders</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 md:py-12">
      <Link href="/my-orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors uppercase tracking-widest text-xs mb-6">
        <ArrowLeft size={14} /> BACK TO ORDERS
      </Link>

      {/* Order header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-8 md:mb-12">
        <div>
          <h1 className="font-display font-black uppercase text-white"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)", lineHeight: 0.95 }}>
            ORDER {order.id}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">{new Date(order.createdAt).toLocaleString("en-GB")}</p>
        </div>
        <span className={`self-start sm:self-auto px-4 py-2 text-sm uppercase tracking-widest font-bold ${statusClass(order.status)}`}>
          {order.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="font-display text-base sm:text-xl uppercase tracking-wider text-white">ITEMS</h2>
            </div>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-4 flex gap-3 sm:gap-4 items-center">
                  <div className="w-14 sm:w-16 bg-card border border-border flex-shrink-0 flex items-center justify-center font-display text-muted-foreground text-xs uppercase" style={{ height: "72px" }}>
                    IMG
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display uppercase text-white text-sm sm:text-lg leading-tight line-clamp-2">{item.productName}</p>
                    <p className="text-muted-foreground text-xs mt-1">{item.selectedSize} / {item.selectedColor}</p>
                    <p className="text-white text-xs sm:text-sm mt-1 font-bold">{item.price} EGP × {item.quantity} = {item.price * item.quantity} EGP</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary + Customer */}
        <div className="space-y-6">
          <div className="bg-card border border-border p-4 sm:p-6">
            <h2 className="font-display text-base sm:text-xl uppercase tracking-wider text-white border-b border-border pb-4 mb-4">SUMMARY</h2>
            <div className="space-y-2.5 mb-5">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span className="text-white">{order.total - order.deliveryFee - (order.discountAmount ?? 0)} EGP</span>
              </div>
              {(order.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-primary font-bold">
                  <span>Discount ({order.discountCode})</span>
                  <span>- {order.discountAmount} EGP</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Delivery</span>
                <span className="text-white">{order.deliveryFee} EGP</span>
              </div>
            </div>
            <div className="border-t border-border pt-4 flex justify-between items-end">
              <span className="font-display uppercase tracking-widest text-base sm:text-lg text-white">Total</span>
              <span className="text-xl sm:text-2xl text-white font-bold">{order.total} EGP</span>
            </div>
          </div>

          <div className="bg-card border border-border p-4 sm:p-6">
            <h2 className="font-display text-base sm:text-xl uppercase tracking-wider text-white border-b border-border pb-4 mb-4">CUSTOMER INFO</h2>
            <div className="space-y-3">
              {[
                { label: "Name", value: order.customer.name },
                { label: "Phone", value: order.customer.phone },
                { label: "Address", value: `${order.customer.address}, ${order.customer.city}, ${order.customer.governorate}` },
                ...(order.customer.notes ? [{ label: "Notes", value: order.customer.notes }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
                  <p className="text-sm text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

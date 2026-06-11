import { useAuth } from "@/context/AuthContext";
import { useLocation, Link, useParams } from "wouter";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

export default function OrderDetailPage() {
  const { user, getUserOrders, getAllOrders, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const orderId = params.id;

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  if (!user) return null;

  const orders = isAdmin ? getAllOrders() : getUserOrders();
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-display uppercase text-white mb-4">ORDER NOT FOUND</h1>
        <Link href="/my-orders" className="text-primary hover:text-white uppercase tracking-widest text-sm">Return to My Orders</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Link href="/my-orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors uppercase tracking-widest text-xs mb-8">
        <ArrowLeft size={16} /> BACK TO ORDERS
      </Link>
      
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-6xl font-display font-black uppercase text-white mb-2">ORDER {order.id}</h1>
          <p className="text-muted-foreground text-sm">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div>
          <span className={`px-4 py-2 text-sm uppercase tracking-widest font-bold ${
            order.status === 'Delivered' ? 'bg-green-500/20 text-green-500' :
            order.status === 'Cancelled' ? 'bg-red-500/20 text-red-500' :
            order.status === 'Confirmed' ? 'bg-blue-500/20 text-blue-500' :
            order.status === 'Out for Delivery' ? 'bg-purple-500/20 text-purple-500' :
            'bg-yellow-500/20 text-yellow-500'
          }`}>
            {order.status}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="font-display text-xl uppercase tracking-wider text-white">ITEMS</h2>
            </div>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-4 flex gap-4 items-center bg-background">
                  <div className="w-16 h-20 bg-card border border-border flex-shrink-0 flex items-center justify-center font-display text-muted-foreground text-xs uppercase">
                    IMG
                  </div>
                  <div className="flex-1">
                    <p className="font-display uppercase text-white text-lg">{item.productName}</p>
                    <p className="text-muted-foreground text-xs">{item.selectedSize} / {item.selectedColor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{item.price} EGP × {item.quantity}</p>
                    <p className="font-bold text-white mt-1">{item.price * item.quantity} EGP</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="space-y-8">
          <div className="bg-card border border-border p-6">
            <h2 className="font-display text-xl uppercase tracking-wider text-white border-b border-border pb-4 mb-4">SUMMARY</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span className="text-white">{order.total - order.deliveryFee} EGP</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Delivery</span>
                <span className="text-white">{order.deliveryFee === 0 ? "FREE" : `${order.deliveryFee} EGP`}</span>
              </div>
            </div>
            <div className="border-t border-border pt-4 flex justify-between items-end">
              <span className="font-display uppercase tracking-widest text-lg text-white">Total</span>
              <span className="text-2xl text-white font-bold">{order.total} EGP</span>
            </div>
          </div>
          
          <div className="bg-card border border-border p-6">
            <h2 className="font-display text-xl uppercase tracking-wider text-white border-b border-border pb-4 mb-4">CUSTOMER INFO</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Name</p>
                <p className="text-sm text-white">{order.customer.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Phone</p>
                <p className="text-sm text-white">{order.customer.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Delivery Address</p>
                <p className="text-sm text-white">{order.customer.address}</p>
                <p className="text-sm text-white">{order.customer.city}, {order.customer.governorate}</p>
              </div>
              {order.customer.notes && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Notes</p>
                  <p className="text-sm text-white">{order.customer.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

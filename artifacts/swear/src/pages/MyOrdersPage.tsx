import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";

export default function MyOrdersPage() {
  const { user, getUserOrders } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  if (!user) return null;

  const orders = getUserOrders();

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-12">MY ORDERS</h1>
      
      <div className="bg-card p-6 border border-border">
        {orders.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground mb-6 text-lg">No orders yet.</p>
            <Link href="/shop" className="inline-flex h-14 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors">
              START SHOPPING
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest">
                  <th className="py-4 px-4 font-normal">Order ID</th>
                  <th className="py-4 px-4 font-normal">Date</th>
                  <th className="py-4 px-4 font-normal">Status</th>
                  <th className="py-4 px-4 font-normal text-right">Total</th>
                  <th className="py-4 px-4 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                    <td className="py-4 px-4 font-display text-white text-lg">{order.id}</td>
                    <td className="py-4 px-4 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="py-4 px-4">
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
                    <td className="py-4 px-4 text-right text-white font-bold">{order.total} EGP</td>
                    <td className="py-4 px-4 text-right">
                      <Link href={`/orders/${order.id}`} className="text-xs text-primary hover:text-white uppercase tracking-widest border border-primary px-3 py-1 hover:bg-primary hover:text-black transition-colors">
                        VIEW
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

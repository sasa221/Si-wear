import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Order } from "@/lib/types";
import { dbGetAdminOrderById } from "@/lib/orderService";

export default function AdminOrderPrintPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }
    dbGetAdminOrderById(orderId)
      .then(setOrder)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load order."));
  }, [isAdmin, orderId, setLocation]);

  const subtotal = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [order]);

  if (!isAdmin) return null;

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white text-black p-8">
        <Link href="/admin/orders" className="text-sm underline">Back to orders</Link>
        <p className="mt-8">{error || "Loading order..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 sm:p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm uppercase tracking-widest">
          <ArrowLeft size={14} /> Back
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 text-xs uppercase tracking-widest font-bold"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      <main className="mx-auto max-w-3xl border border-black p-6 print:border-0">
        <header className="flex items-start justify-between border-b border-black pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-widest">S! Wear</h1>
            <p className="text-sm">Packing / Delivery Sheet</p>
          </div>
          <div className="text-right">
            <p className="font-bold">Order #{order.id}</p>
            <p className="text-sm">{new Date(order.createdAt).toLocaleString("en-GB")}</p>
            <p className="text-sm">Status: {order.status}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <h2 className="font-bold uppercase border-b border-black mb-2 pb-1">Customer</h2>
            <p>{order.customer.name}</p>
            <p>{order.customer.phone}</p>
            <p>{order.customer.governorate}, {order.customer.city}</p>
            <p>{order.customer.address}</p>
            {order.customer.notes && <p>Notes: {order.customer.notes}</p>}
          </div>
          <div>
            <h2 className="font-bold uppercase border-b border-black mb-2 pb-1">Payment</h2>
            <p>Cash on Delivery</p>
            <p>Total to collect: <strong>{order.total} EGP</strong></p>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="font-bold uppercase border-b border-black mb-2 pb-1">Products</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="py-2">Product</th>
                <th className="py-2">Size</th>
                <th className="py-2">Color</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item.variantId}-${index}`} className="border-b border-black/20">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2">{item.selectedSize}</td>
                  <td className="py-2">{item.selectedColor}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{item.price * item.quantity} EGP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ml-auto max-w-xs text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{subtotal} EGP</span></div>
          {(order.discountAmount ?? 0) > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>- {order.discountAmount} EGP</span></div>
          )}
          <div className="flex justify-between"><span>Shipping</span><span>{order.deliveryFee} EGP</span></div>
          <div className="flex justify-between border-t border-black pt-2 text-lg font-bold"><span>Total</span><span>{order.total} EGP</span></div>
        </section>
      </main>
    </div>
  );
}

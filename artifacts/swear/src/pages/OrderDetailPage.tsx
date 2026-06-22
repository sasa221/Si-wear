import { useAuth } from "@/context/AuthContext";
import type { Order, OrderStatus } from "@/context/AuthContext";
import { useLocation, Link, useParams } from "wouter";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { dbCreateReturnRequest, dbGetOrderById, dbRequestOrderCancellation } from "@/lib/orderService";
import { getProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { getProductImage, useFallbackImage } from "@/lib/images";
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

const CANCELLABLE_STATUSES = new Set(["Pending", "Confirmed", "Preparing"]);

export default function OrderDetailPage() {
  const { user, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const orderId = params.id as string;
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnMessage, setReturnMessage] = useState("");
  const [returnAction, setReturnAction] = useState<"return" | "exchange">("exchange");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const productImages = useMemo(() => {
    return new Map(getProducts().map(product => [product.id, getProductImage(product.images)]));
  }, []);

  const loadOrder = useCallback(async (showLoading = true) => {
    if (!user || !orderId) return;
    if (showLoading) setLoading(true);
    setLoadError(null);
    try {
      const found = await dbGetOrderById(orderId);
      if (!found) {
        console.warn("Order detail not found:", { routeParam: orderId, supabaseError: null });
        setOrder(null);
      } else if (!isAdmin && found.userId !== user.id) {
        console.warn("Order route param does not belong to current user:", { routeParam: orderId, userId: user.id });
        setOrder(null);
      } else {
        setOrder(found);
      }
    } catch (err) {
      console.error("Order detail fetch failed:", { routeParam: orderId, error: err });
      setLoadError(err instanceof Error ? err.message : "Failed to load order.");
      setOrder(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user, orderId, isAdmin]);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    if (!orderId) return;
    loadOrder();
  }, [user, orderId, setLocation, loadOrder]);

  useEffect(() => {
    if (!user || !orderId || !supabaseConfigured) return;
    return subscribeToTableChanges<{ id: string; status: OrderStatus; total_egp: number }>(
      { table: "orders", filter: `id=eq.${orderId}`, channel: `order-detail-${orderId}` },
      change => {
        if (change.eventType === "UPDATE") {
          loadOrder(false);
        }
      }
    );
  }, [orderId, user, loadOrder]);

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
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          We could not find order ID {orderId}. Check that the link uses the order id from My Orders and that Supabase is connected.
        </p>
        {loadError && (
          <p className="text-red-400 text-sm mb-6">{loadError}</p>
        )}
        <Link href="/my-orders" className="text-primary hover:text-white uppercase tracking-widest text-sm">Return to My Orders</Link>
      </div>
    );
  }

  const canRequestCancellation =
    !isAdmin &&
    CANCELLABLE_STATUSES.has(order.status) &&
    order.cancellationStatus !== "Pending" &&
    order.cancellationStatus !== "Approved" &&
    order.cancellationStatus !== "Rejected";
  const canRequestReturn = !isAdmin && order.status === "Delivered";

  const handleCancellationRequest = async () => {
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      toast({ title: "Reason required", description: "Please add a short cancellation reason.", variant: "destructive" });
      return;
    }
    setSubmittingRequest(true);
    try {
      const persisted = await dbRequestOrderCancellation(order.id, user.id, reason);
      if (persisted.cancellationStatus !== "Pending" || !persisted.cancellationRequested) {
        throw new Error("Cancellation request was not confirmed by the server.");
      }
      const refreshed = await dbGetOrderById(order.id);
      if (!refreshed || refreshed.cancellationStatus !== "Pending" || !refreshed.cancellationRequested) {
        throw new Error("Cancellation request was saved but could not be confirmed on reload.");
      }
      setOrder(refreshed);
      setCancelReason("");
      toast({ title: "Cancellation requested", description: "Admin will review your request." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to request cancellation.", variant: "destructive" });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleReturnRequest = async () => {
    const reason = returnReason.trim();
    const message = returnMessage.trim();
    if (reason.length < 3 || message.length < 10) {
      toast({ title: "More details needed", description: "Add a reason and a short message.", variant: "destructive" });
      return;
    }
    setSubmittingRequest(true);
    try {
      await dbCreateReturnRequest({
        orderId: order.id,
        orderNumber: order.id,
        userId: user.id,
        reason,
        message,
        preferredAction: returnAction,
      });
      setReturnReason("");
      setReturnMessage("");
      toast({ title: "Request sent", description: "Admin will review your return/exchange request." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send request.", variant: "destructive" });
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-8 md:py-12">
      <Link href="/my-orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors uppercase tracking-widest text-xs mb-6">
        <ArrowLeft size={14} /> BACK TO ORDERS
      </Link>

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
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-background/50">
              <h2 className="font-display text-base sm:text-xl uppercase tracking-wider text-white">ITEMS</h2>
            </div>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={`${item.variantId}-${idx}`} className="p-4 flex gap-3 sm:gap-4 items-center">
                  <div className="w-14 sm:w-16 bg-card border border-border flex-shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-[10px] uppercase" style={{ height: "72px" }}>
                    <img
                      src={productImages.get(item.productId) || getProductImage(undefined)}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      width={64}
                      height={72}
                      onError={useFallbackImage}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display uppercase text-white text-sm sm:text-lg leading-tight line-clamp-2">{item.productName}</p>
                    <p className="text-muted-foreground text-xs mt-1">{item.selectedSize} / {item.selectedColor}</p>
                    <p className="text-white text-xs sm:text-sm mt-1 font-bold">{item.price} EGP x {item.quantity} = {item.price * item.quantity} EGP</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border p-4 sm:p-6">
            <h2 className="font-display text-base sm:text-xl uppercase tracking-wider text-white border-b border-border pb-4 mb-4">SUMMARY</h2>
            <div className="space-y-2.5 mb-5">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span className="text-white">{order.total - order.deliveryFee + (order.discountAmount ?? 0)} EGP</span>
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
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Payment</span>
                <span className="text-primary font-bold">Cash on Delivery</span>
              </div>
            </div>
            <div className="border-t border-border pt-4 flex justify-between items-end">
              <span className="font-display uppercase tracking-widest text-base sm:text-lg text-white">Total</span>
              <span className="text-xl sm:text-2xl text-white font-bold">{order.total} EGP</span>
            </div>
          </div>

          <div className="bg-card border border-border p-4 sm:p-6">
            <h2 className="font-display text-base sm:text-xl uppercase tracking-wider text-white border-b border-border pb-4 mb-4">DELIVERY INFO</h2>
            <div className="space-y-3">
              {[
                { label: "Name", value: order.customer.name },
                { label: "Phone", value: order.customer.phone },
                { label: "Governorate", value: order.customer.governorate },
                { label: "City / Area", value: order.customer.city },
                { label: "Address", value: order.customer.address },
                ...(order.customer.notes ? [{ label: "Notes", value: order.customer.notes }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
                  <p className="text-sm text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {!isAdmin && (
            <div className="bg-card border border-border p-4 sm:p-6">
              <h2 className="font-display text-base sm:text-xl uppercase tracking-wider text-white border-b border-border pb-4 mb-4">ORDER HELP</h2>

              {order.cancellationStatus === "Pending" && (
                <div className="border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs uppercase tracking-widest text-yellow-400 mb-4">
                  Cancellation request pending admin review.
                </div>
              )}
              {order.cancellationStatus === "Rejected" && (
                <div className="border border-red-500/40 bg-red-500/10 p-3 text-xs uppercase tracking-widest text-red-400 mb-4">
                  Cancellation request was rejected.
                </div>
              )}

              {canRequestCancellation && (
                <div className="space-y-3 mb-5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Request cancellation</p>
                  <textarea
                    value={cancelReason}
                    onChange={event => setCancelReason(event.target.value)}
                    placeholder="Why do you want to cancel this order?"
                    className="w-full min-h-20 bg-background border border-border p-3 text-sm text-white outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={submittingRequest}
                    onClick={handleCancellationRequest}
                    className="w-full h-10 border border-red-500/40 text-red-400 font-display font-bold uppercase tracking-widest text-xs hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Request Cancellation
                  </button>
                </div>
              )}

              {canRequestReturn && (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Return / Exchange Request</p>
                  <select
                    value={returnAction}
                    onChange={event => setReturnAction(event.target.value as "return" | "exchange")}
                    className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ fontSize: "16px" }}
                  >
                    <option value="exchange">Exchange</option>
                    <option value="return">Return</option>
                  </select>
                  <input
                    value={returnReason}
                    onChange={event => setReturnReason(event.target.value)}
                    placeholder="Reason"
                    className="w-full h-10 bg-background border border-border px-3 text-sm text-white outline-none focus:border-primary"
                    style={{ fontSize: "16px" }}
                  />
                  <textarea
                    value={returnMessage}
                    onChange={event => setReturnMessage(event.target.value)}
                    placeholder="Tell us what happened and what you need."
                    className="w-full min-h-24 bg-background border border-border p-3 text-sm text-white outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={submittingRequest}
                    onClick={handleReturnRequest}
                    className="w-full h-10 bg-primary text-black font-display font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors disabled:opacity-50"
                  >
                    Send Request
                  </button>
                </div>
              )}

              {!canRequestCancellation && !canRequestReturn && order.cancellationStatus !== "Pending" && order.cancellationStatus !== "Rejected" && (
                <p className="text-sm text-muted-foreground">
                  Cancellation is available for Pending, Confirmed, or Preparing orders. Return/exchange requests are available after delivery.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

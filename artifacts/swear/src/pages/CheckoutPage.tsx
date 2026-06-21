import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CART_ITEM_UPDATED_MESSAGE, useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import {
  validateDiscountCode,
  applyDiscountCode,
  calculateDiscount,
  DiscountCode,
} from "@/hooks/useDiscountCodes";
import { decrementCartStock, validateCartStock } from "@/hooks/useProducts";
import { SUPABASE_NOT_CONNECTED_MESSAGE, supabaseConfigured, useDevOrderMock } from "@/lib/supabase";
import {
  EGYPT_GOVERNORATES,
  MANUAL_SHIPPING_MESSAGE,
  getShippingFeeQuote,
  getShippingZones,
} from "@/lib/shippingService";
import { ACCOUNT_RESTRICTED_MESSAGE, dbGetCurrentUserAccountStatus } from "@/lib/userService";
import type { ShippingZone } from "@/lib/types";
import { getProductImage, useFallbackImage } from "@/lib/images";
import { CheckCircle, XCircle, Tag, Loader2 } from "lucide-react";

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^01[0125][0-9]{8}$/, "Must be a valid 11-digit Egyptian phone number starting with 01"),
  governorate: z.string().min(1, "Please select a governorate"),
  city: z.string().min(2, "City is required"),
  address: z.string().min(10, "Please provide a detailed address"),
  notes: z.string().optional()
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

function createOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const bytes = new Uint8Array(3);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  }
  const random = Array.from(bytes, byte => byte.toString(36).padStart(2, "0")).join("").toUpperCase();
  return `SW${timestamp}${random}`;
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { items, totalPrice, clearCart } = useCart();
  const { user, saveOrder } = useAuth();

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCode | null>(null);
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const discountAmount = appliedCoupon ? calculateDiscount(appliedCoupon, totalPrice) : 0;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      governorate: "Cairo",
      city: "",
      address: "",
      notes: ""
    }
  });

  const watchedGovernorate = form.watch("governorate");
  const watchedCity = form.watch("city");
  const subtotalAfterDiscount = Math.max(0, totalPrice - discountAmount);
  const shippingQuote = useMemo(
    () => getShippingFeeQuote(shippingZones, watchedGovernorate, watchedCity, subtotalAfterDiscount),
    [shippingZones, watchedGovernorate, watchedCity, subtotalAfterDiscount]
  );
  const hasShippingQuote = shippingQuote.matched && shippingQuote.fee !== null;
  const deliveryFee = shippingQuote.fee ?? 0;
  const finalTotal = subtotalAfterDiscount + deliveryFee;

  useEffect(() => {
    let cancelled = false;
    setShippingLoading(true);
    setShippingError(null);
    getShippingZones()
      .then(zones => {
        if (!cancelled) setShippingZones(zones);
      })
      .catch(err => {
        if (!cancelled) setShippingError(err instanceof Error ? err.message : "Failed to load shipping zones.");
      })
      .finally(() => {
        if (!cancelled) setShippingLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (user) {
      form.reset({ ...form.getValues(), name: user.name, phone: user.phone });
    }
  }, [user, form]);

  useEffect(() => {
    if (!user) setLocation("/login?redirect=/checkout");
  }, [user, setLocation]);

  if (!user) return null;
  if (items.length === 0) { setLocation("/cart"); return null; }
  const accountRestricted = user.blocked === true || user.isActive === false;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const result = await validateDiscountCode(couponInput, totalPrice);
      if (result.valid && result.discount) {
        setAppliedCoupon(result.discount);
        setCouponMessage({ text: result.message, ok: true });
      } else {
        setAppliedCoupon(null);
        setCouponMessage({ text: result.message, ok: false });
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMessage({
        text: err instanceof Error ? err.message : "Failed to validate code.",
        ok: false,
      });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMessage(null);
  };

  const onSubmit = async (data: CheckoutFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (!supabaseConfigured && !useDevOrderMock) {
        setSubmitError(SUPABASE_NOT_CONNECTED_MESSAGE);
        setIsSubmitting(false);
        return;
      }
      const accountStatus = await dbGetCurrentUserAccountStatus(user.id);
      if (accountRestricted || accountStatus?.blocked || accountStatus?.isActive === false) {
        setSubmitError(ACCOUNT_RESTRICTED_MESSAGE);
        setIsSubmitting(false);
        return;
      }
      if (shippingLoading) {
        setSubmitError("Delivery fee is still loading. Please wait a moment.");
        setIsSubmitting(false);
        return;
      }
      if (shippingError) {
        setSubmitError(shippingError);
        setIsSubmitting(false);
        return;
      }
      if (!hasShippingQuote) {
        setSubmitError(shippingQuote.message || MANUAL_SHIPPING_MESSAGE);
        setIsSubmitting(false);
        return;
      }
      const invalidCartItem = items.find(item => !item.variantId || item.variantIssue);
      if (invalidCartItem) {
        setSubmitError(CART_ITEM_UPDATED_MESSAGE);
        setIsSubmitting(false);
        return;
      }

      const orderId = createOrderId();
      const stockError = await validateCartStock(items);
      if (stockError) {
        setSubmitError(stockError);
        setIsSubmitting(false);
        return;
      }
      const order = {
        id: orderId,
        userId: user.id,
        items: items.map(i => ({
          productId: i.productId,
          variantId: i.variantId,
          productName: i.productName || i.product.name,
          price: i.price,
          selectedSize: i.selectedSize,
          selectedColor: i.selectedColor,
          quantity: i.quantity
        })),
        total: finalTotal,
        deliveryFee,
        ...(appliedCoupon ? { discountCode: appliedCoupon.code, discountAmount: discountAmount } : {}),
        status: "Pending" as const,
        customer: {
          name: data.name,
          phone: data.phone,
          governorate: data.governorate,
          city: data.city,
          address: data.address,
          notes: data.notes || undefined
        },
        createdAt: new Date().toISOString()
      };
      await saveOrder(order);
      if (useDevOrderMock) await decrementCartStock(items);
      if (appliedCoupon) await applyDiscountCode(appliedCoupon.id, totalPrice);
      clearCart();
      if (useDevOrderMock) {
        sessionStorage.setItem("swear_last_order_dev_mock", "true");
      } else {
        sessionStorage.removeItem("swear_last_order_dev_mock");
      }
      setLocation("/order-success");
    } catch (err) {
      console.error("Failed to place order:", err);
      setSubmitError(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-[1280px] mx-auto px-4 py-8 md:py-12"
    >
      <h1 className="font-display font-black uppercase text-white mb-8 md:mb-12"
        style={{ fontSize: "clamp(2rem, 8vw, 5rem)", lineHeight: 0.92 }}>
        CHECKOUT
      </h1>

      {!supabaseConfigured && (
        <div className="mb-6 border border-red-500/50 bg-red-500/10 p-4 text-xs uppercase tracking-widest text-red-400">
          <div className="flex flex-wrap items-center gap-2">
            {useDevOrderMock && (
              <span className="bg-primary text-black px-2 py-0.5 font-black">DEV MOCK</span>
            )}
            <span>{SUPABASE_NOT_CONNECTED_MESSAGE}</span>
          </div>
          {useDevOrderMock && (
            <p className="mt-2 text-primary">
              Development only: mock orders stay in this browser localStorage.
            </p>
          )}
        </div>
      )}

      {accountRestricted && (
        <div className="mb-6 border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {ACCOUNT_RESTRICTED_MESSAGE}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Form */}
        <div className="lg:col-span-7 xl:col-span-8 order-2 lg:order-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Shipping */}
              <div className="bg-card p-4 sm:p-6 border border-border">
                <h2 className="font-display text-lg sm:text-2xl uppercase tracking-wider text-white mb-5 border-b border-border pb-4">
                  SHIPPING DETAILS
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Full Name</FormLabel>
                      <FormControl><Input placeholder="John Doe" className="bg-background rounded-none" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Phone Number</FormLabel>
                      <FormControl><Input placeholder="01XXXXXXXXX" className="bg-background rounded-none" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="governorate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Governorate</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ fontSize: "16px" }}
                          {...field}
                        >
                          {EGYPT_GOVERNORATES.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">City / Area</FormLabel>
                      <FormControl><Input placeholder="Nasr City" className="bg-background rounded-none" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className={`mt-4 border px-4 py-3 text-xs uppercase tracking-widest ${
                  shippingError || (!shippingLoading && !hasShippingQuote)
                    ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                    : "border-primary/30 bg-primary/10 text-primary"
                }`}>
                  {shippingLoading ? (
                    "Loading delivery fee..."
                  ) : shippingError ? (
                    shippingError
                  ) : hasShippingQuote ? (
                    <>
                      Delivery: {deliveryFee === 0 ? "FREE" : `${deliveryFee} EGP`}
                      {shippingQuote.zone?.cityArea
                        ? ` for ${shippingQuote.zone.cityArea}, ${shippingQuote.zone.governorate}`
                        : ` for ${shippingQuote.zone?.governorate}`}
                    </>
                  ) : (
                    shippingQuote.message || MANUAL_SHIPPING_MESSAGE
                  )}
                </div>
                <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Full Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Street name, building number, floor, apartment" className="bg-background rounded-none min-h-[90px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Order Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any special delivery instructions?" className="bg-background rounded-none min-h-[70px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Payment */}
              <div className="bg-card p-4 sm:p-6 border border-border">
                <h2 className="font-display text-lg sm:text-2xl uppercase tracking-wider text-white mb-4">PAYMENT</h2>
                <div className="flex items-center gap-3 p-4 border border-border bg-background">
                  <div className="w-4 h-4 rounded-full bg-primary border-4 border-background ring-1 ring-border flex-shrink-0" />
                  <span className="uppercase tracking-widest text-white text-sm sm:text-base">Cash on Delivery</span>
                </div>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 p-4 border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
                  <XCircle size={16} className="flex-shrink-0" />
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || shippingLoading || !hasShippingQuote || accountRestricted || (!supabaseConfigured && !useDevOrderMock)}
                className="w-full h-14 bg-primary text-black font-display font-black uppercase tracking-widest text-lg hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    PLACING ORDER...
                  </>
                ) : (
                  "COMPLETE ORDER"
                )}
              </button>
            </form>
          </Form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5 xl:col-span-4 order-1 lg:order-2">
          <div className="bg-card p-4 sm:p-6 border border-border lg:sticky lg:top-24">
            <h2 className="font-display text-lg sm:text-2xl uppercase tracking-wider text-white mb-5 border-b border-border pb-4">
              ORDER SUMMARY
            </h2>

            {/* Items */}
            <div className="space-y-3 mb-5 max-h-[35vh] overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="w-14 h-18 sm:w-16 sm:h-20 bg-background border border-border flex-shrink-0 relative" style={{ height: "72px" }}>
                    <img
                      src={item.image || getProductImage(item.product.images)}
                      alt={item.productName || item.product.name}
                      className="w-full h-full object-cover opacity-80"
                      loading="lazy"
                      onError={useFallbackImage}
                    />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-black text-[9px] font-bold flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display uppercase text-white line-clamp-1 text-xs sm:text-sm">{item.productName || item.product.name}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{item.selectedSize} / {item.selectedColor}</p>
                    {(item.variantIssue || !item.variantId) && (
                      <p className="text-red-400 text-xs mt-0.5">{item.variantIssue || CART_ITEM_UPDATED_MESSAGE}</p>
                    )}
                    <p className="text-white mt-0.5 text-xs sm:text-sm">{item.price * item.quantity} EGP</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount code */}
            <div className="border border-border p-3 sm:p-4 mb-5 bg-background/40">
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2.5 font-bold">
                <Tag size={12} /> DISCOUNT CODE
              </p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary tracking-widest text-sm">{appliedCoupon.code}</span>
                  <button onClick={handleRemoveCoupon} className="text-xs text-muted-foreground hover:text-red-400 uppercase tracking-widest transition-colors">
                    REMOVE
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 h-9 bg-background border border-border px-3 text-white font-mono uppercase text-xs sm:text-sm outline-none focus:border-primary transition-colors"
                    placeholder="ENTER CODE"
                    value={couponInput}
                    onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponMessage(null); }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="h-9 px-3 sm:px-4 bg-primary text-black font-display font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors flex-shrink-0"
                  >
                    APPLY
                  </button>
                </div>
              )}
              {couponMessage && (
                <p className={`flex items-center gap-1.5 mt-2 text-xs font-bold uppercase tracking-widest ${couponMessage.ok ? "text-primary" : "text-red-400"}`}>
                  {couponMessage.ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
                  {couponMessage.text}
                </p>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 space-y-2.5 mb-5">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span className="text-white">{totalPrice} EGP</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-primary font-bold">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span>- {discountAmount} EGP</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Delivery</span>
                <span className="text-white">
                  {shippingLoading
                    ? "Loading..."
                    : hasShippingQuote
                      ? deliveryFee === 0 ? "FREE" : `${deliveryFee} EGP`
                      : "Support will confirm"}
                </span>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-end">
                <span className="font-display uppercase tracking-widest text-base sm:text-lg text-white">Total</span>
                <div className="text-right">
                  {discountAmount > 0 && hasShippingQuote && (
                    <p className="text-muted-foreground line-through text-xs">{totalPrice + deliveryFee} EGP</p>
                  )}
                  <span className="text-2xl sm:text-3xl text-white font-bold">
                    {hasShippingQuote ? `${finalTotal} EGP` : `${subtotalAfterDiscount} EGP + delivery`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

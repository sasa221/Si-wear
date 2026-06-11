import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import {
  validateDiscountCode,
  applyDiscountCode,
  calculateDiscount,
  DiscountCode,
} from "@/hooks/useDiscountCodes";
import { CheckCircle, XCircle, Tag } from "lucide-react";

const governorates = [
  "Cairo","Giza","Alexandria","Dakahlia","Red Sea","Beheira","Fayoum","Gharbia",
  "Ismailia","Menofia","Minya","Qalyubia","New Valley","Suez","Aswan","Assiut",
  "Beni Suef","Port Said","Damietta","Sharkia","South Sinai","Kafr El-Sheikh",
  "Matrouh","Luxor","Qena","North Sinai","Sohag"
];

const checkoutSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^01[0125][0-9]{8}$/, "Must be a valid 11-digit Egyptian phone number starting with 01"),
  governorate: z.string().min(1, "Please select a governorate"),
  city: z.string().min(2, "City is required"),
  address: z.string().min(10, "Please provide a detailed address"),
  notes: z.string().optional()
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

const DELIVERY_FEE = 60;

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { items, totalPrice, clearCart } = useCart();
  const { user, saveOrder } = useAuth();

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCode | null>(null);
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const discountAmount = appliedCoupon
    ? calculateDiscount(appliedCoupon, totalPrice)
    : 0;
  const finalTotal = totalPrice - discountAmount + DELIVERY_FEE;

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

  useEffect(() => {
    if (user) {
      form.reset({
        ...form.getValues(),
        name: user.name,
        phone: user.phone
      });
    }
  }, [user, form]);

  useEffect(() => {
    if (!user) {
      setLocation("/login?redirect=/checkout");
    }
  }, [user, setLocation]);

  if (!user) return null;

  if (items.length === 0) {
    setLocation("/cart");
    return null;
  }

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) return;
    const result = validateDiscountCode(couponInput);
    if (result.valid && result.discount) {
      setAppliedCoupon(result.discount);
      setCouponMessage({ text: result.message, ok: true });
    } else {
      setAppliedCoupon(null);
      setCouponMessage({ text: result.message, ok: false });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMessage(null);
  };

  const onSubmit = (data: CheckoutFormValues) => {
    const orderId = "SW" + Date.now().toString().slice(-6);

    const order = {
      id: orderId,
      userId: user.id,
      items: items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        price: i.product.price,
        selectedSize: i.selectedSize,
        selectedColor: i.selectedColor,
        quantity: i.quantity
      })),
      total: finalTotal,
      deliveryFee: DELIVERY_FEE,
      discountCode: appliedCoupon?.code ?? undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      status: "Pending" as const,
      customer: {
        name: data.name,
        phone: data.phone,
        governorate: data.governorate,
        city: data.city,
        address: data.address,
        notes: data.notes
      },
      createdAt: new Date().toISOString()
    };

    if (appliedCoupon) {
      applyDiscountCode(appliedCoupon.id);
    }

    saveOrder(order);
    clearCart();
    setLocation("/order-success");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-12"
    >
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-12">CHECKOUT</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="bg-card p-6 border border-border">
                <h2 className="font-display text-2xl uppercase tracking-wider text-white mb-6 border-b border-border pb-4">SHIPPING DETAILS</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                          {...field}
                        >
                          {governorates.map(gov => (
                            <option key={gov} value={gov}>{gov}</option>
                          ))}
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

                <div className="mt-6 space-y-6">
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Full Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Street name, building number, floor, apartment" className="bg-background rounded-none min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Order Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any special delivery instructions?" className="bg-background rounded-none min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="bg-card p-6 border border-border">
                <h2 className="font-display text-2xl uppercase tracking-wider text-white mb-4">PAYMENT</h2>
                <div className="flex items-center gap-3 p-4 border border-border bg-background">
                  <div className="w-4 h-4 rounded-full bg-primary border-4 border-background ring-1 ring-border"></div>
                  <span className="uppercase tracking-widest text-white">Cash on Delivery</span>
                </div>
              </div>

              <button type="submit" className="w-full h-16 bg-primary text-black font-display font-black uppercase tracking-widest text-xl hover:bg-white transition-colors">
                COMPLETE ORDER
              </button>
            </form>
          </Form>
        </div>

        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-card p-6 border border-border sticky top-24">
            <h2 className="font-display text-2xl uppercase tracking-wider text-white mb-6 border-b border-border pb-4">ORDER SUMMARY</h2>

            <div className="space-y-4 mb-6 max-h-[35vh] overflow-y-auto pr-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="w-16 h-20 bg-background border border-border flex-shrink-0 relative">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover opacity-80" />
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-black text-[10px] font-bold flex items-center justify-center z-10">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-display uppercase text-white line-clamp-2 text-sm">{item.product.name}</p>
                    <p className="text-muted-foreground text-xs mt-1">{item.selectedSize} / {item.selectedColor}</p>
                    <p className="text-white mt-1 text-sm">{item.product.price * item.quantity} EGP</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount Code */}
            <div className="border border-border p-4 mb-6 bg-background/40">
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3 font-bold">
                <Tag size={13} /> DISCOUNT CODE
              </p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary tracking-widest">{appliedCoupon.code}</span>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-xs text-muted-foreground hover:text-red-400 uppercase tracking-widest transition-colors"
                  >
                    REMOVE
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 h-10 bg-background border border-border px-3 text-white font-mono uppercase text-sm outline-none focus:border-primary transition-colors rounded-none"
                    placeholder="ENTER CODE"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponMessage(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="h-10 px-4 bg-primary text-black font-display font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors"
                  >
                    APPLY
                  </button>
                </div>
              )}
              {couponMessage && (
                <p className={`flex items-center gap-1.5 mt-2 text-xs font-bold uppercase tracking-widest ${couponMessage.ok ? "text-primary" : "text-red-400"}`}>
                  {couponMessage.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {couponMessage.text}
                </p>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 space-y-3 mb-6">
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
                <span className="text-white">{DELIVERY_FEE} EGP</span>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-end">
                <span className="font-display uppercase tracking-widest text-lg text-white">Total</span>
                <div className="text-right">
                  {discountAmount > 0 && (
                    <p className="text-muted-foreground line-through text-sm">{totalPrice + DELIVERY_FEE} EGP</p>
                  )}
                  <span className="text-3xl text-white font-bold">{finalTotal} EGP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

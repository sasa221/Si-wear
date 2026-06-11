import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCart } from "@/context/CartContext";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { items, totalPrice, clearCart } = useCart();
  
  const isFreeShipping = items.reduce((acc, item) => acc + item.quantity, 0) >= 2;
  const deliveryFee = isFreeShipping ? 0 : 60;
  const finalTotal = totalPrice + deliveryFee;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: "",
      phone: "",
      governorate: "Cairo",
      city: "",
      address: "",
      notes: ""
    }
  });

  if (items.length === 0) {
    setLocation("/cart");
    return null;
  }

  const onSubmit = (data: CheckoutFormValues) => {
    const itemsList = items.map(i => 
      `- ${i.product.name} | Size: ${i.selectedSize} | Color: ${i.selectedColor} | Qty: ${i.quantity} | ${i.product.price * i.quantity} EGP`
    ).join('\n');

    const message = `NEW ORDER - S! Wear\n\nCustomer Details:\nName: ${data.name}\nPhone: ${data.phone}\nGovernorate: ${data.governorate}\nCity: ${data.city}\nAddress: ${data.address}\n\nOrder Items:\n${itemsList}\n\nSubtotal: ${totalPrice} EGP\nDelivery: ${deliveryFee === 0 ? 'Free' : `${deliveryFee} EGP`}\nTotal: ${finalTotal} EGP\n\nNotes: ${data.notes || 'None'}\n\nPayment: Cash on Delivery`;

    window.open(`https://wa.me/201220172714?text=${encodeURIComponent(message)}`, "_blank");
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
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-widest">Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" className="bg-background rounded-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-widest">Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="01XXXXXXXXX" className="bg-background rounded-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="governorate"
                    render={({ field }) => (
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
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-widest">City / Area</FormLabel>
                        <FormControl>
                          <Input placeholder="Nasr City" className="bg-background rounded-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="mt-6 space-y-6">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-widest">Full Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Street name, building number, floor, apartment" className="bg-background rounded-none min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-widest">Order Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any special delivery instructions?" className="bg-background rounded-none min-h-[80px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
            
            <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="w-16 h-20 bg-background border border-border flex-shrink-0 relative">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover opacity-80" />
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-black text-[10px] font-bold flex items-center justify-center rounded-none z-10">
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
            
            <div className="border-t border-border pt-4 space-y-4 mb-6">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span className="text-white">{totalPrice} EGP</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Delivery</span>
                <span className="text-white">{deliveryFee === 0 ? "FREE" : `${deliveryFee} EGP`}</span>
              </div>
            </div>
            
            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-end">
                <span className="font-display uppercase tracking-widest text-lg text-white">Total</span>
                <span className="text-3xl text-white font-bold">{finalTotal} EGP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

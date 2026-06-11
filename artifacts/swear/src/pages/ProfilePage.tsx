import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().regex(/^01[0-9]{9}$/, "Must be exactly 11 digits starting with 01"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, logout, updateProfile, getUserOrders } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || "", phone: user?.phone || "" },
  });

  if (!user) return null;

  const orders = getUserOrders().slice(0, 3);

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile(data);
    setIsEditing(false);
    toast({ title: "Success", description: "Profile updated successfully" });
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-12">MY PROFILE</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-card p-6 border border-border">
            <h2 className="font-display text-2xl uppercase tracking-wider text-white mb-6 border-b border-border pb-4">INFO</h2>
            {!isEditing ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Name</p>
                  <p className="text-lg text-white">{user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Email</p>
                  <p className="text-lg text-white">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Phone</p>
                  <p className="text-lg text-white">{user.phone}</p>
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="mt-4 w-full h-10 border border-primary text-primary font-display font-bold uppercase tracking-widest hover:bg-primary hover:text-black transition-colors"
                >
                  EDIT PROFILE
                </button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Name</FormLabel>
                      <FormControl><Input className="bg-background rounded-none" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Phone</FormLabel>
                      <FormControl><Input className="bg-background rounded-none" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 h-10 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors">SAVE</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="flex-1 h-10 border border-border text-white font-display font-bold uppercase tracking-widest hover:bg-white/5 transition-colors">CANCEL</button>
                  </div>
                </form>
              </Form>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full h-12 border border-destructive text-destructive font-display font-bold uppercase tracking-widest hover:bg-destructive hover:text-black transition-colors"
          >
            LOGOUT
          </button>
        </div>
        
        <div className="lg:col-span-2">
          <div className="bg-card p-6 border border-border">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
              <h2 className="font-display text-2xl uppercase tracking-wider text-white">RECENT ORDERS</h2>
              <Link href="/my-orders" className="text-sm text-primary hover:text-white transition-colors uppercase tracking-widest">View All</Link>
            </div>
            
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No orders yet.</p>
                <Link href="/shop" className="text-primary hover:text-white uppercase tracking-widest text-sm border-b border-primary">Start Shopping</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="border border-border p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-background">
                    <div>
                      <p className="font-display text-lg text-white">{order.id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className={`px-2 py-1 text-xs uppercase tracking-widest font-bold ${
                        order.status === 'Delivered' ? 'bg-green-500/20 text-green-500' :
                        order.status === 'Cancelled' ? 'bg-red-500/20 text-red-500' :
                        order.status === 'Confirmed' ? 'bg-blue-500/20 text-blue-500' :
                        order.status === 'Out for Delivery' ? 'bg-purple-500/20 text-purple-500' :
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">{order.total} EGP</p>
                      <Link href={`/orders/${order.id}`} className="text-xs text-primary hover:text-white uppercase tracking-widest mt-1 inline-block">View Details</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

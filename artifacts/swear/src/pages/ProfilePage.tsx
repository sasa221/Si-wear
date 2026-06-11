import { useAuth } from "@/context/AuthContext";
import type { Order, Notification } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Package, User, LogOut, Loader2 } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().regex(/^01[0-9]{9}$/, "Must be exactly 11 digits starting with 01"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type Tab = 'info' | 'orders' | 'notifications';

function statusClass(status: string) {
  switch (status) {
    case 'Delivered': return 'bg-green-500/20 text-green-500';
    case 'Cancelled': return 'bg-red-500/20 text-red-500';
    case 'Confirmed': return 'bg-blue-500/20 text-blue-500';
    case 'Preparing': return 'bg-orange-500/20 text-orange-400';
    case 'Out for Delivery': return 'bg-purple-500/20 text-purple-400';
    default: return 'bg-yellow-500/20 text-yellow-400';
  }
}

export default function ProfilePage() {
  const {
    user, logout, updateProfile, getUserOrders,
    getNotifications, markNotificationRead, markAllNotificationsRead
  } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    try { setOrders(await getUserOrders()); }
    catch { /* silent */ }
    finally { setOrdersLoading(false); }
  }, [user, getUserOrders]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setNotifsLoading(true);
    try { setNotifications(await getNotifications()); }
    catch { /* silent */ }
    finally { setNotifsLoading(false); }
  }, [user, getNotifications]);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
  }, [activeTab, loadOrders]);

  useEffect(() => {
    if (activeTab === 'notifications') loadNotifications();
  }, [activeTab, loadNotifications]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || "", phone: user?.phone || "" },
  });

  if (!user) return null;

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile(data);
    setIsEditing(false);
    toast({ title: "Profile updated" });
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-12">
      <h1 className="font-display font-black uppercase text-white mb-10" style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}>
        MY ACCOUNT
      </h1>

      {/* Tab nav */}
      <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
        {([
          { key: 'info', label: 'Profile', icon: <User size={14} /> },
          { key: 'orders', label: 'My Orders', icon: <Package size={14} /> },
          { key: 'notifications', label: `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: <Bell size={14} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 font-display uppercase tracking-widest text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.key === 'notifications' && unreadCount > 0 && (
              <span className="ml-1 w-5 h-5 bg-primary text-black text-[10px] font-black rounded-none flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="ml-auto flex items-center gap-2 px-5 py-3 font-display uppercase tracking-widest text-sm text-muted-foreground hover:text-red-400 transition-colors whitespace-nowrap border-b-2 border-transparent -mb-px"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'info' && (
        <div className="max-w-md">
          <div className="bg-card p-6 border border-border">
            <h2 className="font-display text-xl uppercase tracking-wider text-white mb-6 border-b border-border pb-4">PERSONAL INFO</h2>
            {!isEditing ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Name</p>
                  <p className="text-white">{user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Email</p>
                  <p className="text-white">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Phone</p>
                  <p className="text-white">{user.phone}</p>
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
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          {ordersLoading ? (
            <div className="py-20 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              <span className="uppercase tracking-widest text-sm">Loading orders...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 border border-border bg-card">
              <Package size={40} className="text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
              <Link href="/shop" className="text-primary hover:text-white uppercase tracking-widest text-sm border-b border-primary transition-colors">
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="border border-border p-5 bg-card flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <p className="font-display text-lg text-white">{order.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-xs uppercase tracking-widest font-bold ${statusClass(order.status)}`}>
                      {order.status}
                    </span>
                    <div className="text-right">
                      <p className="font-bold text-white">{order.total} EGP</p>
                      <Link href={`/orders/${order.id}`} className="text-xs text-primary hover:text-white uppercase tracking-widest mt-1 inline-block transition-colors">
                        View Details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs uppercase tracking-widest text-primary hover:text-white transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifsLoading ? (
            <div className="py-20 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              <span className="uppercase tracking-widest text-sm">Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 border border-border bg-card">
              <BellOff size={40} className="text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications yet.</p>
              <p className="text-xs text-muted-foreground mt-2">Order status updates will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`border p-4 flex items-start gap-4 transition-colors cursor-pointer ${
                    notif.read
                      ? 'border-border bg-card/50 opacity-70'
                      : 'border-primary/30 bg-primary/5'
                  }`}
                  onClick={() => !notif.read && handleMarkRead(notif.id)}
                >
                  <div className={`flex-shrink-0 w-2 h-2 mt-2 ${notif.read ? 'bg-muted-foreground' : 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notif.createdAt).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {!notif.read && (
                    <span className="flex-shrink-0 text-[10px] uppercase tracking-widest text-primary font-bold">NEW</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useAuth } from "@/context/AuthContext";
import type { Order, Notification } from "@/context/AuthContext";
import { useLocation, Link, useSearch } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, MessageSquare, Package, User, LogOut, Loader2, Send, X } from "lucide-react";
import { rowToNotification } from "@/lib/orderService";
import {
  dbGetCustomerContactMessageById,
  dbGetUserContactMessages,
  dbReplyToCustomerContactMessage,
  rowToContactMessage,
} from "@/lib/contactService";
import { subscribeToTableChanges, supabaseConfigured } from "@/lib/supabase";
import type { ContactMessage, ContactMessageStatus } from "@/lib/types";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().regex(/^01[0-9]{9}$/, "Must be exactly 11 digits starting with 01"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type Tab = 'info' | 'orders' | 'messages' | 'notifications';

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

function messageStatusClass(status: ContactMessageStatus) {
  switch (status) {
    case 'admin_replied':
    case 'replied':
      return 'bg-primary/10 text-primary';
    case 'customer_replied':
    case 'pending_admin':
      return 'bg-orange-500/10 text-orange-400';
    case 'closed':
      return 'bg-zinc-500/10 text-zinc-300';
    default:
      return 'bg-yellow-500/10 text-yellow-400';
  }
}

function messageStatusLabel(status: ContactMessageStatus) {
  switch (status) {
    case 'admin_replied':
    case 'replied':
      return 'ADMIN REPLIED';
    case 'customer_replied':
    case 'pending_admin':
      return 'PENDING ADMIN';
    case 'closed':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
}

export default function ProfilePage() {
  const {
    user, logout, updateProfile, getUserOrders,
    getNotifications, markNotificationRead, markAllNotificationsRead
  } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = new URLSearchParams(search).get('tab');
    return tab === 'orders' || tab === 'messages' || tab === 'notifications' ? tab : 'info';
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [messageReply, setMessageReply] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  useEffect(() => {
    const tab = new URLSearchParams(search).get('tab');
    if (tab === 'orders' || tab === 'messages' || tab === 'notifications' || tab === 'info') {
      setActiveTab(tab);
    }
  }, [search]);

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

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setMessagesLoading(true);
    try { setMessages(await dbGetUserContactMessages(user.id)); }
    catch { /* silent */ }
    finally { setMessagesLoading(false); }
  }, [user]);

  const openMessageThread = useCallback(async (messageId: string) => {
    setThreadLoading(true);
    try {
      const found = await dbGetCustomerContactMessageById(messageId);
      setSelectedMessage(found);
      setMessageReply("");
    } catch (err) {
      toast({
        title: "Message not loaded",
        description: err instanceof Error ? err.message : "Failed to load message thread.",
        variant: "destructive",
      });
    } finally {
      setThreadLoading(false);
    }
  }, [toast]);

  const updateMessageInList = useCallback((updated: ContactMessage) => {
    setMessages(prev => prev.map(item => item.id === updated.id ? updated : item));
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
  }, [activeTab, loadOrders]);

  useEffect(() => {
    if (activeTab === 'notifications') loadNotifications();
  }, [activeTab, loadNotifications]);

  useEffect(() => {
    if (activeTab === 'messages') loadMessages();
  }, [activeTab, loadMessages]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, loadNotifications]);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    return subscribeToTableChanges<{ id: string; status: Order['status']; total_egp: number }>(
      { table: 'orders', filter: `user_id=eq.${user.id}`, channel: `profile-orders-${user.id}` },
      change => {
        if (change.eventType === 'UPDATE') {
          setOrders(prev => prev.map(order =>
            order.id === change.record.id
              ? { ...order, status: change.record.status, total: change.record.total_egp ?? order.total }
              : order
          ));
        }
        if (change.eventType === 'INSERT' && activeTab === 'orders') loadOrders();
      }
    );
  }, [activeTab, loadOrders, user]);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    return subscribeToTableChanges<Record<string, any>>(
      { table: 'notifications', filter: `customer_id=eq.${user.id}`, channel: `profile-notifications-${user.id}` },
      change => {
        const notification = rowToNotification(change.record);
        if (change.eventType === 'INSERT') {
          setNotifications(prev => prev.some(item => item.id === notification.id) ? prev : [notification, ...prev]);
        }
        if (change.eventType === 'UPDATE') {
          setNotifications(prev => prev.map(item => item.id === notification.id ? notification : item));
        }
      }
    );
  }, [user]);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    return subscribeToTableChanges<Record<string, any>>(
      { table: 'contact_messages', filter: `customer_id=eq.${user.id}`, channel: `profile-contact-messages-${user.id}` },
      change => {
        const next = rowToContactMessage(change.record);
        if (change.eventType === 'INSERT') {
          setMessages(prev => prev.some(item => item.id === next.id) ? prev : [next, ...prev]);
        }
        if (change.eventType === 'UPDATE') {
          setMessages(prev => prev.map(item => item.id === next.id ? {
            ...item,
            ...next,
            replies: next.replies?.length ? next.replies : item.replies,
            latestReply: next.latestReply ?? item.latestReply,
            replyCount: next.replyCount || item.replyCount,
          } : item));
          setSelectedMessage(prev => prev?.id === next.id ? {
            ...prev,
            ...next,
            replies: next.replies?.length ? next.replies : prev.replies,
            latestReply: next.latestReply ?? prev.latestReply,
            replyCount: next.replyCount || prev.replyCount,
          } : prev);
        }
      }
    );
  }, [user]);

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

  const handleSendMessageReply = async () => {
    if (!selectedMessage) return;
    const cleanReply = messageReply.trim();
    if (cleanReply.length < 3) {
      toast({ title: "Reply required", description: "Write a reply before sending.", variant: "destructive" });
      return;
    }

    setReplySaving(true);
    try {
      const updated = await dbReplyToCustomerContactMessage(selectedMessage.id, cleanReply);
      if (updated) {
        setSelectedMessage(updated);
        updateMessageInList(updated);
      }
      setMessageReply("");
      toast({ title: "Reply sent" });
    } catch (err) {
      toast({
        title: "Reply not sent",
        description: err instanceof Error ? err.message : "Failed to send reply.",
        variant: "destructive",
      });
    } finally {
      setReplySaving(false);
    }
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
          { key: 'messages', label: 'Messages', icon: <MessageSquare size={14} /> },
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

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div>
          {messagesLoading ? (
            <div className="py-20 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              <span className="uppercase tracking-widest text-sm">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 border border-border bg-card">
              <MessageSquare size={40} className="text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">You have not sent any messages yet.</p>
              <button
                onClick={() => setLocation("/contact")}
                className="text-primary hover:text-white uppercase tracking-widest text-sm border-b border-primary transition-colors"
              >
                Contact Support
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)] gap-5">
              <div className="space-y-3">
                {messages.map(message => {
                  const latest = message.latestReply;
                  return (
                    <div key={message.id} className="border border-border p-5 bg-card">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <p className="font-display text-lg text-white uppercase">{message.subject}</p>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(message.createdAt).toLocaleDateString('en-GB')}</p>
                          {message.orderId && (
                            <p className="text-xs text-primary mt-1">Order: {message.orderId}</p>
                          )}
                        </div>
                        <span className={`self-start px-3 py-1 text-xs uppercase tracking-widest font-bold ${messageStatusClass(message.status)}`}>
                          {messageStatusLabel(message.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap line-clamp-3">{message.message}</p>
                      {latest && (
                        <div className="mt-4 border border-border bg-background/50 p-3">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                            Latest {latest.senderRole === "admin" ? "admin" : "your"} reply
                          </p>
                          <p className="text-sm text-white line-clamp-2">{latest.message}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => openMessageThread(message.id)}
                        className="mt-4 inline-flex items-center gap-2 border border-primary px-4 py-2 text-xs uppercase tracking-widest font-bold text-primary hover:bg-primary hover:text-black transition-colors"
                      >
                        <MessageSquare size={13} />
                        Open Thread
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="border border-border bg-card min-h-[420px]">
                {threadLoading ? (
                  <div className="h-full min-h-[420px] flex items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="uppercase tracking-widest text-sm">Loading thread...</span>
                  </div>
                ) : !selectedMessage ? (
                  <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <MessageSquare size={34} className="mb-3 opacity-50" />
                    <p className="uppercase tracking-widest text-sm">Select a message thread.</p>
                  </div>
                ) : (
                  <div className="flex flex-col min-h-[420px]">
                    <div className="flex items-start justify-between gap-3 border-b border-border p-5">
                      <div>
                        <p className="font-display text-xl uppercase text-white">{selectedMessage.subject}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(selectedMessage.createdAt).toLocaleString('en-GB')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMessage(null)}
                        className="text-muted-foreground hover:text-white transition-colors"
                        aria-label="Close thread"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex-1 p-5 space-y-4">
                      <div className="max-w-[86%] border border-border bg-background p-4">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">You</p>
                        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-3">
                          {new Date(selectedMessage.createdAt).toLocaleString('en-GB')}
                        </p>
                      </div>

                      {(selectedMessage.replies ?? []).map(reply => (
                        <div
                          key={reply.id}
                          className={`max-w-[86%] border p-4 ${
                            reply.senderRole === "admin"
                              ? "ml-auto border-primary/40 bg-primary/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <p className={`text-[10px] uppercase tracking-widest mb-2 ${
                            reply.senderRole === "admin" ? "text-primary" : "text-muted-foreground"
                          }`}>
                            {reply.senderRole === "admin" ? "S! Wear" : "You"}
                          </p>
                          <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-3">
                            {new Date(reply.createdAt).toLocaleString('en-GB')}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border p-5">
                      {selectedMessage.status === "closed" ? (
                        <div className="border border-zinc-500/30 bg-zinc-500/10 px-4 py-3 text-sm text-zinc-300">
                          This conversation is closed.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            value={messageReply}
                            onChange={event => setMessageReply(event.target.value)}
                            placeholder="Write your reply..."
                            className="w-full min-h-28 bg-background border border-border p-4 text-white outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={handleSendMessageReply}
                            disabled={replySaving}
                            className="inline-flex items-center gap-2 h-11 px-5 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                          >
                            {replySaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Send Reply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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

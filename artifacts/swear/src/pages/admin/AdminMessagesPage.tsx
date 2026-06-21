import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { dbGetAllContactMessages, rowToContactMessage } from "@/lib/contactService";
import { subscribeToTableChanges, supabaseConfigured } from "@/lib/supabase";
import type { ContactMessage, ContactMessageStatus } from "@/lib/types";

function statusClass(status: ContactMessageStatus): string {
  switch (status) {
    case "admin_replied":
    case "replied": return "border-primary/40 bg-primary/10 text-primary";
    case "customer_replied":
    case "pending_admin": return "border-orange-500/40 bg-orange-500/10 text-orange-400";
    case "closed": return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
    default: return "border-yellow-500/40 bg-yellow-500/10 text-yellow-400";
  }
}

function statusLabel(status: ContactMessageStatus): string {
  switch (status) {
    case "admin_replied":
    case "replied": return "ADMIN REPLIED";
    case "customer_replied":
    case "pending_admin": return "PENDING ADMIN";
    case "closed": return "CLOSED";
    default: return "OPEN";
  }
}

function needsAttention(status: ContactMessageStatus): boolean {
  return status === "open" || status === "customer_replied" || status === "pending_admin";
}

function sortMessages(messages: ContactMessage[]): ContactMessage[] {
  return [...messages].sort((a, b) =>
    new Date(b.lastReplyAt || b.createdAt).getTime() -
    new Date(a.lastReplyAt || a.createdAt).getTime()
  );
}

export default function AdminMessagesPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  const loadMessages = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setLoadError(null);
    try {
      setMessages(sortMessages(await dbGetAllContactMessages()));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load messages.";
      setLoadError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) return;
    loadMessages();
  }, [isAdmin, loadMessages]);

  useEffect(() => {
    if (!isAdmin || !supabaseConfigured) return;
    return subscribeToTableChanges<Record<string, any>>(
      { table: "contact_messages", channel: "admin-contact-messages" },
      change => {
        const message = rowToContactMessage(change.record);
        if (change.eventType === "INSERT") {
          setMessages(prev => prev.some(item => item.id === message.id) ? prev : sortMessages([message, ...prev]));
        }
        if (change.eventType === "UPDATE") {
          setMessages(prev => sortMessages(prev.map(item => item.id === message.id ? {
            ...item,
            ...message,
            replies: message.replies?.length ? message.replies : item.replies,
            latestReply: message.latestReply ?? item.latestReply,
            replyCount: message.replyCount || item.replyCount,
          } : item)));
        }
        if (change.eventType === "DELETE") {
          setMessages(prev => prev.filter(item => item.id !== message.id));
        }
      }
    );
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">MESSAGES</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
            Customer contact messages and support replies.
          </p>
        </div>
        <button
          onClick={() => loadMessages(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-white transition-colors text-xs uppercase tracking-widest"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="py-24 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            <span className="uppercase tracking-widest text-sm">Loading messages...</span>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-red-400 uppercase tracking-widest text-sm px-4">
            {loadError}
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <MessageSquare size={34} className="mx-auto mb-3 opacity-40" />
            <p className="uppercase tracking-widest text-sm">No customer messages yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                  <th className="py-3 px-4 font-normal">Message ID</th>
                  <th className="py-3 px-4 font-normal">Customer</th>
                  <th className="py-3 px-4 font-normal">Phone</th>
                  <th className="py-3 px-4 font-normal">Email</th>
                  <th className="py-3 px-4 font-normal">Subject</th>
                  <th className="py-3 px-4 font-normal">Latest</th>
                  <th className="py-3 px-4 font-normal">Order</th>
                  <th className="py-3 px-4 font-normal">Status</th>
                  <th className="py-3 px-4 font-normal">Activity</th>
                  <th className="py-3 px-4 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {messages.map(message => {
                  const latest = message.latestReply;
                  const latestText = latest ? latest.message : message.message;
                  const latestBy = latest ? (latest.senderRole === "admin" ? "Admin" : "Customer") : "Customer";
                  return (
                    <tr key={message.id} className="border-b border-border/50 hover:bg-background/30 transition-colors align-top">
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{message.id.slice(0, 8)}</td>
                      <td className="py-3 px-4 text-white text-sm">{message.customerName || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">{message.customerPhone || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">{message.customerEmail || "-"}</td>
                      <td className="py-3 px-4 text-white text-sm font-bold">
                        <div className="flex items-center gap-2">
                          {needsAttention(message.status) && (
                            <span className="h-2 w-2 bg-orange-400" aria-label="Needs attention" />
                          )}
                          <span>{message.subject}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm max-w-xs">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{latestBy}</p>
                        <span className="line-clamp-2">{latestText}</span>
                      </td>
                      <td className="py-3 px-4 text-primary text-xs font-bold">{message.orderId || "-"}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${statusClass(message.status)}`}>
                          {statusLabel(message.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(message.lastReplyAt || message.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/messages/${message.id}`}
                          className="inline-flex items-center gap-1.5 border border-primary px-3 py-1.5 text-primary hover:bg-primary hover:text-black transition-colors text-xs uppercase tracking-widest font-bold"
                        >
                          <Eye size={12} /> View / Reply
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

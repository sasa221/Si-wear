import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Loader2, Lock, RotateCcw, Send } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  dbCloseContactMessage,
  dbGetContactMessageById,
  dbReopenContactMessage,
  dbReplyToContactMessage,
} from "@/lib/contactService";
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

export default function AdminMessageDetailPage() {
  const { isAdmin, user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const messageId = params.id as string;
  const { toast } = useToast();
  const [message, setMessage] = useState<ContactMessage | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }
    setLoadError(null);
    dbGetContactMessageById(messageId)
      .then(found => {
        setMessage(found);
        setReply("");
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : "Failed to load message.";
        setLoadError(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [isAdmin, messageId, setLocation, toast]);

  if (!isAdmin) return null;

  const handleReply = async () => {
    if (!message) return;
    if (message.status === "closed") {
      toast({ title: "Conversation closed", description: "Reopen this conversation before replying.", variant: "destructive" });
      return;
    }
    const cleanReply = reply.trim();
    if (cleanReply.length < 3) {
      toast({ title: "Reply required", description: "Write a reply before sending.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updated = await dbReplyToContactMessage(message.id, cleanReply, user?.email || "admin");
      if (updated) setMessage(updated);
      setReply("");
      toast({ title: "Reply sent", description: "Customer notification created." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send reply.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!message) return;
    setSaving(true);
    try {
      const updated = await dbCloseContactMessage(message.id);
      if (updated) setMessage(updated);
      toast({ title: "Conversation closed" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to close conversation.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!message) return;
    setSaving(true);
    try {
      const updated = await dbReopenContactMessage(message.id);
      if (updated) setMessage(updated);
      toast({ title: "Conversation reopened" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reopen conversation.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <Link href="/admin/messages" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors uppercase tracking-widest text-xs mb-8">
        <ArrowLeft size={16} /> BACK TO MESSAGES
      </Link>

      {loading ? (
        <div className="py-24 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="uppercase tracking-widest text-sm">Loading message...</span>
        </div>
      ) : loadError ? (
        <div className="bg-card border border-red-500/40 p-8 text-center text-red-400">
          {loadError}
        </div>
      ) : !message ? (
        <div className="bg-card border border-border p-8 text-center text-muted-foreground">
          Message not found.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border pb-4 mb-5">
              <div>
                <h1 className="font-display text-2xl sm:text-4xl uppercase text-white">{message.subject}</h1>
                <p className="text-xs text-muted-foreground mt-2 uppercase tracking-widest">
                  {new Date(message.createdAt).toLocaleString("en-GB")}
                </p>
              </div>
              <span className={`self-start inline-flex border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${statusClass(message.status)}`}>
                {statusLabel(message.status)}
              </span>
            </div>

            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Conversation Thread</p>
              <div className="space-y-4">
                <div className="max-w-[88%] bg-background border border-border p-4 text-white leading-relaxed">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Customer</p>
                  <p className="whitespace-pre-wrap">{message.message}</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {new Date(message.createdAt).toLocaleString("en-GB")}
                  </p>
                </div>

                {(message.replies ?? []).map(replyItem => (
                  <div
                    key={replyItem.id}
                    className={`max-w-[88%] border p-4 text-white leading-relaxed ${
                      replyItem.senderRole === "admin"
                        ? "ml-auto bg-primary/10 border-primary/30"
                        : "bg-background border-border"
                    }`}
                  >
                    <p className={`text-[10px] uppercase tracking-widest mb-2 ${
                      replyItem.senderRole === "admin" ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {replyItem.senderRole === "admin" ? "Admin" : "Customer"}
                    </p>
                    <p className="whitespace-pre-wrap">{replyItem.message}</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      {new Date(replyItem.createdAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {message.status === "closed" ? (
              <div className="border border-zinc-500/30 bg-zinc-500/10 p-4 text-sm text-zinc-300">
                This conversation is closed.
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Write Reply</p>
                <textarea
                  value={reply}
                  onChange={event => setReply(event.target.value)}
                  placeholder="Write a clear support reply..."
                  className="w-full min-h-40 bg-background border border-border p-4 text-white outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={saving}
                  className="mt-3 inline-flex items-center gap-2 h-11 px-5 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Reply
                </button>
              </div>
            )}
          </div>

          <aside className="bg-card border border-border p-5 sm:p-6 h-fit">
            <h2 className="font-display text-xl uppercase tracking-widest text-white border-b border-border pb-3 mb-4">Customer Info</h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Name</p>
                <p className="text-white">{message.customerName || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Phone</p>
                <p className="text-white">{message.customerPhone || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Email</p>
                <p className="text-white break-all">{message.customerEmail || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Related Order</p>
                <p className="text-primary font-bold">{message.orderId || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Status</p>
                <span className={`mb-3 inline-flex border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${statusClass(message.status)}`}>
                  {statusLabel(message.status)}
                </span>
                {message.status === "closed" ? (
                  <button
                    type="button"
                    onClick={handleReopen}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 h-10 border border-primary text-primary font-display font-bold uppercase tracking-widest hover:bg-primary hover:text-black transition-colors disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 h-10 border border-zinc-500 text-zinc-300 font-display font-bold uppercase tracking-widest hover:bg-zinc-200 hover:text-black transition-colors disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    Close
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </AdminLayout>
  );
}

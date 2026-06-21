import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  dbGetReturnRequests,
  dbUpdateReturnRequestStatus,
} from "@/lib/orderService";
import type { ReturnRequest, ReturnRequestStatus } from "@/lib/types";

const STATUSES: ReturnRequestStatus[] = ["Pending", "Accepted", "Rejected", "Completed"];

function statusClass(status: ReturnRequestStatus) {
  switch (status) {
    case "Accepted": return "border-primary/40 bg-primary/10 text-primary";
    case "Rejected": return "border-red-500/40 bg-red-500/10 text-red-400";
    case "Completed": return "border-green-500/40 bg-green-500/10 text-green-400";
    default: return "border-yellow-500/40 bg-yellow-500/10 text-yellow-400";
  }
}

export default function AdminReturnRequestsPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  const loadRequests = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setLoadError(null);
    try {
      setRequests(await dbGetReturnRequests());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load requests.";
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
    loadRequests();
  }, [isAdmin, loadRequests]);

  if (!isAdmin) return null;

  const updateStatus = async (request: ReturnRequest, status: ReturnRequestStatus) => {
    setUpdatingId(request.id);
    try {
      const adminNote = window.prompt("Admin note (optional)", request.adminNote ?? "") ?? request.adminNote;
      const updated = await dbUpdateReturnRequestStatus(request.id, status, adminNote);
      setRequests(prev => prev.map(item => item.id === request.id && updated ? updated : item));
      toast({ title: "Request updated", description: status });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update request.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">RETURNS</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
            Return and exchange requests from delivered orders.
          </p>
        </div>
        <button
          onClick={() => loadRequests(true)}
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
            <span className="uppercase tracking-widest text-sm">Loading requests...</span>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-red-400 uppercase tracking-widest text-sm px-4">
            {loadError}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground uppercase tracking-widest text-sm">
            No return or exchange requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                  <th className="py-3 px-4 font-normal">Order</th>
                  <th className="py-3 px-4 font-normal">Action</th>
                  <th className="py-3 px-4 font-normal">Reason</th>
                  <th className="py-3 px-4 font-normal">Message</th>
                  <th className="py-3 px-4 font-normal">Date</th>
                  <th className="py-3 px-4 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id} className="border-b border-border/50 hover:bg-background/30 transition-colors align-top">
                    <td className="py-3 px-4 text-white font-display">{request.orderNumber}</td>
                    <td className="py-3 px-4 text-primary uppercase tracking-widest text-xs font-bold">{request.preferredAction}</td>
                    <td className="py-3 px-4 text-white text-sm">{request.reason}</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm max-w-md">{request.message}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{new Date(request.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="py-3 px-4">
                      {updatingId === request.id ? (
                        <Loader2 size={16} className="animate-spin text-primary" />
                      ) : (
                        <select
                          value={request.status}
                          onChange={event => updateStatus(request, event.target.value as ReturnRequestStatus)}
                          className={`h-8 px-2 text-xs uppercase tracking-widest font-bold outline-none cursor-pointer border bg-transparent ${statusClass(request.status)}`}
                        >
                          {STATUSES.map(status => (
                            <option key={status} value={status} className="bg-[#111] text-white normal-case font-normal">{status}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Edit3, Loader2, RefreshCw, Truck } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SUPABASE_NOT_CONNECTED_MESSAGE, supabaseConfigured, useDevOrderMock } from "@/lib/supabase";
import {
  ADMIN_GOVERNORATES,
  getShippingZones,
  saveShippingZone,
} from "@/lib/shippingService";
import type { ShippingZone } from "@/lib/types";

type FormState = {
  id?: string;
  governorate: string;
  cityArea: string;
  deliveryFeeEgp: string;
  freeShippingMinEgp: string;
  active: boolean;
};

const emptyForm: FormState = {
  governorate: "Giza",
  cityArea: "",
  deliveryFeeEgp: "60",
  freeShippingMinEgp: "",
  active: true,
};

function zoneToForm(zone: ShippingZone): FormState {
  return {
    id: zone.id,
    governorate: zone.governorate,
    cityArea: zone.cityArea ?? "",
    deliveryFeeEgp: String(zone.deliveryFeeEgp),
    freeShippingMinEgp: zone.freeShippingMinEgp ? String(zone.freeShippingMinEgp) : "",
    active: zone.active,
  };
}

export default function AdminShippingPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  const loadZones = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setLoadError(null);
    try {
      const data = await getShippingZones(true);
      setZones(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load shipping zones.";
      setLoadError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) return;
    loadZones();
  }, [isAdmin, loadZones]);

  if (!isAdmin) return null;

  const resetForm = () => setForm(emptyForm);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const deliveryFee = Number(form.deliveryFeeEgp);
    const freeMin = form.freeShippingMinEgp.trim() ? Number(form.freeShippingMinEgp) : null;

    if (!form.governorate.trim()) {
      toast({ title: "Missing Governorate", description: "Governorate is required.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      toast({ title: "Invalid Fee", description: "Delivery fee must be 0 or more.", variant: "destructive" });
      return;
    }
    if (freeMin !== null && (!Number.isFinite(freeMin) || freeMin < 0)) {
      toast({ title: "Invalid Free Shipping Minimum", description: "Minimum must be empty or 0 or more.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await saveShippingZone({
        id: form.id,
        governorate: form.governorate,
        cityArea: form.cityArea,
        deliveryFeeEgp: deliveryFee,
        freeShippingMinEgp: freeMin,
        active: form.active,
      });
      toast({ title: "Shipping Zone Saved", description: `${form.governorate} delivery zone updated.` });
      resetForm();
      await loadZones();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save shipping zone.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (zone: ShippingZone) => {
    setSaving(true);
    try {
      await saveShippingZone({
        id: zone.id,
        governorate: zone.governorate,
        cityArea: zone.cityArea,
        deliveryFeeEgp: zone.deliveryFeeEgp,
        freeShippingMinEgp: zone.freeShippingMinEgp,
        active: !zone.active,
      });
      await loadZones();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update zone.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">SHIPPING</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
            Fees ship from Hadayek Al Ahram, Giza.
          </p>
        </div>
        <button
          onClick={() => loadZones(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-white transition-colors text-xs uppercase tracking-widest"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!supabaseConfigured && (
        <div className="mb-4 border border-red-500/50 bg-red-500/10 p-4 text-xs uppercase tracking-widest text-red-400">
          <div className="flex flex-wrap items-center gap-2">
            {useDevOrderMock && (
              <span className="bg-primary text-black px-2 py-0.5 font-black">DEV MOCK</span>
            )}
            <span>{SUPABASE_NOT_CONNECTED_MESSAGE}</span>
          </div>
          {useDevOrderMock && (
            <p className="mt-2 text-primary">
              Development only: shipping zones are saved in this browser localStorage.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <form onSubmit={handleSave} className="xl:col-span-4 bg-card border border-border p-4 sm:p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Truck size={18} className="text-primary" />
            <h2 className="font-display uppercase tracking-widest text-white">
              {form.id ? "Edit Zone" : "Add Zone"}
            </h2>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Governorate</label>
            <select
              value={form.governorate}
              onChange={event => setForm(prev => ({ ...prev, governorate: event.target.value }))}
              className="flex h-11 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ fontSize: "16px" }}
            >
              {ADMIN_GOVERNORATES.map(gov => (
                <option key={gov} value={gov}>{gov}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">City / Area Optional</label>
            <Input
              value={form.cityArea}
              onChange={event => setForm(prev => ({ ...prev, cityArea: event.target.value }))}
              placeholder="Leave empty for governorate default"
              className="h-11 bg-background rounded-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Delivery Fee EGP</label>
              <Input
                type="number"
                min={0}
                value={form.deliveryFeeEgp}
                onChange={event => setForm(prev => ({ ...prev, deliveryFeeEgp: event.target.value }))}
                className="h-11 bg-background rounded-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Free Shipping Min</label>
              <Input
                type="number"
                min={0}
                value={form.freeShippingMinEgp}
                onChange={event => setForm(prev => ({ ...prev, freeShippingMinEgp: event.target.value }))}
                placeholder="Optional"
                className="h-11 bg-background rounded-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 border border-border bg-background px-3 py-3 text-sm text-white">
            <input
              type="checkbox"
              checked={form.active}
              onChange={event => setForm(prev => ({ ...prev, active: event.target.checked }))}
              className="h-4 w-4 accent-[#39FF14]"
            />
            <span className="uppercase tracking-widest text-xs">Active zone</span>
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-11 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="h-11 px-4 border border-border text-muted-foreground hover:text-white uppercase tracking-widest text-xs"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="xl:col-span-8 bg-card border border-border overflow-hidden">
          {loading ? (
            <div className="py-24 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
              <span className="uppercase tracking-widest text-sm">Loading shipping zones...</span>
            </div>
          ) : loadError ? (
            <div className="py-16 text-center text-red-400 uppercase tracking-widest text-sm px-4">
              {loadError}
            </div>
          ) : zones.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground uppercase tracking-widest text-sm">
              No shipping zones yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                    <th className="py-3 px-4 font-normal">Governorate</th>
                    <th className="py-3 px-4 font-normal">City / Area</th>
                    <th className="py-3 px-4 font-normal">Fee</th>
                    <th className="py-3 px-4 font-normal">Free Min</th>
                    <th className="py-3 px-4 font-normal">Status</th>
                    <th className="py-3 px-4 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map(zone => (
                    <tr key={zone.id} className="border-b border-border/40 hover:bg-background/30 transition-colors">
                      <td className="py-3 px-4 text-white font-semibold">{zone.governorate}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {zone.cityArea || "Default"}
                      </td>
                      <td className="py-3 px-4 text-white">{zone.deliveryFeeEgp} EGP</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {zone.freeShippingMinEgp ? `${zone.freeShippingMinEgp} EGP` : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${
                          zone.active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-red-500/30 bg-red-500/10 text-red-400"
                        }`}>
                          {zone.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setForm(zoneToForm(zone))}
                            className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-white"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(zone)}
                            disabled={saving}
                            className="border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-white disabled:opacity-50"
                          >
                            {zone.active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

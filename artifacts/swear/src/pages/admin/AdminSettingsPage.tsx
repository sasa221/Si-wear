import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Save } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getStoreSettings, saveStoreSettings, type StoreSettings } from "@/lib/storeSettings";

const emptySettings: StoreSettings = {
  brandName: "",
  whatsappNumber: "",
  announcementBarText: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
  storeLocation: "",
  shippingNote: "",
  returnsPolicyText: "",
  supportInfo: "",
};

export default function AdminSettingsPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [settings, setSettings] = useState<StoreSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getStoreSettings()
      .then(data => {
        if (!cancelled) setSettings(data);
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : "Failed to load settings.";
        if (!cancelled) setLoadError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const setField = (field: keyof StoreSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveStoreSettings(settings);
      setSettings(saved);
      toast({ title: "Settings saved", description: "Public site settings updated." });
    } catch (err) {
      toast({
        title: "Settings not saved",
        description: err instanceof Error ? err.message : "Failed to save settings.",
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
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">SETTINGS</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
            Store identity, support, social, and public policy text.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 bg-primary text-black font-display font-bold uppercase tracking-widest px-5 py-3 hover:bg-white transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </button>
      </div>

      {loading ? (
        <div className="py-24 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="uppercase tracking-widest text-sm">Loading settings...</span>
        </div>
      ) : loadError ? (
        <div className="bg-card border border-red-500/40 p-8 text-center text-red-400">
          {loadError}
        </div>
      ) : (
        <div className="bg-card border border-border p-4 sm:p-6 max-w-5xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Brand Name</label>
              <Input value={settings.brandName} onChange={e => setField("brandName", e.target.value)} className="bg-background rounded-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">WhatsApp Number</label>
              <Input value={settings.whatsappNumber} onChange={e => setField("whatsappNumber", e.target.value)} className="bg-background rounded-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Announcement Bar Text</label>
              <Input value={settings.announcementBarText} onChange={e => setField("announcementBarText", e.target.value)} className="bg-background rounded-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Instagram URL</label>
              <Input value={settings.instagramUrl} onChange={e => setField("instagramUrl", e.target.value)} className="bg-background rounded-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">TikTok URL</label>
              <Input value={settings.tiktokUrl} onChange={e => setField("tiktokUrl", e.target.value)} className="bg-background rounded-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Facebook URL</label>
              <Input value={settings.facebookUrl} onChange={e => setField("facebookUrl", e.target.value)} className="bg-background rounded-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Support Info</label>
              <Input value={settings.supportInfo} onChange={e => setField("supportInfo", e.target.value)} className="bg-background rounded-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Store Location</label>
            <Textarea value={settings.storeLocation} onChange={e => setField("storeLocation", e.target.value)} className="bg-background rounded-none min-h-20" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Shipping Note</label>
            <Textarea value={settings.shippingNote} onChange={e => setField("shippingNote", e.target.value)} className="bg-background rounded-none min-h-20" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Returns Policy Text</label>
            <Textarea value={settings.returnsPolicyText} onChange={e => setField("returnsPolicyText", e.target.value)} className="bg-background rounded-none min-h-24" />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

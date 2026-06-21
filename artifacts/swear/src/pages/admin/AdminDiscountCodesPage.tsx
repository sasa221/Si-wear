import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  getDiscountCodesAsync,
  saveDiscountCode,
  setDiscountCodeActive,
  type DiscountCode,
} from "@/hooks/useDiscountCodes";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Loader2, Plus, Percent, ToggleLeft, ToggleRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const codeSchema = z.object({
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, dashes, and underscores"),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().min(1, "Value must be at least 1"),
  minimumOrderEgp: z.coerce.number().min(0, "Minimum order cannot be negative"),
  usageLimit: z.coerce.number().nullable(),
  hasLimit: z.boolean(),
  expiresAt: z.string().optional(),
});

type CodeFormValues = z.infer<typeof codeSchema>;

const defaultFormValues: CodeFormValues = {
  code: "",
  type: "percentage",
  value: 10,
  minimumOrderEgp: 0,
  usageLimit: null,
  hasLimit: false,
  expiresAt: "",
};

function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `dc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AdminDiscountCodesPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);

  const form = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: defaultFormValues,
  });

  const hasLimit = form.watch("hasLimit");
  const type = form.watch("type");

  const loadCodes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setCodes(await getDiscountCodesAsync());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load discount codes.";
      setLoadError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }
    loadCodes();
  }, [isAdmin, setLocation, loadCodes]);

  if (!isAdmin) return null;

  const openCreateForm = () => {
    setEditingCode(null);
    form.reset(defaultFormValues);
    setShowForm(true);
  };

  const openEditForm = (code: DiscountCode) => {
    setEditingCode(code);
    form.reset({
      code: code.code,
      type: code.type,
      value: code.value,
      minimumOrderEgp: code.minimumOrderEgp,
      usageLimit: code.usageLimit,
      hasLimit: code.usageLimit !== null,
      expiresAt: code.expiresAt ? code.expiresAt.slice(0, 10) : "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCode(null);
    form.reset(defaultFormValues);
  };

  const onSubmit = async (data: CodeFormValues) => {
    const existing = codes.find(
      (c) => c.id !== editingCode?.id && c.code.toUpperCase() === data.code.toUpperCase()
    );
    if (existing) {
      toast({ title: "Code already exists", variant: "destructive" });
      return;
    }

    if (data.type === "percentage" && data.value > 100) {
      toast({ title: "Percentage cannot exceed 100", variant: "destructive" });
      return;
    }
    if (data.hasLimit && (!data.usageLimit || data.usageLimit < 1)) {
      toast({ title: "Usage limit required", description: "Enter at least 1 use or set the code to unlimited.", variant: "destructive" });
      return;
    }

    const nextCode: DiscountCode = {
      id: editingCode?.id ?? createId(),
      code: data.code.toUpperCase(),
      type: data.type,
      value: data.value,
      minimumOrderEgp: data.minimumOrderEgp,
      usageLimit: data.hasLimit ? Number(data.usageLimit) : null,
      usedCount: editingCode?.usedCount ?? 0,
      active: editingCode?.active ?? true,
      expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      createdAt: editingCode?.createdAt ?? new Date().toISOString(),
    };

    setSaving(true);
    try {
      await saveDiscountCode(nextCode);
      await loadCodes();
      closeForm();
      toast({ title: editingCode ? "Discount code updated" : "Discount code created", description: nextCode.code });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create discount code.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (code: DiscountCode) => {
    try {
      await setDiscountCodeActive(code.id, !code.active);
      setCodes(prev => prev.map(item => item.id === code.id ? { ...item, active: !item.active } : item));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update code.",
        variant: "destructive",
      });
    }
  };

  const formatValue = (c: DiscountCode) =>
    c.type === "percentage" ? `${c.value}% OFF` : `${c.value} EGP OFF`;

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">
            DISCOUNT CODES
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">
            {codes.length} code{codes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={showForm ? closeForm : openCreateForm}
          className="flex items-center justify-center gap-2 bg-primary text-black font-display font-bold uppercase tracking-widest px-6 py-3 hover:bg-white transition-colors"
        >
          <Plus size={18} /> {showForm ? "CLOSE FORM" : "CREATE CODE"}
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border p-6 mb-8">
          <h2 className="font-display text-xl uppercase tracking-widest text-white mb-6 border-b border-border pb-3">
            {editingCode ? "EDIT DISCOUNT CODE" : "NEW DISCOUNT CODE"}
          </h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Code</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-background rounded-none uppercase"
                        placeholder="SUMMER20"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Type</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ fontSize: "16px" }}
                        {...field}
                      >
                        <option value="percentage">Percentage (% off)</option>
                        <option value="fixed">Fixed (EGP off)</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">
                      Value {type === "percentage" ? "(%)" : "(EGP)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="bg-background rounded-none"
                        min={1}
                        max={type === "percentage" ? 100 : undefined}
                        style={{ fontSize: "16px" }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="minimumOrderEgp" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Minimum Order EGP</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} className="bg-background rounded-none" style={{ fontSize: "16px" }} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="expiresAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Expiry Optional</FormLabel>
                    <FormControl>
                      <Input type="date" className="bg-background rounded-none" style={{ fontSize: "16px" }} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-2">
                  <FormField control={form.control} name="hasLimit" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">Usage Limit</FormLabel>
                      <div className="flex items-center gap-2 h-10">
                        <button
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          className={`text-sm uppercase tracking-widest font-bold transition-colors ${
                            field.value ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {field.value ? "LIMITED" : "UNLIMITED"}
                        </button>
                      </div>
                    </FormItem>
                  )} />
                  {hasLimit && (
                    <FormField control={form.control} name="usageLimit" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            className="bg-background rounded-none"
                            placeholder="e.g. 100"
                            min={1}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 px-8 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
                >
                  {saving ? "SAVING..." : "SAVE CODE"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="h-11 px-8 border border-border text-white font-display font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </Form>
        </div>
      )}

      <div className="bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="py-20 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="uppercase tracking-widest text-sm">Loading codes...</span>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-red-400 uppercase tracking-widest text-sm px-4">
            {loadError}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                  <th className="py-3 px-4 font-normal">Code</th>
                  <th className="py-3 px-4 font-normal">Discount</th>
                  <th className="py-3 px-4 font-normal">Minimum</th>
                  <th className="py-3 px-4 font-normal">Expiry</th>
                  <th className="py-3 px-4 font-normal">Usage</th>
                  <th className="py-3 px-4 font-normal text-center">Status</th>
                  <th className="py-3 px-4 font-normal text-center">Created</th>
                  <th className="py-3 px-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-muted-foreground">
                      <Percent size={32} className="mx-auto mb-3 opacity-30" />
                      <p>No discount codes yet. Click Create Code to add one.</p>
                    </td>
                  </tr>
                ) : (
                  codes.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-background/20 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-primary tracking-widest">{c.code}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 text-xs uppercase tracking-widest font-bold">
                          {formatValue(c)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {c.minimumOrderEgp > 0 ? `${c.minimumOrderEgp} EGP` : "None"}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-EG") : "No expiry"}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {c.usedCount} / {c.usageLimit === null ? "unlimited" : c.usageLimit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleActive(c)}
                          className="inline-flex items-center gap-1"
                          title={c.active ? "Click to deactivate" : "Click to activate"}
                        >
                          {c.active ? (
                            <>
                              <ToggleRight size={20} className="text-primary" />
                              <span className="text-xs text-primary uppercase tracking-widest font-bold">ACTIVE</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={20} className="text-muted-foreground" />
                              <span className="text-xs text-muted-foreground uppercase tracking-widest">OFF</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("en-EG")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditForm(c)}
                          className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-white"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4 uppercase tracking-widest">
        Deactivate codes instead of deleting them so order history stays readable.
      </p>
    </AdminLayout>
  );
}

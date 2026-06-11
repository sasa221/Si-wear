import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  getDiscountCodes,
  saveDiscountCodes,
  DiscountCode,
} from "@/hooks/useDiscountCodes";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Percent, ToggleLeft, ToggleRight } from "lucide-react";
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
  usageLimit: z.coerce.number().nullable(),
  hasLimit: z.boolean(),
});

type CodeFormValues = z.infer<typeof codeSchema>;

export default function AdminDiscountCodesPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [showForm, setShowForm] = useState(false);

  const form = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      code: "",
      type: "percentage",
      value: 10,
      usageLimit: null,
      hasLimit: false,
    },
  });

  const hasLimit = form.watch("hasLimit");
  const type = form.watch("type");

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }
    setCodes(getDiscountCodes());
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  const onSubmit = (data: CodeFormValues) => {
    const existing = codes.find(
      (c) => c.code.toUpperCase() === data.code.toUpperCase()
    );
    if (existing) {
      toast({ title: "Code already exists", variant: "destructive" });
      return;
    }

    if (data.type === "percentage" && data.value > 100) {
      toast({ title: "Percentage cannot exceed 100", variant: "destructive" });
      return;
    }

    const newCode: DiscountCode = {
      id: "dc-" + Date.now(),
      code: data.code.toUpperCase(),
      type: data.type,
      value: data.value,
      usageLimit: data.hasLimit ? Number(data.usageLimit) : null,
      usedCount: 0,
      active: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [...codes, newCode];
    saveDiscountCodes(updated);
    setCodes(updated);
    form.reset();
    setShowForm(false);
    toast({ title: "Discount code created", description: newCode.code });
  };

  const toggleActive = (id: string) => {
    const updated = codes.map((c) =>
      c.id === id ? { ...c, active: !c.active } : c
    );
    saveDiscountCodes(updated);
    setCodes(updated);
  };

  const handleDelete = (id: string, code: string) => {
    if (!confirm(`Delete code "${code}"?`)) return;
    const updated = codes.filter((c) => c.id !== id);
    saveDiscountCodes(updated);
    setCodes(updated);
    toast({ title: "Code deleted", description: code });
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
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-2 bg-primary text-black font-display font-bold uppercase tracking-widest px-6 py-3 hover:bg-white transition-colors"
        >
          <Plus size={18} /> CREATE CODE
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border border-border p-6 mb-8">
          <h2 className="font-display text-xl uppercase tracking-widest text-white mb-6 border-b border-border pb-3">
            NEW DISCOUNT CODE
          </h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">
                        Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background rounded-none uppercase"
                          placeholder="SUMMER20"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs tracking-widest">
                        Type
                      </FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          {...field}
                        >
                          <option value="percentage">Percentage (% off)</option>
                          <option value="fixed">Fixed (EGP off)</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
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
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="hasLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs tracking-widest">
                          Usage Limit
                        </FormLabel>
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
                    )}
                  />
                  {hasLimit && (
                    <FormField
                      control={form.control}
                      name="usageLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              className="bg-background rounded-none"
                              placeholder="e.g. 100"
                              min={1}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="h-11 px-8 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors"
                >
                  SAVE CODE
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="h-11 px-8 border border-border text-white font-display font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* Codes table */}
      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                <th className="py-3 px-4 font-normal">Code</th>
                <th className="py-3 px-4 font-normal">Discount</th>
                <th className="py-3 px-4 font-normal">Usage</th>
                <th className="py-3 px-4 font-normal text-center">Status</th>
                <th className="py-3 px-4 font-normal text-center">Created</th>
                <th className="py-3 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-muted-foreground"
                  >
                    <Percent size={32} className="mx-auto mb-3 opacity-30" />
                    <p>No discount codes yet. Click Create Code to add one.</p>
                  </td>
                </tr>
              ) : (
                codes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-background/20 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-primary tracking-widest">
                        {c.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 text-xs uppercase tracking-widest font-bold">
                        {formatValue(c)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {c.usedCount} /{" "}
                      {c.usageLimit === null ? "∞" : c.usageLimit}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleActive(c.id)}
                        className="inline-flex items-center gap-1"
                        title={c.active ? "Click to deactivate" : "Click to activate"}
                      >
                        {c.active ? (
                          <>
                            <ToggleRight size={20} className="text-primary" />
                            <span className="text-xs text-primary uppercase tracking-widest font-bold">
                              ACTIVE
                            </span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={20} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground uppercase tracking-widest">
                              OFF
                            </span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("en-EG")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(c.id, c.code)}
                        className="inline-flex items-center justify-center w-8 h-8 bg-background border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 uppercase tracking-widest">
        Toggle a code ON/OFF without deleting it. Users enter codes at checkout.
      </p>
    </AdminLayout>
  );
}

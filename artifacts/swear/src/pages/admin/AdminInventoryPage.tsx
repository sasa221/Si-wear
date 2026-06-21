import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getProductsAsync, updateVariantInventoryAsync } from "@/hooks/useProducts";
import type { Product, ProductVariant } from "@/data/products";

type InventoryRow = {
  product: Product;
  variant: ProductVariant;
};

export default function AdminInventoryPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  const loadInventory = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setLoadError(null);
    try {
      const nextProducts = await getProductsAsync({ admin: true });
      setProducts(nextProducts);
      setStockDrafts(Object.fromEntries(
        nextProducts.flatMap(product =>
          product.variants.map(variant => [variant.id, String(variant.stock)])
        )
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load inventory.";
      setLoadError(message);
      toast({ title: "Inventory not loaded", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) return;
    loadInventory();
  }, [isAdmin, loadInventory]);

  const rows = useMemo<InventoryRow[]>(
    () => products.flatMap(product => product.variants.map(variant => ({ product, variant }))),
    [products]
  );

  if (!isAdmin) return null;

  const saveVariant = async (row: InventoryRow) => {
    const stock = Math.max(0, Number(stockDrafts[row.variant.id]) || 0);
    setBusyId(row.variant.id);
    try {
      await updateVariantInventoryAsync(row.variant.id, { stock, active: row.variant.active });
      toast({ title: "Inventory saved", description: `${row.product.name} - ${row.variant.color} / ${row.variant.size}` });
      await loadInventory();
    } catch (err) {
      toast({
        title: "Inventory not saved",
        description: err instanceof Error ? err.message : "Failed to update inventory.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (row: InventoryRow) => {
    setBusyId(row.variant.id);
    try {
      await updateVariantInventoryAsync(row.variant.id, { active: !row.variant.active });
      toast({ title: row.variant.active ? "Variant disabled" : "Variant enabled" });
      await loadInventory();
    } catch (err) {
      toast({
        title: "Variant not updated",
        description: err instanceof Error ? err.message : "Failed to update variant.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">INVENTORY</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-2">
            {rows.length} size/color variants from Supabase.
          </p>
        </div>
        <button
          onClick={() => loadInventory(true)}
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
            <span className="uppercase tracking-widest text-sm">Loading inventory...</span>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-red-400 uppercase tracking-widest text-sm px-4">
            {loadError}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground uppercase tracking-widest text-sm">
            No product variants yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                  <th className="py-3 px-4 font-normal">Product</th>
                  <th className="py-3 px-4 font-normal">Color</th>
                  <th className="py-3 px-4 font-normal">Size</th>
                  <th className="py-3 px-4 font-normal">Stock</th>
                  <th className="py-3 px-4 font-normal">Variant</th>
                  <th className="py-3 px-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isBusy = busyId === row.variant.id;
                  return (
                    <tr key={row.variant.id} className="border-b border-border/50 hover:bg-background/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="text-white font-bold text-sm">{row.product.name}</p>
                        <p className="text-xs text-muted-foreground">{row.product.status}</p>
                      </td>
                      <td className="py-3 px-4 text-white">{row.variant.color}</td>
                      <td className="py-3 px-4 text-white font-display">{row.variant.size}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min={0}
                          value={stockDrafts[row.variant.id] ?? String(row.variant.stock)}
                          onChange={event => setStockDrafts(prev => ({ ...prev, [row.variant.id]: event.target.value }))}
                          className="h-9 w-24 bg-background border border-border px-3 text-white outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${
                          row.variant.active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-red-500/40 bg-red-500/10 text-red-400"
                        }`}>
                          {row.variant.active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => saveVariant(row)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 border border-primary px-3 py-1.5 text-xs uppercase tracking-widest text-primary hover:bg-primary hover:text-black disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save
                          </button>
                          <button
                            onClick={() => toggleActive(row)}
                            disabled={isBusy}
                            className="border border-border px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-white disabled:opacity-50"
                          >
                            {row.variant.active ? "Disable" : "Enable"}
                          </button>
                        </div>
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

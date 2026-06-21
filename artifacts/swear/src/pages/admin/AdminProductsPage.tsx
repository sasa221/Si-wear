import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  archiveProductAsync,
  deleteProductAsync,
  getProductsAsync,
  restoreProductAsync,
  setProductStatusAsync,
} from "@/hooks/useProducts";
import { Product, getInventoryStatus, getStockLabel, getTotalStock } from "@/data/products";
import { Archive, Edit, Eye, EyeOff, Plus, RotateCcw, Star, Trash2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getProductImage, useFallbackImage } from "@/lib/images";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ProductFilter = "all" | "active" | "draft" | "archived";

const filters: { label: string; value: ProductFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

function inventoryClass(product: Product): string {
  const status = getInventoryStatus(product);
  if (status === "archived") return "bg-zinc-800/80 text-zinc-400 border-zinc-600";
  if (status === "draft") return "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";
  if (status === "out_of_stock") return "bg-red-500/10 text-red-400 border-red-500/30";
  if (status === "low_stock") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
  return "bg-primary/10 text-primary border-primary/30";
}

export default function AdminProductsPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const loadProducts = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getProductsAsync({ admin: true, status: filter })
      .then(setProducts)
      .catch(err => setLoadError(err instanceof Error ? err.message : "Failed to load products."))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
    } else {
      loadProducts();
    }
  }, [isAdmin, setLocation, loadProducts]);

  if (!isAdmin) return null;

  const runProductAction = async (product: Product, action: () => Promise<void>, successTitle: string) => {
    setBusyProductId(product.id);
    try {
      await action();
      toast({ title: successTitle, description: product.name });
      loadProducts();
    } catch (err) {
      toast({
        title: "Product update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyProductId(null);
    }
  };

  const handleStatusToggle = (product: Product) => {
    if (product.status === "archived") {
      return runProductAction(product, () => restoreProductAsync(product.id), "Product restored");
    }

    const nextStatus = product.status === "active" ? "draft" : "active";
    return runProductAction(
      product,
      () => setProductStatusAsync(product.id, nextStatus),
      nextStatus === "active" ? "Product published" : "Product unpublished"
    );
  };

  const handleArchive = (product: Product) => {
    runProductAction(product, () => archiveProductAsync(product.id), "Product archived");
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const product = deleteTarget;
    setDeleteTarget(null);
    setBusyProductId(product.id);
    try {
      const result = await deleteProductAsync(product.id);
      toast({
        title: result.action === "deleted"
          ? "Product permanently deleted."
          : "Product archived because it has order history.",
        description: result.storageWarnings?.length ? result.storageWarnings.join(" ") : product.name,
      });
      loadProducts();
    } catch (err) {
      toast({
        title: "Product delete failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyProductId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">PRODUCTS</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">{products.length} total</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center justify-center gap-2 bg-primary text-black font-display font-bold uppercase tracking-widest px-6 py-3 hover:bg-white transition-colors"
        >
          <Plus size={18} /> ADD PRODUCT
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map(item => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`h-9 px-4 border text-xs uppercase tracking-widest font-bold transition-colors ${
              filter === item.value
                ? "bg-primary text-black border-primary"
                : "bg-background text-muted-foreground border-border hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                <th className="py-3 px-4 font-normal w-14">Image</th>
                <th className="py-3 px-4 font-normal">Name</th>
                <th className="py-3 px-4 font-normal">Category</th>
                <th className="py-3 px-4 font-normal">Price</th>
                <th className="py-3 px-4 font-normal">Stock</th>
                <th className="py-3 px-4 font-normal">Status</th>
                <th className="py-3 px-4 font-normal">Flags</th>
                <th className="py-3 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground uppercase tracking-widest text-sm">
                    Loading products...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-red-400">
                    {loadError}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    No products in this view.
                  </td>
                </tr>
              ) : products.map(product => (
                <tr key={product.id} className="border-b border-border/50 hover:bg-background/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="w-10 h-13 bg-background border border-border overflow-hidden" style={{ height: "52px" }}>
                      <img
                        src={getProductImage(product.images)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={useFallbackImage}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-white text-sm line-clamp-1">{product.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">#{product.id}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-background border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {product.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-white font-bold text-sm">{product.price} EGP</td>
                  <td className="py-3 px-4 text-white font-bold text-sm">
                    {getTotalStock(product)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex border px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${inventoryClass(product)}`}>
                      {getStockLabel(product)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {product.isNew && (
                        <span title="New" className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[9px] uppercase tracking-widest font-bold">
                          <Zap size={9} /> NEW
                        </span>
                      )}
                      {product.isBestSeller && (
                        <span title="Best Seller" className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[9px] uppercase tracking-widest font-bold">
                          <Star size={9} /> BEST
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="inline-flex items-center justify-center gap-1 h-8 px-2 bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors text-[10px] uppercase tracking-widest font-bold"
                      >
                        <Edit size={13} /> Edit
                      </Link>
                      <button
                        type="button"
                        disabled={busyProductId === product.id}
                        onClick={() => handleStatusToggle(product)}
                        className="inline-flex items-center justify-center gap-1 h-8 px-2 bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50 text-[10px] uppercase tracking-widest font-bold"
                      >
                        {product.status === "archived" ? <RotateCcw size={13} /> : product.status === "active" ? <EyeOff size={13} /> : <Eye size={13} />}
                        {product.status === "archived" ? "Restore" : product.status === "active" ? "Unpublish" : "Publish"}
                      </button>
                      {product.status !== "archived" && (
                        <button
                          type="button"
                          disabled={busyProductId === product.id}
                          onClick={() => handleArchive(product)}
                          className="inline-flex items-center justify-center gap-1 h-8 px-2 bg-background border border-border text-muted-foreground hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50 text-[10px] uppercase tracking-widest font-bold"
                        >
                          <Archive size={13} /> Archive
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyProductId === product.id}
                        onClick={() => setDeleteTarget(product)}
                        className="inline-flex items-center justify-center gap-1 h-8 px-2 bg-background border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40 transition-colors disabled:opacity-50 text-[10px] uppercase tracking-widest font-bold"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product and its variants/images. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

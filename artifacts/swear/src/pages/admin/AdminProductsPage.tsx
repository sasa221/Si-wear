import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getProducts, saveProducts } from "@/hooks/useProducts";
import { Product } from "@/data/products";
import { Plus, Edit, Trash2, Star, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminProductsPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
    } else {
      setProducts(getProducts());
    }
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const updated = products.filter(p => p.id !== id);
    saveProducts(updated);
    setProducts(updated);
    toast({ title: "Product deleted", description: name });
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

      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/60">
                <th className="py-3 px-4 font-normal w-14">Image</th>
                <th className="py-3 px-4 font-normal">Name</th>
                <th className="py-3 px-4 font-normal">Category</th>
                <th className="py-3 px-4 font-normal">Price</th>
                <th className="py-3 px-4 font-normal">Flags</th>
                <th className="py-3 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    No products yet. Click Add Product to create one.
                  </td>
                </tr>
              ) : products.map(product => (
                <tr key={product.id} className="border-b border-border/50 hover:bg-background/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="w-10 h-13 bg-background border border-border overflow-hidden" style={{ height: "52px" }}>
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
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
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="inline-flex items-center justify-center w-8 h-8 bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                      >
                        <Edit size={13} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id, product.name)}
                        className="inline-flex items-center justify-center w-8 h-8 bg-background border border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

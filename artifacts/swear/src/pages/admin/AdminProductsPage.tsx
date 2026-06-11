import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { products as initialProducts, Product } from "@/data/products";
import { Plus, Edit } from "lucide-react";

export default function AdminProductsPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
    } else {
      const stored = localStorage.getItem("swear_products");
      if (stored) {
        setProducts(JSON.parse(stored));
      } else {
        setProducts(initialProducts);
        localStorage.setItem("swear_products", JSON.stringify(initialProducts));
      }
    }
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white">PRODUCTS</h1>
        <Link href="/admin/products/new" className="flex items-center justify-center gap-2 bg-primary text-black font-display font-bold uppercase tracking-widest px-6 py-3 hover:bg-white transition-colors">
          <Plus size={18} /> ADD PRODUCT
        </Link>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-widest bg-background/50">
                <th className="py-4 px-4 font-normal w-16">Image</th>
                <th className="py-4 px-4 font-normal">Name</th>
                <th className="py-4 px-4 font-normal">Category</th>
                <th className="py-4 px-4 font-normal">Price</th>
                <th className="py-4 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b border-border/50 hover:bg-background/20 transition-colors">
                  <td className="py-4 px-4">
                    <div className="w-10 h-12 bg-background border border-border overflow-hidden">
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-white text-sm line-clamp-1">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.id}</p>
                  </td>
                  <td className="py-4 px-4">
                    <span className="bg-background border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {product.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-white font-bold">{product.price} EGP</td>
                  <td className="py-4 px-4 text-right">
                    <Link href={`/admin/products/${product.id}/edit`} className="inline-flex items-center justify-center w-8 h-8 bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                      <Edit size={14} />
                    </Link>
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

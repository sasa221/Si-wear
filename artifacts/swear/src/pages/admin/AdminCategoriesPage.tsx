import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getCategories, saveCategories, getProducts } from "@/hooks/useProducts";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Tag } from "lucide-react";

export default function AdminCategoriesPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }
    setCategories(getCategories());
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  const getProductCountForCategory = (cat: string) => {
    return getProducts().filter(p => p.category === cat).length;
  };

  const handleAdd = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.find(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Category already exists", variant: "destructive" });
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
    setNewCategory("");
    toast({ title: "Category added", description: trimmed });
  };

  const handleDelete = (cat: string) => {
    const count = getProductCountForCategory(cat);
    if (count > 0) {
      toast({
        title: "Cannot delete",
        description: `${count} product${count !== 1 ? 's' : ''} still use this category. Reassign them first.`,
        variant: "destructive",
      });
      return;
    }
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    saveCategories(updated);
    toast({ title: "Category deleted", description: cat });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <AdminLayout>
      <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white mb-2">CATEGORIES</h1>
      <p className="text-muted-foreground text-sm mb-8 uppercase tracking-widest">
        {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
      </p>

      {/* Add new category */}
      <div className="bg-card border border-border p-6 mb-6">
        <h2 className="font-display text-lg uppercase tracking-widest text-white mb-4">ADD CATEGORY</h2>
        <div className="flex gap-3">
          <Input
            placeholder="e.g. Jackets"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-background rounded-none border-border flex-1 max-w-sm"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 h-10 px-6 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors"
          >
            <Plus size={16} />
            ADD
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Press Enter or click Add. Names are case-sensitive.</p>
      </div>

      {/* Category list */}
      <div className="bg-card border border-border overflow-hidden">
        <div className="border-b border-border bg-background/60 px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-4">
          <span>Category Name</span>
          <span className="text-right">Products</span>
          <span></span>
        </div>

        {categories.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Tag size={32} className="mx-auto mb-3 opacity-40" />
            <p>No categories yet. Add one above.</p>
          </div>
        ) : (
          categories.map((cat, i) => {
            const count = getProductCountForCategory(cat);
            return (
              <div
                key={cat}
                className={`grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-4 ${
                  i !== categories.length - 1 ? 'border-b border-border/50' : ''
                } hover:bg-background/20 transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Tag size={14} className="text-primary" />
                  </div>
                  <span className="font-display uppercase tracking-wider text-white">{cat}</span>
                </div>
                <span className="text-right text-sm text-muted-foreground">
                  {count} product{count !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={count > 0}
                  title={count > 0 ? `${count} products use this category` : "Delete category"}
                  className={`w-8 h-8 flex items-center justify-center border transition-colors ${
                    count > 0
                      ? 'border-border text-muted-foreground/30 cursor-not-allowed'
                      : 'border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40'
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4 uppercase tracking-widest">
        Categories with active products cannot be deleted. Reassign all products first.
      </p>
    </AdminLayout>
  );
}

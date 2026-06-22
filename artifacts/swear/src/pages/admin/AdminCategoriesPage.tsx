import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getProductsAsync } from "@/hooks/useProducts";
import { ALLOWED_CATEGORIES, slugify, type Product } from "@/data/products";
import {
  getCategoriesAsync,
  saveCategory,
  saveCategoryImage,
  setCategoryActive,
  type CategoryRecord,
} from "@/lib/categoryService";
import { supabaseConfigured, uploadSupabaseStorageObject } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Tag, Upload, Link as LinkIcon, X, ImagePlus, Trash2 } from "lucide-react";

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const DEFAULT_IMAGES: Record<string, string> = {
  "T-Shirts": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop&q=80",
  "Shirts": "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop&q=80",
  "Pants": "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop&q=80",
};

function storagePathForCategory(file: File, category: CategoryRecord): string {
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `categories/${slugify(category.name)}-${id}.${extension}`;
}

interface CategoryRowProps {
  category: CategoryRecord;
  productCount: number;
  image: string;
  onFileChange: (file: File) => Promise<void>;
  onImageChange: (img: string | null) => Promise<void>;
  onSetActive: (active: boolean) => Promise<void>;
  onSortChange: (sortOrder: number) => Promise<void>;
  canDeactivate: boolean;
}

function CategoryRow({ category, productCount, image, onFileChange, onImageChange, onSetActive, onSortChange, canDeactivate }: CategoryRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortSaving, setSortSaving] = useState(false);
  const [sortDraft, setSortDraft] = useState(String(category.sortOrder || 1));
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    setSortDraft(String(category.sortOrder || 1));
  }, [category.sortOrder]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      await onFileChange(file);
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  };

  const handleUrl = async () => {
    const url = urlInput.trim();
    if (!/^https?:\/\/.+/.test(url)) {
      setUrlError("Enter a valid https:// URL");
      return;
    }
    setSaving(true);
    try {
      await onImageChange(url);
      setUrlInput("");
      setUrlError("");
      setUrlMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSortSave = async () => {
    const nextSort = Math.max(1, Math.round(Number(sortDraft) || 1));
    setSortDraft(String(nextSort));
    if (nextSort === category.sortOrder) return;
    setSortSaving(true);
    try {
      await onSortChange(nextSort);
    } finally {
      setSortSaving(false);
    }
  };

  const canToggleActive = category.active ? canDeactivate : true;

  return (
    <div className="border-b border-border/50 last:border-0 p-4 sm:p-5 hover:bg-background/20 transition-colors">
      <div className="flex items-center gap-4">
        <div
          className="relative flex-shrink-0 border border-border overflow-hidden cursor-pointer group"
          style={{ width: 64, height: 80 }}
          onClick={() => fileRef.current?.click()}
          title="Click to change photo"
        >
          {image ? (
            <>
              <img
                src={image}
                alt={category.name}
                className="w-full h-full object-cover"
                loading="lazy"
                width={64}
                height={80}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload size={16} className="text-primary" />
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-card flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ImagePlus size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
          {saving && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-primary" />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFile} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg uppercase tracking-widest text-white leading-none">{category.name}</p>
            {!category.active && (
              <span className="border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-red-400">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {productCount} product{productCount !== 1 ? "s" : ""}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort</span>
            <input
              type="number"
              min={1}
              className="h-8 w-20 bg-background border border-border px-2 text-xs text-white outline-none focus:border-primary transition-colors font-mono"
              value={sortDraft}
              onChange={event => setSortDraft(event.target.value)}
              onKeyDown={event => event.key === "Enter" && handleSortSave()}
            />
            <button
              type="button"
              onClick={handleSortSave}
              disabled={sortSaving || Number(sortDraft) === category.sortOrder}
              className="h-8 px-3 border border-border text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
            >
              {sortSaving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
            </button>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-white transition-colors uppercase tracking-widest font-bold"
            >
              <Upload size={11} /> Upload Photo
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={() => { setUrlMode(m => !m); setUrlError(""); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors uppercase tracking-widest"
            >
              <LinkIcon size={11} /> {urlMode ? "Cancel" : "Use URL"}
            </button>
            {image && (
              <>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={() => onImageChange(null)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors uppercase tracking-widest"
                >
                  <X size={11} /> Remove
                </button>
              </>
            )}
          </div>

          {urlMode && (
            <div className="mt-2 flex gap-2 max-w-sm">
              <input
                type="url"
                className="flex-1 h-8 bg-background border border-border px-3 text-xs text-white outline-none focus:border-primary transition-colors font-mono"
                placeholder="https://example.com/image.jpg"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlError(""); }}
                onKeyDown={e => e.key === "Enter" && handleUrl()}
              />
              <button
                type="button"
                onClick={handleUrl}
                className="h-8 px-3 bg-primary text-black font-display font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors"
              >
                SET
              </button>
            </div>
          )}
          {urlError && <p className="text-xs text-red-400 mt-1">{urlError}</p>}
        </div>

        <button
          onClick={() => onSetActive(!category.active)}
          disabled={!canToggleActive || saving}
          title={
            category.active && !canDeactivate
              ? `${productCount} products use this category. Reassign first.`
              : category.active
                ? "Deactivate category"
                : "Activate category"
          }
          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center border transition-colors ${
            !canToggleActive
              ? "border-border text-muted-foreground/30 cursor-not-allowed"
              : category.active
                ? "border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40"
                : "border-primary/50 text-primary hover:bg-primary hover:text-black"
          }`}
        >
          {category.active ? <Trash2 size={15} /> : <Plus size={15} />}
        </button>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        getCategoriesAsync(true, true),
        getProductsAsync({ admin: true }),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load categories.",
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
    loadData();
  }, [isAdmin, setLocation, loadData]);

  if (!isAdmin) return null;

  const getCount = (cat: string) => products.filter(product => product.category === cat).length;

  const handleAdd = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!(ALLOWED_CATEGORIES as readonly string[]).includes(trimmed)) {
      toast({ title: "Category not allowed", description: `Use only: ${ALLOWED_CATEGORIES.join(", ")}`, variant: "destructive" });
      return;
    }
    const existing = categories.find(category => category.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      toast({
        title: "Category already exists",
        description: existing.active
          ? "Edit the existing category row instead."
          : "Activate the existing category row instead.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await saveCategory({
        name: trimmed,
        active: true,
        sortOrder: (ALLOWED_CATEGORIES as readonly string[]).indexOf(trimmed) + 1,
      });
      setNewCategory("");
      await loadData();
      toast({ title: "Category saved", description: trimmed });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save category.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (category: CategoryRecord, active: boolean) => {
    const count = getCount(category.name);
    if (!active && count > 0) {
      toast({ title: "Cannot deactivate", description: `${count} product${count !== 1 ? "s" : ""} still use this category. Reassign them first.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await setCategoryActive(category.id, active);
      await loadData();
      toast({ title: active ? "Category activated" : "Category deactivated", description: category.name });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update category.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSortChange = async (category: CategoryRecord, sortOrder: number) => {
    setSaving(true);
    try {
      await saveCategory({
        id: category.id,
        name: category.name,
        coverImageUrl: category.coverImageUrl,
        active: category.active,
        sortOrder,
      });
      await loadData();
      toast({ title: "Sort updated", description: category.name });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update category sort.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (category: CategoryRecord, img: string | null) => {
    const previous = categories;
    setCategories(prev => prev.map(item =>
      item.id === category.id ? { ...item, coverImageUrl: img } : item
    ));
    try {
      const updated = await saveCategoryImage(category.id, img);
      setCategories(prev => prev.map(item => item.id === category.id ? updated : item));
      toast({ title: "Photo updated", description: category.name });
    } catch (err) {
      setCategories(previous);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update category image.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = async (category: CategoryRecord, file: File) => {
    const url = supabaseConfigured
      ? await uploadSupabaseStorageObject("product-images", storagePathForCategory(file, category), file, file.type || "image/jpeg")
      : await compressImage(file);
    await handleImageChange(category, url);
  };

  const getImage = (category: CategoryRecord) =>
    category.coverImageUrl || DEFAULT_IMAGES[category.name] || "";

  return (
    <AdminLayout>
      <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white mb-2">CATEGORIES</h1>
      <p className="text-muted-foreground text-sm mb-8 uppercase tracking-widest">
        {categories.filter(category => category.active).length} active categories
      </p>

      <div className="bg-card border border-border p-5 sm:p-6 mb-6">
        <h2 className="font-display text-lg uppercase tracking-widest text-white mb-4">ADD CATEGORY</h2>
        <div className="flex gap-3">
          <Input
            placeholder="T-Shirts, Shirts, or Pants"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="bg-background rounded-none border-border flex-1 max-w-sm"
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-6 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            ADD
          </button>
        </div>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="py-20 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="uppercase tracking-widest text-sm">Loading categories...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Tag size={32} className="mx-auto mb-3 opacity-40" />
            <p>No categories yet. Add one above.</p>
          </div>
        ) : (
          categories.map(category => (
            <CategoryRow
              key={category.id}
              category={category}
              productCount={getCount(category.name)}
              image={getImage(category)}
              onFileChange={file => handleFileChange(category, file)}
              onImageChange={img => handleImageChange(category, img)}
              onSetActive={active => handleSetActive(category, active)}
              onSortChange={sortOrder => handleSortChange(category, sortOrder)}
              canDeactivate={getCount(category.name) === 0}
            />
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4 uppercase tracking-widest">
        Only T-Shirts, Shirts, and Pants are allowed. Custom Design stays separate from product categories.
      </p>
    </AdminLayout>
  );
}

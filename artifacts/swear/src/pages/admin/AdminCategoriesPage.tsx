import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  getCategories, saveCategories, getProducts,
  getCategoryImages, saveCategoryImages,
} from "@/hooks/useProducts";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Tag, Upload, Link as LinkIcon, X, ImagePlus } from "lucide-react";

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const DEFAULT_IMAGES: Record<string, string> = {
  "T-Shirts":  "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop&q=80",
  "Shirts":    "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop&q=80",
  "Pants":     "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop&q=80",
  "Hoodies":   "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop&q=80",
};

interface CategoryRowProps {
  name: string;
  productCount: number;
  image: string;
  onImageChange: (img: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function CategoryRow({ name, productCount, image, onImageChange, onDelete, canDelete }: CategoryRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [urlError, setUrlError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      onImageChange(compressed);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUrl = () => {
    const url = urlInput.trim();
    if (!/^https?:\/\/.+/.test(url)) { setUrlError("Enter a valid https:// URL"); return; }
    onImageChange(url);
    setUrlInput("");
    setUrlError("");
    setUrlMode(false);
  };

  return (
    <div className="border-b border-border/50 last:border-0 p-4 sm:p-5 hover:bg-background/20 transition-colors">
      <div className="flex items-center gap-4">
        {/* Image thumbnail */}
        <div
          className="relative flex-shrink-0 border border-border overflow-hidden cursor-pointer group"
          style={{ width: 64, height: 80 }}
          onClick={() => fileRef.current?.click()}
          title="Click to change photo"
        >
          {image ? (
            <>
              <img src={image} alt={name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload size={16} className="text-primary" />
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-card flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ImagePlus size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFile} />
        </div>

        {/* Name + count */}
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg uppercase tracking-widest text-white leading-none">{name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {productCount} product{productCount !== 1 ? "s" : ""}
          </p>
          {/* Photo controls */}
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
                  onClick={() => onImageChange("")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors uppercase tracking-widest"
                >
                  <X size={11} /> Remove
                </button>
              </>
            )}
          </div>

          {/* URL input */}
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

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={!canDelete}
          title={!canDelete ? `${productCount} products use this category. Reassign first.` : "Delete category"}
          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center border transition-colors ${
            !canDelete
              ? "border-border text-muted-foreground/30 cursor-not-allowed"
              : "border-border text-muted-foreground hover:text-red-500 hover:border-red-500/40"
          }`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [categories, setCategories] = useState<string[]>([]);
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (!isAdmin) { setLocation("/admin/login"); return; }
    setCategories(getCategories());
    setCategoryImages(getCategoryImages());
  }, [isAdmin, setLocation]);

  if (!isAdmin) return null;

  const getCount = (cat: string) => getProducts().filter(p => p.category === cat).length;

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
    const count = getCount(cat);
    if (count > 0) {
      toast({ title: "Cannot delete", description: `${count} product${count !== 1 ? "s" : ""} still use this category. Reassign them first.`, variant: "destructive" });
      return;
    }
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    saveCategories(updated);
    // also remove its image entry
    const imgs = { ...categoryImages };
    delete imgs[cat];
    setCategoryImages(imgs);
    saveCategoryImages(imgs);
    toast({ title: "Category deleted", description: cat });
  };

  const handleImageChange = (cat: string, img: string) => {
    const updated = { ...categoryImages, [cat]: img };
    if (!img) delete updated[cat];
    setCategoryImages(updated);
    try {
      saveCategoryImages(updated);
      toast({ title: "Photo updated", description: cat });
    } catch {
      toast({ title: "Image too large", description: "Try a smaller file.", variant: "destructive" });
      // rollback
      setCategoryImages(categoryImages);
    }
  };

  const getImage = (cat: string) =>
    categoryImages[cat] || DEFAULT_IMAGES[cat] || "";

  return (
    <AdminLayout>
      <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white mb-2">CATEGORIES</h1>
      <p className="text-muted-foreground text-sm mb-8 uppercase tracking-widest">
        {categories.length} categor{categories.length !== 1 ? "ies" : "y"} — click any photo or use Upload to change it
      </p>

      {/* Add new */}
      <div className="bg-card border border-border p-5 sm:p-6 mb-6">
        <h2 className="font-display text-lg uppercase tracking-widest text-white mb-4">ADD CATEGORY</h2>
        <div className="flex gap-3">
          <Input
            placeholder="e.g. Jackets"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="bg-background rounded-none border-border flex-1 max-w-sm"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 h-10 px-6 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors"
          >
            <Plus size={16} /> ADD
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          After adding, click the photo slot next to the category to upload a cover image.
        </p>
      </div>

      {/* Category list */}
      <div className="bg-card border border-border overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Tag size={32} className="mx-auto mb-3 opacity-40" />
            <p>No categories yet. Add one above.</p>
          </div>
        ) : (
          categories.map(cat => (
            <CategoryRow
              key={cat}
              name={cat}
              productCount={getCount(cat)}
              image={getImage(cat)}
              onImageChange={img => handleImageChange(cat, img)}
              onDelete={() => handleDelete(cat)}
              canDelete={getCount(cat) === 0}
            />
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4 uppercase tracking-widest">
        Categories with active products cannot be deleted. Photo changes save instantly.
      </p>
    </AdminLayout>
  );
}

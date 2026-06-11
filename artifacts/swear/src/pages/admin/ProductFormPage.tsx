import { useAuth } from "@/context/AuthContext";
import { useLocation, useParams, Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Product } from "@/data/products";
import { getProducts, saveProducts, getCategories } from "@/hooks/useProducts";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, Link as LinkIcon, GripVertical, ImagePlus, AlertCircle } from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(1, "Price must be positive"),
  description: z.string().min(1, "Description is required"),
  sizes: z.array(z.string()).min(1, "Select at least one size"),
  colors: z.string().min(1, "At least one color is required"),
  isNew: z.boolean(),
  isBestSeller: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 900;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
          else { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
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

export default function ProductFormPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const isEdit = !!params.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      description: "",
      sizes: ["M", "L"],
      colors: "",
      isNew: false,
      isBestSeller: false,
    },
  });

  useEffect(() => {
    if (!isAdmin) { setLocation("/admin/login"); return; }
    const stored = getProducts();
    const cats = getCategories();
    setProducts(stored);
    setCategories(cats);

    if (isEdit) {
      const prod = stored.find((p: Product) => p.id === params.id);
      if (prod) {
        form.reset({
          name: prod.name,
          category: prod.category,
          price: prod.price,
          description: prod.description,
          sizes: prod.sizes,
          colors: prod.colors.join(", "),
          isNew: !!prod.isNew,
          isBestSeller: !!prod.isBestSeller,
        });
        setImages(prod.images);
      }
    } else {
      form.setValue("category", cats[0] || "");
    }
  }, [isAdmin, setLocation, isEdit, params.id, form]);

  if (!isAdmin) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setImageError("");
    try {
      const results = await Promise.all(Array.from(files).map(compressImage));
      setImages(prev => [...prev, ...results]);
    } catch {
      setImageError("Failed to process one or more images.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\/.+/.test(url)) {
      setImageError("Enter a valid http(s) URL.");
      return;
    }
    setImages(prev => [...prev, url]);
    setUrlInput("");
    setImageError("");
    setUrlMode(false);
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  const onSubmit = (data: ProductFormValues) => {
    if (images.length === 0) {
      setImageError("Add at least one product image.");
      return;
    }

    const colors = data.colors.split(",").map(s => s.trim()).filter(Boolean);
    const newProduct: Product = {
      id: isEdit ? params.id! : "prod-" + Date.now(),
      name: data.name,
      category: data.category,
      price: data.price,
      description: data.description,
      sizes: data.sizes,
      colors,
      images,
      isNew: data.isNew,
      isBestSeller: data.isBestSeller,
    };

    let updated = [...products];
    if (isEdit) {
      const idx = updated.findIndex(p => p.id === params.id);
      if (idx !== -1) updated[idx] = newProduct;
    } else {
      updated.push(newProduct);
    }

    try {
      saveProducts(updated);
    } catch {
      toast({ title: "Storage full", description: "Images are too large. Try fewer or smaller photos.", variant: "destructive" });
      return;
    }

    toast({ title: isEdit ? "Product updated" : "Product created" });
    setLocation("/admin/products");
  };

  return (
    <AdminLayout>
      <Link href="/admin/products" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors uppercase tracking-widest text-xs mb-8">
        <ArrowLeft size={16} /> BACK TO PRODUCTS
      </Link>

      <h1 className="text-3xl md:text-5xl font-display font-black uppercase text-white mb-8">
        {isEdit ? "EDIT PRODUCT" : "NEW PRODUCT"}
      </h1>

      <div className="bg-card border border-border p-4 sm:p-6 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            {/* Name + Price + Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Product Name</FormLabel>
                  <FormControl><Input className="bg-background rounded-none" placeholder="Shadow Oversize Tee" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Price (EGP)</FormLabel>
                    <FormControl><Input type="number" className="bg-background rounded-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Category</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...field}>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest">Description</FormLabel>
                <FormControl><Textarea className="bg-background rounded-none min-h-[100px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* ── Images Section ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="uppercase text-xs tracking-widest text-muted-foreground font-medium">
                  Product Images
                  <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal">
                    (first = main)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => { setUrlMode(m => !m); setImageError(""); }}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-white transition-colors uppercase tracking-widest"
                >
                  <LinkIcon size={12} />
                  {urlMode ? "Cancel URL" : "Add by URL"}
                </button>
              </div>

              {/* URL input */}
              {urlMode && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="url"
                    className="flex-1 h-10 bg-background border border-border px-3 text-sm text-white outline-none focus:border-primary transition-colors font-mono"
                    placeholder="https://example.com/image.jpg"
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setImageError(""); }}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddUrl())}
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    className="h-10 px-4 bg-primary text-black font-display font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors"
                  >
                    ADD
                  </button>
                </div>
              )}

              {/* Drop zone */}
              <div
                className={`relative border-2 border-dashed transition-colors rounded-none ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={e => handleFiles(e.target.files)}
                />

                {images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 cursor-pointer">
                    <ImagePlus size={36} className="text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-display uppercase tracking-widest text-white text-sm">Click or drag photos here</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP • Compressed automatically</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Upload size={14} className="text-primary" />
                      <span className="text-xs text-primary font-bold uppercase tracking-widest">Browse Files</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    {/* Existing images grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
                      {images.map((src, i) => (
                        <div key={i} className={`relative group border ${i === 0 ? "border-primary" : "border-border"}`}>
                          <div style={{ aspectRatio: "4/5" }}>
                            <img src={src} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                          {i === 0 && (
                            <span className="absolute top-1 left-1 bg-primary text-black text-[9px] font-black px-1 py-0.5 uppercase">MAIN</span>
                          )}
                          {/* Controls */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 pointer-events-none group-hover:pointer-events-auto">
                            <div className="flex gap-1">
                              {i > 0 && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); moveImage(i, -1); }}
                                  className="w-6 h-6 bg-white/10 hover:bg-white/30 text-white flex items-center justify-center text-xs border border-white/20"
                                  title="Move left"
                                >←</button>
                              )}
                              {i < images.length - 1 && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); moveImage(i, 1); }}
                                  className="w-6 h-6 bg-white/10 hover:bg-white/30 text-white flex items-center justify-center text-xs border border-white/20"
                                  title="Move right"
                                >→</button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); removeImage(i); }}
                              className="w-6 h-6 bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center border border-red-400/30"
                              title="Remove"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add more — click area (doesn't trigger whole zone) */}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        style={{ aspectRatio: "4/5" }}
                      >
                        <Upload size={16} />
                        <span className="text-[10px] uppercase tracking-wider font-display">Add</span>
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      {images.length} image{images.length !== 1 ? "s" : ""} • Click zone or "Add" to upload more
                    </p>
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-primary font-display uppercase tracking-widest">Processing…</p>
                    </div>
                  </div>
                )}
              </div>

              {imageError && (
                <p className="flex items-center gap-1.5 mt-2 text-xs text-red-400 font-bold">
                  <AlertCircle size={12} /> {imageError}
                </p>
              )}
            </div>

            {/* Sizes + Colors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="sizes" render={() => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest mb-3 block">Available Sizes</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_SIZES.map(size => (
                      <FormField key={size} control={form.control} name="sizes" render={({ field }) => (
                        <label className={`cursor-pointer flex items-center justify-center w-12 h-10 border text-sm font-display uppercase transition-colors ${
                          field.value?.includes(size)
                            ? "bg-primary border-primary text-black"
                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                        }`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={field.value?.includes(size)}
                            onChange={e => {
                              const current = field.value || [];
                              field.onChange(e.target.checked ? [...current, size] : current.filter(s => s !== size));
                            }}
                          />
                          {size}
                        </label>
                      )} />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="colors" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Colors (comma separated)</FormLabel>
                  <FormControl>
                    <Input className="bg-background rounded-none" placeholder="Black, White, Olive" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">e.g. Black, White, Sage</p>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Flags */}
            <div className="border border-border p-4 space-y-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Product Flags</p>
              <FormField control={form.control} name="isNew" render={({ field }) => (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => field.onChange(!field.value)}
                    className={`w-5 h-5 border flex items-center justify-center transition-colors flex-shrink-0 ${
                      field.value ? "bg-primary border-primary" : "bg-background border-border group-hover:border-primary/50"
                    }`}
                  >
                    {field.value && <span className="text-black text-xs font-black">✓</span>}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold uppercase tracking-widest">Mark as NEW</p>
                    <p className="text-xs text-muted-foreground">Shows "NEW" badge and appears in Latest Drops on homepage</p>
                  </div>
                </label>
              )} />
              <FormField control={form.control} name="isBestSeller" render={({ field }) => (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => field.onChange(!field.value)}
                    className={`w-5 h-5 border flex items-center justify-center transition-colors flex-shrink-0 ${
                      field.value ? "bg-yellow-400 border-yellow-400" : "bg-background border-border group-hover:border-yellow-400/50"
                    }`}
                  >
                    {field.value && <span className="text-black text-xs font-black">✓</span>}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold uppercase tracking-widest">Mark as BEST SELLER</p>
                    <p className="text-xs text-muted-foreground">Shows "BEST SELLER" badge and appears in Best Sellers on homepage</p>
                  </div>
                </label>
              )} />
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-4">
              <button type="submit" className="h-12 px-8 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors">
                {isEdit ? "UPDATE PRODUCT" : "SAVE PRODUCT"}
              </button>
              <Link href="/admin/products" className="flex items-center justify-center h-12 px-8 border border-border text-white font-display font-bold uppercase tracking-widest hover:bg-white/5 transition-colors">
                CANCEL
              </Link>
            </div>

          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}

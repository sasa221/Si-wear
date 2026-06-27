import { useAuth } from "@/context/AuthContext";
import { useLocation, useParams, Link } from "wouter";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  PRODUCT_SIZES,
  Product,
  ProductStatus,
  ProductVariant,
  createProductId,
  createVariantId,
  getProductColors,
  getProductSizes,
  isUuid,
  normalizeVariantOption,
  slugify,
} from "@/data/products";
import { getProductsAsync, saveProducts } from "@/hooks/useProducts";
import { getCategoryNamesAsync } from "@/lib/categoryService";
import { getSupabaseAccessToken, supabaseConfigured, uploadSupabaseStorageObject } from "@/lib/supabase";
import { apiUrl } from "@/lib/apiConfig";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, Link as LinkIcon, ImagePlus, AlertCircle, Check } from "lucide-react";
import { useFallbackImage } from "@/lib/images";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().trim().min(1, "Choose a category").refine(
    value => slugify(value) !== "custom-design",
    "Custom Design stays separate from product categories"
  ),
  price: z.coerce.number().min(1, "Price must be positive"),
  status: z.enum(["active", "draft", "archived"]),
  description: z.string().min(1, "Description is required"),
  isNew: z.boolean(),
  isBestSeller: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;
type StockMap = Record<string, number>;

function stockKey(color: string, size: string): string {
  return `${color.toLowerCase()}::${size}`;
}

function cleanColor(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function createLocalProductId(name: string): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return createProductId(`${name}-${Date.now()}`);
}

function buildSku(slug: string, color: string, size: string): string {
  return `${slug}-${slugify(color)}-${slugify(size)}`.toUpperCase();
}

async function readApiPayload(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    return { message: text };
  }
}

async function syncProductToSupabase(product: Product, previousProduct?: Product): Promise<string[]> {
  if (!supabaseConfigured) return [];

  if (!isUuid(product.id)) {
    throw new Error("Product sync needs a UUID product id. Re-save this product after migration.");
  }

  const variantRows = product.variants.map(variant => ({
    id: variant.id,
    product_id: product.id,
    size: variant.size,
    color: variant.color,
    stock: variant.stock,
    sku: variant.sku ?? buildSku(product.slug, variant.color, variant.size),
    active: variant.active,
    created_at: variant.createdAt,
  }));

  const activeVariantIds = new Set(product.variants.map(variant => variant.id));
  const removedVariantIds = previousProduct?.variants
    .filter(variant => !activeVariantIds.has(variant.id) && isUuid(variant.id))
    .map(variant => variant.id) ?? [];

  const token = getSupabaseAccessToken();
  if (!token) {
    throw new Error("Admin login is required to save products. Sign in to the admin panel again.");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl("/admin/products/sync"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          category: product.category,
          price_egp: product.price,
          description: product.description,
          images: product.images,
          status: product.status,
          is_new: !!product.isNew,
          is_best_seller: !!product.isBestSeller,
        },
        variants: variantRows,
        removedVariantIds,
      }),
    });
  } catch {
    throw new Error("Product API is not reachable. Start the API server and try again.");
  }

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : "Product sync failed."
    );
  }

  if (payload.ok !== true) {
    throw new Error("Product sync failed.");
  }

  return Array.isArray(payload.warnings)
    ? payload.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
}

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

function storagePathForFile(file: File): string {
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `products/${id}.${extension}`;
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
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["S", "M", "L"]);
  const [colors, setColors] = useState<string[]>(["Black"]);
  const [colorInput, setColorInput] = useState("");
  const [stockByVariant, setStockByVariant] = useState<StockMap>({});
  const [imageError, setImageError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "T-Shirts",
      price: 0,
      status: "active",
      description: "",
      isNew: false,
      isBestSeller: false,
    },
  });

  const existingProduct = useMemo(
    () => products.find(product => product.id === params.id),
    [params.id, products]
  );

  useEffect(() => {
    if (!isAdmin) { setLocation("/admin/login"); return; }
    let cancelled = false;

    Promise.all([getCategoryNamesAsync(true), getProductsAsync({ admin: true, includeArchived: true })])
      .then(([cats, stored]) => {
        if (cancelled) return;
        setProducts(stored);

        if (isEdit) {
          const prod = stored.find((p: Product) => p.id === params.id);
          if (prod) {
            setCategories(cats.includes(prod.category) ? cats : [prod.category, ...cats]);
            form.reset({
              name: prod.name,
              category: prod.category,
              price: prod.price,
              status: prod.status,
              description: prod.description,
              isNew: !!prod.isNew,
              isBestSeller: !!prod.isBestSeller,
            });
            setImages(prod.images);
            setSelectedSizes(getProductSizes(prod));
            setColors(getProductColors(prod));
            setStockByVariant(
              prod.variants.reduce<StockMap>((acc, variant) => {
                acc[stockKey(variant.color, variant.size)] = variant.stock;
                return acc;
              }, {})
            );
          } else {
            setCategories(cats);
          }
        } else {
          setCategories(cats);
          form.setValue("category", cats[0] || "T-Shirts");
        }
      })
      .catch(err => {
        toast({
          title: "Failed to load products",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      });

    return () => { cancelled = true; };
  }, [isAdmin, setLocation, isEdit, params.id, form]);

  if (!isAdmin) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setImageError("");
    try {
      const results = await Promise.all(
        Array.from(files).map(file => {
          if (supabaseConfigured) {
            return uploadSupabaseStorageObject(
              "product-images",
              storagePathForFile(file),
              file,
              file.type || "image/jpeg"
            );
          }
          return compressImage(file);
        })
      );
      setImages(prev => [...prev, ...results]);
    } catch (err) {
      setImageError(
        supabaseConfigured
          ? `Storage upload failed: ${err instanceof Error ? err.message : "Use Add by URL fallback."}`
          : "Failed to process one or more images."
      );
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

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => (
      prev.includes(size)
        ? prev.filter(item => item !== size)
        : [...prev, size].sort((a, b) => PRODUCT_SIZES.indexOf(a as typeof PRODUCT_SIZES[number]) - PRODUCT_SIZES.indexOf(b as typeof PRODUCT_SIZES[number]))
    ));
  };

  const addColor = () => {
    const nextColor = cleanColor(colorInput);
    if (!nextColor) return;
    if (colors.some(color => color.toLowerCase() === nextColor.toLowerCase())) {
      toast({ title: "Color already exists", variant: "destructive" });
      return;
    }
    setColors(prev => [...prev, nextColor]);
    setColorInput("");
  };

  const removeColor = (color: string) => {
    setColors(prev => prev.filter(item => item !== color));
  };

  const setStock = (color: string, size: string, value: string) => {
    const stock = Math.max(0, Number(value) || 0);
    setStockByVariant(prev => ({ ...prev, [stockKey(color, size)]: stock }));
  };

  const getStock = (color: string, size: string) => stockByVariant[stockKey(color, size)] ?? 0;

  const onSubmit = async (data: ProductFormValues) => {
    if (images.length === 0) {
      setImageError("Add at least one product image.");
      return;
    }

    if (selectedSizes.length === 0) {
      toast({ title: "Select at least one size", variant: "destructive" });
      return;
    }

    if (colors.length === 0) {
      toast({ title: "Add at least one color", variant: "destructive" });
      return;
    }

    setSaving(true);
    const productId = existingProduct?.id ?? createLocalProductId(data.name);
    const slug = existingProduct?.slug || slugify(data.name);
    const now = new Date().toISOString();

    const variants: ProductVariant[] = colors.flatMap(color =>
      selectedSizes.map(size => {
        const previousVariant = existingProduct?.variants.find(
          variant =>
            normalizeVariantOption(variant.color) === normalizeVariantOption(color) &&
            normalizeVariantOption(variant.size) === normalizeVariantOption(size)
        );
        return {
          id: previousVariant?.id || createVariantId(productId, color, size),
          productId,
          size,
          color,
          stock: getStock(color, size),
          sku: previousVariant?.sku || buildSku(slug, color, size),
          active: true,
          createdAt: previousVariant?.createdAt || now,
        };
      })
    );

    const newProduct: Product = {
      id: productId,
      name: data.name,
      slug,
      category: data.category,
      price: data.price,
      description: data.description,
      status: data.status as ProductStatus,
      variants,
      sizes: selectedSizes,
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
      let warnings: string[] = [];
      if (supabaseConfigured) {
        warnings = await syncProductToSupabase(newProduct, existingProduct);
      }
      saveProducts(updated);
      toast({
        title: isEdit ? "Product updated successfully" : "Product created successfully",
        description: warnings[0],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Images are too large or Supabase sync failed.";
      toast({
        title: isEdit ? "Failed to update product" : "Failed to create product",
        description: message,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    setSaving(false);
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

      <div className="bg-card border border-border p-4 sm:p-6 max-w-5xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest">Product Name</FormLabel>
                  <FormControl><Input className="bg-background rounded-none" placeholder="Oversized Heavy Cotton T-Shirt" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Price (EGP)</FormLabel>
                    <FormControl><Input type="number" className="bg-background rounded-none" style={{ fontSize: "16px" }} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest">Status</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ fontSize: "16px" }} {...field}>
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest">Category</FormLabel>
                <FormControl>
                  <select className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ fontSize: "16px" }} {...field}>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest">Description</FormLabel>
                <FormControl><Textarea className="bg-background rounded-none min-h-[100px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

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

              {urlMode && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="url"
                    className="flex-1 h-10 bg-background border border-border px-3 text-sm text-white outline-none focus:border-primary transition-colors font-mono"
                    placeholder="https://example.com/image.jpg"
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setImageError(""); }}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddUrl())}
                    style={{ fontSize: "16px" }}
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
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
                />

                {images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 cursor-pointer">
                    <ImagePlus size={36} className="text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-display uppercase tracking-widest text-white text-sm">Click or drag photos here</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP. Compressed automatically</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Upload size={14} className="text-primary" />
                      <span className="text-xs text-primary font-bold uppercase tracking-widest">Browse Files</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
                      {images.map((src, i) => (
                        <div key={i} className={`relative group border ${i === 0 ? "border-primary" : "border-border"}`}>
                          <div className="product-image-frame">
                            <img
                              src={src}
                              alt={`Product image ${i + 1}`}
                              className="product-image product-image--thumb"
                              loading="lazy"
                              width={160}
                              height={200}
                              onError={useFallbackImage}
                            />
                          </div>
                          {i === 0 && (
                            <span className="absolute top-1 left-1 bg-primary text-black text-[9px] font-black px-1 py-0.5 uppercase">MAIN</span>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 pointer-events-none group-hover:pointer-events-auto">
                            <div className="flex gap-1">
                              {i > 0 && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); moveImage(i, -1); }}
                                  className="w-6 h-6 bg-white/10 hover:bg-white/30 text-white flex items-center justify-center text-xs border border-white/20"
                                  title="Move left"
                                >
                                  {"<"}
                                </button>
                              )}
                              {i < images.length - 1 && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); moveImage(i, 1); }}
                                  className="w-6 h-6 bg-white/10 hover:bg-white/30 text-white flex items-center justify-center text-xs border border-white/20"
                                  title="Move right"
                                >
                                  {">"}
                                </button>
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
                      {images.length} image{images.length !== 1 ? "s" : ""}. Click zone or Add to upload more
                    </p>
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-primary font-display uppercase tracking-widest">Processing...</p>
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

            <div className="border border-border p-4 sm:p-5 space-y-5 bg-background/30">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg uppercase tracking-widest text-white">Variant Inventory</h2>
                  <p className="text-xs text-muted-foreground mt-1">Pick sizes, add colors, then set stock for each size/color combo.</p>
                </div>
                <span className="text-xs uppercase tracking-widest text-primary">
                  Total stock: {colors.reduce((sum, color) => sum + selectedSizes.reduce((inner, size) => inner + getStock(color, size), 0), 0)}
                </span>
              </div>

              <div>
                <p className="uppercase text-xs tracking-widest text-muted-foreground font-medium mb-2">Available Sizes</p>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_SIZES.map(size => (
                    <button
                      type="button"
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`h-10 px-4 border font-display uppercase text-sm font-bold transition-colors ${
                        selectedSizes.includes(size)
                          ? "bg-primary border-primary text-black"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-white"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="uppercase text-xs tracking-widest text-muted-foreground font-medium mb-2">Colors</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <Input
                    value={colorInput}
                    onChange={e => setColorInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addColor())}
                    className="bg-background rounded-none border-border"
                    placeholder="Black, White, Olive..."
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={addColor}
                    className="h-10 px-5 bg-primary text-black font-display font-bold uppercase tracking-widest text-xs hover:bg-white transition-colors"
                  >
                    Add Color
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {colors.map(color => (
                    <span key={color} className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-widest text-white">
                      {color}
                      <button type="button" onClick={() => removeColor(color)} className="text-muted-foreground hover:text-red-400">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {colors.length > 0 && selectedSizes.length > 0 ? (
                <div className="overflow-x-auto border border-border">
                  <table className="w-full min-w-[520px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-card text-xs uppercase tracking-widest text-muted-foreground">
                        <th className="py-3 px-3 font-normal">Color</th>
                        {selectedSizes.map(size => (
                          <th key={size} className="py-3 px-3 font-normal text-center">{size}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map(color => (
                        <tr key={color} className="border-b border-border/50 last:border-0">
                          <td className="py-3 px-3 text-white font-display uppercase tracking-widest text-xs">{color}</td>
                          {selectedSizes.map(size => (
                            <td key={`${color}-${size}`} className="py-2 px-2">
                              <input
                                type="number"
                                min="0"
                                value={getStock(color, size)}
                                onChange={e => setStock(color, size, e.target.value)}
                                className="h-10 w-20 mx-auto block bg-background border border-border px-2 text-center text-white outline-none focus:border-primary"
                                style={{ fontSize: "16px" }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-primary/40 bg-primary/10 px-4 py-3 text-xs uppercase tracking-widest text-primary">
                  Add at least one color and one size to build the stock matrix.
                </div>
              )}
            </div>

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
                    {field.value && <Check size={13} className="text-black" />}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold uppercase tracking-widest">Mark as NEW</p>
                    <p className="text-xs text-muted-foreground">Shows NEW badge and appears in Latest Drops on homepage</p>
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
                    {field.value && <Check size={13} className="text-black" />}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold uppercase tracking-widest">Mark as BEST SELLER</p>
                    <p className="text-xs text-muted-foreground">Shows BEST SELLER badge and appears in Best Sellers on homepage</p>
                  </div>
                </label>
              )} />
            </div>

            <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={saving}
                className="h-12 px-8 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "SAVING..." : isEdit ? "UPDATE PRODUCT" : "SAVE PRODUCT"}
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

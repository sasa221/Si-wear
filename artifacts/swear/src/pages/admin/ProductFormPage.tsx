import { useAuth } from "@/context/AuthContext";
import { useLocation, useParams, Link } from "wouter";
import { useEffect, useState } from "react";
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
import { ArrowLeft } from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(1, "Price must be positive"),
  description: z.string().min(1, "Description is required"),
  imageUrls: z.string().min(1, "At least one image URL is required"),
  sizes: z.array(z.string()).min(1, "Select at least one size"),
  colors: z.string().min(1, "At least one color is required"),
  isNew: z.boolean(),
  isBestSeller: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

export default function ProductFormPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const isEdit = !!params.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      description: "",
      imageUrls: "",
      sizes: ["M", "L"],
      colors: "",
      isNew: false,
      isBestSeller: false,
    },
  });

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }

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
          imageUrls: prod.images.join("\n"),
          sizes: prod.sizes,
          colors: prod.colors.join(", "),
          isNew: !!prod.isNew,
          isBestSeller: !!prod.isBestSeller,
        });
      }
    } else {
      form.setValue("category", cats[0] || "");
    }
  }, [isAdmin, setLocation, isEdit, params.id, form]);

  if (!isAdmin) return null;

  const onSubmit = (data: ProductFormValues) => {
    const images = data.imageUrls.split("\n").map(s => s.trim()).filter(Boolean);
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

    saveProducts(updated);
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

      <div className="bg-card border border-border p-6 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                      <select
                        className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...field}
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest">Description</FormLabel>
                <FormControl><Textarea className="bg-background rounded-none min-h-[100px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="imageUrls" render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs tracking-widest">Image URLs (one per line)</FormLabel>
                <FormControl>
                  <Textarea
                    className="bg-background rounded-none min-h-[100px] font-mono text-xs"
                    placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.jpg"}
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">First URL is the main product image.</p>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="sizes" render={() => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest mb-3 block">Available Sizes</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_SIZES.map(size => (
                      <FormField key={size} control={form.control} name="sizes" render={({ field }) => (
                        <label className={`cursor-pointer flex items-center justify-center w-12 h-10 border text-sm font-display uppercase transition-colors ${
                          field.value?.includes(size)
                            ? 'bg-primary border-primary text-black'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                        }`}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={field.value?.includes(size)}
                            onChange={e => {
                              const current = field.value || [];
                              field.onChange(
                                e.target.checked ? [...current, size] : current.filter(s => s !== size)
                              );
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
                      field.value ? 'bg-primary border-primary' : 'bg-background border-border group-hover:border-primary/50'
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
                      field.value ? 'bg-yellow-400 border-yellow-400' : 'bg-background border-border group-hover:border-yellow-400/50'
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

            <div className="pt-6 border-t border-border flex gap-4">
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

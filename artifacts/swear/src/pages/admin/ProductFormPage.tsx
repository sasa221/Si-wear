import { useAuth } from "@/context/AuthContext";
import { useLocation, useParams, Link } from "wouter";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Product } from "@/data/products";
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
  category: z.enum(['T-Shirts', 'Shirts', 'Pants', 'Custom Design']),
  price: z.coerce.number().min(1, "Price must be positive"),
  description: z.string().min(1, "Description is required"),
  imageUrls: z.string().min(1, "At least one image URL is required"),
  sizes: z.array(z.string()).min(1, "Select at least one size"),
  colors: z.string().min(1, "At least one color is required"),
  status: z.enum(['Active', 'Draft'])
});

type ProductFormValues = z.infer<typeof productSchema>;

const AVAILABLE_SIZES = ["S", "M", "L", "XL", "2XL", "XXL"];

export default function ProductFormPage() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const isEdit = !!params.id;
  const [products, setProducts] = useState<Product[]>([]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "T-Shirts",
      price: 0,
      description: "",
      imageUrls: "",
      sizes: ["M", "L"],
      colors: "Black",
      status: "Active"
    }
  });

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }
    const stored = JSON.parse(localStorage.getItem("swear_products") || "[]");
    setProducts(stored);
    
    if (isEdit && stored.length > 0) {
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
          status: "Active"
        });
      }
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
      images
    };

    let updatedProducts = [...products];
    if (isEdit) {
      const idx = updatedProducts.findIndex(p => p.id === params.id);
      if (idx !== -1) updatedProducts[idx] = newProduct;
    } else {
      updatedProducts.push(newProduct);
    }

    localStorage.setItem("swear_products", JSON.stringify(updatedProducts));
    toast({ title: "Success", description: "Product saved successfully" });
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
                  <FormControl><Input className="bg-background rounded-none" {...field} /></FormControl>
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
                      <select className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" {...field}>
                        <option value="T-Shirts">T-Shirts</option>
                        <option value="Shirts">Shirts</option>
                        <option value="Pants">Pants</option>
                        <option value="Custom Design">Custom Design</option>
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
                <FormLabel className="uppercase text-xs tracking-widest">Image URLs (One per line)</FormLabel>
                <FormControl><Textarea className="bg-background rounded-none min-h-[120px]" placeholder="https://..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="sizes" render={() => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-widest mb-3 block">Sizes</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_SIZES.map(size => (
                      <FormField key={size} control={form.control} name="sizes" render={({ field }) => (
                        <label className={`cursor-pointer flex items-center justify-center w-12 h-10 border text-sm font-display uppercase transition-colors ${
                          field.value?.includes(size) ? 'bg-primary border-primary text-black' : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                        }`}>
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={field.value?.includes(size)}
                            onChange={(e) => {
                              const current = field.value || [];
                              const updated = e.target.checked ? [...current, size] : current.filter(s => s !== size);
                              field.onChange(updated);
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
                  <FormLabel className="uppercase text-xs tracking-widest">Colors (Comma separated)</FormLabel>
                  <FormControl><Input className="bg-background rounded-none" placeholder="Black, White, Olive" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="uppercase text-xs tracking-widest">Status</FormLabel>
                <FormControl>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value="Active" checked={field.value === "Active"} onChange={field.onChange} className="text-primary focus:ring-primary bg-background border-border" />
                      <span className="text-sm">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value="Draft" checked={field.value === "Draft"} onChange={field.onChange} className="text-primary focus:ring-primary bg-background border-border" />
                      <span className="text-sm">Draft</span>
                    </label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="pt-6 border-t border-border flex gap-4">
              <button type="submit" className="h-12 px-8 bg-primary text-black font-display font-bold uppercase tracking-widest hover:bg-white transition-colors">
                SAVE PRODUCT
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

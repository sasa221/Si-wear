import { Product } from "@/data/products";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
  cols?: "1" | "2" | "3";
}

export function ProductGrid({ products, emptyMessage = "No products found.", cols = "3" }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="w-full py-12 flex items-center justify-center text-muted-foreground">
        <p className="uppercase tracking-widest text-sm">{emptyMessage}</p>
      </div>
    );
  }

  const gridClass =
    cols === "1"
      ? "grid grid-cols-1 gap-4 sm:gap-6"
      : cols === "2"
      ? "grid grid-cols-2 gap-3 sm:gap-6"
      : "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6";

  return (
    <div className={gridClass} data-testid="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

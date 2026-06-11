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
      <div className="w-full py-16 flex items-center justify-center text-zinc-600">
        <p className="uppercase tracking-widest text-xs">{emptyMessage}</p>
      </div>
    );
  }

  const gridClass =
    cols === "1"
      ? "grid grid-cols-1 gap-3 sm:gap-4"
      : cols === "2"
      ? "grid grid-cols-2 gap-3 sm:gap-4"
      : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4";

  return (
    <div className={gridClass} data-testid="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

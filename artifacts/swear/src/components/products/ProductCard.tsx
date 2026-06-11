import { Link } from "wouter";
import { Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/shop/${product.id}`}
      className="group block relative w-full overflow-hidden border border-border hover:border-primary transition-colors duration-300 bg-card"
      data-testid={`card-product-${product.id}`}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/5" }}>
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="bg-primary text-black font-display uppercase tracking-wide text-[10px] font-bold px-2 py-0.5">
              NEW
            </span>
          )}
          {product.isBestSeller && (
            <span className="bg-black/70 text-white font-display uppercase tracking-wide text-[10px] font-bold px-2 py-0.5 border border-white/30">
              BEST SELLER
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 sm:p-4 bg-card">
        <h3 className="font-display text-sm sm:text-base md:text-lg uppercase tracking-wider text-white truncate leading-tight">
          {product.name}
        </h3>
        <p className="text-white font-bold mt-1 text-sm sm:text-base">{product.price} EGP</p>
        <div className="mt-3 w-full h-9 sm:h-10 bg-primary text-black font-display font-bold uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center hover:bg-white transition-colors">
          VIEW PRODUCT
        </div>
      </div>
    </Link>
  );
}

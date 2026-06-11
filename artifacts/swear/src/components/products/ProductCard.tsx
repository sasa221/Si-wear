import { Link } from "wouter";
import { Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/shop/${product.id}`}
      className="group block relative w-full overflow-hidden bg-[#111] hover:bg-[#161616] transition-colors duration-300"
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
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isNew && (
            <span className="bg-[#39FF14] text-black font-display uppercase tracking-wide text-[9px] font-bold px-1.5 py-0.5">
              NEW
            </span>
          )}
          {product.isBestSeller && (
            <span className="bg-black/80 text-white font-display uppercase tracking-wide text-[9px] font-bold px-1.5 py-0.5 border border-white/20">
              BEST SELLER
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 sm:p-3">
        <h3 className="font-display text-[11px] sm:text-xs md:text-sm uppercase tracking-wider text-white truncate leading-tight">
          {product.name}
        </h3>
        <p className="text-white font-bold mt-0.5 text-xs sm:text-sm">{product.price} EGP</p>
        <div className="mt-2 w-full py-1.5 bg-[#39FF14] text-black font-display font-bold uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center group-hover:bg-white transition-colors">
          View Product
        </div>
      </div>
    </Link>
  );
}

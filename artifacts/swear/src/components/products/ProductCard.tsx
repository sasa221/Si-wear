import { Link } from "wouter";
import { Product, getInventoryStatus, getStockLabel } from "@/data/products";
import { getProductImage, useFallbackImage } from "@/lib/images";

export function ProductCard({ product }: { product: Product }) {
  const inventoryStatus = getInventoryStatus(product);
  const isOutOfStock = inventoryStatus === "out_of_stock";

  return (
    <Link
      href={`/shop/${product.slug || product.id}`}
      className="group block relative w-full overflow-hidden bg-[#111] hover:bg-[#161616] transition-colors duration-300"
      data-testid={`card-product-${product.id}`}
    >
      {/* Image */}
      <div className="product-image-frame relative">
        <img
          src={getProductImage(product.images)}
          alt={product.name}
          className="product-image"
          loading="lazy"
          width={480}
          height={600}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          onError={useFallbackImage}
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
          {(inventoryStatus === "low_stock" || isOutOfStock) && (
            <span className={`${isOutOfStock ? "bg-red-500 text-white" : "bg-yellow-400 text-black"} font-display uppercase tracking-wide text-[9px] font-bold px-1.5 py-0.5`}>
              {getStockLabel(product)}
            </span>
          )}
        </div>
        {isOutOfStock && <div className="absolute inset-0 bg-black/50" />}
      </div>

      {/* Info */}
      <div className="p-2.5 sm:p-3">
        <h3 className="font-display text-[11px] sm:text-xs md:text-sm uppercase tracking-wider text-white truncate leading-tight">
          {product.name}
        </h3>
        <p className="text-white font-bold mt-0.5 text-xs sm:text-sm">{product.price} EGP</p>
        <div className={`mt-2 w-full py-1.5 font-display font-bold uppercase tracking-widest text-[10px] sm:text-xs flex items-center justify-center transition-colors ${
          isOutOfStock
            ? "bg-zinc-800 text-zinc-400"
            : "bg-[#39FF14] text-black group-hover:bg-white"
        }`}>
          {isOutOfStock ? "Out of Stock" : "View Product"}
        </div>
      </div>
    </Link>
  );
}

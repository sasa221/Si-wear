import { Link } from "wouter";
import { Product } from "@/data/products";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/shop/${product.id}`} className="group block relative w-full overflow-hidden border border-transparent hover:border-primary transition-colors duration-300 bg-card rounded-none" data-testid={`card-product-${product.id}`}>
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        <div className="absolute top-2 left-2 flex flex-col gap-2">
          {product.isNew && (
            <Badge className="bg-primary text-primary-foreground hover:bg-primary font-display uppercase tracking-wide text-xs rounded-none">
              NEW
            </Badge>
          )}
          {product.isBestSeller && (
            <Badge variant="outline" className="text-white border-white bg-black/50 backdrop-blur-sm font-display uppercase tracking-wide text-xs rounded-none">
              BEST SELLER
            </Badge>
          )}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="w-full bg-primary text-primary-foreground font-display uppercase text-center py-2 font-bold tracking-widest cursor-pointer hover:bg-white transition-colors">
            QUICK ADD
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-card">
        <h3 className="font-display text-xl uppercase tracking-wider text-white truncate">{product.name}</h3>
        <p className="text-muted-foreground mt-1">{product.price} EGP</p>
      </div>
    </Link>
  );
}

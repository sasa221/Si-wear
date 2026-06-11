import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { getProducts } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Minus, Plus, ChevronLeft } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { ProductGrid } from "@/components/products/ProductGrid";

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const allProducts = getProducts();
  const product = allProducts.find(p => p.id === id);
  const relatedProducts = allProducts
    .filter(p => p.category === product?.category && p.id !== product?.id)
    .slice(0, 3);

  const [mainImage, setMainImage] = useState(product?.images[0] || "");
  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] || "");
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] || "");
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-display uppercase text-white mb-4">Product Not Found</h1>
        <Link href="/shop" className="text-primary hover:underline uppercase tracking-widest text-sm">Return to Shop</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!user) {
      setLocation(`/login?redirect=/shop/${product.id}`);
      return;
    }
    addItem({ product, selectedSize, selectedColor, quantity });
    toast({
      title: "ADDED TO CART",
      description: `${quantity}x ${product.name} (${selectedSize}, ${selectedColor})`,
      className: "bg-primary text-black border-none rounded-none font-display uppercase tracking-wider",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-[1280px] mx-auto px-4 py-6 md:py-12"
    >
      {/* Back link */}
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-white transition-colors uppercase tracking-widest text-xs mb-6">
        <ChevronLeft size={14} /> SHOP
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 mb-16 md:mb-24">
        {/* ── Images ── */}
        <div className="flex flex-col gap-3">
          {/* Main image */}
          <div className="w-full bg-card border border-border overflow-hidden" style={{ aspectRatio: "4/5" }}>
            <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {/* Thumbnails */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setMainImage(img)}
                className={`border overflow-hidden ${mainImage === img ? "border-primary" : "border-border"}`}
                style={{ aspectRatio: "4/5" }}
              >
                <img src={img} alt={`${product.name} view ${i + 1}`} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        {/* ── Product Info ── */}
        <div className="flex flex-col">
          <span className="text-primary font-display uppercase tracking-widest text-xs sm:text-sm mb-1">{product.category}</span>
          <h1
            className="font-display font-black uppercase text-white leading-none mb-3"
            style={{ fontSize: "clamp(1.8rem, 6vw, 4rem)" }}
          >
            {product.name}
          </h1>

          <div className="flex items-center gap-2 mb-4">
            <p className="text-xl sm:text-2xl text-white font-bold">{product.price} EGP</p>
            {product.isNew && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[10px] uppercase tracking-widest font-bold font-display">NEW</span>
            )}
            {product.isBestSeller && (
              <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] uppercase tracking-widest font-bold font-display">BEST SELLER</span>
            )}
          </div>

          <p className="text-muted-foreground text-sm sm:text-base mb-6 leading-relaxed">{product.description}</p>

          {/* Size */}
          <div className="mb-5">
            <h3 className="font-display uppercase tracking-widest text-white text-sm mb-2">SIZE</h3>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`h-10 sm:h-11 px-4 sm:px-5 font-display uppercase tracking-widest font-bold transition-colors text-sm ${
                    selectedSize === size
                      ? "bg-primary text-black"
                      : "bg-transparent border border-border text-white hover:border-white"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="mb-6">
            <h3 className="font-display uppercase tracking-widest text-white text-sm mb-2">COLOR</h3>
            <div className="flex flex-wrap gap-2">
              {product.colors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`h-10 sm:h-11 px-3 sm:px-4 font-display uppercase tracking-widest font-bold transition-colors text-xs sm:text-sm ${
                    selectedColor === color
                      ? "bg-primary text-black"
                      : "bg-transparent border border-border text-white hover:border-white"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-3 mb-5">
            <span className="font-display uppercase tracking-widest text-white text-sm">QTY</span>
            <div className="flex items-center border border-border h-11">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 h-full text-white hover:text-primary transition-colors">
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-white text-sm">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 h-full text-white hover:text-primary transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAddToCart}
            className="w-full h-13 sm:h-14 bg-primary text-black font-display uppercase font-black tracking-widest text-base sm:text-lg hover:bg-white transition-colors mb-3"
            style={{ minHeight: "52px" }}
          >
            {user ? "ADD TO CART" : "SIGN IN TO ORDER"}
          </motion.button>

          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-6">
            Cash on Delivery only —{" "}
            <Link href="/contact" className="text-primary hover:text-white transition-colors">
              Questions? Contact us
            </Link>
          </p>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="size-guide" className="border-border">
              <AccordionTrigger className="font-display uppercase tracking-widest text-white hover:text-primary transition-colors text-sm">
                Size Guide
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">
                Check our <Link href="/size-chart" className="text-primary hover:underline">Size Chart</Link> for detailed measurements.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="shipping" className="border-border">
              <AccordionTrigger className="font-display uppercase tracking-widest text-white hover:text-primary transition-colors text-sm">
                Shipping & Returns
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm">
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>3–7 business days across Egypt</li>
                  <li>Cash on Delivery available everywhere</li>
                  <li>Flat 60 EGP delivery to all governorates</li>
                  <li>7-day exchange policy</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Related */}
      {relatedProducts.length > 0 && (
        <div>
          <h2
            className="font-display uppercase font-bold text-white mb-6 md:mb-8 border-t border-border pt-10 md:pt-12"
            style={{ fontSize: "clamp(1.6rem, 5vw, 2.5rem)" }}
          >
            RELATED DROPS
          </h2>
          <ProductGrid products={relatedProducts} />
        </div>
      )}
    </motion.div>
  );
}

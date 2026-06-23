import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { getProductsAsync } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Minus, Plus, ChevronLeft, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { ProductGrid } from "@/components/products/ProductGrid";
import { findVariant, getActiveVariants, getSizesForColor, type Product } from "@/data/products";
import { getProductImage, useFallbackImage } from "@/lib/images";

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mainImage, setMainImage] = useState(getProductImage(undefined));
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getProductsAsync({ activeOnly: true })
      .then(products => {
        if (cancelled) return;
        const found = products.find(item => item.id === id || item.slug === id) ?? null;
        setProduct(found);
        setRelatedProducts(
          found
            ? products
                .filter(item =>
                  item.id !== found.id &&
                  item.category === found.category
                )
                .slice(0, 3)
            : []
        );
      })
      .catch(err => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load product.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const colorOptions = useMemo(() => {
    if (!product) return [];
    return [...new Set(getActiveVariants(product).map(variant => variant.color))];
  }, [product]);

  const sizeVariants = useMemo(() => {
    if (!product || !selectedColor) return [];
    return getSizesForColor(product, selectedColor);
  }, [product, selectedColor]);

  const selectedVariant = product ? findVariant(product, selectedSize, selectedColor) : undefined;
  const selectedStock = selectedVariant?.stock ?? 0;
  const stockLabel = selectedStock <= 0
    ? "Out of stock"
    : selectedStock <= 3
      ? `Low stock - ${selectedStock} left`
      : "In stock";

  useEffect(() => {
    if (product) {
      setMainImage(getProductImage(product.images));
      setSelectedColor(product.colors[0] || "");
      setSelectedSize(product.sizes[0] || "");
      setQuantity(1);
    }
  }, [product?.id]);

  useEffect(() => {
    if (!product || colorOptions.length === 0) return;
    if (!selectedColor || !colorOptions.includes(selectedColor)) {
      setSelectedColor(colorOptions[0]);
    }
  }, [colorOptions, product, selectedColor]);

  useEffect(() => {
    if (!product || !selectedColor || sizeVariants.length === 0) return;
    const current = sizeVariants.find(variant => variant.size === selectedSize);
    if (!current || current.stock <= 0) {
      const next = sizeVariants.find(variant => variant.stock > 0) ?? sizeVariants[0];
      setSelectedSize(next.size);
      setQuantity(1);
    }
  }, [product, selectedColor, selectedSize, sizeVariants]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-24 flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
        <span className="uppercase tracking-widest text-sm">Loading product...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-display uppercase text-white mb-4">Product Error</h1>
        <p className="text-red-400 mb-6">{loadError}</p>
        <Link href="/shop" className="text-primary hover:underline uppercase tracking-widest text-sm">Return to Shop</Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-display uppercase text-white mb-4">Product Not Found</h1>
        <Link href="/shop" className="text-primary hover:underline uppercase tracking-widest text-sm">Return to Shop</Link>
      </div>
    );
  }

  const hasSizes = sizeVariants.length > 0;
  const hasColors = colorOptions.length > 0;
  const canOrder = hasSizes && hasColors && !!selectedVariant && selectedStock > 0;
  const unavailableMessage = !hasSizes || !hasColors
    ? "This product needs size and color options before customers can order it."
    : "Selected size and color is out of stock.";

  const handleAddToCart = () => {
    if (!user) {
      setLocation(`/login?redirect=/shop/${product.slug || product.id}`);
      return;
    }
    if (!canOrder || !selectedVariant) {
      toast({
        title: "CAN'T ADD TO CART",
        description: selectedVariant && selectedStock <= 0
          ? "This size and color is out of stock."
          : "This product is missing size or color options. Please contact S! Wear.",
        variant: "destructive",
      });
      return;
    }
    addItem({
      product,
      productId: product.id,
      variantId: selectedVariant.id,
      productName: product.name,
      selectedSize,
      selectedColor,
      price: product.price,
      quantity: Math.min(quantity, selectedStock),
      image: getProductImage(product.images),
    });
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
            <img
              src={mainImage}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="eager"
              width={800}
              height={1000}
              onError={useFallbackImage}
            />
          </div>
          {/* Thumbnails */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {(product.images.length > 0 ? product.images : [getProductImage(product.images)]).map((img, i) => (
              <button
                key={i}
                onClick={() => setMainImage(img)}
                className={`border overflow-hidden ${mainImage === img ? "border-primary" : "border-border"}`}
                style={{ aspectRatio: "4/5" }}
              >
                <img
                  src={img}
                  alt={`${product.name} view ${i + 1}`}
                  className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                  loading="lazy"
                  width={240}
                  height={300}
                  onError={useFallbackImage}
                />
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
            {hasSizes ? (
              <div className="flex flex-wrap gap-2">
                {sizeVariants.map(variant => (
                  <button
                    key={variant.id}
                    onClick={() => variant.stock > 0 && setSelectedSize(variant.size)}
                    disabled={variant.stock <= 0}
                    title={variant.stock <= 0 ? "Out of stock" : `${variant.stock} in stock`}
                    className={`h-10 sm:h-11 px-4 sm:px-5 font-display uppercase tracking-widest font-bold transition-colors text-sm ${
                      selectedSize === variant.size
                        ? "bg-primary text-black"
                        : "bg-transparent border border-border text-white hover:border-white"
                    } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border`}
                  >
                    {variant.size}
                  </button>
                ))}
              </div>
            ) : (
              <p className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs uppercase tracking-widest text-red-400">
                No sizes configured
              </p>
            )}
          </div>

          {/* Color */}
          <div className="mb-6">
            <h3 className="font-display uppercase tracking-widest text-white text-sm mb-2">COLOR</h3>
            {hasColors ? (
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    onClick={() => { setSelectedColor(color); setQuantity(1); }}
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
            ) : (
              <p className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs uppercase tracking-widest text-red-400">
                No colors configured
              </p>
            )}
          </div>

          {!canOrder && (
            <div className="mb-5 border border-primary/40 bg-primary/10 px-4 py-3 text-xs uppercase tracking-widest text-primary">
              {unavailableMessage}
            </div>
          )}

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-3 mb-5">
            <span className="font-display uppercase tracking-widest text-white text-sm">QTY</span>
            <div className="flex items-center border border-border h-11">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 h-full text-white hover:text-primary transition-colors">
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-white text-sm">{quantity}</span>
              <button onClick={() => setQuantity(Math.min(selectedStock || 1, quantity + 1))} className="px-4 h-full text-white hover:text-primary transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <span className={`text-xs uppercase tracking-widest ${selectedStock <= 0 ? "text-red-400" : selectedStock <= 3 ? "text-yellow-400" : "text-primary"}`}>
              {stockLabel}
            </span>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAddToCart}
            disabled={!!user && !canOrder}
            className="w-full h-13 sm:h-14 bg-primary text-black font-display uppercase font-black tracking-widest text-base sm:text-lg hover:bg-white transition-colors mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "52px" }}
          >
            {!user ? "SIGN IN TO ORDER" : canOrder ? "ADD TO CART" : "UNAVAILABLE"}
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
                  <li>Delivery fee is calculated by governorate and city/area at checkout</li>
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

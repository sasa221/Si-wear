import { useState } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { products } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { ProductGrid } from "@/components/products/ProductGrid";

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { toast } = useToast();
  
  const product = products.find(p => p.id === id);
  const relatedProducts = products.filter(p => p.category === product?.category && p.id !== product?.id).slice(0, 3);
  
  const [mainImage, setMainImage] = useState(product?.images[0] || "");
  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] || "");
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] || "");
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h1 className="text-4xl font-display uppercase text-white mb-4">Product Not Found</h1>
        <Link href="/shop" className="text-primary hover:underline">Return to Shop</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem({
      product,
      selectedSize,
      selectedColor,
      quantity
    });
    toast({
      title: "ADDED TO CART",
      description: `${quantity}x ${product.name} (${selectedSize}, ${selectedColor})`,
      className: "bg-primary text-black border-none rounded-none font-display uppercase tracking-wider",
    });
  };

  const handleWhatsAppOrder = () => {
    const total = product.price * quantity;
    const message = `Hello! I'd like to order: ${product.name}, Size: ${selectedSize}, Color: ${selectedColor}, Qty: ${quantity}, Price: ${total} EGP`;
    window.open(`https://wa.me/201220172714?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-12"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
        {/* Left: Images */}
        <div className="flex flex-col gap-4">
          <div className="aspect-[3/4] w-full bg-card border border-border">
            <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {product.images.map((img, i) => (
              <button 
                key={i} 
                onClick={() => setMainImage(img)}
                className={`aspect-[3/4] border ${mainImage === img ? 'border-primary' : 'border-border'}`}
              >
                <img src={img} alt={`${product.name} view ${i+1}`} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div className="flex flex-col">
          <span className="text-primary font-display uppercase tracking-widest text-sm mb-2">{product.category}</span>
          <h1 className="text-5xl md:text-6xl font-display font-black uppercase text-white mb-4 leading-none">{product.name}</h1>
          <p className="text-3xl text-white mb-8">{product.price} EGP</p>
          
          <p className="text-muted-foreground mb-8">{product.description}</p>
          
          <div className="mb-6">
            <h3 className="font-display uppercase tracking-widest text-white mb-3">SIZE</h3>
            <div className="flex flex-wrap gap-3">
              {product.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`h-12 px-6 font-display uppercase tracking-widest font-bold transition-colors ${selectedSize === size ? 'bg-primary text-black' : 'bg-transparent border border-border text-white hover:border-white'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="font-display uppercase tracking-widest text-white mb-3">COLOR</h3>
            <div className="flex flex-wrap gap-3">
              {product.colors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`h-12 px-6 font-display uppercase tracking-widest font-bold transition-colors ${selectedColor === color ? 'bg-primary text-black' : 'bg-transparent border border-border text-white hover:border-white'}`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-8 flex items-center gap-4">
            <h3 className="font-display uppercase tracking-widest text-white">QTY</h3>
            <div className="flex items-center border border-border h-12">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 text-white hover:text-primary transition-colors">
                <Minus size={16} />
              </button>
              <span className="w-10 text-center text-white">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 text-white hover:text-primary transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 mb-12">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAddToCart}
              className="w-full h-14 bg-primary text-black font-display uppercase font-black tracking-widest text-lg hover:bg-white transition-colors"
            >
              ADD TO CART
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleWhatsAppOrder}
              className="w-full h-14 bg-transparent border-2 border-white text-white font-display uppercase font-black tracking-widest text-lg hover:bg-white hover:text-black transition-colors"
            >
              ORDER VIA WHATSAPP
            </motion.button>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="size-guide" className="border-border">
              <AccordionTrigger className="font-display uppercase tracking-widest text-white hover:text-primary transition-colors">Size Guide</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Please check our <Link href="/size-chart" className="text-primary hover:underline">Size Chart</Link> for detailed measurements.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="shipping" className="border-border">
              <AccordionTrigger className="font-display uppercase tracking-widest text-white hover:text-primary transition-colors">Shipping & Returns</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <ul className="list-disc pl-5 space-y-2">
                  <li>3-7 business days delivery</li>
                  <li>Cash on Delivery available everywhere in Egypt</li>
                  <li>Free shipping for 2+ items</li>
                  <li>7-day exchange policy</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div>
          <h2 className="text-4xl font-display uppercase font-bold text-white mb-8 border-t border-border pt-12">RELATED DROPS</h2>
          <ProductGrid products={relatedProducts} />
        </div>
      )}
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { Link } from "wouter";
import { useCart } from "@/context/CartContext";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice } = useCart();
  
  const isFreeShipping = items.reduce((acc, item) => acc + item.quantity, 0) >= 2;
  const deliveryFee = isFreeShipping ? 0 : 60;
  const finalTotal = totalPrice + deliveryFee;

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="container mx-auto px-4 py-32 flex flex-col items-center justify-center min-h-[60vh]"
      >
        <ShoppingBag size={64} className="text-border mb-6" />
        <h1 className="text-4xl font-display uppercase text-white mb-4 text-center">Your Cart is Empty</h1>
        <p className="text-muted-foreground mb-8 text-center max-w-md">Looks like you haven't added anything to your cart yet.</p>
        <Link href="/shop" className="inline-flex h-14 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-10 hover:bg-white transition-colors">
          SHOP NOW
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-12"
    >
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-12">CART</h1>
      
      <div className="flex flex-col lg:flex-row gap-12">
        <div className="flex-1">
          <div className="border-b border-border pb-4 mb-6 hidden md:grid grid-cols-12 gap-4">
            <div className="col-span-6 font-display uppercase tracking-widest text-muted-foreground">Product</div>
            <div className="col-span-3 font-display uppercase tracking-widest text-muted-foreground text-center">Quantity</div>
            <div className="col-span-3 font-display uppercase tracking-widest text-muted-foreground text-right">Total</div>
          </div>
          
          <div className="space-y-6">
            {items.map((item, index) => (
              <div key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-border items-center">
                {/* Product Info */}
                <div className="col-span-1 md:col-span-6 flex gap-4">
                  <div className="w-24 h-32 bg-card flex-shrink-0">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <Link href={`/shop/${item.product.id}`} className="font-display uppercase text-xl text-white hover:text-primary transition-colors line-clamp-2">
                      {item.product.name}
                    </Link>
                    <p className="text-muted-foreground text-sm mt-1">{item.product.price} EGP</p>
                    <div className="flex gap-4 mt-2">
                      <p className="text-sm"><span className="text-muted-foreground">Size:</span> <span className="text-white">{item.selectedSize}</span></p>
                      <p className="text-sm"><span className="text-muted-foreground">Color:</span> <span className="text-white">{item.selectedColor}</span></p>
                    </div>
                  </div>
                </div>
                
                {/* Quantity */}
                <div className="col-span-1 md:col-span-3 flex justify-start md:justify-center items-center">
                  <div className="flex items-center border border-border h-10 w-fit">
                    <button onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity - 1)} className="px-3 text-white hover:text-primary transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity + 1)} className="px-3 text-white hover:text-primary transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                
                {/* Total & Remove */}
                <div className="col-span-1 md:col-span-3 flex justify-between md:justify-end items-center">
                  <span className="text-xl text-white md:mr-4">{item.product.price * item.quantity} EGP</span>
                  <button 
                    onClick={() => removeItem(item.product.id, item.selectedSize, item.selectedColor)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-2"
                    aria-label="Remove item"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="bg-card p-6 border border-border">
            <h2 className="font-display text-2xl uppercase tracking-wider text-white mb-6 border-b border-border pb-4">ORDER SUMMARY</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="text-white">{totalPrice} EGP</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span className="text-white">{deliveryFee === 0 ? "FREE" : `${deliveryFee} EGP`}</span>
              </div>
              {deliveryFee > 0 && (
                <p className="text-xs text-primary">Free delivery for 2+ items!</p>
              )}
            </div>
            
            <div className="border-t border-border pt-4 mb-8">
              <div className="flex justify-between items-end">
                <span className="font-display uppercase tracking-widest text-lg text-white">Total</span>
                <span className="text-3xl text-white font-bold">{finalTotal} EGP</span>
              </div>
            </div>
            
            <Link href="/checkout" className="flex h-14 items-center justify-center w-full bg-primary text-black font-display font-bold uppercase tracking-widest text-lg hover:bg-white transition-colors mb-4">
              PROCEED TO CHECKOUT
            </Link>
            
            <Link href="/shop" className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider underline underline-offset-4">
              CONTINUE SHOPPING
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

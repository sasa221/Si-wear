import { motion } from "framer-motion";
import { Link } from "wouter";
import { CART_ITEM_UPDATED_MESSAGE, useCart } from "@/context/CartContext";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";
import { getProductImage, useFallbackImage } from "@/lib/images";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice } = useCart();

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="max-w-[1280px] mx-auto px-4 py-20 md:py-32 flex flex-col items-center justify-center min-h-[60vh]"
      >
        <ShoppingBag size={56} className="text-border mb-5" />
        <h1 className="font-display uppercase text-white mb-3 text-center"
          style={{ fontSize: "clamp(1.6rem, 6vw, 3rem)" }}>
          Your Cart is Empty
        </h1>
        <p className="text-muted-foreground mb-8 text-center max-w-xs text-sm">
          Looks like you haven't added anything to your cart yet.
        </p>
        <Link href="/shop" className="flex h-12 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors w-full max-w-xs">
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
      className="max-w-[1280px] mx-auto px-4 py-8 md:py-12"
    >
      <h1 className="font-display font-black uppercase text-white mb-8 md:mb-12"
        style={{ fontSize: "clamp(2.2rem, 9vw, 5rem)", lineHeight: 0.92 }}>
        CART
      </h1>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">
        {/* Items */}
        <div className="flex-1 min-w-0">
          <div className="border-b border-border pb-3 mb-4 hidden md:grid grid-cols-12 gap-4">
            <div className="col-span-6 font-display uppercase tracking-widest text-muted-foreground text-xs">Product</div>
            <div className="col-span-3 font-display uppercase tracking-widest text-muted-foreground text-xs text-center">Quantity</div>
            <div className="col-span-3 font-display uppercase tracking-widest text-muted-foreground text-xs text-right">Total</div>
          </div>

          <div className="space-y-4 md:space-y-6">
            {items.map((item, index) => (
              <div
                key={`${item.product.id}-${item.variantId}-${index}`}
                className="flex gap-3 py-4 border-b border-border items-start md:grid md:grid-cols-12 md:gap-4 md:items-center"
              >
                {/* Image + info */}
                <div className="flex gap-3 flex-1 min-w-0 md:col-span-6">
                  <div className="w-20 h-26 sm:w-24 sm:h-32 bg-card border border-border flex-shrink-0" style={{ height: "104px" }}>
                    <img
                      src={item.image || getProductImage(item.product.images)}
                      alt={item.productName || item.product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      width={96}
                      height={128}
                      onError={useFallbackImage}
                    />
                  </div>
                  <div className="flex flex-col justify-between py-1 min-w-0">
                    <div>
                      <Link href={`/shop/${item.product.slug || item.product.id}`} className="font-display uppercase text-sm sm:text-base text-white hover:text-primary transition-colors line-clamp-2 leading-tight">
                        {item.productName || item.product.name}
                      </Link>
                      <p className="text-muted-foreground text-xs mt-1">{item.price} EGP</p>
                      <p className="text-xs mt-0.5 text-muted-foreground">{item.selectedSize} / {item.selectedColor}</p>
                      {(item.variantIssue || !item.variantId) && (
                        <p className="text-xs mt-1 text-red-400">{item.variantIssue || CART_ITEM_UPDATED_MESSAGE}</p>
                      )}
                    </div>
                    {/* Mobile: qty controls inline */}
                    <div className="flex items-center justify-between mt-3 md:hidden">
                      <div className="flex items-center border border-border h-9">
                        <button onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity - 1, item.variantId)} className="px-2.5 text-white hover:text-primary transition-colors h-full">
                          <Minus size={12} />
                        </button>
                        <span className="w-7 text-center text-white text-sm">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity + 1, item.variantId)} className="px-2.5 text-white hover:text-primary transition-colors h-full">
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold text-sm">{item.price * item.quantity} EGP</span>
                        <button onClick={() => removeItem(item.product.id, item.selectedSize, item.selectedColor, item.variantId)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop: qty controls */}
                <div className="col-span-3 hidden md:flex justify-center items-center">
                  <div className="flex items-center border border-border h-10 w-fit">
                    <button onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity - 1, item.variantId)} className="px-3 text-white hover:text-primary transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity + 1, item.variantId)} className="px-3 text-white hover:text-primary transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Desktop: total + remove */}
                <div className="col-span-3 hidden md:flex justify-end items-center gap-3">
                  <span className="text-white font-bold">{item.price * item.quantity} EGP</span>
                  <button onClick={() => removeItem(item.product.id, item.selectedSize, item.selectedColor, item.variantId)} className="text-muted-foreground hover:text-destructive transition-colors p-2">
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <div className="bg-card p-5 sm:p-6 border border-border">
            <h2 className="font-display text-xl sm:text-2xl uppercase tracking-wider text-white mb-5 border-b border-border pb-4">
              ORDER SUMMARY
            </h2>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Subtotal</span>
                <span className="text-white">{totalPrice} EGP</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-sm">
                <span>Delivery</span>
                <span className="text-white">Calculated at checkout</span>
              </div>
              <p className="text-xs text-muted-foreground/60 italic">Have a discount code? Apply it at checkout.</p>
            </div>

            <div className="border-t border-border pt-4 mb-6">
              <div className="flex justify-between items-end">
                <span className="font-display uppercase tracking-widest text-base sm:text-lg text-white">Subtotal</span>
                <span className="text-2xl sm:text-3xl text-white font-bold">{totalPrice} EGP</span>
              </div>
            </div>

            <Link href="/checkout" className="flex h-12 sm:h-14 items-center justify-center w-full bg-primary text-black font-display font-bold uppercase tracking-widest text-base sm:text-lg hover:bg-white transition-colors mb-4">
              PROCEED TO CHECKOUT
            </Link>

            <Link href="/shop" className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider underline underline-offset-4">
              CONTINUE SHOPPING
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

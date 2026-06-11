import { motion } from "framer-motion";
import { Link } from "wouter";
import { CheckCircle, Package } from "lucide-react";

export default function OrderSuccessPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-[1280px] mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[70vh] text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="w-24 h-24 bg-primary/10 border border-primary flex items-center justify-center mb-8"
      >
        <CheckCircle size={48} className="text-primary" />
      </motion.div>

      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="font-display font-black uppercase text-white mb-4"
        style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
      >
        ORDER PLACED!
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="text-primary font-display uppercase tracking-widest text-sm mb-8"
      >
        CASH ON DELIVERY
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-lg mx-auto space-y-3 text-muted-foreground mb-12 border border-border bg-card p-6"
      >
        <p className="text-white font-display uppercase tracking-wider">Order placed successfully.</p>
        <p>We'll contact you to confirm your order and schedule delivery. You can track your order status in your account.</p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <Link
          href="/my-orders"
          data-testid="btn-view-orders"
          className="flex h-12 items-center justify-center gap-2 bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors"
        >
          <Package size={18} />
          VIEW MY ORDERS
        </Link>
        <Link
          href="/shop"
          data-testid="btn-continue-shopping"
          className="flex h-12 items-center justify-center border-2 border-white text-white font-display font-bold uppercase tracking-widest px-8 hover:bg-white hover:text-black transition-colors"
        >
          CONTINUE SHOPPING
        </Link>
      </motion.div>
    </motion.div>
  );
}

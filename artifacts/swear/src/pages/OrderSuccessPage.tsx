import { motion } from "framer-motion";
import { Link } from "wouter";
import { CheckCircle, MessageCircle } from "lucide-react";

export default function OrderSuccessPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-32 flex flex-col items-center justify-center min-h-[70vh] text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-8"
      >
        <CheckCircle size={48} className="text-primary" />
      </motion.div>
      
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-6"
      >
        ORDER CONFIRMED!
      </motion.h1>
      
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-xl mx-auto space-y-6 text-muted-foreground text-lg mb-12"
      >
        <p>Thank you for shopping with S! Wear.</p>
        <p>We've received your order and sent the details via WhatsApp. We will contact you shortly to confirm your delivery address and schedule.</p>
      </motion.div>
      
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <a 
          href="https://wa.me/201220172714" 
          target="_blank" 
          rel="noreferrer"
          className="flex h-14 items-center justify-center gap-2 bg-transparent border-2 border-white text-white font-display font-bold uppercase tracking-widest px-8 hover:bg-white hover:text-black transition-colors"
        >
          <MessageCircle size={20} />
          CONTACT US
        </a>
        <Link href="/shop" className="flex h-14 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors">
          CONTINUE SHOPPING
        </Link>
      </motion.div>
    </motion.div>
  );
}

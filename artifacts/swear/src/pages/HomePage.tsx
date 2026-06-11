import { motion } from "framer-motion";
import { Link } from "wouter";
import { products } from "@/data/products";
import { ProductGrid } from "@/components/products/ProductGrid";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const latestDrops = products.filter(p => p.isNew);
  const bestSellers = products.filter(p => p.isBestSeller);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full"
    >
      {/* Hero Section */}
      <section className="hero-gradient relative w-full h-[75vh] min-h-[60vh] flex flex-col justify-center items-center px-4 overflow-hidden">
        <div className="z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
          <motion.h1 
            className="text-hero font-display font-black text-white uppercase leading-none text-center"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.8 }}
          >
            WEAR IT<br />
            <span className="text-primary block mt-2">LOUD.</span>
            WEAR IT<br />
            BOLD.
          </motion.h1>
          
          <motion.p 
            className="mt-6 md:mt-10 text-body text-gray-300 max-w-[560px] text-center mx-auto"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Oversized essentials, bold fits, and custom streetwear made to stand out.
          </motion.p>
          
          <motion.div 
            className="mt-10 flex flex-col md:flex-row gap-4 w-full md:w-auto justify-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Link href="/shop" className="inline-flex h-12 md:h-14 items-center justify-center bg-primary text-primary-foreground font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors">
              SHOP NOW
            </Link>
            <Link href="/custom-design" className="inline-flex h-12 md:h-14 items-center justify-center border-2 border-white text-white font-display font-bold uppercase tracking-widest px-8 hover:bg-white hover:text-black transition-colors">
              CREATE YOUR DESIGN
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Category Cards */}
      <section className="py-12 md:py-16 container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/shop?category=T-Shirts" className="group block relative h-64 md:h-80 bg-card overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-card to-black opacity-80 z-0"></div>
            <h2 className="relative z-10 text-card font-display text-white uppercase tracking-wider group-hover:scale-110 transition-transform duration-300">T-SHIRTS</h2>
          </Link>
          <Link href="/shop?category=Shirts" className="group block relative h-64 md:h-80 bg-card overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-card to-black opacity-80 z-0"></div>
            <h2 className="relative z-10 text-card font-display text-white uppercase tracking-wider group-hover:scale-110 transition-transform duration-300">SHIRTS</h2>
          </Link>
          <Link href="/shop?category=Pants" className="group block relative h-64 md:h-80 bg-card overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-card to-black opacity-80 z-0"></div>
            <h2 className="relative z-10 text-card font-display text-white uppercase tracking-wider group-hover:scale-110 transition-transform duration-300">PANTS</h2>
          </Link>
        </div>
      </section>

      {/* Latest Drops */}
      <section className="py-12 md:py-16 bg-card">
        <div className="container">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-section font-display uppercase font-bold text-white mb-8"
          >
            LATEST DROPS
          </motion.h2>
          <ProductGrid products={latestDrops} />
        </div>
      </section>

      {/* Best Sellers */}
      <section className="py-12 md:py-16 container">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-section font-display uppercase font-bold text-white mb-8"
        >
          BEST SELLERS
        </motion.h2>
        <ProductGrid products={bestSellers} />
      </section>

      {/* Custom Design Banner */}
      <section className="py-12 md:py-16 bg-card w-full border-y border-border">
        <div className="container text-center flex flex-col items-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-section font-display uppercase font-bold text-white mb-6"
          >
            CREATE YOUR<br/><span className="text-primary">OWN DESIGN</span>
          </motion.h2>
          <p className="text-body text-muted-foreground max-w-2xl mb-10">
            Send your idea. Choose your fit. We'll bring it to life.
          </p>
          <Link href="/custom-design" className="inline-flex h-12 md:h-14 items-center justify-center bg-primary text-primary-foreground font-display font-bold uppercase tracking-widest px-10 hover:bg-white transition-colors">
            START DESIGNING
          </Link>
        </div>
      </section>

      {/* Brand Statement */}
      <section className="py-16 md:py-24 container flex flex-col items-center text-center">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-hero font-display uppercase font-black text-white leading-none mb-8 tracking-tighter"
        >
          QUALITY<br/>OVER<br/>QUANTITY
        </motion.h2>
        <p className="text-body text-muted-foreground uppercase tracking-widest font-display">
          The difference between quality and quantity is S! Wear.
        </p>
      </section>
    </motion.div>
  );
}

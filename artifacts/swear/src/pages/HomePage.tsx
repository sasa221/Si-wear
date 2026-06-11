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
      <section className="relative w-full h-[100dvh] flex flex-col justify-center items-center px-4 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#002200] via-black to-black">
        <div className="z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
          <motion.h1 
            className="text-6xl md:text-8xl lg:text-9xl font-display font-black text-white uppercase leading-none text-center"
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
            className="mt-6 md:mt-10 text-lg md:text-xl text-gray-300 max-w-2xl text-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Oversized essentials, bold fits, and custom streetwear made to stand out.
          </motion.p>
          
          <motion.div 
            className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Link href="/shop" className="inline-flex h-14 items-center justify-center bg-primary text-primary-foreground font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors">
              SHOP NOW
            </Link>
            <Link href="/custom-design" className="inline-flex h-14 items-center justify-center border-2 border-white text-white font-display font-bold uppercase tracking-widest px-8 hover:bg-white hover:text-black transition-colors">
              CREATE YOUR DESIGN
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Category Cards */}
      <section className="py-20 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/shop?category=T-Shirts" className="group block relative h-80 bg-card overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-card to-black opacity-80 z-0"></div>
            <h2 className="relative z-10 font-display text-4xl text-white uppercase tracking-wider group-hover:scale-110 transition-transform duration-300">T-SHIRTS</h2>
          </Link>
          <Link href="/shop?category=Shirts" className="group block relative h-80 bg-card overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-card to-black opacity-80 z-0"></div>
            <h2 className="relative z-10 font-display text-4xl text-white uppercase tracking-wider group-hover:scale-110 transition-transform duration-300">SHIRTS</h2>
          </Link>
          <Link href="/shop?category=Pants" className="group block relative h-80 bg-card overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-card to-black opacity-80 z-0"></div>
            <h2 className="relative z-10 font-display text-4xl text-white uppercase tracking-wider group-hover:scale-110 transition-transform duration-300">PANTS</h2>
          </Link>
        </div>
      </section>

      {/* Latest Drops */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-display uppercase font-bold text-white mb-12"
          >
            LATEST DROPS
          </motion.h2>
          <ProductGrid products={latestDrops} />
        </div>
      </section>

      {/* Best Sellers */}
      <section className="py-20 container mx-auto px-4">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-display uppercase font-bold text-white mb-12"
        >
          BEST SELLERS
        </motion.h2>
        <ProductGrid products={bestSellers} />
      </section>

      {/* Custom Design Banner */}
      <section className="py-24 bg-card w-full border-y border-border">
        <div className="container mx-auto px-4 text-center flex flex-col items-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-display uppercase font-bold text-white mb-6"
          >
            CREATE YOUR<br/><span className="text-primary">OWN DESIGN</span>
          </motion.h2>
          <p className="text-xl text-muted-foreground max-w-2xl mb-10">
            Send your idea. Choose your fit. We'll bring it to life.
          </p>
          <Link href="/custom-design" className="inline-flex h-14 items-center justify-center bg-primary text-primary-foreground font-display font-bold uppercase tracking-widest px-10 hover:bg-white transition-colors">
            START DESIGNING
          </Link>
        </div>
      </section>

      {/* Brand Statement */}
      <section className="py-32 container mx-auto px-4 flex flex-col items-center text-center">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-7xl md:text-9xl font-display uppercase font-black text-white leading-none mb-8 tracking-tighter"
        >
          QUALITY<br/>OVER<br/>QUANTITY
        </motion.h2>
        <p className="text-xl md:text-2xl text-muted-foreground uppercase tracking-widest font-display">
          The difference between quality and quantity is S! Wear.
        </p>
      </section>
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { Link } from "wouter";

export default function AboutPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full"
    >
      <section className="py-32 bg-black container mx-auto px-4 flex flex-col items-center text-center">
        <h1 className="text-7xl md:text-9xl font-display font-black uppercase text-white mb-8">
          BORN IN <span className="text-primary">CAIRO</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
          S! Wear is a bold, unapologetic Egyptian streetwear label. We were founded to bring quality fits, heavy fabrics, and raw energy to the streets of Cairo and beyond.
        </p>
      </section>

      <section className="py-24 bg-card w-full border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="p-8 border border-border bg-background">
              <h2 className="text-4xl font-display uppercase text-white mb-4">QUALITY</h2>
              <p className="text-muted-foreground">We don't cut corners. Heavyweight cotton, reinforced stitching, and pre-shrunk fabrics. Every piece is built to last.</p>
            </div>
            <div className="p-8 border border-border bg-background">
              <h2 className="text-4xl font-display uppercase text-white mb-4">LOCAL</h2>
              <p className="text-muted-foreground">Proudly manufactured in Egypt. We support local artisans and factories while delivering world-class streetwear.</p>
            </div>
            <div className="p-8 border border-border bg-background">
              <h2 className="text-4xl font-display uppercase text-white mb-4">BOLD</h2>
              <p className="text-muted-foreground">No safe choices. Our cuts are aggressive, our silhouettes are distinct, and our graphics speak loud.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-32 text-center container mx-auto px-4">
        <h2 className="text-5xl md:text-7xl font-display uppercase font-bold text-white mb-10">JOIN THE MOVEMENT</h2>
        <Link href="/shop" className="inline-flex h-16 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest text-xl px-12 hover:bg-white transition-colors">
          SHOP THE COLLECTION
        </Link>
      </section>
    </motion.div>
  );
}

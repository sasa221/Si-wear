import { motion } from "framer-motion";
import { Link } from "wouter";
import { getProducts } from "@/hooks/useProducts";
import { ProductGrid } from "@/components/products/ProductGrid";

export default function HomePage() {
  const allProducts = getProducts();
  const latestDrops = allProducts.filter(p => p.isNew);
  const bestSellers = allProducts.filter(p => p.isBestSeller);

  const categoryCards = [
    {
      label: "T-SHIRTS",
      href: "/shop?category=T-Shirts",
      image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=1000&fit=crop&q=80",
    },
    {
      label: "SHIRTS",
      href: "/shop?category=Shirts",
      image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&h=1000&fit=crop&q=80",
    },
    {
      label: "PANTS",
      href: "/shop?category=Pants",
      image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=1000&fit=crop&q=80",
    },
    {
      label: "HOODIES",
      href: "/shop?category=Hoodies",
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=1000&fit=crop&q=80",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full overflow-x-hidden"
    >
      {/* ── Hero ── */}
      <section
        className="relative w-full flex items-center justify-center"
        style={{
          minHeight: "520px",
          maxHeight: "70vh",
          height: "70vh",
          backgroundImage:
            "url('https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1920&h=1080&fit=crop&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.80) 60%, rgba(0,0,0,0.97) 100%)",
          }}
        />
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 75% 15%, rgba(57,255,20,0.07) 0%, transparent 55%)",
          }}
        />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-16 md:py-20 text-center flex flex-col items-center">
          <motion.h1
            className="font-display font-black text-white uppercase text-center"
            style={{ fontSize: "clamp(48px, 8vw, 120px)", lineHeight: 0.9, letterSpacing: "-0.01em" }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.7 }}
          >
            WEAR IT{" "}
            <span className="text-primary">LOUD.</span>
            <br />
            WEAR IT BOLD.
          </motion.h1>

          <motion.p
            className="mt-5 text-gray-300 max-w-[520px] mx-auto"
            style={{ fontSize: "clamp(0.875rem, 1.8vw, 1.05rem)" }}
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
          >
            Oversized essentials, bold fits, and custom streetwear made to stand out.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.6 }}
          >
            <Link
              href="/shop"
              data-testid="btn-hero-shop"
              className="inline-flex h-12 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors text-sm"
            >
              SHOP NOW
            </Link>
            <Link
              href="/custom-design"
              data-testid="btn-hero-custom"
              className="inline-flex h-12 items-center justify-center border-2 border-white text-white font-display font-bold uppercase tracking-widest px-8 hover:bg-white hover:text-black transition-colors text-sm"
            >
              CREATE YOUR DESIGN
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Category Cards ── */}
      <section className="py-10 md:py-14" style={{ background: "#0a0a0a" }}>
        <div className="max-w-[1280px] mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categoryCards.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
              >
                <Link
                  href={cat.href}
                  data-testid={`link-category-${cat.label.toLowerCase()}`}
                  className="group block relative overflow-hidden"
                  style={{ height: "300px" }}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url('${cat.image}')` }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.15) 100%)",
                    }}
                  />
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-primary transition-colors duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span
                      className="font-display font-black text-white uppercase block"
                      style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.6rem)", lineHeight: 1 }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-xs text-primary uppercase tracking-widest font-display mt-1 block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      SHOP NOW →
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Latest Drops ── */}
      {latestDrops.length > 0 && (
        <section className="py-10 md:py-14" style={{ background: "#111111" }}>
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="flex items-end justify-between mb-6">
              <motion.h2
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-display font-black text-white uppercase"
              >
                LATEST DROPS
              </motion.h2>
              <Link href="/shop" className="text-xs text-primary hover:text-white uppercase tracking-widest transition-colors hidden sm:block">
                VIEW ALL →
              </Link>
            </div>
            <ProductGrid products={latestDrops} />
          </div>
        </section>
      )}

      {/* ── Best Sellers ── */}
      {bestSellers.length > 0 && (
        <section className="py-10 md:py-14" style={{ background: "#000000" }}>
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="flex items-end justify-between mb-6">
              <motion.h2
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-display font-black text-white uppercase"
              >
                BEST SELLERS
              </motion.h2>
              <Link href="/shop" className="text-xs text-primary hover:text-white uppercase tracking-widest transition-colors hidden sm:block">
                VIEW ALL →
              </Link>
            </div>
            <ProductGrid products={bestSellers} />
          </div>
        </section>
      )}

      {/* ── Custom Design Banner ── */}
      <section
        className="py-12 md:py-16 border-y border-[#222]"
        style={{ background: "#111111" }}
      >
        <div className="max-w-[1280px] mx-auto px-4 text-center flex flex-col items-center">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-display font-black text-white uppercase mb-4"
          >
            CREATE YOUR{" "}
            <span className="text-primary">OWN DESIGN</span>
          </motion.h2>
          <p className="text-gray-400 max-w-xl mb-8" style={{ fontSize: "clamp(0.875rem, 1.8vw, 1rem)" }}>
            Send your idea. Choose your fit. We'll bring it to life.
          </p>
          <Link
            href="/custom-design"
            data-testid="btn-custom-design-banner"
            className="inline-flex h-12 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-10 hover:bg-white transition-colors text-sm"
          >
            START DESIGNING
          </Link>
        </div>
      </section>

      {/* ── Brand Statement ── */}
      <section className="py-14 md:py-20" style={{ background: "#000000" }}>
        <div className="max-w-[1280px] mx-auto px-4 flex flex-col items-center text-center">
          <motion.h2
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="font-display font-black text-white uppercase leading-none mb-5"
            style={{ fontSize: "clamp(2.5rem, 6vw, 5.5rem)", lineHeight: 0.92 }}
          >
            QUALITY<br />OVER<br />QUANTITY
          </motion.h2>
          <p
            className="text-gray-400 uppercase tracking-widest font-display"
            style={{ fontSize: "clamp(0.7rem, 1.5vw, 0.85rem)" }}
          >
            The difference between quality and quantity is S! Wear.
          </p>
        </div>
      </section>
    </motion.div>
  );
}

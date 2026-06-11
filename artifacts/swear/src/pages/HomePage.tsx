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
      image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop&q=80",
    },
    {
      label: "SHIRTS",
      href: "/shop?category=Shirts",
      image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop&q=80",
    },
    {
      label: "PANTS",
      href: "/shop?category=Pants",
      image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop&q=80",
    },
    {
      label: "HOODIES",
      href: "/shop?category=Hoodies",
      image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop&q=80",
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
        className="relative w-full flex items-end justify-center"
        style={{
          minHeight: "520px",
          height: "75svh",
          maxHeight: "680px",
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
              "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.97) 100%)",
          }}
        />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 pb-10 sm:pb-14 md:pb-20 flex flex-col items-start sm:items-center">
          <motion.h1
            className="font-display font-black text-white uppercase text-left sm:text-center"
            style={{ fontSize: "clamp(44px, 10vw, 110px)", lineHeight: 0.88, letterSpacing: "-0.01em" }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            WEAR IT{" "}
            <span className="text-primary">LOUD.</span>
            <br />
            WEAR IT BOLD.
          </motion.h1>

          <motion.p
            className="mt-4 text-gray-300 text-sm sm:text-base max-w-sm sm:max-w-md text-left sm:text-center"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Oversized essentials, bold fits, and custom streetwear made to stand out.
          </motion.p>

          <motion.div
            className="mt-6 flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:justify-center"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Link
              href="/shop"
              className="flex h-12 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-8 hover:bg-white transition-colors text-sm sm:text-base"
            >
              SHOP NOW
            </Link>
            <Link
              href="/custom-design"
              className="flex h-12 items-center justify-center border-2 border-white text-white font-display font-bold uppercase tracking-widest px-8 hover:bg-white hover:text-black transition-colors text-sm sm:text-base"
            >
              CREATE YOUR DESIGN
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Category Cards ── */}
      <section className="py-8 md:py-12" style={{ background: "#0a0a0a" }}>
        <div className="max-w-[1280px] mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {categoryCards.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
              >
                <Link
                  href={cat.href}
                  className="group block relative overflow-hidden"
                  style={{ aspectRatio: "3/4" }}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url('${cat.image}')` }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.1) 100%)",
                    }}
                  />
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-primary transition-colors duration-300 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                    <span
                      className="font-display font-black text-white uppercase block"
                      style={{ fontSize: "clamp(0.9rem, 3vw, 1.4rem)", lineHeight: 1 }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[10px] sm:text-xs text-primary uppercase tracking-widest font-display mt-1 block">
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
        <section className="py-8 md:py-12" style={{ background: "#111111" }}>
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="flex items-baseline justify-between mb-5 md:mb-8">
              <motion.h2
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="font-display font-black text-white uppercase"
                style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
              >
                LATEST DROPS
              </motion.h2>
              <Link href="/shop" className="text-xs text-primary hover:text-white uppercase tracking-widest transition-colors whitespace-nowrap ml-4">
                VIEW ALL →
              </Link>
            </div>
            <ProductGrid products={latestDrops} />
          </div>
        </section>
      )}

      {/* ── Best Sellers ── */}
      {bestSellers.length > 0 && (
        <section className="py-8 md:py-12" style={{ background: "#000000" }}>
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="flex items-baseline justify-between mb-5 md:mb-8">
              <motion.h2
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="font-display font-black text-white uppercase"
                style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
              >
                BEST SELLERS
              </motion.h2>
              <Link href="/shop" className="text-xs text-primary hover:text-white uppercase tracking-widest transition-colors whitespace-nowrap ml-4">
                VIEW ALL →
              </Link>
            </div>
            <ProductGrid products={bestSellers} />
          </div>
        </section>
      )}

      {/* ── Custom Design Banner ── */}
      <section className="py-10 md:py-16 border-y border-[#222]" style={{ background: "#111111" }}>
        <div className="max-w-[1280px] mx-auto px-4 flex flex-col items-center text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display font-black text-white uppercase"
            style={{ fontSize: "clamp(1.8rem, 6vw, 3.5rem)" }}
          >
            CREATE YOUR{" "}
            <span className="text-primary">OWN DESIGN</span>
          </motion.h2>
          <p className="text-gray-400 max-w-xs sm:max-w-md mt-3 mb-6 text-sm sm:text-base">
            Send your idea. Choose your fit. We'll bring it to life.
          </p>
          <Link
            href="/custom-design"
            className="flex h-12 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest px-10 hover:bg-white transition-colors w-full sm:w-auto max-w-xs"
          >
            START DESIGNING
          </Link>
        </div>
      </section>

      {/* ── Brand Statement ── */}
      <section className="py-12 md:py-20" style={{ background: "#000000" }}>
        <div className="max-w-[1280px] mx-auto px-4 flex flex-col items-center text-center">
          <motion.h2
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="font-display font-black text-white uppercase leading-none"
            style={{ fontSize: "clamp(2.5rem, 10vw, 5.5rem)" }}
          >
            QUALITY<br />OVER<br />QUANTITY
          </motion.h2>
          <p
            className="mt-4 text-gray-400 uppercase tracking-widest font-display text-xs sm:text-sm"
          >
            The difference between quality and quantity is S! Wear.
          </p>
        </div>
      </section>
    </motion.div>
  );
}

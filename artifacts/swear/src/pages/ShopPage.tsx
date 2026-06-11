import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { getProducts, getCategories } from "@/hooks/useProducts";
import { ProductGrid } from "@/components/products/ProductGrid";
import { SlidersHorizontal } from "lucide-react";

export default function ShopPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialCategory = searchParams.get("category") || "All";

  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const allProducts = useMemo(() => getProducts(), []);
  const dynamicCategories = useMemo(() => ["All", ...getCategories()], []);

  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (category !== "All") {
      result = result.filter(p => p.category === category);
    }
    if (sort === "price-low") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sort === "price-high") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else {
      result = [...result].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    }
    return result;
  }, [allProducts, category, sort]);

  const sortLabels: Record<string, string> = {
    newest: "Newest",
    "price-low": "Price ↑",
    "price-high": "Price ↓",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-[1280px] mx-auto px-4 py-8 md:py-12"
    >
      <h1 className="font-display font-black uppercase text-white mb-6 md:mb-10"
        style={{ fontSize: "clamp(2.2rem, 8vw, 5rem)", lineHeight: 0.92 }}>
        SHOP ALL
      </h1>

      {/* Category tabs — horizontal scroll on mobile */}
      <div className="mb-4">
        <div className="-mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 pb-2 min-w-max md:min-w-0 md:flex-wrap">
            {dynamicCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-shrink-0 h-9 px-4 text-xs font-display font-bold uppercase tracking-widest border transition-colors whitespace-nowrap ${
                  category === cat
                    ? "bg-primary text-black border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:text-white hover:border-white/30"
                }`}
              >
                {cat}
                {cat !== "All" && (
                  <span className="ml-1.5 opacity-60 font-normal">
                    ({allProducts.filter(p => p.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sort bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
        </p>

        {/* Mobile: button toggle */}
        <div className="relative md:hidden">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-2 h-9 px-4 border border-border text-white text-xs font-display font-bold uppercase tracking-widest"
          >
            <SlidersHorizontal size={14} />
            {sortLabels[sort]}
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border z-20 min-w-[140px]">
              {Object.entries(sortLabels).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setSort(val); setSortOpen(false); }}
                  className={`block w-full text-left px-4 py-3 text-xs uppercase tracking-widest font-display font-bold transition-colors ${
                    sort === val ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: inline select */}
        <select
          className="hidden md:block bg-card border border-border text-white px-4 h-9 uppercase tracking-wider text-xs appearance-none outline-none focus:border-primary font-display font-bold cursor-pointer"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
        </select>
      </div>

      {/* Grid */}
      <ProductGrid products={filteredProducts} emptyMessage={`No products in ${category} yet.`} />
    </motion.div>
  );
}

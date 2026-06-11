import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { getProducts, getCategories } from "@/hooks/useProducts";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ChevronDown } from "lucide-react";

const FIXED_TABS = ["All", "T-Shirts", "Shirts", "Pants", "Custom Design"];

export default function ShopPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialCategory = searchParams.get("category") || "All";

  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState("newest");

  const allProducts = useMemo(() => getProducts(), []);
  const dynamicCategories = useMemo(() => {
    const cats = getCategories();
    const tabs = ["All", ...cats.filter(c => c !== "Hoodies")];
    const extra = tabs.filter(t => !FIXED_TABS.includes(t));
    const base = FIXED_TABS.filter(t => t === "All" || cats.includes(t));
    return [...new Set([...base, ...extra])];
  }, []);

  const filteredProducts = useMemo(() => {
    let result = category === "All"
      ? allProducts.filter(p => p.category !== "Hoodies")
      : allProducts.filter(p => p.category === category);
    if (sort === "price-low") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sort === "price-high") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else {
      result = [...result].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    }
    return result;
  }, [allProducts, category, sort]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-black"
    >
      <div className="max-w-[1280px] mx-auto px-5 pt-6 pb-12 md:pt-10">

        {/* Page header */}
        <div className="mb-5">
          <h1
            className="font-display font-black uppercase text-white leading-none"
            style={{ fontSize: "clamp(1.8rem, 7vw, 4.5rem)" }}
          >
            SHOP ALL
          </h1>
          <p className="text-[#39FF14]/70 text-xs font-display uppercase tracking-widest mt-1">
            Pick your fit. Built for the street.
          </p>
        </div>

        {/* Category tabs — horizontal scroll */}
        <div className="-mx-5 px-5 overflow-x-auto scrollbar-none mb-3">
          <div className="flex gap-2 pb-1 min-w-max">
            {dynamicCategories.map(cat => {
              const isActive = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-shrink-0 px-4 py-2 text-[11px] font-display font-bold uppercase tracking-widest transition-all duration-200 whitespace-nowrap rounded-sm ${
                    isActive
                      ? "bg-[#39FF14] text-black"
                      : "bg-[#111] text-zinc-400 hover:text-white hover:bg-[#1a1a1a]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort row */}
        <div className="flex items-center justify-between mb-5 py-2 border-b border-zinc-800">
          <span className="text-[11px] text-zinc-500 uppercase tracking-widest">
            {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""}
          </span>
          <div className="relative flex items-center gap-1">
            <span className="text-[11px] text-zinc-500 uppercase tracking-widest">Sort:</span>
            <div className="relative">
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="appearance-none bg-transparent text-white text-[11px] font-display font-bold uppercase tracking-widest pr-5 pl-1 py-1 outline-none cursor-pointer border-none"
              >
                <option value="newest" className="bg-black">Newest</option>
                <option value="price-low" className="bg-black">Price ↑</option>
                <option value="price-high" className="bg-black">Price ↓</option>
              </select>
              <ChevronDown size={11} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Product grid */}
        <ProductGrid products={filteredProducts} emptyMessage={`No products in ${category} yet.`} />
      </div>
    </motion.div>
  );
}

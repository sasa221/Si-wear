import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { getProducts, getCategories } from "@/hooks/useProducts";
import { ProductGrid } from "@/components/products/ProductGrid";

export default function ShopPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialCategory = searchParams.get("category") || "All";

  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState("newest");

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-[1280px] mx-auto px-4 py-12"
    >
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-12">SHOP ALL</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-56 flex-shrink-0">
          <div className="sticky top-24">
            <h3 className="font-display text-lg uppercase tracking-widest text-white mb-4 border-b border-border pb-2">CATEGORIES</h3>
            <ul className="space-y-2">
              {dynamicCategories.map(c => (
                <li key={c}>
                  <button
                    onClick={() => setCategory(c)}
                    className={`text-sm uppercase tracking-wider hover:text-primary transition-colors w-full text-left py-1 ${
                      category === c ? 'text-primary font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    {c}
                    {c !== "All" && (
                      <span className="ml-2 text-[10px] text-muted-foreground/60">
                        ({allProducts.filter(p => p.category === c).length})
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <h3 className="font-display text-lg uppercase tracking-widest text-white mt-8 mb-4 border-b border-border pb-2">SORT BY</h3>
            <select
              className="w-full bg-input border border-border text-white p-3 uppercase tracking-wider text-sm appearance-none outline-none focus:border-primary rounded-none"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1">
          {filteredProducts.length === 0 && category !== "All" && (
            <p className="text-muted-foreground uppercase tracking-widest text-sm mb-4">
              No products in {category} yet.
            </p>
          )}
          <ProductGrid products={filteredProducts} emptyMessage="No products match your criteria." />
        </div>
      </div>
    </motion.div>
  );
}

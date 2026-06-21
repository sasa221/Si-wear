import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, X, User, ChevronRight, Search } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeToTableChanges, supabaseConfigured } from "@/lib/supabase";
import { getProductsAsync } from "@/hooks/useProducts";
import { ALLOWED_CATEGORIES, type Product } from "@/data/products";
import { getProductImage, useFallbackImage } from "@/lib/images";
import { defaultStoreSettings, getStoreSettings } from "@/lib/storeSettings";

const ALLOWED_CATEGORY_SET = new Set<string>(ALLOWED_CATEGORIES);

export function Header() {
  const { totalItems } = useCart();
  const { user, logout, getUnreadCount } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcementText, setAnnouncementText] = useState(defaultStoreSettings.announcementBarText);

  const closeMenu = () => setMobileMenuOpen(false);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/custom-design", label: "Custom Design" },
    { href: "/size-chart", label: "Size Chart" },
    { href: "/contact", label: "Contact" },
  ];
  const marqueeText = announcementText ||
    "CASH ON DELIVERY - NEW DROPS AVAILABLE NOW - CUSTOM DESIGNS AVAILABLE";

  useEffect(() => {
    let cancelled = false;
    getStoreSettings()
      .then(settings => {
        if (!cancelled) setAnnouncementText(settings.announcementBarText);
      })
      .catch(err => console.error("Failed to load store settings:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    getUnreadCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, [getUnreadCount, user]);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    return subscribeToTableChanges<Record<string, any>>(
      { table: "notifications", filter: `customer_id=eq.${user.id}`, channel: `header-notifications-${user.id}` },
      change => {
        if (change.eventType === "INSERT" && change.record.read === false) {
          setUnreadCount(prev => prev + 1);
        }
        if (change.eventType === "UPDATE") {
          getUnreadCount().then(setUnreadCount).catch(() => {});
        }
      }
    );
  }, [getUnreadCount, user]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    getProductsAsync({ activeOnly: true })
      .then(products => {
        if (!cancelled) setSearchProducts(products.filter(product => ALLOWED_CATEGORY_SET.has(product.category)));
      })
      .catch(err => console.error("Failed to load search products:", err));
    return () => { cancelled = true; };
  }, [searchOpen]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return searchProducts
      .filter(product =>
        product.status === "active" &&
        ALLOWED_CATEGORY_SET.has(product.category) &&
        (
          product.name.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
        )
      )
      .slice(0, 8);
  }, [searchProducts, searchQuery]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      {/* Announcement Bar */}
      <div className="w-full bg-primary text-black overflow-hidden relative h-7 flex items-center">
        <div className="marquee-track whitespace-nowrap text-[10px] sm:text-xs font-display uppercase tracking-widest font-bold">
          <span className="mx-4">{marqueeText} - {marqueeText}</span>
          <span className="mx-4">{marqueeText} - {marqueeText}</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="w-full px-4 h-14 md:h-16 flex items-center justify-between max-w-[1280px] mx-auto">
        {/* Logo */}
        <Link href="/" className="font-display text-3xl md:text-4xl text-white font-black hover:text-primary transition-colors flex-shrink-0" onClick={closeMenu}>
          S!
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} className="text-sm font-display uppercase tracking-widest text-white hover:text-primary transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Icons */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* User — desktop dropdown */}
          <button
            className="text-white hover:text-primary transition-colors p-2"
            onClick={() => { closeMenu(); setSearchOpen(true); }}
            aria-label="Search products"
          >
            <Search size={20} />
          </button>

          <div className="relative hidden md:block">
            {user ? (
              <>
                <button
                  className="text-white hover:text-primary transition-colors p-2 relative"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                >
                  <User size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-primary text-black text-[9px] font-black flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute top-full right-0 mt-2 w-48 bg-card border border-border shadow-2xl z-50 flex flex-col py-2"
                    >
                      <Link href="/profile" className="px-4 py-2 text-sm text-white hover:bg-primary/20 hover:text-primary transition-colors uppercase tracking-widest font-bold" onClick={() => setUserDropdownOpen(false)}>MY PROFILE</Link>
                      <Link href="/profile?tab=notifications" className="px-4 py-2 text-sm text-white hover:bg-primary/20 hover:text-primary transition-colors uppercase tracking-widest font-bold" onClick={() => setUserDropdownOpen(false)}>
                        NOTIFICATIONS{unreadCount > 0 ? ` (${unreadCount})` : ""}
                      </Link>
                      <Link href="/my-orders" className="px-4 py-2 text-sm text-white hover:bg-primary/20 hover:text-primary transition-colors uppercase tracking-widest font-bold" onClick={() => setUserDropdownOpen(false)}>MY ORDERS</Link>
                      <button
                        className="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 text-left transition-colors uppercase tracking-widest font-bold mt-2 border-t border-border pt-3"
                        onClick={() => { logout(); setUserDropdownOpen(false); setLocation("/"); }}
                      >
                        LOGOUT
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <Link href="/login" className="text-white hover:text-primary transition-colors p-2 inline-block">
                <User size={20} />
              </Link>
            )}
          </div>

          {/* User icon — mobile (links to profile or login) */}
          <div className="md:hidden">
            {user ? (
              <Link href="/profile" className="text-white hover:text-primary transition-colors p-2 inline-block">
                <User size={20} />
              </Link>
            ) : (
              <Link href="/login" className="text-white hover:text-primary transition-colors p-2 inline-block">
                <User size={20} />
              </Link>
            )}
          </div>

          {/* Cart */}
          <Link href="/cart" className="text-white hover:text-primary transition-colors p-2 relative" data-testid="link-cart">
            <ShoppingBag size={20} />
            {totalItems > 0 && (
              <motion.span
                key={totalItems}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary text-black text-[9px] flex items-center justify-center font-bold leading-none"
              >
                {totalItems}
              </motion.span>
            )}
          </Link>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            data-testid="btn-mobile-menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Full-screen Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col md:hidden"
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
              <Link href="/" className="font-display text-3xl text-primary font-black" onClick={closeMenu}>S!</Link>
              <button onClick={closeMenu} className="text-white p-2" aria-label="Close menu">
                <X size={24} />
              </button>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto py-4">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="flex items-center justify-between px-5 py-4 border-b border-border/40 font-display text-xl uppercase tracking-widest text-white active:bg-white/5"
                >
                  {link.label}
                  <ChevronRight size={18} className="text-muted-foreground" />
                </Link>
              ))}

              <div className="mt-4 border-t border-border/40">
                {user ? (
                  <>
                    <Link href="/profile" onClick={closeMenu} className="flex items-center justify-between px-5 py-4 border-b border-border/40 font-display text-xl uppercase tracking-widest text-primary active:bg-primary/5">
                      My Profile
                      <ChevronRight size={18} className="text-primary" />
                    </Link>
                    <Link href="/my-orders" onClick={closeMenu} className="flex items-center justify-between px-5 py-4 border-b border-border/40 font-display text-xl uppercase tracking-widest text-primary active:bg-primary/5">
                      My Orders
                      <ChevronRight size={18} className="text-primary" />
                    </Link>
                    <button
                      onClick={() => { logout(); closeMenu(); setLocation("/"); }}
                      className="flex items-center justify-between w-full px-5 py-4 font-display text-xl uppercase tracking-widest text-destructive active:bg-destructive/5"
                    >
                      Logout
                      <ChevronRight size={18} className="text-destructive" />
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={closeMenu} className="flex items-center justify-between px-5 py-4 font-display text-xl uppercase tracking-widest text-primary active:bg-primary/5">
                    Login / Sign Up
                    <ChevronRight size={18} className="text-primary" />
                  </Link>
                )}
              </div>
            </nav>

            {/* Menu Footer */}
            <div className="flex-shrink-0 px-5 py-6 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-widest text-center">S! Wear — Egyptian Streetwear</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm"
          >
            <div className="max-w-3xl mx-auto px-4 py-5 sm:py-8">
              <div className="flex items-center justify-between gap-4 mb-5">
                <p className="font-display text-2xl text-primary uppercase tracking-widest">Search</p>
                <button
                  type="button"
                  onClick={closeSearch}
                  className="w-10 h-10 border border-border text-white hover:text-primary hover:border-primary transition-colors flex items-center justify-center"
                  aria-label="Close search"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="relative mb-5">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search T-Shirts, Shirts, Pants..."
                  className="w-full h-14 bg-[#111] border border-border pl-11 pr-4 text-white outline-none focus:border-primary font-display uppercase tracking-widest text-sm"
                  style={{ fontSize: "16px" }}
                />
              </div>

              <div className="border border-border bg-[#0b0b0b] max-h-[70dvh] overflow-y-auto">
                {searchQuery.trim().length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="uppercase tracking-widest text-sm">Search by product name or category.</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="uppercase tracking-widest text-sm">No products found.</p>
                    <Link
                      href="/shop"
                      onClick={closeSearch}
                      className="mt-4 inline-flex bg-primary text-black px-5 py-2 font-display font-bold uppercase tracking-widest text-xs"
                    >
                      Shop the Drop
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {searchResults.map(product => (
                      <Link
                        key={product.id}
                        href={`/shop/${product.slug || product.id}`}
                        onClick={closeSearch}
                        className="flex items-center gap-4 p-3 hover:bg-primary/10 transition-colors"
                      >
                        <div className="w-16 h-20 bg-card border border-border overflow-hidden flex-shrink-0">
                          <img
                            src={getProductImage(product.images)}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={useFallbackImage}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs uppercase tracking-widest text-primary">{product.category}</p>
                          <p className="text-white font-display uppercase tracking-wider line-clamp-1">{product.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">{product.price} EGP</p>
                        </div>
                        <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

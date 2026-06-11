import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Menu, X, User, ChevronRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/custom-design", label: "Custom Design" },
    { href: "/size-chart", label: "Size Chart" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      {/* Announcement Bar */}
      <div className="w-full bg-primary text-black overflow-hidden relative h-7 flex items-center">
        <div className="marquee-track whitespace-nowrap text-[10px] sm:text-xs font-display uppercase tracking-widest font-bold">
          <span className="mx-4">CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE  •  CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE</span>
          <span className="mx-4">CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE  •  CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE</span>
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
          <div className="relative hidden md:block">
            {user ? (
              <>
                <button
                  className="text-white hover:text-primary transition-colors p-2"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                >
                  <User size={20} />
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
    </header>
  );
}

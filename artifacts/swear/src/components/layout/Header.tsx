import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Search, Menu, X, User } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const { totalItems } = useCart();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      {/* Announcement Bar */}
      <div className="w-full bg-primary text-black overflow-hidden relative h-8 flex items-center">
        <div className="marquee-track whitespace-nowrap text-xs font-display uppercase tracking-widest font-bold">
          <span className="mx-4">CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE  •  CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE</span>
          <span className="mx-4">CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE  •  CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE</span>
          <span className="mx-4">CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE  •  CASH ON DELIVERY  •  NEW DROPS AVAILABLE NOW  •  CUSTOM DESIGNS AVAILABLE</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="font-display text-4xl text-white font-black hover:text-primary transition-colors" onClick={closeMenu}>
            S!
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-sm font-display uppercase tracking-widest text-white hover:text-primary transition-colors">Home</Link>
          <Link href="/shop" className="text-sm font-display uppercase tracking-widest text-white hover:text-primary transition-colors">Shop</Link>
          <Link href="/custom-design" className="text-sm font-display uppercase tracking-widest text-white hover:text-primary transition-colors">Custom Design</Link>
          <Link href="/size-chart" className="text-sm font-display uppercase tracking-widest text-white hover:text-primary transition-colors">Size Chart</Link>
          <Link href="/contact" className="text-sm font-display uppercase tracking-widest text-white hover:text-primary transition-colors">Contact</Link>
        </nav>

        {/* Right Icons */}
        <div className="flex items-center gap-4">
          <button className="text-white hover:text-primary transition-colors p-2" aria-label="Search" data-testid="btn-search">
            <Search size={20} />
          </button>
          
          <div className="relative">
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 mt-2 w-48 bg-card border border-border shadow-2xl z-50 flex flex-col py-2"
                    >
                      <Link href="/profile" className="px-4 py-2 text-sm text-white hover:bg-primary/20 hover:text-primary transition-colors uppercase tracking-widest font-bold" onClick={() => setUserDropdownOpen(false)}>MY PROFILE</Link>
                      <Link href="/my-orders" className="px-4 py-2 text-sm text-white hover:bg-primary/20 hover:text-primary transition-colors uppercase tracking-widest font-bold" onClick={() => setUserDropdownOpen(false)}>MY ORDERS</Link>
                      <button 
                        className="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 text-left transition-colors uppercase tracking-widest font-bold mt-2 border-t border-border pt-3"
                        onClick={() => {
                          logout();
                          setUserDropdownOpen(false);
                          setLocation("/");
                        }}
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

          <Link href="/cart" className="text-white hover:text-primary transition-colors p-2 relative" data-testid="link-cart">
            <ShoppingBag size={20} />
            {totalItems > 0 && (
              <motion.span 
                key={totalItems}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-0 right-0 w-4 h-4 bg-primary text-black text-[10px] flex items-center justify-center font-bold"
              >
                {totalItems}
              </motion.span>
            )}
          </Link>

          <button 
            className="md:hidden text-white p-2" 
            onClick={toggleMenu}
            aria-label="Toggle menu"
            data-testid="btn-mobile-menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-full left-0 w-full bg-background border-b border-border shadow-2xl z-40 max-h-[calc(100vh-6rem)] overflow-y-auto"
          >
            <div className="flex flex-col p-4 gap-4">
              <Link href="/" className="text-xl font-display uppercase tracking-widest text-white py-2 border-b border-border/50" onClick={closeMenu}>Home</Link>
              <Link href="/shop" className="text-xl font-display uppercase tracking-widest text-white py-2 border-b border-border/50" onClick={closeMenu}>Shop</Link>
              <Link href="/custom-design" className="text-xl font-display uppercase tracking-widest text-white py-2 border-b border-border/50" onClick={closeMenu}>Custom Design</Link>
              <Link href="/size-chart" className="text-xl font-display uppercase tracking-widest text-white py-2 border-b border-border/50" onClick={closeMenu}>Size Chart</Link>
              <Link href="/contact" className="text-xl font-display uppercase tracking-widest text-white py-2 border-b border-border/50" onClick={closeMenu}>Contact</Link>
              
              {user ? (
                <>
                  <Link href="/profile" className="text-xl font-display uppercase tracking-widest text-primary py-2 border-b border-border/50" onClick={closeMenu}>My Profile</Link>
                  <Link href="/my-orders" className="text-xl font-display uppercase tracking-widest text-primary py-2 border-b border-border/50" onClick={closeMenu}>My Orders</Link>
                  <button 
                    className="text-xl font-display uppercase tracking-widest text-destructive py-2 text-left" 
                    onClick={() => { logout(); closeMenu(); setLocation("/"); }}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/login" className="text-xl font-display uppercase tracking-widest text-primary py-2" onClick={closeMenu}>Login / Sign Up</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

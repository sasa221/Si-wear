import { Link } from "wouter";
import { Instagram, Music, MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-background border-t border-border mt-12 md:mt-24">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-1 md:col-span-2">
            <h2 className="font-display text-4xl text-white mb-4">S! WEAR</h2>
            <p className="text-muted-foreground max-w-sm mb-6 text-body">
              A bold, unapologetic Egyptian streetwear label for young creatives who want to stand out. Quality over quantity, always.
            </p>
          </div>
          
          <div>
            <h3 className="font-display text-xl mb-4 text-white uppercase tracking-widest">Shop</h3>
            <ul className="space-y-3 flex flex-col">
              <li><Link href="/shop" className="text-muted-foreground hover:text-primary transition-colors">All Products</Link></li>
              <li><Link href="/shop?category=T-Shirts" className="text-muted-foreground hover:text-primary transition-colors">T-Shirts</Link></li>
              <li><Link href="/shop?category=Shirts" className="text-muted-foreground hover:text-primary transition-colors">Shirts</Link></li>
              <li><Link href="/shop?category=Pants" className="text-muted-foreground hover:text-primary transition-colors">Pants</Link></li>
              <li><Link href="/custom-design" className="text-muted-foreground hover:text-primary transition-colors">Custom Design</Link></li>
              <li><Link href="/size-chart" className="text-muted-foreground hover:text-primary transition-colors">Size Chart</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-display text-xl mb-4 text-white uppercase tracking-widest">Support</h3>
            <ul className="space-y-3 flex flex-col">
              <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
              <li><Link href="/shipping-policy" className="text-muted-foreground hover:text-primary transition-colors">Shipping Policy</Link></li>
              <li><Link href="/returns-exchange-policy" className="text-muted-foreground hover:text-primary transition-colors">Returns & Exchange</Link></li>
              <li><Link href="/privacy-policy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms-conditions" className="text-muted-foreground hover:text-primary transition-colors">Terms & Conditions</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">© 2025 S! Wear. Made in Egypt.</p>
          <div className="flex gap-4">
            <a href="#" className="w-10 h-10 bg-card flex items-center justify-center rounded-none text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors" aria-label="Instagram">
              <Instagram size={18} />
            </a>
            <a href="#" className="w-10 h-10 bg-card flex items-center justify-center rounded-none text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors" aria-label="TikTok">
              <Music size={18} />
            </a>
            <Link href="/custom-design" className="w-10 h-10 bg-card flex items-center justify-center rounded-none text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors" aria-label="Custom Design">
              <MessageCircle size={18} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

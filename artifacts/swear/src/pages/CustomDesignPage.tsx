import { motion } from "framer-motion";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { Paintbrush, Send, Zap } from "lucide-react";
import { defaultStoreSettings, getStoreSettings } from "@/lib/storeSettings";

export default function CustomDesignPage() {
  const [whatsappNumber, setWhatsappNumber] = useState(defaultStoreSettings.whatsappNumber);

  useEffect(() => {
    let cancelled = false;
    getStoreSettings()
      .then(settings => {
        if (!cancelled) setWhatsappNumber(settings.whatsappNumber || defaultStoreSettings.whatsappNumber);
      })
      .catch(err => console.error("Failed to load store settings:", err));
    return () => { cancelled = true; };
  }, []);

  const handleWhatsApp = () => {
    const message = "Hello S! Wear, I want to create a custom design.\nProduct type: \nSize: \nColor: \nDesign idea: ";
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full"
    >
      {/* Hero */}
      <section className="py-24 md:py-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111] via-black to-black text-center px-4">
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-black uppercase text-white mb-6">
          DESIGN IT<br/><span className="text-primary">YOUR WAY</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Premium streetwear with your artwork. No minimum order quantity. Full creative control.
        </p>
        <button 
          onClick={handleWhatsApp}
          className="inline-flex h-16 items-center justify-center bg-primary text-black font-display font-bold uppercase tracking-widest text-xl px-12 hover:bg-white transition-colors"
        >
          START YOUR ORDER
        </button>
      </section>

      {/* Steps */}
      <section className="py-24 bg-card container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-display uppercase font-bold text-white text-center mb-16">HOW IT WORKS</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
          <div className="text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-background border border-primary flex items-center justify-center text-primary mb-6">
              <Paintbrush size={32} />
            </div>
            <h3 className="font-display text-3xl text-white uppercase mb-4">1. PICK ITEM</h3>
            <p className="text-muted-foreground">Choose from our premium blanks: oversized tees, boxy shirts, or hoodies in various colors.</p>
          </div>
          
          <div className="text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-background border border-primary flex items-center justify-center text-primary mb-6">
              <Send size={32} />
            </div>
            <h3 className="font-display text-3xl text-white uppercase mb-4">2. SHARE DESIGN</h3>
            <p className="text-muted-foreground">Send us your artwork, logo, or concept via WhatsApp. We'll verify the print quality.</p>
          </div>
          
          <div className="text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-background border border-primary flex items-center justify-center text-primary mb-6">
              <Zap size={32} />
            </div>
            <h3 className="font-display text-3xl text-white uppercase mb-4">3. WE PRINT</h3>
            <p className="text-muted-foreground">Using high-end DTF or screen printing, we bring your vision to life on premium fabric.</p>
          </div>
        </div>
      </section>

      <section className="py-24 text-center container mx-auto px-4">
        <h2 className="text-3xl font-display uppercase font-bold text-white mb-6">NEED BULK FOR YOUR BRAND?</h2>
        <p className="text-muted-foreground mb-8">We offer special pricing for B2B orders and brand merchandise.</p>
        <Link href="/contact" className="text-primary hover:text-white uppercase tracking-widest underline underline-offset-8 transition-colors">
          CONTACT US FOR WHOLESALE
        </Link>
      </section>
    </motion.div>
  );
}

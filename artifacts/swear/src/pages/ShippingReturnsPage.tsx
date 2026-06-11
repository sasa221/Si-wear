import { motion } from "framer-motion";
import { Truck, RotateCcw, Package } from "lucide-react";

export default function ShippingReturnsPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-24 max-w-4xl"
    >
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-16 text-center">SHIPPING & RETURNS</h1>

      <div className="space-y-16">
        <section className="bg-card border border-border p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-primary pointer-events-none">
            <Truck size={120} />
          </div>
          <h2 className="text-4xl font-display uppercase text-white mb-6 relative z-10">DELIVERY INFO</h2>
          <div className="space-y-4 text-muted-foreground relative z-10">
            <p className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-white">Estimated Time</span>
              <span>3-7 Business Days</span>
            </p>
            <p className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-white">Payment Method</span>
              <span>Cash on Delivery Only</span>
            </p>
            <p className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-white">Coverage</span>
              <span>All Governorates in Egypt</span>
            </p>
          </div>
        </section>

        <section className="bg-card border border-border p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-primary pointer-events-none">
            <Package size={120} />
          </div>
          <h2 className="text-4xl font-display uppercase text-white mb-6 relative z-10">SHIPPING FEES</h2>
          <div className="space-y-4 text-muted-foreground relative z-10">
            <p className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-white">Delivery Fee</span>
              <span>60 EGP (All governorates)</span>
            </p>
            <p className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-white">Discount Codes</span>
              <span>Enter at checkout</span>
            </p>
          </div>
        </section>

        <section className="bg-card border border-border p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-primary pointer-events-none">
            <RotateCcw size={120} />
          </div>
          <h2 className="text-4xl font-display uppercase text-white mb-6 relative z-10">RETURN POLICY</h2>
          <div className="space-y-4 text-muted-foreground relative z-10">
            <p>We accept exchanges within <span className="text-white font-bold">7 days</span> of receiving your order.</p>
            <ul className="list-disc pl-5 space-y-2 mt-4">
              <li>Items must be unworn, unwashed, and in original condition.</li>
              <li>Original tags must remain attached.</li>
              <li>Customer is responsible for exchange shipping fees unless the item is defective.</li>
              <li>Custom designs are final sale and cannot be returned/exchanged unless defective.</li>
            </ul>
            
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-xl font-display uppercase text-white mb-2">How to Exchange</h3>
              <p>Message us on WhatsApp (+201220172714) with your order details and photos of the item. We will arrange a courier pickup and drop-off.</p>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

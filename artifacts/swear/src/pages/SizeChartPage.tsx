import { motion } from "framer-motion";
import AdsterraBannerAd from "@/components/ads/AdsterraBannerAd";

export default function SizeChartPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-16 max-w-4xl"
    >
      <h1 className="text-5xl md:text-7xl font-display font-black uppercase text-white mb-6 text-center">SIZE CHART</h1>
      <p className="text-muted-foreground text-center mb-16 text-lg">Find your perfect fit. Our garments run true to the intended cut (oversized means oversized).</p>

        <div className="space-y-16">
          {/* T-Shirt Chart */}

          <div>
            <h2 className="text-3xl font-display uppercase text-primary mb-6 border-l-4 border-primary pl-4">Oversized Heavy Cotton T-Shirt</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse bg-card">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="p-4 font-display uppercase tracking-widest text-white">Size</th>
                  <th className="p-4 font-display uppercase tracking-widest text-white">Width (cm)</th>
                  <th className="p-4 font-display uppercase tracking-widest text-white">Length (cm)</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">S</td>
                  <td className="p-4">55</td>
                  <td className="p-4">70</td>
                </tr>
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">M</td>
                  <td className="p-4">58</td>
                  <td className="p-4">72</td>
                </tr>
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">L</td>
                  <td className="p-4">61</td>
                  <td className="p-4">75</td>
                </tr>
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">XL</td>
                  <td className="p-4">64</td>
                  <td className="p-4">77</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">2XL</td>
                  <td className="p-4">67</td>
                  <td className="p-4">79</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Shirts Chart */}
        <div>
          <h2 className="text-3xl font-display uppercase text-primary mb-6 border-l-4 border-primary pl-4">Boxy Fit Shirt</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse bg-card">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="p-4 font-display uppercase tracking-widest text-white">Size</th>
                  <th className="p-4 font-display uppercase tracking-widest text-white">Width (cm)</th>
                  <th className="p-4 font-display uppercase tracking-widest text-white">Length (cm)</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">M</td>
                  <td className="p-4">62</td>
                  <td className="p-4">71</td>
                </tr>
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">L</td>
                  <td className="p-4">65</td>
                  <td className="p-4">72</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">XL</td>
                  <td className="p-4">67</td>
                  <td className="p-4">73</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pants Chart */}
        <div>
          <h2 className="text-3xl font-display uppercase text-primary mb-6 border-l-4 border-primary pl-4">Wide Leg Pant</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse bg-card">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="p-4 font-display uppercase tracking-widest text-white">Size</th>
                  <th className="p-4 font-display uppercase tracking-widest text-white">Recommended Weight</th>
                  <th className="p-4 font-display uppercase tracking-widest text-white">Max Height</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">M</td>
                  <td className="p-4">60 - 75 kg</td>
                  <td className="p-4">Up to 175 cm</td>
                </tr>
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">L</td>
                  <td className="p-4">75 - 90 kg</td>
                  <td className="p-4">Up to 180 cm</td>
                </tr>
                <tr className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">XL</td>
                  <td className="p-4">85 - 100 kg</td>
                  <td className="p-4">Up to 190 cm</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-bold">XXL</td>
                  <td className="p-4">95 - 120 kg</td>
                  <td className="p-4">Up to 195 cm</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* How to measure */}
        <div className="border border-border p-8 bg-card mt-16">
          <h2 className="text-3xl font-display uppercase text-white mb-6">HOW TO MEASURE</h2>

          <div className="mt-12 flex justify-center">
            <AdsterraBannerAd variant="300x250" />
          </div>





          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-muted-foreground">


            <div>
              <h3 className="text-white font-bold uppercase mb-2 tracking-wider">Width</h3>
              <p>Measure across the chest, 2cm below the armhole. Lay the garment flat.</p>
            </div>
            <div>
              <h3 className="text-white font-bold uppercase mb-2 tracking-wider">Length</h3>
              <p>Measure from the highest point of the shoulder down to the bottom hem.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

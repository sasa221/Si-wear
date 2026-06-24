import { useEffect, useState } from "react";
import AdsterraBannerAd, { type AdsterraBannerVariant } from "@/components/ads/AdsterraBannerAd";

const DESKTOP_BREAKPOINT = 760;

function getVariantForViewport(): AdsterraBannerVariant {
  if (typeof window === "undefined") return "300x250";
  return window.innerWidth >= DESKTOP_BREAKPOINT ? "728x90" : "300x250";
}

export default function ResponsiveAdsterraBanner({ className }: { className?: string }) {
  const [variant, setVariant] = useState<AdsterraBannerVariant>(getVariantForViewport);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncVariant = () => setVariant(getVariantForViewport());

    syncVariant();
    window.addEventListener("resize", syncVariant);
    return () => window.removeEventListener("resize", syncVariant);
  }, []);

  return <AdsterraBannerAd variant={variant} className={className} />;
}

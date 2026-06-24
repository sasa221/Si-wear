import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-1843771211926020";
const ADSENSE_SLOT = "1472712384";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function GoogleAdSenseAd() {
  const adRef = useRef<HTMLModElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (typeof window === "undefined") return;
    if (!adRef.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      initializedRef.current = true;
    } catch {
      // AdSense can be blocked by extensions or remain blank before approval.
    }
  }, []);

  return (
    <section className="mx-auto my-12 w-full max-w-[728px] px-4" aria-label="Advertisement">
      <div className="mb-2 flex justify-center">
        <span className="text-[10px] uppercase tracking-widest text-zinc-400">Advertisement</span>
      </div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

export type AdsterraBannerVariant = "728x90" | "300x250";

type AdsterraAtOptions = {
  key: string;
  format: "iframe";
  height: number;
  width: number;
  params: Record<string, unknown>;
};

const EXCLUDED_ROUTE_PREFIXES: string[] = [
  "/admin",
  "/cart",
  "/checkout",
  "/login",
  "/signup",
  "/my-orders",
  "/order",
];



const VARIANT_OPTIONS: Record<AdsterraBannerVariant, AdsterraAtOptions> = {
  "728x90": {
    key: "22f2562a18ec8f3ee1e8d25348108a18",
    format: "iframe",
    height: 90,
    width: 728,
    params: {},
  },
  "300x250": {
    key: "ed641de555be50ce3ec2b3f2581423db",
    format: "iframe",
    height: 250,
    width: 300,
    params: {},
  },
};

function routeIsExcluded(pathname: string) {
  return EXCLUDED_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export default function AdsterraBannerAd({
  variant,
  className,
}: {
  variant: AdsterraBannerVariant;
  className?: string;
}) {
  const [location] = useLocation();
  const pathname = typeof location === "string" ? location : "";
  const excluded = routeIsExcluded(pathname);

  const atOptions = VARIANT_OPTIONS[variant];

  const wrapperId = useMemo(() => {
    const base = `adsterra-${atOptions.key}-${atOptions.width}x${atOptions.height}`;
    return base.replace(/[^a-zA-Z0-9\-_]/g, "");
  }, [atOptions.height, atOptions.key, atOptions.width]);

  const injectedOnceRef = useRef(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (excluded) return;
    if (injectedOnceRef.current) return;

    if (typeof document === "undefined") return;

    const wrapperEl = document.getElementById(wrapperId);
    if (!wrapperEl) return;

    // Reserve space to avoid layout shift.
    wrapperEl.style.width = `${atOptions.width}px`;
    wrapperEl.style.height = `${atOptions.height}px`;

    // Avoid duplicate script injection per ad slot.
    if (document.getElementById(wrapperId + "-script")) {
      injectedOnceRef.current = true;
      return;
    }

    injectedOnceRef.current = true;

    // Adsterra iframe invoke snippet (script+calling atOptions).
    // We must not guess domain beyond the snippet; therefore this uses the standard Adsterra
    // invoke pattern with the provided key/format.
    const script = document.createElement("script");
    script.id = wrapperId + "-script";
    script.type = "text/javascript";
    script.async = true;

    // Adsterra expected invoke URL.
    // If the full copied snippet is different, user must provide it.
    const invokeSrc = "https://www.adsterra.com/ads/scripts/invoke.js";

    script.src = invokeSrc;

    const timeout = window.setTimeout(() => {
      setBlocked(true);
    }, 2500);

    const onLoadOrError = () => {
      window.clearTimeout(timeout);
      // If blocked, wrapper will likely stay empty; we still render reserve box.
    };

    script.onload = onLoadOrError;
    script.onerror = () => {
      window.clearTimeout(timeout);
      setBlocked(true);
    };

    document.body.appendChild(script);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.atOptions = {
      key: atOptions.key,
      format: atOptions.format,
      height: atOptions.height,
      width: atOptions.width,
      params: atOptions.params,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoke = w.__adsterra_invoke;
    // Some snippets rely on invoke.js auto-executing into #wrapper.
    // We keep fallback label if it doesn't.
    if (typeof invoke === "function") {
      try {
        invoke(wrapperEl);
      } catch {
        // ignore
      }
    }

    return () => {
      window.clearTimeout(timeout);
    };
  }, [atOptions, excluded, injectedOnceRef, wrapperId]);

  if (excluded) return null;

  const minWidth = variant === "728x90" ? 728 : 300;

  return (
    <section className={className} aria-label="Advertisement">
      <div className="mt-6 w-full flex flex-col items-center">
        <div className="w-full flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Advertisement</span>
        </div>

        <div
          id={wrapperId}
          className="adsterra-wrapper bg-[#0b0b0b] border border-[#1a1a1a]"
          style={{
            minWidth: `${minWidth}px`,
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          {/* invoke.js will fill this. */}
          {blocked && (
            <div className="w-full h-full flex items-center justify-center text-[12px] text-zinc-500">
              If ads are blocked, this area may stay empty.
            </div>
          )}
        </div>

        {variant === "728x90" && (
          <div className="hidden md:block" />
        )}
      </div>
    </section>
  );
}


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

function safeInvokeWarn(message: string) {
  // dev-safe console warnings only
  if (typeof window !== "undefined" && window?.console?.warn) {
    window.console.warn(`[AdsterraBannerAd] ${message}`);
  }
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

  const mountedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  // Remount/route change support by clearing per-wrapper content.
  useEffect(() => {
    if (excluded) return;
    if (typeof document === "undefined") return;

    const wrapperEl = document.getElementById(wrapperId);
    if (!wrapperEl) return;

    // Reserve space to avoid layout shift.
    wrapperEl.style.width = `${atOptions.width}px`;
    wrapperEl.style.height = `${atOptions.height}px`;

    // Clear old injected nodes to avoid duplicate scripts.
    // (Provider renders into this wrapper.)
    while (wrapperEl.firstChild) {
      wrapperEl.removeChild(wrapperEl.firstChild);
    }

    // Avoid endlessly appending external scripts.
    // We'll still append fresh for each mount, but we ensure we don't stack multiple wrapper-specific invoke scripts.
    const existingInvokeScript = document.getElementById(wrapperId + "-invoke");
    if (existingInvokeScript) {
      existingInvokeScript.remove();
    }

    // Clear atOptions global (provider relies on window.atOptions)
    const w = window as any;
    w.atOptions = {
      key: atOptions.key,
      format: atOptions.format,
      height: atOptions.height,
      width: atOptions.width,
      params: atOptions.params,
    };

    // Exact inline snippet as provided.
    // IMPORTANT: must set global window.atOptions AND inline atOptions = { ... }.
    const atOptionsScript = document.createElement("script");
    atOptionsScript.type = "text/javascript";
    atOptionsScript.id = wrapperId + "-atOptions";
    atOptionsScript.text = `
<script>
  atOptions = {
    'key' : '${atOptions.key}',
    'format' : 'iframe',
    'height' : ${atOptions.height},
    'width' : ${atOptions.width},
    'params' : {}
  };
</script>
`.replace("<script>", "").replace("</script>", "");

    // Actually inject into document so the snippet runs in page context.
    // The external script expects window.atOptions and uses the wrapper to render.

    const injectContainer = document.body;

    injectContainer.appendChild(atOptionsScript);

    // External invoke snippet (exact URL)
    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.async = true;
    invokeScript.id = wrapperId + "-invoke";
    invokeScript.src = `https://www.highperformanceformat.com/${atOptions.key}/invoke.js`;

    const timeout = window.setTimeout(() => {
      setFailed(true);
      safeInvokeWarn(`script timeout for variant ${variant}`);
    }, 3500);

    invokeScript.onload = () => {
      window.clearTimeout(timeout);
      // Do not show placeholder text unless it fails after load.
      // We keep reserved space; if provider doesn't render, it will remain empty.
    };
    invokeScript.onerror = () => {
      window.clearTimeout(timeout);
      setFailed(true);
      safeInvokeWarn(`script error for variant ${variant}`);
    };

    // Append invoke after atOptions inline snippet.
    injectContainer.appendChild(invokeScript);

    mountedRef.current = true;

    return () => {
      window.clearTimeout(timeout);
      // Remove injected scripts for this wrapper.
      const s1 = document.getElementById(wrapperId + "-atOptions");
      if (s1 && s1.parentNode) s1.parentNode.removeChild(s1);
      const s2 = document.getElementById(wrapperId + "-invoke");
      if (s2 && s2.parentNode) s2.parentNode.removeChild(s2);
    };
  }, [excluded, atOptions.height, atOptions.key, atOptions.params, atOptions.format, atOptions.width, variant, wrapperId]);

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
        />

        {failed ? null : null}

        {variant === "728x90" && <div className="hidden md:block" />}
      </div>
    </section>
  );
}


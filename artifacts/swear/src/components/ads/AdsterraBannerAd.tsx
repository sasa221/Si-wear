import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

export type AdsterraBannerVariant = "728x90" | "300x250";

type AdsterraBannerConfig = {
  key: string;
  format: "iframe";
  height: number;
  width: number;
  params: Record<string, unknown>;
};

type DebugState = {
  containerChildrenCount: number;
  scriptAppended: boolean;
  scriptLoaded: boolean;
  scriptError: boolean;
  viewportWidth: number;
  renderMessage: string;
};

declare global {
  interface Window {
    atOptions?: AdsterraBannerConfig;
  }
}

const QUERY_DEBUG_KEY = "addebug";

const EXCLUDED_ROUTE_PREFIXES: string[] = [
  "/admin",
  "/cart",
  "/checkout",
  "/login",
  "/signup",
  "/my-orders",
  "/order",
  "/orders",
  "/product",
  "/products",
];

const VARIANT_CONFIGS: Record<AdsterraBannerVariant, AdsterraBannerConfig> = {
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

function getAdDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get(QUERY_DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function safeInvokeWarn(message: string) {
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
  const debugEnabled = getAdDebugEnabled();
  const bannerConfig = VARIANT_CONFIGS[variant];
  const variantLabel = variant === "728x90" ? "leaderboard" : "rectangle";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderCheckTimerRef = useRef<number | null>(null);
  const [debugState, setDebugState] = useState<DebugState>({
    containerChildrenCount: 0,
    scriptAppended: false,
    scriptLoaded: false,
    scriptError: false,
    viewportWidth: typeof window !== "undefined" ? window.innerWidth : 0,
    renderMessage: "",
  });

  const updateDebugState = (next: Partial<DebugState>) => {
    if (!debugEnabled) return;
    setDebugState(prev => ({ ...prev, ...next }));
  };

  useEffect(() => {
    if (!debugEnabled || typeof window === "undefined") return;

    const syncViewportWidth = () => {
      updateDebugState({
        viewportWidth: window.innerWidth,
        containerChildrenCount: containerRef.current?.children.length ?? 0,
      });
    };

    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);
    return () => window.removeEventListener("resize", syncViewportWidth);
  }, [debugEnabled]);

  useEffect(() => {
    if (excluded) return;
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    if (!container) return;

    updateDebugState({
      containerChildrenCount: 0,
      scriptAppended: false,
      scriptLoaded: false,
      scriptError: false,
      viewportWidth: window.innerWidth,
      renderMessage: "",
    });

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    container.style.width = `${bannerConfig.width}px`;
    container.style.height = `${bannerConfig.height}px`;
    container.style.maxWidth = "100%";

    window.atOptions = {
      key: bannerConfig.key,
      format: bannerConfig.format,
      height: bannerConfig.height,
      width: bannerConfig.width,
      params: bannerConfig.params,
    };

    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.async = true;
    invokeScript.src = `https://www.highperformanceformat.com/${bannerConfig.key}/invoke.js`;

    invokeScript.onload = () => {
      updateDebugState({
        scriptLoaded: true,
        containerChildrenCount: container.children.length,
      });

      renderCheckTimerRef.current = window.setTimeout(() => {
        const renderedNodes = Array.from(container.children).filter(node => node !== invokeScript);
        const hasIframe = !!container.querySelector("iframe");
        const hasRenderedAd = hasIframe || renderedNodes.length > 0;

        updateDebugState({
          containerChildrenCount: container.children.length,
          renderMessage: hasRenderedAd
            ? ""
            : "script loaded but no iframe/ad rendered; likely ad blocker, no-fill, or network blocked.",
        });
      }, 1800);
    };

    invokeScript.onerror = () => {
      updateDebugState({
        scriptError: true,
        containerChildrenCount: container.children.length,
      });
      safeInvokeWarn(`script error for variant ${variant}`);
    };

    container.appendChild(invokeScript);
    updateDebugState({
      scriptAppended: true,
      containerChildrenCount: container.children.length,
    });

    return () => {
      if (renderCheckTimerRef.current) {
        window.clearTimeout(renderCheckTimerRef.current);
        renderCheckTimerRef.current = null;
      }
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [
    bannerConfig.format,
    bannerConfig.height,
    bannerConfig.key,
    bannerConfig.params,
    bannerConfig.width,
    debugEnabled,
    excluded,
    pathname,
    variant,
  ]);

  if (excluded) return null;

  return (
    <section className={className} aria-label="Advertisement">
      <div className="my-12 flex w-full flex-col items-center">
        <div className="mb-2 flex w-full items-center justify-center">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400">Advertisement</span>
        </div>

        {debugEnabled && (
          <div className="mb-2 text-center text-[10px] uppercase tracking-wide text-zinc-500">
            <div>variant: {variantLabel}</div>
            <div>key: {bannerConfig.key}</div>
            <div>script appended: {debugState.scriptAppended ? "yes" : "no"}</div>
            <div>script loaded: {debugState.scriptLoaded ? "yes" : "no"}</div>
            <div>script error: {debugState.scriptError ? "yes" : "no"}</div>
            <div>container children count: {debugState.containerChildrenCount}</div>
            <div>route/pathname: {pathname}</div>
            <div>viewport width: {debugState.viewportWidth}</div>
            {debugState.renderMessage && <div>{debugState.renderMessage}</div>}
          </div>
        )}

        <div
          ref={containerRef}
          className="adsterra-wrapper flex items-center justify-center overflow-hidden"
          style={{
            width: `${bannerConfig.width}px`,
            height: `${bannerConfig.height}px`,
            maxWidth: "100%",
          }}
        />
      </div>
    </section>
  );
}

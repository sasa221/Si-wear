import { useEffect, useState } from "react";

const SCRIPT_URL = "https://pl29870845.effectivecpmnetwork.com/1d14148284c10554d565eeccffdddc82/invoke.js";
const CONTAINER_ID = "container-1d14148284c10554d565eeccffdddc82";

function isElementInDom(id: string) {
  return typeof document !== "undefined" && !!document.getElementById(id);
}

export default function ExternalNativeAd() {
  const [scriptReady, setScriptReady] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Ensure container exists (React render should do this, but guard anyway)
    if (!isElementInDom(CONTAINER_ID)) return;

    const win = window as any;
    const globalKey = "__external_native_adsterra_pl29870845_loaded";

    // Avoid duplicate injection
    if (win?.[globalKey]) {
      setScriptReady(true);
      return;
    }

    win[globalKey] = true;

    // If adblocker blocks, script tag may never load.
    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = SCRIPT_URL;

    const timeout = window.setTimeout(() => {
      // If the script failed to initialize, we mark blocked.
      // (We intentionally do NOT retry to avoid duplicates.)
      setBlocked(true);
    }, 2500);

    script.onload = () => {
      window.clearTimeout(timeout);
      setScriptReady(true);
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      setBlocked(true);
    };

    // Insert once per mount if not already present
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (!existing) {
      document.body.appendChild(script);
    } else {
      // Script tag already exists; treat as ready once container exists.
      setScriptReady(true);
    }

    // Cleanup: do not remove script to prevent multiple re-injects across navigation.
    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <section
      className="w-full"
      aria-label="Advertisement"
    >
      <div
        className="bg-[#0b0b0b] border border-[#1a1a1a] text-white"
        style={{ minHeight: 140 }}
      >
        <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-4">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Advertisement
          </span>
          {/* subtle status indicator without layout shift */}
          {!scriptReady && (
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Loading…</span>
          )}
        </div>
        <div className="px-4 pb-4">
          <div id={CONTAINER_ID} />
          {blocked && (
            <div className="mt-3 text-[12px] text-zinc-500">
              If ads are blocked, this area may stay empty.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


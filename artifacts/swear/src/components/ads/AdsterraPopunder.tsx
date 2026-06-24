import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const ALLOWED_ROUTES: string[] = ["/", "/shop", "/size-chart", "/about", "/contact"];
const BLOCKED_PREFIXES: string[] = [
  "/admin",
  "/cart",
  "/checkout",
  "/login",
  "/signup",
  "/my-orders",
  "/orders",
  "/product",
  "/products",
];

const STORAGE_KEY = "swear_popunder_last_shown_at";
const MIN_DELAY_MS = 25_000;

function isAdSafeRoute(pathname: string) {
  // Block first
  if (BLOCKED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return false;
  // Allow exact or prefix where required
  if (pathname === "/") return true;
  return ALLOWED_ROUTES.some(r => pathname === r || (r !== "/" && pathname.startsWith(r)));
}

function hasUserInteracted() {
  // Best-effort: we only need a simple interaction flag.
  // We set it via listeners.
  return true;
}

export default function AdsterraPopunder() {
  const [location] = useLocation();
  const pathname = typeof location === "string" ? location : "";

  const safe = useMemo(() => isAdSafeRoute(pathname), [pathname]);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onInteract = () => setHasInteracted(true);
    window.addEventListener("click", onInteract, { once: true });
    window.addEventListener("scroll", onInteract, { once: true });
    window.addEventListener("keydown", onInteract, { once: true });

    return () => {
      window.removeEventListener("click", onInteract);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!safe) return;
    if (!hasInteracted) return;

    const lastRaw = window.localStorage.getItem(STORAGE_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();

    if (last && now - last < 24 * 60 * 60 * 1000) return;

    const timeout = window.setTimeout(() => {
      // Cancel if route became unsafe
      if (!isAdSafeRoute(pathname)) return;

      // Frequency cap: set timestamp right before injecting
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // ignore
      }

      const s = document.createElement("script");
      s.src =
        "https://pl29870844.effectivecpmnetwork.com/1d/c9/4b/1dc94b7fb8b8b16050331452551675fd.js";
      s.async = true;

      // invisible component: inject but keep UI unaffected
      document.body.appendChild(s);

      return () => {
        try {
          if (s.parentNode) s.parentNode.removeChild(s);
        } catch {
          // ignore
        }
      };
    }, MIN_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [safe, hasInteracted, pathname]);

  return null;
}


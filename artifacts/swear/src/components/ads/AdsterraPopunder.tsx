import { useEffect, useMemo, useRef } from "react";
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
const ARM_DELAY_MS = 10_000;

function isAdSafeRoute(pathname: string) {
  if (BLOCKED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return false;
  if (pathname === "/") return true;
  return ALLOWED_ROUTES.some(r => pathname === r || (r !== "/" && pathname.startsWith(r)));
}

function debugLog(enabled: boolean, msg: string) {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.debug(`[AdsterraPopunder] ${msg}`);
}

export default function AdsterraPopunder() {
  const [location] = useLocation();
  const pathname = typeof location === "string" ? location : "";

  const safe = useMemo(() => isAdSafeRoute(pathname), [pathname]);

  const armedRef = useRef(false);
  const attemptedRef = useRef(false);
  const armTimerRef = useRef<number | null>(null);

  const isDev = typeof import.meta !== "undefined" && import.meta?.env?.MODE !== "production";

  // Expose dev reset helper only in development.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDev) return;

    (window as any).__resetSwearPopunderCap = () => {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    };

    return () => {
      try {
        delete (window as any).__resetSwearPopunderCap;
      } catch {
        // ignore
      }
    };
  }, [isDev]);

  // Route-safe + frequency cap evaluation.
  useEffect(() => {
    debugLog(isDev, `mounted. route=${pathname} safe=${safe}`);

    // Reset on route change.
    armedRef.current = false;
    attemptedRef.current = false;
    if (armTimerRef.current) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }

    if (typeof window === "undefined") return;
    if (!safe) {
      debugLog(isDev, "route blocked");
      return;
    }

    const lastRaw = window.localStorage.getItem(STORAGE_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();
    const within24h = !!(last && now - last < 24 * 60 * 60 * 1000);

    if (within24h) {
      debugLog(isDev, "24h cap blocked");
      return;
    }

    debugLog(isDev, `waiting for safe route interaction. will arm in ${ARM_DELAY_MS}ms`);

    armTimerRef.current = window.setTimeout(() => {
      // Before arming, re-check route safety (route might have changed).
      if (!isAdSafeRoute(pathname)) return;
      armedRef.current = true;
      debugLog(isDev, "armed: next user gesture may inject popunder");
    }, ARM_DELAY_MS);

    return () => {
      if (armTimerRef.current) {
        window.clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe, pathname, isDev]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const events: (keyof WindowEventMap)[] = ["pointerdown", "touchstart", "click", "scroll"];

    const injectFromGesture = () => {
      if (attemptedRef.current) return;
      if (!safe) {
        debugLog(isDev, "gesture ignored: route blocked");
        return;
      }
      if (!armedRef.current) {
        debugLog(isDev, "gesture ignored: not armed yet");
        return;
      }

      attemptedRef.current = true;
      armedRef.current = false;

      // Re-check 24h cap right at injection attempt (and only set timestamp after attempt).
      const lastRaw = window.localStorage.getItem(STORAGE_KEY);
      const last = lastRaw ? Number(lastRaw) : 0;
      const now = Date.now();
      if (last && now - last < 24 * 60 * 60 * 1000) {
        debugLog(isDev, "24h cap blocked at injection time");
        return;
      }

      debugLog(isDev, "injecting popunder script (synchronously from user gesture)");

      const inject = () => {
        try {
          const s = document.createElement("script");
          s.src =
            "https://pl29870844.effectivecpmnetwork.com/1d/c9/4b/1dc94b7fb8b8b16050331452551675fd.js";
          s.async = true;

          // No UI.
          document.body.appendChild(s);

          s.onload = () => {
            debugLog(isDev, "script loaded");
          };
          s.onerror = () => {
            debugLog(isDev, "script load error");
          };

          // Set timestamp only after injection attempt.
          try {
            window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
          } catch {
            // ignore
          }
        } catch {
          debugLog(isDev, "script injection exception");
        }
      };

      // Delay requirement (>=25s) is handled via arming; we still keep MIN_DELAY_MS for safety.
      // If user triggers before 25s, we ignore until enough time has passed.
      const startTimeRaw = window.sessionStorage.getItem("swear_popunder_armed_started_at");
      const startTime = startTimeRaw ? Number(startTimeRaw) : 0;
      const elapsed = startTime ? Date.now() - startTime : ARM_DELAY_MS;
      if (elapsed < MIN_DELAY_MS) {
        debugLog(isDev, "gesture received before MIN_DELAY_MS; waiting for remaining time");
        // Do not inject; we'll rely on arming + next gesture.
        attemptedRef.current = false;
        return;
      }

      inject();
    };

    for (const ev of events) {
      window.addEventListener(ev, injectFromGesture, { passive: true });
    }

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, injectFromGesture);
      }
    };
  }, [safe, isDev, pathname]);

  // On arm: mark armed start time in sessionStorage so MIN_DELAY_MS can be honored.
  useEffect(() => {
    if (!safe) return;
    if (!armedRef.current) return;
    try {
      window.sessionStorage.setItem("swear_popunder_armed_started_at", String(Date.now()));
    } catch {
      // ignore
    }
  }, [safe]);

  return null;
}



import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

const STORAGE_KEY = "swear_popunder_last_shown_at";
const SCRIPT_SRC =
  "https://pl29870844.effectivecpmnetwork.com/1d/c9/4b/1dc94b7fb8b8b16050331452551675fd.js";

const MIN_DELAY_MS = 25_000; // enforced by normal arm timing
const ARM_DELAY_MS = 10_000; // normal mode
const DEBUG_ARM_DELAY_MS = 3_000; // debug mode

const QUERY_DEBUG_KEY = "addebug";

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

function isAdSafeRoute(pathname: string) {
  if (BLOCKED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return false;
  if (pathname === "/") return true;
  return ALLOWED_ROUTES.some(r => pathname === r || (r !== "/" && pathname.startsWith(r)));
}

function getAdDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get(QUERY_DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function safeSetStorageValue(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

function safeGetStorageValue() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function computeWithin24h(lastShownAtMs: number, now: number) {
  return !!lastShownAtMs && now - lastShownAtMs < 24 * 60 * 60 * 1000;
}

function createPopunderScript() {
  const s = document.createElement("script");
  s.src = SCRIPT_SRC;
  s.async = true;
  return s;
}

export default function AdsterraPopunder() {
  const [location] = useLocation();
  const pathname = typeof location === "string" ? location : "";

  const safeRoute = useMemo(() => isAdSafeRoute(pathname), [pathname]);
  const debugEnabled = getAdDebugEnabled();

  const isDev = typeof import.meta !== "undefined" && import.meta?.env?.MODE !== "production";

  // invisible in normal mode
  const [debugTick, setDebugTick] = useState(0);
  const debugStateRef = useRef({
    interactionReceived: false,
    armed: false,
    scriptInjected: false,
    scriptLoaded: false,
    scriptError: false,
    lastShownAt: null as string | null,
  });

  const armedRef = useRef(false);
  const attemptedRef = useRef(false);
  const armTimerRef = useRef<number | null>(null);

  const cleanupListenersRef = useRef<null | (() => void)>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  // Dev-only helper
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

  // Keep debug state fresh in debug mode
  const bumpDebug = () => {
    if (!debugEnabled) return;
    setDebugTick(t => t + 1);
  };

  // Cancel timers/listeners and reset state on route changes.
  useEffect(() => {
    attemptedRef.current = false;
    armedRef.current = false;
    debugStateRef.current.armed = false;
    debugStateRef.current.interactionReceived = false;

    if (armTimerRef.current) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }

    // Remove listeners if we attached any.
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }

    // Update lastShown timestamp for debug UI.
    if (debugEnabled) {
      debugStateRef.current.lastShownAt = safeGetStorageValue();
      bumpDebug();
    }

    if (typeof window === "undefined") return;
    if (!safeRoute) return;

    const lastRaw = safeGetStorageValue();
    const lastShownAtMs = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();

    const within24h = computeWithin24h(lastShownAtMs, now);
    const capPassed = debugEnabled ? true : !within24h;

    if (debugEnabled) {
      // cap bypass
      debugStateRef.current.lastShownAt = lastRaw;
      bumpDebug();
    } else if (!capPassed) {
      return;
    }

    const armDelay = debugEnabled ? DEBUG_ARM_DELAY_MS : ARM_DELAY_MS;
    armTimerRef.current = window.setTimeout(() => {
      // route may have changed; ensure still safe
      if (!isAdSafeRoute(pathname)) return;
      armedRef.current = true;
      debugStateRef.current.armed = true;
      bumpDebug();

      // store armed started time if we want strict MIN_DELAY behavior
      try {
        window.sessionStorage.setItem("swear_popunder_armed_started_at", String(Date.now()));
      } catch {
        // ignore
      }
    }, armDelay);

    return () => {
      if (armTimerRef.current) {
        window.clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, safeRoute]);

  // Gesture injection: pointerdown/touchstart/click ONLY (no scroll reliance).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const events: (keyof WindowEventMap)[] = ["pointerdown", "touchstart", "click"];

    const injectOnce = () => {
      if (attemptedRef.current) return;
      if (!isAdSafeRoute(pathname)) return;

      // arm gating
      if (!armedRef.current) return;

      attemptedRef.current = true;
      armedRef.current = false;
      debugStateRef.current.armed = false;

      // Cap check at injection time (normal mode only)
      const lastRaw = safeGetStorageValue();
      const lastShownAtMs = lastRaw ? Number(lastRaw) : 0;
      const now = Date.now();
      const within24h = computeWithin24h(lastShownAtMs, now);

      if (!debugEnabled && within24h) {
        bumpDebug();
        return;
      }

      // If we armed but it was less than MIN_DELAY, wait for remaining time before injecting.
      // In normal mode, armDelay=10s and MIN_DELAY=25s means we need extra 15s.
      // To keep logic predictable and mobile-friendly, we enforce elapsed time using sessionStorage.
      const armedStartRaw = window.sessionStorage.getItem("swear_popunder_armed_started_at");
      const armedStartMs = armedStartRaw ? Number(armedStartRaw) : 0;
      const elapsed = armedStartMs ? Date.now() - armedStartMs : 0;

      if (!debugEnabled && elapsed < MIN_DELAY_MS) {
        // Let the next gesture try again; do not inject now.
        attemptedRef.current = false;
        return;
      }

      // Avoid duplicates
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        debugStateRef.current.scriptInjected = true;
        bumpDebug();
        return;
      }

      debugStateRef.current.scriptInjected = true;
      bumpDebug();

      const s = createPopunderScript();
      scriptRef.current = s;

      s.onload = () => {
        debugStateRef.current.scriptLoaded = true;
        bumpDebug();
      };
      s.onerror = () => {
        debugStateRef.current.scriptError = true;
        bumpDebug();
      };

      // Timestamp only after we are attempting injection.
      safeSetStorageValue(String(Date.now()));
      debugStateRef.current.lastShownAt = safeGetStorageValue();

      document.body.appendChild(s);
    };

    const onAnyGesture = () => {
      debugStateRef.current.interactionReceived = true;
      bumpDebug();
      injectOnce();
    };

    // capture true so it’s part of the first user gesture path
    for (const ev of events) {
      window.addEventListener(ev, onAnyGesture, { capture: true });
    }

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, onAnyGesture, { capture: true } as any);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugEnabled, pathname]);

  // Debug box: debug mode only
  if (!debugEnabled) return null;

  const capRaw = safeGetStorageValue();
  const capMs = capRaw ? Number(capRaw) : 0;
  const within24h = computeWithin24h(capMs, Date.now());

  const capPassed = debugEnabled ? true : !within24h;

  const debugBoxStyle: React.CSSProperties = {
    position: "fixed",
    right: 12,
    bottom: 12,
    zIndex: 999999,
    background: "rgba(0,0,0,0.75)",
    color: "#fff",
    fontSize: 12,
    lineHeight: "16px",
    padding: "10px 12px",
    borderRadius: 8,
    width: 260,
    pointerEvents: "none",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
  };

  return (
    <div style={debugBoxStyle}>
      <div>pathname: {pathname}</div>
      <div>route allowed: {safeRoute ? "yes" : "no"}</div>
      <div>cap passed: {capPassed ? "yes" : "no"}</div>
      <div>debug mode: yes</div>
      <div>armed: {debugStateRef.current.armed ? "yes" : "no"}</div>
      <div>interaction received: {debugStateRef.current.interactionReceived ? "yes" : "no"}</div>
      <div>script injected: {debugStateRef.current.scriptInjected ? "yes" : "no"}</div>
      <div>script loaded: {debugStateRef.current.scriptLoaded ? "yes" : "no"}</div>
      <div>script error: {debugStateRef.current.scriptError ? "yes" : "no"}</div>
      <div>last shown: {debugStateRef.current.lastShownAt ?? "null"}</div>
      {/* keep render reactive */}
      <div style={{ opacity: 0.5 }}>tick: {debugTick}</div>
    </div>
  );
}


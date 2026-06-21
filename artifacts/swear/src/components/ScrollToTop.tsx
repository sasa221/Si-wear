import { useEffect } from "react";
import { useLocation } from "wouter";

export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.querySelectorAll<HTMLElement>("[data-route-scroll-root]").forEach(element => {
      element.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    });
  }, [location]);

  return null;
}

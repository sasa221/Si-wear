export const REQUIRED_PRODUCTION_API_URL = "https://si-wear-api-server-hu6e.vercel.app";

function normalizeApiBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

const configuredApiUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_URL as string | undefined);
let warnedAboutProductionApiUrl = false;

export function apiBaseUrl(): string {
  if (import.meta.env.PROD) {
    if (!warnedAboutProductionApiUrl) {
      if (configuredApiUrl && configuredApiUrl !== REQUIRED_PRODUCTION_API_URL) {
        console.warn("[S! Wear] VITE_API_URL must point to the production API host; using required API URL.");
      } else if (!configuredApiUrl) {
        console.warn("[S! Wear] VITE_API_URL is missing; using required production API URL.");
      }
      warnedAboutProductionApiUrl = true;
    }
    return REQUIRED_PRODUCTION_API_URL;
  }

  return configuredApiUrl;
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = apiBaseUrl();
  return base ? `${base}/api${normalizedPath}` : `/api${normalizedPath}`;
}

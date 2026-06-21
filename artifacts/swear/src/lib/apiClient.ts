import { getSupabaseAccessToken } from "@/lib/supabase";

type ApiPayload = Record<string, any>;

export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");
  return base ? `${base}/api${path}` : `/api${path}`;
}

async function readPayload(res: Response): Promise<ApiPayload> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) as ApiPayload : {};
  } catch {
    return { message: text };
  }
}

export function apiMessage(payload: ApiPayload, fallback: string): string {
  return typeof payload.message === "string" && payload.message
    ? payload.message
    : typeof payload.error === "string" && payload.error
      ? payload.error
      : fallback;
}

export async function apiFetchJson<T = ApiPayload>(
  path: string,
  init: RequestInit = {},
  fallback = "Request failed."
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new Error("API is not reachable. Start the API server and try again.");
  }

  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Error(apiMessage(payload, fallback));
  }

  return payload as T;
}

export async function adminApiFetchJson<T = ApiPayload>(
  path: string,
  init: RequestInit = {},
  fallback = "Admin request failed."
): Promise<T> {
  const token = getSupabaseAccessToken();
  if (!token) throw new Error("Admin login is required. Sign in again.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return apiFetchJson<T>(path, { ...init, headers }, fallback);
}

export async function customerApiFetchJson<T = ApiPayload>(
  path: string,
  init: RequestInit = {},
  fallback = "Request failed."
): Promise<T> {
  const token = getSupabaseAccessToken();
  if (!token) throw new Error("Login is required. Sign in again.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return apiFetchJson<T>(path, { ...init, headers }, fallback);
}

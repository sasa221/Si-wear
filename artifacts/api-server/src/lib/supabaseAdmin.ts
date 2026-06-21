import type { NextFunction, Request, Response } from "express";

export type SupabaseConfig = ReturnType<typeof getSupabaseConfig>;

export type AdminLocals = {
  supabaseConfig: SupabaseConfig;
  adminUserId: string;
};

export function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  return value?.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

export function getSupabaseConfig() {
  const url = normalizeSupabaseUrl(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || serviceRoleKey;

  if (!url || !serviceRoleKey || !anonKey) {
    throw Object.assign(
      new Error("Supabase server env is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API server."),
      { status: 500 },
    );
  }

  return { url, serviceRoleKey, anonKey };
}

export function getBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function readJson(res: globalThis.Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

export function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return [record["message"], record["details"], record["hint"], record["code"]]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ") || fallback;
  }
  return fallback;
}

export function getErrorStatus(err: unknown): number {
  return typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
    ? (err as { status: number }).status
    : 500;
}

export async function supabaseRequest(
  config: SupabaseConfig,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const payload = await readJson(res);
  if (!res.ok) {
    throw Object.assign(new Error(errorMessage(payload, res.statusText || "Supabase request failed.")), { status: res.status });
  }
  return payload;
}

export async function requireAdminUserId(config: SupabaseConfig, token: string): Promise<string> {
  const authRes = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  const authPayload = await readJson(authRes);
  if (!authRes.ok) {
    throw Object.assign(new Error(errorMessage(authPayload, "Invalid admin session.")), { status: 401 });
  }

  const authUser = authPayload as { id?: string };
  if (!authUser.id) {
    throw Object.assign(new Error("Invalid admin session."), { status: 401 });
  }

  const profileRows = await supabaseRequest(
    config,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=role,blocked,is_active&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  const profile = Array.isArray(profileRows) ? profileRows[0] as Record<string, unknown> | undefined : undefined;
  const role = String(profile?.role ?? "").toLowerCase();
  const blocked = profile?.blocked === true || profile?.blocked === "true" || profile?.blocked === "t";
  const isActive = !(profile?.is_active === false || profile?.is_active === "false" || profile?.is_active === "f");

  if (role !== "admin" || blocked || !isActive) {
    throw Object.assign(new Error("Admin access is required."), { status: 403 });
  }

  return authUser.id;
}

export async function adminAuthMiddleware(
  req: Request,
  res: Response<unknown, AdminLocals>,
  next: NextFunction,
) {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required." });
    }

    res.locals.supabaseConfig = config;
    res.locals.adminUserId = await requireAdminUserId(config, token);
    return next();
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Admin authentication failed.";
    req.log.error({ err: message, status }, "admin auth failed");
    return res.status(status).json({ error: "ADMIN_AUTH_FAILED", message });
  }
}

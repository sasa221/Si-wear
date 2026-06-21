import { Router, type IRouter } from "express";

const router: IRouter = Router();
const SETTINGS_ID = "default";

const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,
  brand_name: "S! Wear",
  whatsapp_number: "201220172714",
  announcement_bar_text: "",
  instagram_url: "",
  tiktok_url: "",
  facebook_url: "",
  store_location: "Gate 1, 113D Pyramids Gardens, Giza, Egypt",
  shipping_note: "Delivery fee is calculated by governorate and city/area at checkout.",
  returns_policy_text: "7-day exchange policy for delivered orders.",
  support_info: "+20 122 017 2714",
};

function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  return value?.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

function getSupabaseConfig() {
  const url = normalizeSupabaseUrl(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || serviceRoleKey;

  if (!url || !serviceRoleKey || !anonKey) {
    throw new Error("Supabase server env is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API server.");
  }

  return { url, serviceRoleKey, anonKey };
}

function getBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return [record["message"], record["details"], record["hint"], record["code"]]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ") || fallback;
  }
  return fallback;
}

async function supabaseRequest(config: ReturnType<typeof getSupabaseConfig>, path: string, init: RequestInit): Promise<unknown> {
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

async function requireAdminUserId(config: ReturnType<typeof getSupabaseConfig>, token: string): Promise<string> {
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
  const blocked = profile?.blocked === true || profile?.blocked === "true";
  const isActive = !(profile?.is_active === false || profile?.is_active === "false");
  if (role !== "admin" || blocked || !isActive) {
    throw Object.assign(new Error("Admin access is required to manage settings."), { status: 403 });
  }
  return authUser.id;
}

function cleanSettings(body: Record<string, unknown>) {
  const pick = (key: string, fallback: string) => {
    const value = body[key];
    return typeof value === "string" ? value.trim() : fallback;
  };
  return {
    ...DEFAULT_SETTINGS,
    brand_name: pick("brand_name", DEFAULT_SETTINGS.brand_name),
    whatsapp_number: pick("whatsapp_number", DEFAULT_SETTINGS.whatsapp_number).replace(/[^\d]/g, ""),
    announcement_bar_text: pick("announcement_bar_text", ""),
    instagram_url: pick("instagram_url", ""),
    tiktok_url: pick("tiktok_url", ""),
    facebook_url: pick("facebook_url", ""),
    store_location: pick("store_location", DEFAULT_SETTINGS.store_location),
    shipping_note: pick("shipping_note", DEFAULT_SETTINGS.shipping_note),
    returns_policy_text: pick("returns_policy_text", DEFAULT_SETTINGS.returns_policy_text),
    support_info: pick("support_info", DEFAULT_SETTINGS.support_info),
    updated_at: new Date().toISOString(),
  };
}

async function getSettings(config: ReturnType<typeof getSupabaseConfig>) {
  const rows = await supabaseRequest(config, `/rest/v1/store_settings?id=eq.${SETTINGS_ID}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (Array.isArray(rows) && rows[0]) return rows[0];
  return DEFAULT_SETTINGS;
}

router.get("/settings", async (_req, res) => {
  try {
    const config = getSupabaseConfig();
    return res.json({ settings: await getSettings(config) });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Settings could not be loaded.";
    return res.status(status).json({ error: "SETTINGS_FETCH_FAILED", message });
  }
});

router.put("/admin/settings", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to save settings." });
    }
    const adminUserId = await requireAdminUserId(config, token);
    const settings = cleanSettings(req.body ?? {});
    await supabaseRequest(config, "/rest/v1/store_settings?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(settings),
    });
    req.log.info({ admin_user_id: adminUserId }, "store settings saved");
    return res.json({ ok: true, settings });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Settings could not be saved.";
    req.log.error({ err: message, status }, "store settings save failed");
    return res.status(status).json({ error: "SETTINGS_SAVE_FAILED", message });
  }
});

export default router;

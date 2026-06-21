import { Router } from "express";

const router = Router();

function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  return value?.replace(/\/+$|\/rest\/v1$/i, "");
}

function maskProjectRef(url: string | undefined): string {
  try {
    if (!url) return "missing";
    const u = new URL(url);
    const host = u.hostname; // e.g. abcde123.supabase.co
    const parts = host.split(".");
    const ref = parts[0] ?? "";
    if (ref.length <= 6) return `${ref.replace(/./g, "*")}.${parts.slice(1).join(".")}`;
    const start = ref.slice(0, 4);
    const end = ref.slice(-3);
    return `${start}...${end}.${parts.slice(1).join(".")}`;
  } catch {
    return "invalid-url";
  }
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

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function parseErrorPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const parts = [record["message"], record["details"], record["hint"], record["code"]]
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

router.post("/admin/login", async (req, res) => {
  req.log.info("admin login request received");

  try {
    const { email, password } = req.body ?? {};

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    req.log.info({ email: normalizedEmail }, "normalized email");

    let config;
    try {
      config = getSupabaseConfig();
      req.log.info({ supabase_exists: true, supabase_project: maskProjectRef(config.url) }, "supabase config");
    } catch (err) {
      req.log.error({ err: err instanceof Error ? err.message : String(err) }, "supabase env missing");
      req.log.info({ supabase_exists: false }, "normalized env check");
      const reason = "SERVER_MISCONFIGURED";
      req.log.info({ final_reject_reason: reason }, "final reject reason");
      return res.status(500).json({ error: reason });
    }

    if (!normalizedEmail || typeof password !== "string" || password.length === 0) {
      const reason = "INVALID_CREDENTIALS";
      req.log.info({ final_reject_reason: reason }, "final reject reason");
      return res.status(401).json({ error: reason });
    }

    // Call Supabase Auth signInWithPassword
    const authRes = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    const authPayload = await readJson(authRes);
    if (!authRes.ok) {
      const parsed = parseErrorPayload(authPayload, authRes.statusText || "Auth failed");
      req.log.info({ auth_result: "failure", auth_error: parsed }, "Supabase Auth signInWithPassword");
      const reason = "INVALID_CREDENTIALS";
      req.log.info({ final_reject_reason: reason }, "final reject reason");
      return res.status(401).json({ error: reason, details: parsed });
    }

    // Success: extract user id without logging tokens
    const payload = authPayload as Record<string, any>;
    const session = payload.session ?? payload;
    const user = session?.user ?? payload.user;
    const userId = user?.id;

    req.log.info({ auth_result: "success", auth_user_id: userId ?? null }, "Supabase Auth signInWithPassword");

    if (!userId) {
      const reason = "INVALID_CREDENTIALS";
      req.log.info({ final_reject_reason: reason }, "final reject reason");
      return res.status(401).json({ error: reason });
    }

    // Check profile row using service role key
    const profileRes = await fetch(
      `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role,blocked,is_active`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          Accept: "application/json",
        },
      },
    );

    const profilePayload = await readJson(profileRes);
    let profile: Record<string, any> | null = null;
    if (profileRes.ok) {
      if (Array.isArray(profilePayload)) profile = profilePayload[0] ?? null;
      else profile = (profilePayload as Record<string, any>) ?? null;
    }

    req.log.info({ profile_found: Boolean(profile) }, "whether profile row was found");
    req.log.info({ profile_role: profile?.role ?? null, profile_blocked: profile?.blocked ?? null, profile_is_active: profile?.is_active ?? null }, "profile details");

    if (!profile) {
      const reason = "PROFILE_NOT_FOUND";
      req.log.info({ final_reject_reason: reason }, "final reject reason");
      return res.status(403).json({ error: reason });
    }

    const role = String(profile.role ?? "").toLowerCase();
    const blocked = Boolean(profile.blocked === true || profile.blocked === "t" || profile.blocked === "true");
    const isActive = !(profile.is_active === false || profile.is_active === "f" || profile.is_active === "false");

    if (role !== "admin") {
      const reason = "NOT_ADMIN";
      req.log.info({ final_reject_reason: reason }, "final reject reason");
      return res.status(403).json({ error: reason });
    }

    if (blocked || !isActive) {
      const reason = "ADMIN_BLOCKED";
      req.log.info({ final_reject_reason: reason }, "final reject reason");
      return res.status(403).json({ error: reason });
    }

    // All checks passed — return success with Supabase session for frontend auth
    req.log.info({ final_reject_reason: "none" }, "final reject reason");
    return res.json({
      ok: true,
      user_id: userId,
      email: user?.email || normalizedEmail,
      role: role,
      session: {
        access_token: session?.access_token || "",
        refresh_token: session?.refresh_token || "",
        expires_at: session?.expires_at,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Admin login failed");
    const reason = "SERVER_ERROR";
    req.log.info({ final_reject_reason: reason }, "final reject reason");
    return res.status(500).json({ error: reason });
  }
});

export default router;

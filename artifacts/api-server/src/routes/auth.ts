import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();
const RESERVED_CUSTOMER_EMAILS = new Set(["admin@swear.com"]);

class HttpError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "SIGNUP_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  return value?.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

function getSupabaseConfig() {
  const url = normalizeSupabaseUrl(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || serviceRoleKey;

  if (!url || !serviceRoleKey || !anonKey) {
    throw new HttpError(
      "Supabase server env is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API server.",
      500,
      "SERVER_MISCONFIGURED",
    );
  }

  return { url, serviceRoleKey, anonKey };
}

function isDuplicateEmail(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("email address") && normalized.includes("registered") ||
    normalized.includes("already exists") ||
    normalized.includes("duplicate") && normalized.includes("email");
}

function createSupabaseClients() {
  const config = getSupabaseConfig();
  const clientOptions = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };

  return {
    adminClient: createClient(config.url, config.serviceRoleKey, clientOptions),
    authClient: createClient(config.url, config.anonKey, clientOptions),
  };
}

router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body ?? {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof fullName === "string" ? fullName.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    if (!normalizedName || !normalizedPhone || !normalizedEmail || typeof password !== "string" || password.length < 8) {
      throw new HttpError("Please complete all signup fields correctly.", 400, "INVALID_SIGNUP_DATA");
    }

    if (RESERVED_CUSTOMER_EMAILS.has(normalizedEmail)) {
      throw new HttpError("Email already registered.", 409, "EMAIL_EXISTS");
    }

    const { adminClient, authClient } = createSupabaseClients();

    const { data: phoneRows, error: phoneError } = await adminClient
      .from("profiles")
      .select("id,email")
      .eq("phone", normalizedPhone)
      .limit(1);

    if (phoneError) {
      throw new HttpError(phoneError.message, 500, "PROFILE_LOOKUP_FAILED");
    }

    if (phoneRows && phoneRows.length > 0) {
      throw new HttpError("Phone number already registered.", 409, "PHONE_EXISTS");
    }

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        phone: normalizedPhone,
      },
    });

    if (createError) {
      throw new HttpError(
        isDuplicateEmail(createError.message) ? "Email already registered." : createError.message,
        isDuplicateEmail(createError.message) ? 409 : 400,
        isDuplicateEmail(createError.message) ? "EMAIL_EXISTS" : "AUTH_CREATE_FAILED",
      );
    }

    const user = createData.user;
    if (!user?.id) {
      throw new HttpError("Supabase did not return the created user.", 500, "AUTH_CREATE_FAILED");
    }

    const profile = {
      id: user.id,
      full_name: normalizedName,
      phone: normalizedPhone,
      email: normalizedEmail,
      role: "customer",
      blocked: false,
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
    };

    const { data: profileRows, error: profileError } = await adminClient
      .from("profiles")
      .upsert(profile, { onConflict: "id" })
      .select("*");

    if (profileError) {
      throw new HttpError(profileError.message, 500, "PROFILE_CREATE_FAILED");
    }

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError || !signInData.session) {
      throw new HttpError(signInError?.message || "Account created, but automatic sign-in failed.", 500, "AUTH_LOGIN_FAILED");
    }

    req.log.info({ auth_user_id: user.id }, "customer signup created");
    return res.json({
      ok: true,
      user,
      profile: profileRows?.[0] ?? profile,
      session: signInData.session,
    });
  } catch (err) {
    const error = err instanceof HttpError
      ? err
      : new HttpError(err instanceof Error ? err.message : "Failed to create account.");

    req.log.error({ err: error.message, status: error.status, code: error.code }, "customer signup failed");
    if (error.status === 429) {
      return res.status(429).json({
        error: "RATE_LIMITED",
        message: "Too many signup attempts. Please wait a minute and try again.",
      });
    }
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
});

export default router;

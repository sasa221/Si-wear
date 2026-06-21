import { Router, type IRouter } from "express";
import { adminAuthMiddleware, getErrorStatus, getSupabaseConfig, supabaseRequest, type AdminLocals } from "../lib/supabaseAdmin.js";

const router: IRouter = Router();

type DiscountRow = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_order_egp: number | null;
  usage_limit: number | null;
  used_count: number | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function validateRow(row: DiscountRow | null, subtotalEgp: number): string | null {
  if (!row) return "Invalid discount code.";
  if (row.active === false) return "This code is no longer active.";
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "This code has expired.";
  if (subtotalEgp < Number(row.minimum_order_egp ?? 0)) return `Minimum order is ${row.minimum_order_egp ?? 0} EGP.`;
  if (row.usage_limit !== null && row.usage_limit !== undefined && Number(row.used_count ?? 0) >= row.usage_limit) {
    return "This code has reached its usage limit.";
  }
  return null;
}

function calculateDiscount(row: DiscountRow, subtotalEgp: number): number {
  if (row.discount_type === "percentage") {
    return Math.round((subtotalEgp * Number(row.discount_value)) / 100);
  }
  return Math.min(Number(row.discount_value), subtotalEgp);
}

async function getCodeByCode(config: ReturnType<typeof getSupabaseConfig>, code: string): Promise<DiscountRow | null> {
  const rows = await supabaseRequest(config, `/rest/v1/discount_codes?code=eq.${encodeURIComponent(code)}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] as DiscountRow | undefined ?? null : null;
}

async function getCodeById(config: ReturnType<typeof getSupabaseConfig>, id: string): Promise<DiscountRow | null> {
  const rows = await supabaseRequest(config, `/rest/v1/discount_codes?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] as DiscountRow | undefined ?? null : null;
}

function cleanDiscount(body: Record<string, unknown>, existing?: Partial<DiscountRow>) {
  const code = normalizeCode(body["code"] ?? existing?.code);
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    throw Object.assign(new Error("Code must be 2-20 letters, numbers, dashes, or underscores."), { status: 400 });
  }

  const type = String(body["discount_type"] ?? existing?.discount_type ?? "percentage");
  if (!["percentage", "fixed"].includes(type)) {
    throw Object.assign(new Error("Discount type must be percentage or fixed."), { status: 400 });
  }

  const value = Math.round(Number(body["discount_value"] ?? existing?.discount_value));
  if (!Number.isFinite(value) || value < 1 || (type === "percentage" && value > 100)) {
    throw Object.assign(new Error("Discount value is invalid."), { status: 400 });
  }

  const usageLimitRaw = body["usage_limit"];
  const usageLimit = usageLimitRaw === null || usageLimitRaw === "" || usageLimitRaw === undefined
    ? existing?.usage_limit ?? null
    : Math.round(Number(usageLimitRaw));
  if (usageLimit !== null && (!Number.isFinite(usageLimit) || usageLimit < 1)) {
    throw Object.assign(new Error("Usage limit must be empty or at least 1."), { status: 400 });
  }

  const minimum = Math.round(Number(body["minimum_order_egp"] ?? existing?.minimum_order_egp ?? 0));
  if (!Number.isFinite(minimum) || minimum < 0) {
    throw Object.assign(new Error("Minimum order cannot be negative."), { status: 400 });
  }

  return {
    code,
    discount_type: type,
    discount_value: value,
    minimum_order_egp: minimum,
    usage_limit: usageLimit,
    used_count: Math.max(0, Math.round(Number(body["used_count"] ?? existing?.used_count ?? 0)) || 0),
    active: body["active"] === undefined ? existing?.active !== false : body["active"] === true,
    expires_at: typeof body["expires_at"] === "string" && body["expires_at"] ? body["expires_at"] : existing?.expires_at ?? null,
  };
}

router.post("/discount-codes/validate", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const code = normalizeCode(req.body?.code);
    const subtotalEgp = Math.max(0, Math.round(Number(req.body?.subtotal_egp) || 0));
    const row = code ? await getCodeByCode(config, code) : null;
    const message = validateRow(row, subtotalEgp);
    if (message || !row) return res.json({ valid: false, discount: null, discount_amount: 0, message });
    return res.json({
      valid: true,
      discount: row,
      discount_amount: calculateDiscount(row, subtotalEgp),
      message: "Code applied successfully!",
    });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Discount code could not be validated.";
    return res.status(status).json({ error: "DISCOUNT_VALIDATE_FAILED", message });
  }
});

router.post("/discount-codes/:id/apply", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const codeId = String(req.params.id);
    const row = await getCodeById(config, codeId);
    const subtotalEgp = Math.max(0, Math.round(Number(req.body?.subtotal_egp) || 0));
    const message = validateRow(row, subtotalEgp);
    if (message || !row) return res.status(400).json({ error: "DISCOUNT_INVALID", message });
    const usedCount = Number(row.used_count ?? 0);
    const rows = await supabaseRequest(
      config,
      `/rest/v1/discount_codes?id=eq.${encodeURIComponent(row.id)}&used_count=eq.${usedCount}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ used_count: usedCount + 1 }),
      },
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(409).json({ error: "DISCOUNT_USAGE_CHANGED", message: "Discount usage changed. Validate the code again." });
    }
    return res.json({ ok: true, discount: rows[0] });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Discount code could not be applied.";
    return res.status(status).json({ error: "DISCOUNT_APPLY_FAILED", message });
  }
});

router.get("/admin/discount-codes", adminAuthMiddleware, async (_req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/discount_codes?select=*&order=created_at.desc", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.json({ codes: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Discount codes could not be loaded.";
    return res.status(status).json({ error: "DISCOUNT_CODES_FETCH_FAILED", message });
  }
});

router.post("/admin/discount-codes", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const row = {
      id: globalThis.crypto?.randomUUID?.(),
      ...cleanDiscount(req.body ?? {}),
      created_at: new Date().toISOString(),
    };
    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/discount_codes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    req.log.info({ admin_user_id: adminUserId, code: row.code }, "discount code created");
    return res.json({ ok: true, code: Array.isArray(rows) ? rows[0] : row });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Discount code could not be saved.";
    req.log.error({ err: message, status }, "discount code create failed");
    return res.status(status).json({ error: "DISCOUNT_CODE_SAVE_FAILED", message });
  }
});

router.patch("/admin/discount-codes/:id", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const codeId = String(req.params.id);
    const existing = await getCodeById(supabaseConfig, codeId);
    if (!existing) return res.status(404).json({ error: "DISCOUNT_CODE_NOT_FOUND", message: "Discount code was not found." });
    const rows = await supabaseRequest(supabaseConfig, `/rest/v1/discount_codes?id=eq.${encodeURIComponent(codeId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(cleanDiscount(req.body ?? {}, existing)),
    });
    req.log.info({ admin_user_id: adminUserId, code_id: codeId }, "discount code updated");
    return res.json({ ok: true, code: Array.isArray(rows) ? rows[0] : null });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Discount code could not be updated.";
    req.log.error({ err: message, status }, "discount code update failed");
    return res.status(status).json({ error: "DISCOUNT_CODE_UPDATE_FAILED", message });
  }
});

router.post("/admin/discount-codes/:id/deactivate", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const codeId = String(req.params.id);
    await supabaseRequest(supabaseConfig, `/rest/v1/discount_codes?id=eq.${encodeURIComponent(codeId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ active: false }),
    });
    req.log.info({ admin_user_id: adminUserId, code_id: codeId }, "discount code deactivated");
    return res.json({ ok: true });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Discount code could not be deactivated.";
    req.log.error({ err: message, status }, "discount code deactivate failed");
    return res.status(status).json({ error: "DISCOUNT_CODE_DEACTIVATE_FAILED", message });
  }
});

export default router;

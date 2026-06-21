import { adminApiFetchJson, apiFetchJson } from "@/lib/apiClient";
import { SUPABASE_NOT_CONNECTED_MESSAGE, supabaseConfigured, useDevOrderMock } from "@/lib/supabase";
import type { DiscountCode } from "@/lib/types";

export type { DiscountCode } from "@/lib/types";

const KEY = "swear_discount_codes";

type DiscountCodeRow = {
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

type DiscountPayload = {
  code?: DiscountCodeRow;
  codes?: DiscountCodeRow[];
  discount?: DiscountCodeRow | null;
  valid?: boolean;
  message?: string;
};

function normalizeCode(code: Partial<DiscountCode> & { id: string; code: string }): DiscountCode {
  return {
    id: code.id,
    code: code.code.toUpperCase(),
    type: code.type === "fixed" ? "fixed" : "percentage",
    value: Math.max(1, Number(code.value) || 1),
    minimumOrderEgp: Math.max(0, Number(code.minimumOrderEgp) || 0),
    usageLimit: code.usageLimit === undefined ? null : code.usageLimit,
    usedCount: Math.max(0, Number(code.usedCount) || 0),
    active: code.active !== false,
    expiresAt: code.expiresAt ?? null,
    createdAt: code.createdAt || new Date().toISOString(),
  };
}

function rowToDiscount(row: DiscountCodeRow): DiscountCode {
  return {
    id: row.id,
    code: row.code,
    type: row.discount_type,
    value: row.discount_value,
    minimumOrderEgp: row.minimum_order_egp ?? 0,
    usageLimit: row.usage_limit,
    usedCount: row.used_count ?? 0,
    active: row.active !== false,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function discountToRow(code: DiscountCode): Record<string, unknown> {
  return {
    id: code.id,
    code: code.code.toUpperCase().trim(),
    discount_type: code.type,
    discount_value: code.value,
    minimum_order_egp: code.minimumOrderEgp,
    usage_limit: code.usageLimit,
    used_count: code.usedCount,
    active: code.active,
    expires_at: code.expiresAt || null,
    created_at: code.createdAt,
  };
}

function shouldUseLocalDiscounts(): boolean {
  if (supabaseConfigured) return false;
  if (useDevOrderMock) return true;
  throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
}

function getLocalDiscountCodes(): DiscountCode[] {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.map(normalizeCode) : [];
    }
  } catch {}
  return [];
}

function saveLocalDiscountCodes(codes: DiscountCode[]): void {
  localStorage.setItem(KEY, JSON.stringify(codes.map(normalizeCode)));
}

export function getDiscountCodes(): DiscountCode[] {
  return getLocalDiscountCodes();
}

export function saveDiscountCodes(codes: DiscountCode[]): void {
  saveLocalDiscountCodes(codes);
}

export async function getDiscountCodesAsync(): Promise<DiscountCode[]> {
  if (shouldUseLocalDiscounts()) return getLocalDiscountCodes();

  const payload = await adminApiFetchJson<DiscountPayload>(
    "/admin/discount-codes",
    {},
    "Failed to load discount codes."
  );
  return (payload.codes ?? []).map(rowToDiscount);
}

export async function saveDiscountCode(code: DiscountCode): Promise<DiscountCode> {
  const normalized = normalizeCode(code);
  if (shouldUseLocalDiscounts()) {
    const codes = getLocalDiscountCodes();
    const next = codes.some(item => item.id === normalized.id)
      ? codes.map(item => item.id === normalized.id ? normalized : item)
      : [normalized, ...codes];
    saveLocalDiscountCodes(next);
    return normalized;
  }

  const existingCodes = await getDiscountCodesAsync();
  const isExisting = existingCodes.some(item => item.id === normalized.id);
  const payload = await adminApiFetchJson<DiscountPayload>(
    isExisting
      ? `/admin/discount-codes/${encodeURIComponent(normalized.id)}`
      : "/admin/discount-codes",
    {
      method: isExisting ? "PATCH" : "POST",
      body: JSON.stringify(discountToRow(normalized)),
    },
    "Failed to save discount code."
  );
  if (!payload.code) throw new Error("Discount API did not return a code.");
  return rowToDiscount(payload.code);
}

export async function setDiscountCodeActive(id: string, active: boolean): Promise<void> {
  if (shouldUseLocalDiscounts()) {
    saveLocalDiscountCodes(getLocalDiscountCodes().map(code =>
      code.id === id ? { ...code, active } : code
    ));
    return;
  }

  if (!active) {
    await adminApiFetchJson(
      `/admin/discount-codes/${encodeURIComponent(id)}/deactivate`,
      { method: "POST" },
      "Failed to deactivate discount code."
    );
    return;
  }

  await adminApiFetchJson(
    `/admin/discount-codes/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ active: true }) },
    "Failed to activate discount code."
  );
}

export async function validateDiscountCode(
  code: string,
  subtotalEgp: number
): Promise<{ valid: boolean; discount: DiscountCode | null; message: string }> {
  if (!shouldUseLocalDiscounts()) {
    const payload = await apiFetchJson<DiscountPayload>(
      "/discount-codes/validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal_egp: subtotalEgp }),
      },
      "Failed to validate discount code."
    );
    return {
      valid: payload.valid === true,
      discount: payload.discount ? rowToDiscount(payload.discount) : null,
      message: payload.message || (payload.valid ? "Code applied successfully!" : "Invalid discount code."),
    };
  }

  const codes = await getDiscountCodesAsync();
  const discount = codes.find(
    (c) => c.code.toUpperCase() === code.toUpperCase().trim()
  );

  if (!discount) {
    return { valid: false, discount: null, message: "Invalid discount code." };
  }
  if (!discount.active) {
    return { valid: false, discount: null, message: "This code is no longer active." };
  }
  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < Date.now()) {
    return { valid: false, discount: null, message: "This code has expired." };
  }
  if (subtotalEgp < discount.minimumOrderEgp) {
    return {
      valid: false,
      discount: null,
      message: `Minimum order is ${discount.minimumOrderEgp} EGP.`,
    };
  }
  if (
    discount.usageLimit !== null &&
    discount.usedCount >= discount.usageLimit
  ) {
    return {
      valid: false,
      discount: null,
      message: "This code has reached its usage limit.",
    };
  }

  return { valid: true, discount, message: "Code applied successfully!" };
}

export async function applyDiscountCode(codeId: string, subtotalEgp = 0): Promise<void> {
  if (!shouldUseLocalDiscounts()) {
    await apiFetchJson(
      `/discount-codes/${encodeURIComponent(codeId)}/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtotal_egp: subtotalEgp }),
      },
      "Failed to apply discount code."
    );
    return;
  }

  const codes = await getDiscountCodesAsync();
  const current = codes.find((c) => c.id === codeId);
  if (!current) return;

  const updated = { ...current, usedCount: current.usedCount + 1 };
  await saveDiscountCode(updated);
}

export function calculateDiscount(
  discount: DiscountCode,
  subtotal: number
): number {
  if (discount.type === "percentage") {
    return Math.round((subtotal * discount.value) / 100);
  }
  return Math.min(discount.value, subtotal);
}

export interface DiscountCode {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  createdAt: string;
}

const KEY = "swear_discount_codes";

export function getDiscountCodes(): DiscountCode[] {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveDiscountCodes(codes: DiscountCode[]): void {
  localStorage.setItem(KEY, JSON.stringify(codes));
}

export function validateDiscountCode(
  code: string
): { valid: boolean; discount: DiscountCode | null; message: string } {
  const codes = getDiscountCodes();
  const discount = codes.find(
    (c) => c.code.toUpperCase() === code.toUpperCase().trim()
  );

  if (!discount)
    return { valid: false, discount: null, message: "Invalid discount code." };
  if (!discount.active)
    return { valid: false, discount: null, message: "This code is no longer active." };
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

export function applyDiscountCode(codeId: string): void {
  const codes = getDiscountCodes();
  const idx = codes.findIndex((c) => c.id === codeId);
  if (idx !== -1) {
    codes[idx].usedCount += 1;
    saveDiscountCodes(codes);
  }
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

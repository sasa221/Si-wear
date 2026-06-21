import { Router, type IRouter } from "express";
import { adminAuthMiddleware, getErrorStatus, getSupabaseConfig, supabaseRequest, type AdminLocals } from "../lib/supabaseAdmin.js";

const router: IRouter = Router();

type ShippingZoneRow = {
  id: string;
  governorate: string;
  city_area: string | null;
  delivery_fee_egp: number;
  free_shipping_min_egp: number | null;
  active: boolean;
  created_at: string;
};

function cleanZone(body: Record<string, unknown>, existing?: Partial<ShippingZoneRow>) {
  const governorate = typeof body["governorate"] === "string" ? body["governorate"].trim() : existing?.governorate;
  if (!governorate) {
    throw Object.assign(new Error("Governorate is required."), { status: 400 });
  }

  const fee = body["delivery_fee_egp"] ?? existing?.delivery_fee_egp;
  const deliveryFee = Math.round(Number(fee));
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
    throw Object.assign(new Error("Delivery fee must be 0 or more."), { status: 400 });
  }

  const freeMinRaw = body["free_shipping_min_egp"];
  const freeMin = freeMinRaw === null || freeMinRaw === "" || freeMinRaw === undefined
    ? existing?.free_shipping_min_egp ?? null
    : Math.round(Number(freeMinRaw));
  if (freeMin !== null && (!Number.isFinite(freeMin) || freeMin < 0)) {
    throw Object.assign(new Error("Free shipping minimum must be empty or 0 or more."), { status: 400 });
  }

  return {
    governorate,
    city_area: typeof body["city_area"] === "string" && body["city_area"].trim()
      ? body["city_area"].trim()
      : null,
    delivery_fee_egp: deliveryFee,
    free_shipping_min_egp: freeMin,
    active: body["active"] === undefined ? existing?.active !== false : body["active"] === true,
  };
}

async function getZone(config: ReturnType<typeof getSupabaseConfig>, id: string): Promise<ShippingZoneRow | null> {
  const rows = await supabaseRequest(config, `/rest/v1/shipping_zones?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] as ShippingZoneRow | undefined ?? null : null;
}

router.get("/shipping-zones", async (_req, res) => {
  try {
    const config = getSupabaseConfig();
    const rows = await supabaseRequest(config, "/rest/v1/shipping_zones?select=*&active=eq.true&order=created_at.desc", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.json({ zones: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Shipping zones could not be loaded.";
    return res.status(status).json({ error: "SHIPPING_ZONES_FETCH_FAILED", message });
  }
});

router.get("/admin/shipping-zones", adminAuthMiddleware, async (_req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/shipping_zones?select=*&order=created_at.desc", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.json({ zones: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Shipping zones could not be loaded.";
    return res.status(status).json({ error: "SHIPPING_ZONES_FETCH_FAILED", message });
  }
});

router.post("/admin/shipping-zones", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const id = globalThis.crypto?.randomUUID?.() ?? undefined;
    const zone = {
      ...(id ? { id } : {}),
      ...cleanZone(req.body ?? {}),
      created_at: new Date().toISOString(),
    };
    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/shipping_zones", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(zone),
    });
    req.log.info({ admin_user_id: adminUserId }, "shipping zone created");
    return res.json({ ok: true, zone: Array.isArray(rows) ? rows[0] : zone });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Shipping zone could not be saved.";
    req.log.error({ err: message, status }, "shipping zone create failed");
    return res.status(status).json({ error: "SHIPPING_ZONE_SAVE_FAILED", message });
  }
});

router.patch("/admin/shipping-zones/:id", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const zoneId = String(req.params.id);
    const existing = await getZone(supabaseConfig, zoneId);
    if (!existing) return res.status(404).json({ error: "SHIPPING_ZONE_NOT_FOUND", message: "Shipping zone was not found." });
    const rows = await supabaseRequest(supabaseConfig, `/rest/v1/shipping_zones?id=eq.${encodeURIComponent(zoneId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(cleanZone(req.body ?? {}, existing)),
    });
    req.log.info({ admin_user_id: adminUserId, zone_id: zoneId }, "shipping zone updated");
    return res.json({ ok: true, zone: Array.isArray(rows) ? rows[0] : null });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Shipping zone could not be updated.";
    req.log.error({ err: message, status }, "shipping zone update failed");
    return res.status(status).json({ error: "SHIPPING_ZONE_UPDATE_FAILED", message });
  }
});

router.post("/admin/shipping-zones/:id/deactivate", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const zoneId = String(req.params.id);
    await supabaseRequest(supabaseConfig, `/rest/v1/shipping_zones?id=eq.${encodeURIComponent(zoneId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ active: false }),
    });
    req.log.info({ admin_user_id: adminUserId, zone_id: zoneId }, "shipping zone deactivated");
    return res.json({ ok: true });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Shipping zone could not be deactivated.";
    req.log.error({ err: message, status }, "shipping zone deactivate failed");
    return res.status(status).json({ error: "SHIPPING_ZONE_DEACTIVATE_FAILED", message });
  }
});

export default router;

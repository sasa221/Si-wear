import { Router, type IRouter } from "express";
import { adminAuthMiddleware, getErrorStatus, supabaseRequest, type AdminLocals } from "../lib/supabaseAdmin";

const router: IRouter = Router();

type OrderRow = Record<string, any> & { id: string; user_id?: string | null; status?: string };
type OrderItemRow = Record<string, any> & { order_id: string; variant_id?: string | null; quantity?: number };

const ORDER_STATUSES = new Set(["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"]);
const PENDING_CANCELLATION_FILTER = "cancellation_requested=eq.true&or=(cancellation_status.eq.pending,cancellation_status.eq.Pending,cancellation_status.eq.None,cancellation_status.is.null)";

function statusMessage(orderId: string, status: string): string {
  switch (status) {
    case "Confirmed": return `Your order #${orderId} has been confirmed.`;
    case "Preparing": return `Your order #${orderId} is being prepared.`;
    case "Out for Delivery": return `Your order #${orderId} is out for delivery.`;
    case "Delivered": return `Your order #${orderId} has been delivered.`;
    case "Cancelled": return `Your order #${orderId} has been cancelled.`;
    default: return `Your order #${orderId} status updated to ${status}.`;
  }
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === "true" || value === "t") return true;
  if (value === false || value === "false" || value === "f") return false;
  return fallback;
}

function normalizeWorkflowValue(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, " ") : "";
}

function cancellationWorkflowStatus(order: OrderRow): "pending" | "approved" | "rejected" | null {
  const status = normalizeWorkflowValue(order.cancellation_status);
  if (status === "pending" || status === "approved" || status === "rejected") return status;
  return asBoolean(order.cancellation_requested, false) ? "pending" : null;
}

async function fetchOrder(config: AdminLocals["supabaseConfig"], orderId: string): Promise<OrderRow | null> {
  const rows = await supabaseRequest(config, `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] as OrderRow | undefined ?? null : null;
}

async function fetchItems(config: AdminLocals["supabaseConfig"], orderIds: string[]): Promise<OrderItemRow[]> {
  if (orderIds.length === 0) return [];
  const encoded = orderIds.map(id => encodeURIComponent(id)).join(",");
  const rows = await supabaseRequest(config, `/rest/v1/order_items?order_id=in.(${encoded})&select=*`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows as OrderItemRow[] : [];
}

async function saveNotification(config: AdminLocals["supabaseConfig"], customerId: string | null | undefined, orderId: string, message: string) {
  if (!customerId) return;
  await supabaseRequest(config, "/rest/v1/notifications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      customer_id: customerId,
      order_id: orderId,
      contact_message_id: null,
      message,
      read: false,
      created_at: new Date().toISOString(),
    }),
  });
}

async function restoreStockOnce(config: AdminLocals["supabaseConfig"], items: OrderItemRow[]) {
  for (const item of items) {
    if (!item.variant_id) continue;
    const rows = await supabaseRequest(config, `/rest/v1/product_variants?id=eq.${encodeURIComponent(item.variant_id)}&select=id,stock&limit=1`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const variant = Array.isArray(rows) ? rows[0] as { id: string; stock?: number } | undefined : undefined;
    if (!variant) continue;
    await supabaseRequest(config, `/rest/v1/product_variants?id=eq.${encodeURIComponent(item.variant_id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ stock: Math.max(0, Number(variant.stock) || 0) + Math.max(0, Number(item.quantity) || 0) }),
    });
  }
}

function isMissingReviewColumnError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return message.includes("cancellation_reviewed_at") ||
    message.includes("cancellation_reviewed_by") ||
    message.includes("schema cache");
}

async function patchCancellationResolution(
  config: AdminLocals["supabaseConfig"],
  orderId: string,
  patch: Record<string, unknown>,
): Promise<OrderRow | undefined> {
  const path = `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&${PENDING_CANCELLATION_FILTER}`;
  const request = (body: Record<string, unknown>) => supabaseRequest(config, path, {
    method: "PATCH",
    headers: { Accept: "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });

  try {
    const rows = await request(patch);
    return Array.isArray(rows) ? rows[0] as OrderRow | undefined : undefined;
  } catch (err) {
    if (!isMissingReviewColumnError(err)) throw err;
    const { cancellation_reviewed_at: _reviewedAt, cancellation_reviewed_by: _reviewedBy, ...legacyPatch } = patch;
    const rows = await request(legacyPatch);
    return Array.isArray(rows) ? rows[0] as OrderRow | undefined : undefined;
  }
}

async function resolveCancellation(
  config: AdminLocals["supabaseConfig"],
  orderId: string,
  approved: boolean,
  adminUserId: string,
  adminNote: string | null,
): Promise<OrderRow> {
  const order = await fetchOrder(config, orderId);
  if (!order) {
    throw Object.assign(new Error("Order was not found."), { status: 404, code: "ORDER_NOT_FOUND" });
  }
  if (cancellationWorkflowStatus(order) !== "pending") {
    throw Object.assign(new Error("No pending cancellation request exists for this order."), { status: 409, code: "NO_PENDING_CANCELLATION" });
  }

  const reviewedAt = new Date().toISOString();
  const updated = await patchCancellationResolution(config, orderId, {
    ...(approved ? { status: "Cancelled" } : {}),
    cancellation_requested: false,
    cancellation_status: approved ? "approved" : "rejected",
    cancellation_resolved_at: reviewedAt,
    cancellation_reviewed_at: reviewedAt,
    cancellation_reviewed_by: adminUserId,
    cancellation_admin_note: adminNote,
  });
  if (!updated) {
    throw Object.assign(new Error("Cancellation request was already resolved."), { status: 409, code: "CANCELLATION_ALREADY_RESOLVED" });
  }

  if (approved) {
    const items = await fetchItems(config, [orderId]);
    await restoreStockOnce(config, items);
  }

  await saveNotification(
    config,
    order.user_id,
    orderId,
    approved
      ? `Your cancellation request for order #${orderId} was approved.`
      : `Your cancellation request for order #${orderId} was rejected.`,
  );

  return updated;
}

router.get("/admin/orders", adminAuthMiddleware, async (_req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/orders?select=*&order=created_at.desc", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const orders = Array.isArray(rows) ? rows as OrderRow[] : [];
    const items = await fetchItems(supabaseConfig, orders.map(order => order.id));
    return res.json({ orders, items });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Orders could not be loaded.";
    return res.status(status).json({ error: "ORDERS_FETCH_FAILED", message });
  }
});

router.get("/admin/orders/:id", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const orderId = String(req.params.id);
    const order = await fetchOrder(supabaseConfig, orderId);
    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND", message: "Order was not found." });
    const items = await fetchItems(supabaseConfig, [orderId]);
    return res.json({ order, items });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Order could not be loaded.";
    return res.status(status).json({ error: "ORDER_FETCH_FAILED", message });
  }
});

router.patch("/admin/orders/:id/status", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const orderId = String(req.params.id);
    const status = String(req.body?.status ?? "");
    if (!ORDER_STATUSES.has(status)) {
      return res.status(400).json({ error: "INVALID_ORDER_STATUS", message: "Invalid order status." });
    }
    const order = await fetchOrder(supabaseConfig, orderId);
    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND", message: "Order was not found." });

    const patch: Record<string, unknown> = { status };
    if (typeof req.body?.admin_notes === "string") patch.admin_notes = req.body.admin_notes;
    await supabaseRequest(supabaseConfig, `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (status !== "Pending") await saveNotification(supabaseConfig, order.user_id, orderId, statusMessage(orderId, status));
    req.log.info({ admin_user_id: adminUserId, order_id: orderId, status }, "order status updated");
    return res.json({ ok: true, user_id: order.user_id ?? null });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Order status could not be updated.";
    req.log.error({ err: message, status }, "order status update failed");
    return res.status(status).json({ error: "ORDER_STATUS_FAILED", message });
  }
});

router.patch("/admin/orders/:id/notes", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const orderId = String(req.params.id);
    const adminNotes = typeof req.body?.admin_notes === "string" ? req.body.admin_notes : "";
    await supabaseRequest(supabaseConfig, `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ admin_notes: adminNotes }),
    });
    req.log.info({ admin_user_id: adminUserId, order_id: orderId }, "order notes updated");
    return res.json({ ok: true });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Order notes could not be saved.";
    req.log.error({ err: message, status }, "order notes update failed");
    return res.status(status).json({ error: "ORDER_NOTES_FAILED", message });
  }
});

router.post("/admin/orders/:id/cancellation/approve", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const orderId = String(req.params.id);
    const adminNote = typeof req.body?.admin_note === "string" ? req.body.admin_note.trim() || null : null;
    const order = await resolveCancellation(supabaseConfig, orderId, true, adminUserId, adminNote);
    req.log.info({ admin_user_id: adminUserId, order_id: orderId, approved: true }, "order cancellation approved");
    return res.json({ ok: true, order, user_id: order.user_id ?? null });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Order cancellation could not be approved.";
    req.log.error({ err: message, status }, "order cancellation approve failed");
    return res.status(status).json({ error: "ORDER_CANCEL_FAILED", message });
  }
});

router.post("/admin/orders/:id/cancellation/reject", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const orderId = String(req.params.id);
    const adminNote = typeof req.body?.admin_note === "string" ? req.body.admin_note.trim() || null : null;
    const order = await resolveCancellation(supabaseConfig, orderId, false, adminUserId, adminNote);
    req.log.info({ admin_user_id: adminUserId, order_id: orderId, approved: false }, "order cancellation rejected");
    return res.json({ ok: true, order, user_id: order.user_id ?? null });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Order cancellation could not be rejected.";
    req.log.error({ err: message, status }, "order cancellation reject failed");
    return res.status(status).json({ error: "ORDER_CANCEL_FAILED", message });
  }
});

router.post("/admin/orders/:id/cancel", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const orderId = String(req.params.id);
    const approved = req.body?.approved === true;
    const adminNote = typeof req.body?.admin_note === "string" ? req.body.admin_note.trim() || null : null;
    const order = await resolveCancellation(supabaseConfig, orderId, approved, adminUserId, adminNote);
    req.log.info({ admin_user_id: adminUserId, order_id: orderId, approved }, "order cancellation resolved");
    return res.json({ ok: true, order, user_id: order.user_id ?? null });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Order cancellation could not be resolved.";
    req.log.error({ err: message, status }, "legacy order cancellation failed");
    return res.status(status).json({ error: "ORDER_CANCEL_FAILED", message });
  }
});

export default router;

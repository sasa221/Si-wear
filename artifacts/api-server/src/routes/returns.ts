import { Router, type IRouter } from "express";
import { adminAuthMiddleware, getErrorStatus, supabaseRequest, type AdminLocals } from "../lib/supabaseAdmin";

const router: IRouter = Router();
const RETURN_STATUSES = new Set(["Pending", "Accepted", "Rejected", "Completed"]);

type ReturnRow = Record<string, any> & {
  id: string;
  user_id: string;
  order_id: string;
  order_number: string;
  preferred_action: string;
};

async function fetchReturn(config: AdminLocals["supabaseConfig"], id: string): Promise<ReturnRow | null> {
  const rows = await supabaseRequest(config, `/rest/v1/return_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] as ReturnRow | undefined ?? null : null;
}

async function notify(config: AdminLocals["supabaseConfig"], row: ReturnRow, status: string) {
  await supabaseRequest(config, "/rest/v1/notifications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      customer_id: row.user_id,
      order_id: row.order_id,
      contact_message_id: null,
      message: `Your ${row.preferred_action} request for order #${row.order_number} is ${status.toLowerCase()}.`,
      read: false,
      created_at: new Date().toISOString(),
    }),
  });
}

router.get("/admin/returns", adminAuthMiddleware, async (_req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/return_requests?select=*&order=created_at.desc", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.json({ returns: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Return requests could not be loaded.";
    return res.status(status).json({ error: "RETURNS_FETCH_FAILED", message });
  }
});

router.get("/admin/returns/:id", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const returnId = String(req.params.id);
    const row = await fetchReturn(supabaseConfig, returnId);
    if (!row) return res.status(404).json({ error: "RETURN_NOT_FOUND", message: "Return request was not found." });
    return res.json({ return_request: row });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Return request could not be loaded.";
    return res.status(status).json({ error: "RETURN_FETCH_FAILED", message });
  }
});

router.patch("/admin/returns/:id/status", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const returnId = String(req.params.id);
    const status = String(req.body?.status ?? "");
    if (!RETURN_STATUSES.has(status)) {
      return res.status(400).json({ error: "INVALID_RETURN_STATUS", message: "Invalid return status." });
    }
    const existing = await fetchReturn(supabaseConfig, returnId);
    if (!existing) return res.status(404).json({ error: "RETURN_NOT_FOUND", message: "Return request was not found." });
    const rows = await supabaseRequest(supabaseConfig, `/rest/v1/return_requests?id=eq.${encodeURIComponent(returnId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status,
        admin_note: typeof req.body?.admin_note === "string" ? req.body.admin_note : existing.admin_note ?? null,
        updated_at: new Date().toISOString(),
      }),
    });
    await notify(supabaseConfig, existing, status);
    req.log.info({ admin_user_id: adminUserId, return_id: returnId, status }, "return request status updated");
    return res.json({ ok: true, return_request: Array.isArray(rows) ? rows[0] : null });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Return request could not be updated.";
    req.log.error({ err: message, status }, "return request status update failed");
    return res.status(status).json({ error: "RETURN_STATUS_FAILED", message });
  }
});

export default router;

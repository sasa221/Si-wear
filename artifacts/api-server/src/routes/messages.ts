import { Router, type IRouter, type Request } from "express";
import {
  adminAuthMiddleware,
  errorMessage,
  getBearerToken,
  getErrorStatus,
  getSupabaseConfig,
  readJson,
  supabaseRequest,
  type AdminLocals,
  type SupabaseConfig,
} from "../lib/supabaseAdmin.js";

const router: IRouter = Router();
const MESSAGE_STATUSES = new Set(["open", "customer_replied", "pending_admin", "admin_replied", "closed"]);

type ProfileRow = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  blocked?: boolean | string | null;
  is_active?: boolean | string | null;
};

type CustomerContext = {
  supabaseConfig: SupabaseConfig;
  customerUserId: string;
  profile: ProfileRow;
};

type ContactMessageRow = Record<string, any> & {
  id: string;
  customer_id?: string | null;
  subject?: string | null;
  message?: string | null;
  status?: string | null;
  admin_reply?: string | null;
  replied_by?: string | null;
  replied_at?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  last_reply_at?: string | null;
  last_reply_by?: string | null;
  created_at?: string | null;
};

type ContactMessageReplyRow = Record<string, any> & {
  id: string;
  contact_message_id: string;
  sender_id?: string | null;
  sender_role?: "customer" | "admin" | string | null;
  message?: string | null;
  created_at?: string | null;
};

function asBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === "true" || value === "t") return true;
  if (value === false || value === "false" || value === "f") return false;
  return fallback;
}

function profileBlocked(profile: ProfileRow | undefined): boolean {
  return asBoolean(profile?.blocked, false);
}

function profileActive(profile: ProfileRow | undefined): boolean {
  return asBoolean(profile?.is_active, true);
}

function normalizeStatus(value: unknown): string {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (status === "replied") return "admin_replied";
  return MESSAGE_STATUSES.has(status) ? status : "open";
}

function parseRequestedStatus(value: unknown): string | null {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (status === "replied") return "admin_replied";
  return MESSAGE_STATUSES.has(status) ? status : null;
}

function isClosed(row: ContactMessageRow): boolean {
  return normalizeStatus(row.status) === "closed";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rowToReply(row: ContactMessageReplyRow) {
  return {
    id: row.id,
    contactMessageId: row.contact_message_id,
    senderId: row.sender_id ?? null,
    senderRole: row.sender_role === "admin" ? "admin" : "customer",
    message: row.message || "",
    createdAt: row.created_at || new Date(0).toISOString(),
  };
}

function serializeMessage(row: ContactMessageRow, replies: ContactMessageReplyRow[] = []) {
  const sortedReplies = [...replies].sort((a, b) => {
    const time = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    return time === 0 ? String(a.id).localeCompare(String(b.id)) : time;
  });
  const mappedReplies = sortedReplies.map(rowToReply);
  const latestReply = mappedReplies[mappedReplies.length - 1] ?? null;

  return {
    id: row.id,
    customerId: row.customer_id || "",
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    subject: row.subject || "",
    message: row.message || "",
    orderId: row.order_id ?? null,
    status: normalizeStatus(row.status),
    adminReply: row.admin_reply ?? null,
    repliedBy: row.replied_by ?? null,
    repliedAt: row.replied_at ?? null,
    closedAt: row.closed_at ?? null,
    closedBy: row.closed_by ?? null,
    lastReplyAt: row.last_reply_at ?? latestReply?.createdAt ?? null,
    lastReplyBy: row.last_reply_by ?? latestReply?.senderId ?? null,
    createdAt: row.created_at || new Date(0).toISOString(),
    replies: mappedReplies,
    latestReply,
    replyCount: mappedReplies.length,
  };
}

async function requireCustomerContext(req: Request, options: { requireActive: boolean }): Promise<CustomerContext> {
  const supabaseConfig = getSupabaseConfig();
  const token = getBearerToken(req.header("authorization"));
  if (!token) {
    throw Object.assign(new Error("Login is required."), { status: 401 });
  }

  const authRes = await fetch(`${supabaseConfig.url}/auth/v1/user`, {
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const authPayload = await readJson(authRes);
  if (!authRes.ok) {
    throw Object.assign(new Error(errorMessage(authPayload, "Invalid customer session.")), { status: 401 });
  }

  const authUser = authPayload as { id?: string };
  if (!authUser.id) {
    throw Object.assign(new Error("Invalid customer session."), { status: 401 });
  }

  const profileRows = await supabaseRequest(
    supabaseConfig,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,full_name,phone,email,role,blocked,is_active&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  const profile = Array.isArray(profileRows) ? profileRows[0] as ProfileRow | undefined : undefined;
  if (!profile) {
    throw Object.assign(new Error("Customer profile was not found."), { status: 403 });
  }
  if (options.requireActive && (profileBlocked(profile) || !profileActive(profile))) {
    throw Object.assign(new Error("Your account is restricted. Please contact S! Wear support."), { status: 403 });
  }

  return { supabaseConfig, customerUserId: authUser.id, profile };
}

async function fetchMessage(config: SupabaseConfig, id: string): Promise<ContactMessageRow | null> {
  const rows = await supabaseRequest(config, `/rest/v1/contact_messages?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] as ContactMessageRow | undefined ?? null : null;
}

async function fetchCustomerMessage(config: SupabaseConfig, customerUserId: string, id: string): Promise<ContactMessageRow | null> {
  const rows = await supabaseRequest(
    config,
    `/rest/v1/contact_messages?id=eq.${encodeURIComponent(id)}&customer_id=eq.${encodeURIComponent(customerUserId)}&select=*&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) ? rows[0] as ContactMessageRow | undefined ?? null : null;
}

async function fetchReplies(config: SupabaseConfig, messageIds: string[]): Promise<ContactMessageReplyRow[]> {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const encoded = uniqueIds.map(id => encodeURIComponent(id)).join(",");
  const rows = await supabaseRequest(
    config,
    `/rest/v1/contact_message_replies?contact_message_id=in.(${encoded})&select=*&order=created_at.asc`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) ? rows as ContactMessageReplyRow[] : [];
}

async function serializeMessages(config: SupabaseConfig, rows: ContactMessageRow[]) {
  const replies = await fetchReplies(config, rows.map(row => row.id));
  const repliesByMessage = new Map<string, ContactMessageReplyRow[]>();
  for (const reply of replies) {
    repliesByMessage.set(reply.contact_message_id, [...(repliesByMessage.get(reply.contact_message_id) ?? []), reply]);
  }
  return rows.map(row => serializeMessage(row, repliesByMessage.get(row.id) ?? []));
}

async function fetchThreadPayload(config: SupabaseConfig, row: ContactMessageRow) {
  const [message] = await serializeMessages(config, [row]);
  return message ?? serializeMessage(row, []);
}

async function patchMessage(
  config: SupabaseConfig,
  id: string,
  patch: Record<string, unknown>,
  customerUserId?: string,
): Promise<ContactMessageRow | null> {
  const ownerFilter = customerUserId ? `&customer_id=eq.${encodeURIComponent(customerUserId)}` : "";
  const rows = await supabaseRequest(config, `/rest/v1/contact_messages?id=eq.${encodeURIComponent(id)}${ownerFilter}`, {
    method: "PATCH",
    headers: { Accept: "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  return Array.isArray(rows) ? rows[0] as ContactMessageRow | undefined ?? null : null;
}

async function createThreadReply(
  config: SupabaseConfig,
  contactMessageId: string,
  senderRole: "customer" | "admin",
  senderId: string | null,
  message: string,
  createdAt: string,
) {
  const rows = await supabaseRequest(config, "/rest/v1/contact_message_replies", {
    method: "POST",
    headers: { Accept: "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      contact_message_id: contactMessageId,
      sender_id: senderId,
      sender_role: senderRole,
      message,
      created_at: createdAt,
    }),
  });
  return Array.isArray(rows) ? rows[0] as ContactMessageReplyRow | undefined ?? null : null;
}

async function saveReplyNotification(config: SupabaseConfig, message: ContactMessageRow) {
  if (!message.customer_id) return;
  await supabaseRequest(config, "/rest/v1/notifications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      customer_id: message.customer_id,
      order_id: null,
      contact_message_id: message.id,
      message: `S! Wear replied to your message: ${message.subject || "Support message"}`,
      read: false,
      created_at: new Date().toISOString(),
    }),
  });
}

async function customerListHandler(req: Request, res: any) {
  try {
    const { supabaseConfig, customerUserId } = await requireCustomerContext(req, { requireActive: false });
    const rows = await supabaseRequest(
      supabaseConfig,
      `/rest/v1/contact_messages?select=*&customer_id=eq.${encodeURIComponent(customerUserId)}&order=created_at.desc`,
      { method: "GET", headers: { Accept: "application/json" } },
    );
    const messages = await serializeMessages(supabaseConfig, Array.isArray(rows) ? rows as ContactMessageRow[] : []);
    return res.json({ messages });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Messages could not be loaded.";
    req.log.error({ err: message, status }, "customer messages fetch failed");
    return res.status(status).json({ error: "MESSAGES_FETCH_FAILED", message });
  }
}

async function customerCreateHandler(req: Request, res: any) {
  try {
    const { supabaseConfig, customerUserId, profile } = await requireCustomerContext(req, { requireActive: true });
    const subject = cleanText(req.body?.subject);
    const body = cleanText(req.body?.message);
    const orderId = cleanText(req.body?.order_id ?? req.body?.orderId) || null;
    if (subject.length < 3) {
      return res.status(400).json({ error: "SUBJECT_REQUIRED", message: "Subject is required." });
    }
    if (body.length < 10) {
      return res.status(400).json({ error: "MESSAGE_REQUIRED", message: "Please provide a more detailed message." });
    }

    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/contact_messages", {
      method: "POST",
      headers: { Accept: "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        customer_id: customerUserId,
        customer_name: profile.full_name || cleanText(req.body?.customer_name ?? req.body?.customerName) || null,
        customer_email: profile.email || cleanText(req.body?.customer_email ?? req.body?.customerEmail) || null,
        customer_phone: profile.phone || cleanText(req.body?.customer_phone ?? req.body?.customerPhone) || null,
        subject,
        message: body,
        order_id: orderId,
        status: "open",
        created_at: new Date().toISOString(),
      }),
    });
    const created = Array.isArray(rows) ? rows[0] as ContactMessageRow | undefined : undefined;
    if (!created) {
      return res.status(500).json({ error: "MESSAGE_NOT_CONFIRMED", message: "Message was not saved." });
    }
    req.log.info({ user_id: customerUserId, message_id: created.id }, "customer contact message created");
    return res.status(201).json({ message: serializeMessage(created, []) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Message could not be sent.";
    req.log.error({ err: message, status }, "customer message create failed");
    return res.status(status).json({ error: "MESSAGE_CREATE_FAILED", message });
  }
}

async function customerDetailHandler(req: Request, res: any) {
  try {
    const { supabaseConfig, customerUserId } = await requireCustomerContext(req, { requireActive: false });
    const messageId = String(req.params.id);
    const message = await fetchCustomerMessage(supabaseConfig, customerUserId, messageId);
    if (!message) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });
    return res.json({ message: await fetchThreadPayload(supabaseConfig, message) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Message could not be loaded.";
    req.log.error({ err: message, status }, "customer message fetch failed");
    return res.status(status).json({ error: "MESSAGE_FETCH_FAILED", message });
  }
}

async function customerReplyHandler(req: Request, res: any) {
  try {
    const { supabaseConfig, customerUserId } = await requireCustomerContext(req, { requireActive: true });
    const messageId = String(req.params.id);
    const reply = cleanText(req.body?.message ?? req.body?.reply);
    if (reply.length < 3) {
      return res.status(400).json({ error: "REPLY_REQUIRED", message: "Write a reply before sending." });
    }

    const existing = await fetchCustomerMessage(supabaseConfig, customerUserId, messageId);
    if (!existing) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });
    if (isClosed(existing)) {
      return res.status(409).json({ error: "MESSAGE_CLOSED", message: "This conversation is closed." });
    }

    const repliedAt = new Date().toISOString();
    await createThreadReply(supabaseConfig, messageId, "customer", customerUserId, reply, repliedAt);
    const updated = await patchMessage(
      supabaseConfig,
      messageId,
      {
        status: "customer_replied",
        last_reply_at: repliedAt,
        last_reply_by: customerUserId,
      },
      customerUserId,
    );
    if (!updated) {
      return res.status(500).json({ error: "MESSAGE_REPLY_NOT_CONFIRMED", message: "Reply was not saved." });
    }
    req.log.info({ user_id: customerUserId, message_id: messageId }, "customer message reply created");
    return res.json({ ok: true, message: await fetchThreadPayload(supabaseConfig, updated) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Reply could not be sent.";
    req.log.error({ err: message, status }, "customer message reply failed");
    return res.status(status).json({ error: "MESSAGE_REPLY_FAILED", message });
  }
}

router.get("/messages", customerListHandler);
router.get("/contact/messages", customerListHandler);
router.post("/messages", customerCreateHandler);
router.post("/contact/messages", customerCreateHandler);
router.get("/messages/:id", customerDetailHandler);
router.get("/contact/messages/:id", customerDetailHandler);
router.post("/messages/:id/reply", customerReplyHandler);
router.post("/contact/messages/:id/reply", customerReplyHandler);

router.get("/admin/messages", adminAuthMiddleware, async (_req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const rows = await supabaseRequest(supabaseConfig, "/rest/v1/contact_messages?select=*&order=created_at.desc", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const messages = await serializeMessages(supabaseConfig, Array.isArray(rows) ? rows as ContactMessageRow[] : []);
    return res.json({ messages });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Messages could not be loaded.";
    return res.status(status).json({ error: "MESSAGES_FETCH_FAILED", message });
  }
});

router.get("/admin/messages/:id", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    const messageId = String(req.params.id);
    const message = await fetchMessage(supabaseConfig, messageId);
    if (!message) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });
    return res.json({ message: await fetchThreadPayload(supabaseConfig, message) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Message could not be loaded.";
    return res.status(status).json({ error: "MESSAGE_FETCH_FAILED", message });
  }
});

router.patch("/admin/messages/:id/status", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const messageId = String(req.params.id);
    const status = parseRequestedStatus(req.body?.status);
    if (!status) {
      return res.status(400).json({ error: "INVALID_MESSAGE_STATUS", message: "Invalid message status." });
    }

    const patch: Record<string, unknown> = { status };
    if (status === "closed") {
      patch.closed_at = new Date().toISOString();
      patch.closed_by = adminUserId;
    } else if (status === "open") {
      patch.closed_at = null;
      patch.closed_by = null;
    }

    const updated = await patchMessage(supabaseConfig, messageId, patch);
    if (!updated) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });
    req.log.info({ admin_user_id: adminUserId, message_id: messageId, status }, "contact message status updated");
    return res.json({ ok: true, message: await fetchThreadPayload(supabaseConfig, updated) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Message status could not be updated.";
    req.log.error({ err: message, status }, "contact message status update failed");
    return res.status(status).json({ error: "MESSAGE_STATUS_FAILED", message });
  }
});

router.post("/admin/messages/:id/reply", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const messageId = String(req.params.id);
    const reply = cleanText(req.body?.message ?? req.body?.admin_reply);
    const repliedBy = cleanText(req.body?.replied_by) || adminUserId;
    if (reply.length < 3) {
      return res.status(400).json({ error: "REPLY_REQUIRED", message: "Write a reply before sending." });
    }
    const existing = await fetchMessage(supabaseConfig, messageId);
    if (!existing) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });
    if (isClosed(existing)) {
      return res.status(409).json({ error: "MESSAGE_CLOSED", message: "This conversation is closed." });
    }

    const repliedAt = new Date().toISOString();
    await createThreadReply(supabaseConfig, messageId, "admin", adminUserId, reply, repliedAt);
    const updated = await patchMessage(supabaseConfig, messageId, {
      admin_reply: reply,
      replied_by: repliedBy,
      replied_at: repliedAt,
      status: "admin_replied",
      last_reply_at: repliedAt,
      last_reply_by: adminUserId,
    });
    if (!updated) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });

    await saveReplyNotification(supabaseConfig, updated);
    req.log.info({ admin_user_id: adminUserId, message_id: messageId }, "contact message replied");
    return res.json({ ok: true, message: await fetchThreadPayload(supabaseConfig, updated) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Reply could not be sent.";
    req.log.error({ err: message, status }, "contact message reply failed");
    return res.status(status).json({ error: "MESSAGE_REPLY_FAILED", message });
  }
});

router.post("/admin/messages/:id/close", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const messageId = String(req.params.id);
    const updated = await patchMessage(supabaseConfig, messageId, {
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: adminUserId,
    });
    if (!updated) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });
    req.log.info({ admin_user_id: adminUserId, message_id: messageId }, "contact message closed");
    return res.json({ ok: true, message: await fetchThreadPayload(supabaseConfig, updated) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Message could not be closed.";
    req.log.error({ err: message, status }, "contact message close failed");
    return res.status(status).json({ error: "MESSAGE_CLOSE_FAILED", message });
  }
});

router.post("/admin/messages/:id/reopen", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const messageId = String(req.params.id);
    const updated = await patchMessage(supabaseConfig, messageId, {
      status: "open",
      closed_at: null,
      closed_by: null,
    });
    if (!updated) return res.status(404).json({ error: "MESSAGE_NOT_FOUND", message: "Message was not found." });
    req.log.info({ admin_user_id: adminUserId, message_id: messageId }, "contact message reopened");
    return res.json({ ok: true, message: await fetchThreadPayload(supabaseConfig, updated) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Message could not be reopened.";
    req.log.error({ err: message, status }, "contact message reopen failed");
    return res.status(status).json({ error: "MESSAGE_REOPEN_FAILED", message });
  }
});

export default router;

import {
  SUPABASE_NOT_CONNECTED_MESSAGE,
  supabaseConfigured,
  useDevOrderMock,
} from "@/lib/supabase";
import { adminApiFetchJson, customerApiFetchJson } from "@/lib/apiClient";
import type { ContactMessage, ContactMessageReply, ContactMessageStatus } from "@/lib/types";

const CONTACT_MESSAGES_KEY = "swear_contact_messages_db";

type MessagePayload = {
  ok?: boolean;
  messages?: Record<string, any>[];
  message?: Record<string, any> | null;
};

export type CreateContactMessageInput = {
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  subject: string;
  message: string;
  orderId?: string | null;
};

function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeStatus(value: unknown): ContactMessageStatus {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (status === "replied") return "admin_replied";
  if (["open", "customer_replied", "pending_admin", "admin_replied", "closed"].includes(status)) {
    return status as ContactMessageStatus;
  }
  return "open";
}

function rowToReply(row: Record<string, any>): ContactMessageReply {
  return {
    id: row.id,
    contactMessageId: row.contactMessageId ?? row.contact_message_id,
    senderId: row.senderId ?? row.sender_id ?? null,
    senderRole: row.senderRole === "admin" || row.sender_role === "admin" ? "admin" : "customer",
    message: row.message || "",
    createdAt: row.createdAt ?? row.created_at ?? new Date(0).toISOString(),
  };
}

export function rowToContactMessage(row: Record<string, any>): ContactMessage {
  const replies = Array.isArray(row.replies) ? row.replies.map(rowToReply) : [];
  const latestReply = row.latestReply
    ? rowToReply(row.latestReply)
    : row.latest_reply
      ? rowToReply(row.latest_reply)
      : replies[replies.length - 1] ?? null;

  return {
    id: row.id,
    customerId: row.customerId ?? row.customer_id ?? "",
    customerName: row.customerName ?? row.customer_name ?? undefined,
    customerEmail: row.customerEmail ?? row.customer_email ?? undefined,
    customerPhone: row.customerPhone ?? row.customer_phone ?? undefined,
    subject: row.subject || "",
    message: row.message || "",
    orderId: row.orderId ?? row.order_id ?? null,
    status: normalizeStatus(row.status),
    adminReply: row.adminReply ?? row.admin_reply ?? null,
    repliedBy: row.repliedBy ?? row.replied_by ?? null,
    repliedAt: row.repliedAt ?? row.replied_at ?? null,
    closedAt: row.closedAt ?? row.closed_at ?? null,
    closedBy: row.closedBy ?? row.closed_by ?? null,
    lastReplyAt: row.lastReplyAt ?? row.last_reply_at ?? latestReply?.createdAt ?? null,
    lastReplyBy: row.lastReplyBy ?? row.last_reply_by ?? latestReply?.senderId ?? null,
    createdAt: row.createdAt ?? row.created_at ?? new Date(0).toISOString(),
    replies,
    latestReply,
    replyCount: Number(row.replyCount ?? row.reply_count ?? replies.length) || 0,
  };
}

function readLocalMessages(): ContactMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTACT_MESSAGES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(rowToContactMessage) : [];
  } catch {
    return [];
  }
}

function writeLocalMessages(messages: ContactMessage[]): void {
  localStorage.setItem(CONTACT_MESSAGES_KEY, JSON.stringify(messages));
}

function assertContactBackend() {
  if (supabaseConfigured) return;
  if (useDevOrderMock) return;
  throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
}

function updateLocalMessage(id: string, updater: (message: ContactMessage) => ContactMessage): ContactMessage | null {
  const messages = readLocalMessages();
  const idx = messages.findIndex(message => message.id === id);
  if (idx === -1) return null;
  messages[idx] = updater(messages[idx]);
  writeLocalMessages(messages);
  return messages[idx];
}

function appendLocalReply(
  message: ContactMessage,
  senderRole: "customer" | "admin",
  body: string,
  senderId?: string | null
): ContactMessage {
  const createdAt = new Date().toISOString();
  const reply: ContactMessageReply = {
    id: createId(),
    contactMessageId: message.id,
    senderId: senderId ?? null,
    senderRole,
    message: body,
    createdAt,
  };
  const replies = [...(message.replies ?? []), reply];
  return {
    ...message,
    replies,
    latestReply: reply,
    replyCount: replies.length,
    lastReplyAt: createdAt,
    lastReplyBy: senderId ?? null,
  };
}

export async function dbCreateContactMessage(input: CreateContactMessageInput): Promise<ContactMessage> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await customerApiFetchJson<MessagePayload>(
      "/messages",
      {
        method: "POST",
        body: JSON.stringify({
          subject: input.subject,
          message: input.message,
          order_id: input.orderId ?? null,
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone,
        }),
      },
      "Failed to send message."
    );
    if (!payload.message) throw new Error("Message was not saved.");
    return rowToContactMessage(payload.message);
  }

  const message: ContactMessage = {
    id: createId(),
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    subject: input.subject.trim(),
    message: input.message.trim(),
    orderId: input.orderId?.trim() || null,
    status: "open",
    adminReply: null,
    repliedBy: null,
    repliedAt: null,
    closedAt: null,
    closedBy: null,
    lastReplyAt: null,
    lastReplyBy: null,
    createdAt: new Date().toISOString(),
    replies: [],
    latestReply: null,
    replyCount: 0,
  };
  writeLocalMessages([message, ...readLocalMessages()]);
  return message;
}

export async function dbGetUserContactMessages(_customerId: string): Promise<ContactMessage[]> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await customerApiFetchJson<MessagePayload>("/messages", {}, "Failed to load messages.");
    return (payload.messages ?? []).map(rowToContactMessage);
  }

  return readLocalMessages()
    .filter(message => message.customerId === _customerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function dbGetCustomerContactMessageById(id: string): Promise<ContactMessage | null> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await customerApiFetchJson<MessagePayload>(
      `/messages/${encodeURIComponent(id)}`,
      {},
      "Failed to load message."
    );
    return payload.message ? rowToContactMessage(payload.message) : null;
  }
  return readLocalMessages().find(message => message.id === id) ?? null;
}

export async function dbReplyToCustomerContactMessage(id: string, body: string): Promise<ContactMessage | null> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await customerApiFetchJson<MessagePayload>(
      `/messages/${encodeURIComponent(id)}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ message: body }),
      },
      "Failed to send reply."
    );
    return payload.message ? rowToContactMessage(payload.message) : null;
  }

  return updateLocalMessage(id, message => ({
    ...appendLocalReply(message, "customer", body, message.customerId),
    status: "customer_replied",
  }));
}

export async function dbGetAllContactMessages(): Promise<ContactMessage[]> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await adminApiFetchJson<MessagePayload>(
      "/admin/messages",
      {},
      "Failed to load messages."
    );
    return (payload.messages ?? []).map(rowToContactMessage);
  }

  return readLocalMessages()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function dbGetContactMessageById(id: string): Promise<ContactMessage | null> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await adminApiFetchJson<MessagePayload>(
      `/admin/messages/${encodeURIComponent(id)}`,
      {},
      "Failed to load message."
    );
    return payload.message ? rowToContactMessage(payload.message) : null;
  }

  return readLocalMessages().find(message => message.id === id) ?? null;
}

export async function dbReplyToContactMessage(
  id: string,
  adminReply: string,
  repliedBy: string
): Promise<ContactMessage | null> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await adminApiFetchJson<MessagePayload>(
      `/admin/messages/${encodeURIComponent(id)}/reply`,
      {
        method: "POST",
        body: JSON.stringify({
          message: adminReply,
          admin_reply: adminReply,
          replied_by: repliedBy,
        }),
      },
      "Failed to send reply."
    );
    return payload.message ? rowToContactMessage(payload.message) : null;
  }

  return updateLocalMessage(id, message => {
    const next = appendLocalReply(message, "admin", adminReply, null);
    return {
      ...next,
      status: "admin_replied",
      adminReply,
      repliedBy,
      repliedAt: next.lastReplyAt,
    };
  });
}

export async function dbCloseContactMessage(id: string): Promise<ContactMessage | null> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await adminApiFetchJson<MessagePayload>(
      `/admin/messages/${encodeURIComponent(id)}/close`,
      { method: "POST" },
      "Failed to close conversation."
    );
    return payload.message ? rowToContactMessage(payload.message) : null;
  }

  return updateLocalMessage(id, message => ({
    ...message,
    status: "closed",
    closedAt: new Date().toISOString(),
  }));
}

export async function dbReopenContactMessage(id: string): Promise<ContactMessage | null> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await adminApiFetchJson<MessagePayload>(
      `/admin/messages/${encodeURIComponent(id)}/reopen`,
      { method: "POST" },
      "Failed to reopen conversation."
    );
    return payload.message ? rowToContactMessage(payload.message) : null;
  }

  return updateLocalMessage(id, message => ({
    ...message,
    status: "open",
    closedAt: null,
    closedBy: null,
  }));
}

export async function dbUpdateContactMessageStatus(
  id: string,
  status: ContactMessageStatus
): Promise<ContactMessage | null> {
  assertContactBackend();
  if (supabaseConfigured) {
    const payload = await adminApiFetchJson<MessagePayload>(
      `/admin/messages/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
      "Failed to update message status."
    );
    return payload.message ? rowToContactMessage(payload.message) : null;
  }

  return updateLocalMessage(id, message => ({ ...message, status: normalizeStatus(status) }));
}

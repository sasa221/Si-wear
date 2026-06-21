import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();

type SupabaseConfig = ReturnType<typeof getSupabaseConfig>;

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  blocked: boolean | null;
  is_active: boolean | null;
  last_login_at: string | null;
  created_at: string | null;
};

type OrderRow = Record<string, any> & { id: string; user_id?: string | null };
type ContactMessageRow = Record<string, any> & { id: string; customer_id?: string | null };
type NotificationRow = Record<string, any> & { id: string; customer_id?: string | null };

function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  return value?.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
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

function getBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
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

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return [record["message"], record["details"], record["hint"], record["code"]]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ") || fallback;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === "t") return true;
  if (value === false || value === "false" || value === "f") return false;
  return fallback;
}

function profileRole(profile: ProfileRow | undefined): string {
  return String(profile?.role ?? "customer").toLowerCase();
}

function profileBlocked(profile: ProfileRow | undefined): boolean {
  return asBoolean(profile?.blocked, false);
}

function profileActive(profile: ProfileRow | undefined): boolean {
  return asBoolean(profile?.is_active, true);
}

async function supabaseRequest(config: SupabaseConfig, path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const payload = await readJson(res);
  if (!res.ok) {
    throw Object.assign(new Error(errorMessage(payload, res.statusText || "Supabase request failed.")), { status: res.status });
  }
  return payload;
}

async function requireAdminUserId(config: SupabaseConfig, token: string): Promise<string> {
  const authRes = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  const authPayload = await readJson(authRes);
  if (!authRes.ok) {
    throw Object.assign(new Error(errorMessage(authPayload, "Invalid admin session.")), { status: 401 });
  }

  const authUser = authPayload as { id?: string };
  if (!authUser.id) {
    throw Object.assign(new Error("Invalid admin session."), { status: 401 });
  }

  const profiles = await fetchProfiles(config);
  const profile = profiles.find(row => row.id === authUser.id);
  if (profileRole(profile) !== "admin" || profileBlocked(profile) || !profileActive(profile)) {
    throw Object.assign(new Error("Admin access is required to manage users."), { status: 403 });
  }

  return authUser.id;
}

async function fetchProfiles(config: SupabaseConfig): Promise<ProfileRow[]> {
  const rows = await supabaseRequest(config, "/rest/v1/profiles?select=*&order=created_at.desc", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows as ProfileRow[] : [];
}

async function fetchOrders(config: SupabaseConfig, userId?: string): Promise<OrderRow[]> {
  const filter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "";
  const rows = await supabaseRequest(config, `/rest/v1/orders?select=*&order=created_at.desc${filter}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows as OrderRow[] : [];
}

async function fetchContactMessages(config: SupabaseConfig, userId: string): Promise<ContactMessageRow[]> {
  const rows = await supabaseRequest(config, `/rest/v1/contact_messages?select=*&customer_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows as ContactMessageRow[] : [];
}

async function fetchNotifications(config: SupabaseConfig, userId: string): Promise<NotificationRow[]> {
  const rows = await supabaseRequest(config, `/rest/v1/notifications?select=*&customer_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows as NotificationRow[] : [];
}

function orderTotal(row: OrderRow): number {
  return Math.max(0, Number(row.total_egp) || 0);
}

function rowToUserSummary(row: ProfileRow, orders: OrderRow[]) {
  const activeOrders = orders.filter(order => order.status !== "Cancelled");
  return {
    id: row.id,
    fullName: row.full_name || "Customer",
    email: row.email || "",
    phone: row.phone || "",
    role: profileRole(row),
    blocked: profileBlocked(row),
    isActive: profileActive(row),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at || new Date(0).toISOString(),
    totalOrders: orders.length,
    totalSpentEgp: activeOrders.reduce((sum, order) => sum + orderTotal(order), 0),
    hasOrders: orders.length > 0,
  };
}

function buildStats(users: ReturnType<typeof rowToUserSummary>[]) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return {
    totalUsers: users.length,
    activeUsers: users.filter(user => user.isActive && !user.blocked).length,
    blockedUsers: users.filter(user => user.blocked || !user.isActive).length,
    newUsersThisMonth: users.filter(user => new Date(user.createdAt).getTime() >= startOfMonth).length,
    usersWithOrders: users.filter(user => user.hasOrders).length,
    totalRevenueEgp: users.reduce((sum, user) => sum + user.totalSpentEgp, 0),
  };
}

function rowToOrder(row: OrderRow) {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    items: [],
    total: orderTotal(row),
    deliveryFee: Math.max(0, Number(row.shipping_egp) || 0),
    ...(row.discount_code ? { discountCode: row.discount_code } : {}),
    ...(Number(row.discount_amount) > 0 ? { discountAmount: Number(row.discount_amount) } : {}),
    status: row.status || "Pending",
    customer: {
      name: row.customer_name || "",
      phone: row.phone || "",
      governorate: row.governorate || "",
      city: row.city_area || "",
      address: row.full_address || "",
      notes: row.notes || undefined,
    },
    createdAt: row.created_at || new Date(0).toISOString(),
    adminNotes: row.admin_notes || undefined,
  };
}

function rowToContactMessage(row: ContactMessageRow) {
  return {
    id: row.id,
    customerId: row.customer_id || "",
    customerName: row.customer_name || undefined,
    customerEmail: row.customer_email || undefined,
    customerPhone: row.customer_phone || undefined,
    subject: row.subject || "",
    message: row.message || "",
    orderId: row.order_id ?? null,
    status: row.status || "open",
    adminReply: row.admin_reply ?? null,
    repliedBy: row.replied_by ?? null,
    repliedAt: row.replied_at ?? null,
    createdAt: row.created_at || new Date(0).toISOString(),
  };
}

function rowToNotification(row: NotificationRow) {
  return {
    id: row.id,
    userId: row.customer_id || "",
    orderId: row.order_id ?? null,
    contactMessageId: row.contact_message_id ?? null,
    message: row.message || "",
    createdAt: row.created_at || new Date(0).toISOString(),
    read: asBoolean(row.read, false),
  };
}

function activeAdminProfiles(profiles: ProfileRow[]): ProfileRow[] {
  return profiles.filter(profile =>
    profileRole(profile) === "admin" &&
    !profileBlocked(profile) &&
    profileActive(profile)
  );
}

function assertCanDemoteOrDeactivateAdmin(
  profiles: ProfileRow[],
  target: ProfileRow,
  adminUserId: string,
  action: string,
) {
  if (target.id === adminUserId) {
    throw Object.assign(new Error(`You cannot ${action} your own admin account.`), { status: 400 });
  }

  if (profileRole(target) !== "admin") return;
  const remainingAdmins = activeAdminProfiles(profiles).filter(profile => profile.id !== target.id);
  if (remainingAdmins.length === 0) {
    throw Object.assign(new Error("At least one active admin must remain."), { status: 400 });
  }
}

async function getAdminContext(req: Request) {
  const config = getSupabaseConfig();
  const token = getBearerToken(req.header("authorization"));
  if (!token) {
    throw Object.assign(new Error("Admin login is required to manage users."), { status: 401 });
  }
  const adminUserId = await requireAdminUserId(config, token);
  return { config, adminUserId };
}

router.get("/admin/users", async (req, res) => {
  try {
    const { config, adminUserId } = await getAdminContext(req);
    const [profiles, orders] = await Promise.all([fetchProfiles(config), fetchOrders(config)]);
    const ordersByUser = new Map<string, OrderRow[]>();
    for (const order of orders) {
      if (!order.user_id) continue;
      ordersByUser.set(order.user_id, [...(ordersByUser.get(order.user_id) ?? []), order]);
    }

    const users = profiles.map(profile => rowToUserSummary(profile, ordersByUser.get(profile.id) ?? []));
    req.log.info({ admin_user_id: adminUserId, users: users.length }, "admin users fetched");
    return res.json({ users, stats: buildStats(users) });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Users could not be loaded.";
    req.log.error({ err: message, status }, "admin users fetch failed");
    return res.status(status).json({ error: "USERS_FETCH_FAILED", message });
  }
});

router.get("/admin/users/:id", async (req, res) => {
  try {
    const { config, adminUserId } = await getAdminContext(req);
    const userId = req.params.id;
    const [profiles, orders, messages, notifications] = await Promise.all([
      fetchProfiles(config),
      fetchOrders(config, userId),
      fetchContactMessages(config, userId),
      fetchNotifications(config, userId),
    ]);
    const profile = profiles.find(row => row.id === userId);
    if (!profile) return res.status(404).json({ error: "USER_NOT_FOUND", message: "User was not found." });

    req.log.info({ admin_user_id: adminUserId, user_id: userId }, "admin user details fetched");
    return res.json({
      user: {
        ...rowToUserSummary(profile, orders),
        orders: orders.map(rowToOrder),
        messages: messages.map(rowToContactMessage),
        notifications: notifications.map(rowToNotification),
      },
    });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "User details could not be loaded.";
    req.log.error({ err: message, status }, "admin user details fetch failed");
    return res.status(status).json({ error: "USER_FETCH_FAILED", message });
  }
});

router.patch("/admin/users/:id/role", async (req, res) => {
  try {
    const { config, adminUserId } = await getAdminContext(req);
    const targetId = req.params.id;
    const role = String(req.body?.role ?? "").toLowerCase();
    if (!["customer", "admin"].includes(role)) {
      return res.status(400).json({ error: "INVALID_ROLE", message: "Role must be customer or admin." });
    }

    const profiles = await fetchProfiles(config);
    const target = profiles.find(profile => profile.id === targetId);
    if (!target) return res.status(404).json({ error: "USER_NOT_FOUND", message: "User was not found." });
    if (role === "customer") {
      assertCanDemoteOrDeactivateAdmin(profiles, target, adminUserId, "remove admin access from");
    }

    await supabaseRequest(config, `/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ role }),
    });

    req.log.info({ admin_user_id: adminUserId, user_id: targetId, role }, "admin user role updated");
    return res.json({ ok: true });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "User role could not be updated.";
    req.log.error({ err: message, status }, "admin user role update failed");
    return res.status(status).json({ error: "USER_ROLE_FAILED", message });
  }
});

router.patch("/admin/users/:id/status", async (req, res) => {
  try {
    const { config, adminUserId } = await getAdminContext(req);
    const targetId = req.params.id;
    const profiles = await fetchProfiles(config);
    const target = profiles.find(profile => profile.id === targetId);
    if (!target) return res.status(404).json({ error: "USER_NOT_FOUND", message: "User was not found." });

    const nextBlocked = asBoolean(req.body?.blocked, profileBlocked(target));
    const nextIsActive = asBoolean(req.body?.isActive, profileActive(target));
    if (nextBlocked || !nextIsActive) {
      assertCanDemoteOrDeactivateAdmin(profiles, target, adminUserId, "restrict");
    }

    await supabaseRequest(config, `/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ blocked: nextBlocked, is_active: nextIsActive }),
    });

    req.log.info({ admin_user_id: adminUserId, user_id: targetId, blocked: nextBlocked, is_active: nextIsActive }, "admin user status updated");
    return res.json({ ok: true });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "User status could not be updated.";
    req.log.error({ err: message, status }, "admin user status update failed");
    return res.status(status).json({ error: "USER_STATUS_FAILED", message });
  }
});

export default router;

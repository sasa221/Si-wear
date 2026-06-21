import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const CART_ITEM_UPDATED_MESSAGE = "This item was updated. Please remove it and add it again.";

type SupabaseConfig = ReturnType<typeof getSupabaseConfig>;
type ProfileRow = {
  id: string;
  role?: string | null;
  blocked?: boolean | string | null;
  is_active?: boolean | string | null;
};
type CustomerContext = {
  config: SupabaseConfig;
  userId: string;
};
type OrderRow = Record<string, any> & {
  id: string;
  user_id?: string | null;
  status?: string | null;
  cancellation_requested?: boolean | string | null;
  cancellation_status?: string | null;
  cancellation_requested_at?: string | null;
};
type OrderItemRow = Record<string, any> & { order_id: string };
type OrderItemPayload = {
  product_id: string;
  variant_id: string;
  size: string;
  color: string;
  quantity: number;
};
type VariantRow = {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  stock: number | null;
  active: boolean | null;
};
type ProductRow = {
  id: string;
  status: string | null;
};

const CUSTOMER_CANCELLABLE_STATUSES = new Set(["pending", "confirmed", "processing", "preparing"]);

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

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return [record["message"], record["details"], record["hint"], record["code"]]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ") || fallback;
  }
  return fallback;
}

function getErrorStatus(err: unknown): number {
  return typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
    ? (err as { status: number }).status
    : 500;
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

async function supabaseServiceRequest(
  config: SupabaseConfig,
  path: string,
  init: RequestInit,
): Promise<unknown> {
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

function normalizeWorkflowValue(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, " ") : "";
}

function cancellationWorkflowStatus(order: OrderRow): "pending" | "approved" | "rejected" | null {
  const status = normalizeWorkflowValue(order.cancellation_status);
  if (status === "pending" || status === "approved" || status === "rejected") return status;
  return asBoolean(order.cancellation_requested, false) ? "pending" : null;
}

function isCustomerCancellable(order: OrderRow): boolean {
  return CUSTOMER_CANCELLABLE_STATUSES.has(normalizeWorkflowValue(order.status));
}

async function requireCustomerContext(req: Request): Promise<CustomerContext> {
  const config = getSupabaseConfig();
  const token = getBearerToken(req.header("authorization"));
  if (!token) {
    throw Object.assign(new Error("Login is required."), { status: 401 });
  }

  const authRes = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
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

  const profileRows = await supabaseServiceRequest(
    config,
    `/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,role,blocked,is_active&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  const profile = Array.isArray(profileRows) ? profileRows[0] as ProfileRow | undefined : undefined;
  if (!profile || profileBlocked(profile) || !profileActive(profile)) {
    throw Object.assign(new Error("Your account is not active."), { status: 403 });
  }

  return { config, userId: authUser.id };
}

async function fetchCustomerOrders(config: SupabaseConfig, userId: string): Promise<OrderRow[]> {
  const rows = await supabaseServiceRequest(
    config,
    `/rest/v1/orders?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) ? rows as OrderRow[] : [];
}

async function fetchCustomerOrder(config: SupabaseConfig, userId: string, orderId: string): Promise<OrderRow | null> {
  const rows = await supabaseServiceRequest(
    config,
    `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) ? rows[0] as OrderRow | undefined ?? null : null;
}

async function fetchOrderItems(config: SupabaseConfig, orderIds: string[]): Promise<OrderItemRow[]> {
  if (orderIds.length === 0) return [];
  const encoded = orderIds.map(id => encodeURIComponent(id)).join(",");
  const rows = await supabaseServiceRequest(
    config,
    `/rest/v1/order_items?order_id=in.(${encoded})&select=*`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) ? rows as OrderItemRow[] : [];
}

async function fetchOrderPayload(config: SupabaseConfig, order: OrderRow) {
  const items = await fetchOrderItems(config, [order.id]);
  return { order, items };
}

function normalizeOption(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseOrderItemPayload(item: unknown): OrderItemPayload {
  const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
  return {
    product_id: typeof row["product_id"] === "string" ? row["product_id"].trim() : "",
    variant_id: typeof row["variant_id"] === "string" ? row["variant_id"].trim() : "",
    size: typeof row["size"] === "string" ? row["size"].trim() : "",
    color: typeof row["color"] === "string" ? row["color"].trim() : "",
    quantity: Math.max(0, Math.round(Number(row["quantity"]) || 0)),
  };
}

function logStockValidationFailure(
  req: Request,
  details: {
    product_id: string;
    variant_id: string;
    size: string;
    color: string;
    requested_quantity: number;
    matched_variant: boolean;
    variant_active: boolean | null;
    product_active: boolean | null;
    available_stock: number | null;
    reason: string;
  },
) {
  req.log.warn(details, "checkout stock validation failed");
}

async function fetchVariant(config: SupabaseConfig, variantId: string): Promise<VariantRow | null> {
  const rows = await supabaseServiceRequest(
    config,
    `/rest/v1/product_variants?id=eq.${encodeURIComponent(variantId)}&select=id,product_id,size,color,stock,active&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) && rows[0] ? rows[0] as VariantRow : null;
}

async function fetchProduct(config: SupabaseConfig, productId: string): Promise<ProductRow | null> {
  const rows = await supabaseServiceRequest(
    config,
    `/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=id,status&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) && rows[0] ? rows[0] as ProductRow : null;
}

async function validateStockBeforeOrder(
  req: Request,
  config: SupabaseConfig,
  itemsPayload: unknown[],
): Promise<string | null> {
  const grouped = new Map<string, OrderItemPayload>();

  for (const rawItem of itemsPayload) {
    const item = parseOrderItemPayload(rawItem);
    if (!item.variant_id || !isUuid(item.variant_id)) {
      logStockValidationFailure(req, {
        product_id: item.product_id,
        variant_id: item.variant_id,
        size: item.size,
        color: item.color,
        requested_quantity: item.quantity,
        matched_variant: false,
        variant_active: null,
        product_active: null,
        available_stock: null,
        reason: "missing_or_invalid_variant_id",
      });
      return CART_ITEM_UPDATED_MESSAGE;
    }
    if (!item.product_id || item.quantity <= 0) {
      logStockValidationFailure(req, {
        product_id: item.product_id,
        variant_id: item.variant_id,
        size: item.size,
        color: item.color,
        requested_quantity: item.quantity,
        matched_variant: false,
        variant_active: null,
        product_active: null,
        available_stock: null,
        reason: "invalid_item_payload",
      });
      return "Order item is invalid.";
    }

    const existing = grouped.get(item.variant_id);
    grouped.set(
      item.variant_id,
      existing ? { ...existing, quantity: existing.quantity + item.quantity } : item,
    );
  }

  for (const item of grouped.values()) {
    const variant = await fetchVariant(config, item.variant_id);
    const variantActive = variant ? variant.active !== false : null;
    const availableStock = variant ? Math.max(0, Number(variant.stock) || 0) : null;

    if (!variant) {
      logStockValidationFailure(req, {
        product_id: item.product_id,
        variant_id: item.variant_id,
        size: item.size,
        color: item.color,
        requested_quantity: item.quantity,
        matched_variant: false,
        variant_active: null,
        product_active: null,
        available_stock: null,
        reason: "variant_not_found",
      });
      return CART_ITEM_UPDATED_MESSAGE;
    }

    const product = await fetchProduct(config, variant.product_id);
    const productActive = product ? normalizeOption(product.status || "active") === "active" : false;
    const productMatches = variant.product_id === item.product_id;
    const optionMatches = normalizeOption(variant.size) === normalizeOption(item.size) &&
      normalizeOption(variant.color) === normalizeOption(item.color);

    if (!productMatches || !optionMatches) {
      logStockValidationFailure(req, {
        product_id: item.product_id,
        variant_id: item.variant_id,
        size: item.size,
        color: item.color,
        requested_quantity: item.quantity,
        matched_variant: true,
        variant_active: variantActive,
        product_active: productActive,
        available_stock: availableStock,
        reason: productMatches ? "size_or_color_mismatch" : "product_id_mismatch",
      });
      return CART_ITEM_UPDATED_MESSAGE;
    }

    if (!productActive) {
      logStockValidationFailure(req, {
        product_id: item.product_id,
        variant_id: item.variant_id,
        size: item.size,
        color: item.color,
        requested_quantity: item.quantity,
        matched_variant: true,
        variant_active: variantActive,
        product_active: productActive,
        available_stock: availableStock,
        reason: "product_inactive",
      });
      return "Selected product is not available for ordering.";
    }

    if (!variantActive) {
      logStockValidationFailure(req, {
        product_id: item.product_id,
        variant_id: item.variant_id,
        size: item.size,
        color: item.color,
        requested_quantity: item.quantity,
        matched_variant: true,
        variant_active: variantActive,
        product_active: productActive,
        available_stock: availableStock,
        reason: "variant_inactive",
      });
      return "Selected product variant is no longer available.";
    }

    if ((availableStock ?? 0) < item.quantity) {
      logStockValidationFailure(req, {
        product_id: item.product_id,
        variant_id: item.variant_id,
        size: item.size,
        color: item.color,
        requested_quantity: item.quantity,
        matched_variant: true,
        variant_active: variantActive,
        product_active: productActive,
        available_stock: availableStock,
        reason: "insufficient_stock",
      });
      return `${variant.color} / ${variant.size} has only ${availableStock ?? 0} left.`;
    }
  }

  return null;
}

router.get("/orders", async (req, res) => {
  try {
    const { config, userId } = await requireCustomerContext(req);
    const orders = await fetchCustomerOrders(config, userId);
    const items = await fetchOrderItems(config, orders.map(order => order.id));
    return res.json({ orders, items });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Orders could not be loaded.";
    req.log.error({ err: message, status }, "customer orders fetch failed");
    return res.status(status).json({ error: "ORDERS_FETCH_FAILED", message });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const { config, userId } = await requireCustomerContext(req);
    const orderId = String(req.params.id);
    const order = await fetchCustomerOrder(config, userId, orderId);
    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND", message: "Order was not found." });
    return res.json(await fetchOrderPayload(config, order));
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Order could not be loaded.";
    req.log.error({ err: message, status }, "customer order fetch failed");
    return res.status(status).json({ error: "ORDER_FETCH_FAILED", message });
  }
});

router.post("/orders/:id/cancel-request", async (req, res) => {
  try {
    const { config, userId } = await requireCustomerContext(req);
    const orderId = String(req.params.id);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (reason.length < 5) {
      return res.status(400).json({ error: "CANCELLATION_REASON_REQUIRED", message: "Please add a short cancellation reason." });
    }

    const order = await fetchCustomerOrder(config, userId, orderId);
    if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND", message: "Order was not found." });

    const cancellationStatus = cancellationWorkflowStatus(order);
    if (cancellationStatus === "pending") {
      return res.status(409).json({ error: "CANCELLATION_ALREADY_PENDING", message: "Cancellation is already pending admin review." });
    }
    if (cancellationStatus === "approved") {
      return res.status(400).json({ error: "CANCELLATION_ALREADY_APPROVED", message: "This cancellation request was already approved." });
    }
    if (cancellationStatus === "rejected") {
      return res.status(400).json({ error: "CANCELLATION_ALREADY_REJECTED", message: "This cancellation request was already reviewed." });
    }
    if (!isCustomerCancellable(order)) {
      return res.status(400).json({ error: "ORDER_NOT_CANCELLABLE", message: "This order can no longer be cancelled." });
    }

    const requestedAt = new Date().toISOString();
    const rows = await supabaseServiceRequest(config, `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { Accept: "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        cancellation_requested: true,
        cancellation_status: "pending",
        cancellation_reason: reason,
        cancellation_requested_at: requestedAt,
        cancellation_resolved_at: null,
        cancellation_admin_note: null,
      }),
    });
    const updated = Array.isArray(rows) ? rows[0] as OrderRow | undefined : undefined;
    if (!updated || cancellationWorkflowStatus(updated) !== "pending" || !updated.cancellation_requested_at) {
      req.log.error({ order_id: orderId, user_id: userId }, "cancellation request write was not confirmed");
      return res.status(500).json({ error: "CANCELLATION_NOT_CONFIRMED", message: "Cancellation request was not saved." });
    }

    req.log.info({ order_id: orderId, user_id: userId }, "customer cancellation requested");
    return res.json(await fetchOrderPayload(config, updated));
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Cancellation request could not be saved.";
    req.log.error({ err: message, status }, "customer cancellation request failed");
    return res.status(status).json({ error: "CANCELLATION_REQUEST_FAILED", message });
  }
});

router.post("/orders/place", async (req, res) => {
  try {
    const customerToken = getBearerToken(req.header("authorization"));
    if (!customerToken) {
      return res.status(401).json({ error: "Login is required to place an order." });
    }

    const { order_payload: orderPayload, items_payload: itemsPayload } = req.body ?? {};
    if (!orderPayload || !Array.isArray(itemsPayload) || itemsPayload.length === 0) {
      return res.status(400).json({ error: "Order payload and items are required." });
    }

    const config = getSupabaseConfig();

    const authRes = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${customerToken}`,
      },
    });
    const authPayload = await readJson(authRes);
    if (!authRes.ok) {
      return res.status(401).json({ error: errorMessage(authPayload, "Invalid customer session.") });
    }

    const authUser = authPayload as { id?: string };
    if (!authUser.id) {
      return res.status(401).json({ error: "Invalid customer session." });
    }

    const profileRows = await supabaseServiceRequest(
      config,
      `/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,blocked,is_active&limit=1`,
      { method: "GET", headers: { Accept: "application/json" } },
    );
    const profile = Array.isArray(profileRows) ? profileRows[0] as ProfileRow | undefined : undefined;
    if (!profile || profileBlocked(profile) || !profileActive(profile)) {
      return res.status(403).json({ error: "ACCOUNT_RESTRICTED", message: "Your account is restricted. Please contact S! Wear support." });
    }

    const stockError = await validateStockBeforeOrder(req, config, itemsPayload);
    if (stockError) {
      return res.status(400).json({ error: stockError });
    }

    const rpcRes = await fetch(`${config.url}/rest/v1/rpc/place_order_with_items`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_user_id: authUser.id,
        order_payload: orderPayload,
        items_payload: itemsPayload,
      }),
    });
    const rpcPayload = await readJson(rpcRes);
    if (!rpcRes.ok) {
      return res.status(400).json({ error: errorMessage(rpcPayload, "Failed to place order.") });
    }

    return res.json(rpcPayload);
  } catch (err) {
    req.log.error({ err }, "Failed to place order");
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to place order.",
    });
  }
});

export default router;

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ApiInit = {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  expectStatus?: number;
};

type QaOrderRow = {
  id: string;
  user_id: string;
  cancellation_requested?: boolean | string | null;
  cancellation_status?: string | null;
};

type QaContactMessageRow = {
  id: string;
  customer_id: string;
  subject: string;
  status?: string | null;
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(dirname, "../..");

loadEnvFile(path.resolve(appRoot, "../api-server/.env"));
loadEnvFile(path.resolve(appRoot, ".env"));

const API_BASE = process.env.QA_API_BASE || "http://localhost:5001/api";
const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Qa-${suffix}-Aa1!`;
const qa = {
  productId: crypto.randomUUID(),
  variantId: crypto.randomUUID(),
  emptyVariantId: crypto.randomUUID(),
  productName: `QA Browser Tee ${suffix}`,
  slug: `qa-browser-tee-${suffix}`,
  customerEmail: `qa-browser-customer-${suffix}@example.com`,
  adminEmail: `qa-browser-admin-${suffix}@example.com`,
  customerPhone: `010${String(Date.now()).slice(-8)}`,
  adminPhone: `012${String(Date.now()).slice(-8)}`,
  customerName: "QA Browser Customer",
  cityArea: `QA City ${suffix}`,
  cancelReason: "QA browser cancellation request from Playwright",
  contactSubject: `QA browser contact ${suffix}`,
  image:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'%3E%3Crect width='600' height='750' fill='%23111111'/%3E%3Crect x='110' y='120' width='380' height='510' rx='18' fill='%2339FF14'/%3E%3Ctext x='300' y='390' text-anchor='middle' font-family='Arial' font-size='54' font-weight='700' fill='%23000000'%3ES! QA%3C/text%3E%3C/svg%3E",
};

const state: {
  authUserIds: string[];
  customerId: string;
  adminId: string;
  customerToken: string;
  adminToken: string;
  shippingZoneId: string;
  orderIds: string[];
  contactMessageIds: string[];
} = {
  authUserIds: [],
  customerId: "",
  adminId: "",
  customerToken: "",
  adminToken: "",
  shippingZoneId: "",
  orderIds: [],
  contactMessageIds: [],
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  assertEnv();
  await api("/healthz");
  state.customerId = await createAuthUser(qa.customerEmail, qa.customerPhone, "customer", qa.customerName);
  state.adminId = await createAuthUser(qa.adminEmail, qa.adminPhone, "admin", "QA Browser Admin");
  state.customerToken = await signIn(qa.customerEmail);
  state.adminToken = await signIn(qa.adminEmail);

  await api("/admin/products/sync", {
    method: "POST",
    token: state.adminToken,
    body: {
      product: {
        id: qa.productId,
        name: qa.productName,
        slug: qa.slug,
        category: "T-Shirts",
        price_egp: 250,
        description: "Automated browser QA product.",
        images: [qa.image],
        status: "active",
        is_new: true,
        is_best_seller: false,
      },
      variants: [
        {
          id: qa.variantId,
          product_id: qa.productId,
          size: "M",
          color: "White",
          stock: 8,
          sku: `qa-browser-white-${suffix}`,
          active: true,
          created_at: new Date().toISOString(),
        },
        {
          id: qa.emptyVariantId,
          product_id: qa.productId,
          size: "L",
          color: "Black",
          stock: 0,
          sku: `qa-browser-black-${suffix}`,
          active: true,
          created_at: new Date().toISOString(),
        },
      ],
      removedVariantIds: [],
    },
  });

  const zone = await api("/admin/shipping-zones", {
    method: "POST",
    token: state.adminToken,
    body: {
      governorate: "Cairo",
      city_area: qa.cityArea,
      delivery_fee_egp: 42,
      free_shipping_min_egp: null,
      active: true,
    },
  });
  state.shippingZoneId = String(zone.zone?.id || "");
  if (!state.shippingZoneId) throw new Error("QA shipping zone was not created.");
});

test.afterAll(async () => {
  await cleanup();
});

test("customer checkout cancellation survives refresh and appears in admin orders", async ({ page }) => {
  const diagnostics = attachPageDiagnostics(page);
  await page.goto("/");
  await expect(page.getByText("WEAR IT", { exact: false })).toBeVisible();
  await settleNetwork(page);

  await page.goto("/custom-design");
  await expect(page.getByRole("heading", { name: /DESIGN IT/i })).toBeVisible();
  await settleNetwork(page);
  await page.goto("/shipping-returns");
  await expect(page.getByRole("heading", { name: /SHIPPING & RETURNS/i })).toBeVisible();
  await settleNetwork(page);

  await customerLogin(page);

  await page.goto("/shop");
  await expect(page.getByRole("heading", { name: /SHOP ALL/i })).toBeVisible();
  await expect(page.getByTestId(`card-product-${qa.productId}`)).toBeVisible();
  await settleNetwork(page);
  await page.getByTestId(`card-product-${qa.productId}`).click();
  await expect(page.getByRole("heading", { name: qa.productName })).toBeVisible();
  await expect(page.getByText("In stock")).toBeVisible();
  await settleNetwork(page);
  await page.getByRole("button", { name: "ADD TO CART" }).click();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "CART" })).toBeVisible();
  await expect(page.getByText(qa.productName)).toBeVisible();
  await page.getByRole("link", { name: /PROCEED TO CHECKOUT/i }).click();

  await expect(page.getByRole("heading", { name: "CHECKOUT" })).toBeVisible();
  await page.locator('input[name="name"]').fill(qa.customerName);
  await page.locator('input[name="phone"]').fill(qa.customerPhone);
  await page.locator('select[name="governorate"]').selectOption("Cairo");
  await page.locator('input[name="city"]').fill(qa.cityArea);
  await page.locator('textarea[name="address"]').fill("QA browser address, building 1, floor 2, apartment 3");
  await expect(page.getByText(`Delivery: 42 EGP for ${qa.cityArea}, Cairo`)).toBeVisible();
  await page.getByRole("button", { name: "COMPLETE ORDER" }).click();
  await expect(page).toHaveURL(/\/order-success$/);
  await expect(page.getByRole("heading", { name: "ORDER PLACED!" })).toBeVisible();
  await settleNetwork(page);

  const order = await waitForLatestCustomerOrder();
  state.orderIds.push(order.id);

  await page.getByTestId("btn-view-orders").click();
  await expect(page.getByRole("heading", { name: "MY ORDERS" })).toBeVisible();
  await expect(page.getByRole("cell", { name: order.id })).toBeVisible();
  await settleNetwork(page);

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByRole("heading", { name: `ORDER ${order.id}` })).toBeVisible();
  await settleNetwork(page);
  await page.getByPlaceholder("Why do you want to cancel this order?").fill(qa.cancelReason);
  await page.getByRole("button", { name: "Request Cancellation" }).click();
  await expect(page.getByText("Cancellation request pending admin review.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: `ORDER ${order.id}` })).toBeVisible();
  await expect(page.getByText("Cancellation request pending admin review.")).toBeVisible();
  await settleNetwork(page);

  const persisted = await getOrder(order.id);
  expect(persisted?.cancellation_requested === true || persisted?.cancellation_requested === "true").toBeTruthy();
  expect(String(persisted?.cancellation_status).toLowerCase()).toBe("pending");

  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: /HIT US UP/i })).toBeVisible();
  await page.locator('input[name="subject"]').fill(qa.contactSubject);
  await page.locator('input[name="orderId"]').fill(order.id);
  await page.locator('textarea[name="message"]').fill("Browser QA message with enough detail for the support workflow.");
  await page.getByRole("button", { name: /Send Message/i }).click();
  await expect(page.getByText("Message sent. We'll reply soon.")).toBeVisible();
  await settleNetwork(page);

  const contactMessage = await waitForLatestContactMessage();
  state.contactMessageIds.push(contactMessage.id);
  await api(`/admin/messages/${encodeURIComponent(contactMessage.id)}/reply`, {
    method: "POST",
    token: state.adminToken,
    body: { message: "Browser QA first admin support reply.", replied_by: "QA Browser Admin" },
  });
  let customerThread = await api(`/messages/${encodeURIComponent(contactMessage.id)}`, { token: state.customerToken });
  expect(customerThread.message?.status).toBe("admin_replied");
  expect(
    customerThread.message?.replies?.some((reply: Record<string, unknown>) =>
      reply.senderRole === "admin" && reply.message === "Browser QA first admin support reply."
    ),
  ).toBeTruthy();

  await api(`/messages/${encodeURIComponent(contactMessage.id)}/reply`, {
    method: "POST",
    token: state.customerToken,
    body: { message: "Browser QA customer follow-up reply after admin answered." },
  });
  customerThread = await api(`/messages/${encodeURIComponent(contactMessage.id)}`, { token: state.customerToken });
  expect(
    customerThread.message?.replies?.some((reply: Record<string, unknown>) =>
      reply.senderRole === "customer" && String(reply.message).includes("customer follow-up")
    ),
  ).toBeTruthy();

  const adminMessages = await api("/admin/messages", { token: state.adminToken });
  expect(
    adminMessages.messages?.some((message: Record<string, unknown>) =>
      message.id === contactMessage.id && message.status === "customer_replied"
    ),
    "Admin messages did not show the customer replied thread as pending admin.",
  ).toBeTruthy();

  await api(`/admin/messages/${encodeURIComponent(contactMessage.id)}/reply`, {
    method: "POST",
    token: state.adminToken,
    body: { message: "Browser QA second admin support reply.", replied_by: "QA Browser Admin" },
  });
  customerThread = await api(`/messages/${encodeURIComponent(contactMessage.id)}`, { token: state.customerToken });
  expect(
    customerThread.message?.replies?.some((reply: Record<string, unknown>) =>
      reply.senderRole === "admin" && reply.message === "Browser QA second admin support reply."
    ),
  ).toBeTruthy();

  await api(`/admin/messages/${encodeURIComponent(contactMessage.id)}/close`, {
    method: "POST",
    token: state.adminToken,
  });
  customerThread = await api(`/messages/${encodeURIComponent(contactMessage.id)}`, { token: state.customerToken });
  expect(customerThread.message?.status).toBe("closed");
  await api(`/messages/${encodeURIComponent(contactMessage.id)}/reply`, {
    method: "POST",
    token: state.customerToken,
    body: { message: "Browser QA reply that should be blocked after close." },
    expectStatus: 409,
  });

  await adminLogin(page);
  await expect(page.getByRole("heading", { name: "DASHBOARD" })).toBeVisible();

  const adminOrdersResponsePromise = waitForAdminOrdersResponse(page);
  await page.goto("/admin/orders");
  const adminOrdersPayload = await adminOrdersResponsePromise;
  expect(
    adminOrdersPayload.orders?.some((adminOrder: QaOrderRow) => adminOrder.id === order.id),
    "Admin orders API did not return the pending cancellation order.",
  ).toBeTruthy();
  await expect(page.getByRole("heading", { name: "ORDERS" })).toBeVisible();
  await page.getByPlaceholder("Search customer name or phone...").fill(qa.customerName);
  await page.getByRole("button", { name: "Cancellation Requested" }).click();
  await expect(page.getByText(order.id).first()).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "Cancellation requested" }).first()).toBeVisible();
  await page.getByText(order.id).first().click();
  await expect(page.getByText(qa.cancelReason)).toBeVisible();

  for (const [url, heading] of [
    ["/admin/products", "PRODUCTS"],
    ["/admin/inventory", "INVENTORY"],
    ["/admin/categories", "CATEGORIES"],
    ["/admin/users", "USERS"],
    ["/admin/shipping", "SHIPPING"],
    ["/admin/discount-codes", "DISCOUNT CODES"],
    ["/admin/messages", "MESSAGES"],
    ["/admin/returns", "RETURNS"],
    ["/admin/settings", "SETTINGS"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await settleNetwork(page);
  }

  diagnostics.assertClean();
});

async function customerLogin(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your email").fill(qa.customerEmail);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByTestId("button-login").click();
  await expect(page).toHaveURL(/\/$/);
  await settleNetwork(page);
}

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("input").nth(0).fill(qa.adminEmail);
  await page.locator("input").nth(1).fill(password);
  const loginResponsePromise = page.waitForResponse(response =>
    response.url().includes("/api/admin/login") &&
    response.request().method() === "POST"
  );
  const dashboardOrdersResponsePromise = waitForAdminOrdersResponse(page);
  await page.getByRole("button", { name: "ACCESS DASHBOARD" }).click();
  const loginResponse = await loginResponsePromise;
  const loginPayload = await loginResponse.json().catch(() => ({}));
  expect(
    loginResponse.ok(),
    `Admin login API rejected QA admin: ${loginResponse.status()} ${loginPayload.error || loginPayload.message || ""}`,
  ).toBeTruthy();
  await expect(page).toHaveURL(/\/admin$/);
  await dashboardOrdersResponsePromise;
  await settleNetwork(page);
}

async function waitForAdminOrdersResponse(page: Page) {
  const response = await page.waitForResponse(response =>
    response.url().includes("/api/admin/orders") &&
    response.request().method() === "GET" &&
    response.status() !== -1
  );
  const payload = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `Admin orders API failed: ${response.status()} ${payload.error || payload.message || ""}`,
  ).toBeTruthy();
  return payload as { orders?: QaOrderRow[] };
}

async function settleNetwork(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

function attachPageDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const requestIssues: string[] = [];

  page.on("pageerror", error => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    const location = message.location().url;
    if (text.includes("Failed to load resource") && !location.includes("/api/")) return;
    if (
      text.includes("API is not reachable. Start the API server and try again.") ||
      text.includes("Settings API is not reachable. Start the API server and try again.") ||
      text.includes("TypeError: Failed to fetch")
    ) {
      return;
    }
    consoleErrors.push(`${location}: ${text}`);
  });
  page.on("requestfailed", request => {
    if (!["document", "script", "stylesheet", "xhr", "fetch"].includes(request.resourceType())) return;
    if (request.resourceType() === "websocket") return;
    const failure = request.failure()?.errorText || "failed";
    if (failure.includes("net::ERR_ABORTED")) return;
    requestIssues.push(`${request.method()} ${request.url()} ${failure}`);
  });
  page.on("response", response => {
    const url = response.url();
    const status = response.status();
    if (url.includes("/api/") && status >= 400) {
      requestIssues.push(`${status} ${url}`);
    }
    if (status >= 500 && url.startsWith(page.url().split("/", 3).join("/"))) {
      requestIssues.push(`${status} ${url}`);
    }
  });

  return {
    assertClean() {
      expect(consoleErrors, "Browser console/page errors").toEqual([]);
      expect(requestIssues, "Failed browser network requests").toEqual([]);
    },
  };
}

async function waitForLatestCustomerOrder(): Promise<QaOrderRow> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    const rows = await supabase(
      `/rest/v1/orders?user_id=eq.${encodeURIComponent(state.customerId)}&select=*&order=created_at.desc&limit=1`,
    );
    if (Array.isArray(rows) && rows[0]?.id) return rows[0] as QaOrderRow;
    await delay(500);
  }
  throw new Error("Browser checkout did not create an order in Supabase.");
}

async function waitForLatestContactMessage(): Promise<QaContactMessageRow> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    const rows = await supabase(
      `/rest/v1/contact_messages?customer_id=eq.${encodeURIComponent(state.customerId)}&subject=eq.${encodeURIComponent(qa.contactSubject)}&select=id,customer_id,subject,status&order=created_at.desc&limit=1`,
    );
    if (Array.isArray(rows) && rows[0]?.id) return rows[0] as QaContactMessageRow;
    await delay(500);
  }
  throw new Error("Browser contact form did not create a message in Supabase.");
}

async function getOrder(orderId: string): Promise<QaOrderRow | null> {
  const rows = await supabase(
    `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,user_id,cancellation_requested,cancellation_status&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] as QaOrderRow | undefined ?? null : null;
}

async function createAuthUser(email: string, phone: string, role: "admin" | "customer", fullName: string) {
  const payload = await supabase("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    },
  });
  const user = payload.user || payload;
  if (!user?.id) throw new Error(`Auth user was not created for ${email}.`);
  state.authUserIds.push(user.id);

  await supabase("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      id: user.id,
      full_name: fullName,
      phone,
      email,
      role,
      blocked: false,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  });
  return user.id as string;
}

async function signIn(email: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = await readPayload(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(`Sign-in failed for ${email}: ${payloadMessage(payload)}`);
  }
  return payload.access_token as string;
}

async function api(pathname: string, init: ApiInit = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: init.method || "GET",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.headers || {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = await readPayload(response);
  if (init.expectStatus !== undefined) {
    if (response.status !== init.expectStatus) {
      throw new Error(`${init.method || "GET"} ${pathname} expected ${init.expectStatus}, got ${response.status}: ${payloadMessage(payload)}`);
    }
  } else if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${pathname} failed ${response.status}: ${payloadMessage(payload)}`);
  }
  return payload;
}

async function supabase(pathname: string, init: ApiInit & { anon?: boolean } = {}) {
  const key = init.anon ? ANON_KEY : SERVICE_ROLE_KEY;
  const token = init.token || key;
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    method: init.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = await readPayload(response);
  if (init.expectStatus !== undefined) {
    if (response.status !== init.expectStatus) {
      throw new Error(`${init.method || "GET"} ${pathname} expected ${init.expectStatus}, got ${response.status}: ${payloadMessage(payload)}`);
    }
  } else if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${pathname} failed ${response.status}: ${payloadMessage(payload)}`);
  }
  return payload;
}

async function cleanup() {
  const safe = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      console.warn(`[e2e cleanup] ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const orderRows = state.customerId
    ? await safeRows(`/rest/v1/orders?user_id=eq.${encodeURIComponent(state.customerId)}&select=id`)
    : [];
  const orderIds = [...new Set([...state.orderIds, ...orderRows.map(row => String(row.id)).filter(Boolean)])];
  const encodedOrders = orderIds.map(encodeURIComponent).join(",");
  const encodedUsers = state.authUserIds.map(encodeURIComponent).join(",");

  if (encodedOrders) {
    await safe("notifications", () => supabase(`/rest/v1/notifications?order_id=in.(${encodedOrders})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
    await safe("return_requests", () => supabase(`/rest/v1/return_requests?order_id=in.(${encodedOrders})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
    await safe("order_items", () => supabase(`/rest/v1/order_items?order_id=in.(${encodedOrders})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
    await safe("orders", () => supabase(`/rest/v1/orders?id=in.(${encodedOrders})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
  }

  if (state.customerId) {
    await safe("contact_messages", () => supabase(`/rest/v1/contact_messages?customer_id=eq.${encodeURIComponent(state.customerId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
    await safe("message notifications", () => supabase(`/rest/v1/notifications?customer_id=eq.${encodeURIComponent(state.customerId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
  }

  if (state.shippingZoneId) {
    await safe("shipping zone", () => supabase(`/rest/v1/shipping_zones?id=eq.${encodeURIComponent(state.shippingZoneId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
  }
  await safe("variants", () => supabase(`/rest/v1/product_variants?product_id=eq.${encodeURIComponent(qa.productId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }));
  await safe("product", () => supabase(`/rest/v1/products?id=eq.${encodeURIComponent(qa.productId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }));
  if (encodedUsers) {
    await safe("profiles", () => supabase(`/rest/v1/profiles?id=in.(${encodedUsers})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
  }
  for (const id of state.authUserIds) {
    await safe(`auth user ${id.slice(0, 8)}`, () => supabase(`/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }));
  }
}

async function safeRows(pathname: string): Promise<Record<string, unknown>[]> {
  try {
    const rows = await supabase(pathname);
    return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  } catch {
    return [];
  }
}

async function readPayload(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) as Record<string, any> : {};
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload: Record<string, any>): string {
  return payload?.message || payload?.error || JSON.stringify(payload);
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function normalizeSupabaseUrl(value: string) {
  return value.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

function assertEnv() {
  const missing = [
    ["SUPABASE_URL/VITE_SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
    ["SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY", ANON_KEY],
  ].filter(([, value]) => !value);
  if (missing.length) {
    throw new Error(`Missing QA env: ${missing.map(([key]) => key).join(", ")}`);
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const fs = require("node:fs");
const path = require("node:path");

const CONFIRM_TOKEN = "DELETE_LEGACY_QA_ORDER_SWMQAC5KRX6E7160";
const TARGET_ORDER_ID = "SWMQAC5KRX6E7160";
const TARGET_ORDER_ITEM_ID = "55bdaf49-96a8-4a9a-b01a-397f9ea1bb0a";
const EXPECTED_ITEM = {
  product_id: "2",
  product_name: "Washed Vintage Tee",
  size: "S",
  color: "Black",
  quantity: 1,
  price_egp: 279,
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function parseArgs(argv) {
  const args = { confirm: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--confirm") {
      args.confirm = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log([
    "Usage:",
    "  pnpm --filter @workspace/api-server run cleanup-legacy-qa-order",
    "  pnpm --filter @workspace/api-server run cleanup-legacy-qa-order -- --confirm DELETE_LEGACY_QA_ORDER_SWMQAC5KRX6E7160",
    "",
    "Default mode is DRY RUN. Real deletion requires the exact --confirm token.",
  ].join("\n"));
}

function normalizeSupabaseUrl(value) {
  return String(value || "").replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload, fallback) {
  if (payload && typeof payload === "object") {
    return [payload.message, payload.details, payload.hint, payload.code]
      .filter(part => typeof part === "string" && part.length > 0)
      .join(" ") || fallback;
  }
  return fallback;
}

async function supabaseRequest(config, pathName, init = {}) {
  const response = await fetch(`${config.url}${pathName}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${pathName} failed ${response.status}: ${payloadMessage(payload, response.statusText || "Supabase request failed.")}`);
  }
  return payload;
}

function safeOrder(order) {
  return {
    id: order.id,
    user_id: order.user_id,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    status: order.status,
    total_egp: order.total_egp,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

function safeItem(item) {
  return {
    id: item.id,
    order_id: item.order_id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    product_name: item.product_name,
    size: item.size,
    color: item.color,
    quantity: item.quantity,
    price_egp: item.price_egp,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadSnapshot(config) {
  const encodedOrderId = encodeURIComponent(TARGET_ORDER_ID);
  const encodedItemId = encodeURIComponent(TARGET_ORDER_ITEM_ID);
  const [orders, orderItems, targetItems, notifications, returnRequests, contactMessages] = await Promise.all([
    supabaseRequest(config, `/rest/v1/orders?id=eq.${encodedOrderId}&select=id,user_id,customer_name,customer_email,status,total_egp,created_at,updated_at`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    supabaseRequest(config, `/rest/v1/order_items?order_id=eq.${encodedOrderId}&select=id,order_id,product_id,variant_id,product_name,size,color,quantity,price_egp`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    supabaseRequest(config, `/rest/v1/order_items?id=eq.${encodedItemId}&select=id,order_id,product_id,variant_id,product_name,size,color,quantity,price_egp`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    supabaseRequest(config, `/rest/v1/notifications?order_id=eq.${encodedOrderId}&select=id,customer_id,order_id,contact_message_id,message,read,created_at`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    supabaseRequest(config, `/rest/v1/return_requests?order_id=eq.${encodedOrderId}&select=id,order_id,status`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
    supabaseRequest(config, `/rest/v1/contact_messages?order_id=eq.${encodedOrderId}&select=id,order_id,subject,status`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }),
  ]);

  return {
    orders: Array.isArray(orders) ? orders : [],
    orderItems: Array.isArray(orderItems) ? orderItems : [],
    targetItems: Array.isArray(targetItems) ? targetItems : [],
    notifications: Array.isArray(notifications) ? notifications : [],
    returnRequests: Array.isArray(returnRequests) ? returnRequests : [],
    contactMessages: Array.isArray(contactMessages) ? contactMessages : [],
  };
}

function validateSnapshot(snapshot) {
  assert(snapshot.orders.length === 1, `Expected exactly one target order ${TARGET_ORDER_ID}, found ${snapshot.orders.length}.`);
  assert(snapshot.targetItems.length === 1, `Expected exactly one target order_item ${TARGET_ORDER_ITEM_ID}, found ${snapshot.targetItems.length}.`);
  assert(snapshot.orderItems.length === 1, `Expected target order to have exactly one order_item, found ${snapshot.orderItems.length}. Refusing to touch a multi-item order.`);

  const item = snapshot.targetItems[0];
  assert(item.order_id === TARGET_ORDER_ID, `Target item belongs to unexpected order ${item.order_id}.`);
  assert(snapshot.orderItems[0].id === TARGET_ORDER_ITEM_ID, "The order has an unexpected order_item. Refusing cleanup.");
  assert(item.variant_id === null, "Target item has a variant_id now. Refusing cleanup because it is no longer the legacy orphan row.");

  for (const [key, expected] of Object.entries(EXPECTED_ITEM)) {
    assert(item[key] === expected, `Target item ${key} is ${JSON.stringify(item[key])}, expected ${JSON.stringify(expected)}. Refusing cleanup.`);
  }

  assert(snapshot.returnRequests.length === 0, `Found ${snapshot.returnRequests.length} return_request row(s). Refusing cleanup outside the requested order_items/notifications/order scope.`);
  assert(snapshot.contactMessages.length === 0, `Found ${snapshot.contactMessages.length} contact_message row(s). Refusing cleanup outside the requested order_items/notifications/order scope.`);
}

async function deleteRows(config, pathName) {
  const rows = await supabaseRequest(config, pathName, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  return Array.isArray(rows) ? rows.length : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.confirm && args.confirm !== CONFIRM_TOKEN) {
    throw new Error(`Invalid --confirm token. Expected ${CONFIRM_TOKEN}.`);
  }

  loadEnvFile(path.resolve(__dirname, "../.env"));
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in artifacts/api-server/.env.");
  }

  const mode = args.confirm === CONFIRM_TOKEN ? "DELETE" : "DRY RUN";
  const config = { url, serviceRoleKey };
  const snapshot = await loadSnapshot(config);
  validateSnapshot(snapshot);

  const order = snapshot.orders[0];
  const item = snapshot.targetItems[0];
  console.log(`[cleanup-legacy-qa-order] Mode: ${mode}`);
  console.log(`[cleanup-legacy-qa-order] Target order: ${JSON.stringify(safeOrder(order), null, 2)}`);
  console.log(`[cleanup-legacy-qa-order] Target order_item: ${JSON.stringify(safeItem(item), null, 2)}`);
  console.log(`[cleanup-legacy-qa-order] Notifications linked to this order: ${snapshot.notifications.length}`);
  console.log("[cleanup-legacy-qa-order] Scope is limited to this exact order, its exact order_item, and notifications with the same order_id.");
  console.log("[cleanup-legacy-qa-order] Products, product_variants, users, profiles, categories, settings, shipping, discounts, contact messages, and returns are not deleted.");

  let deletedNotifications = 0;
  let deletedOrderItems = 0;
  let deletedOrders = 0;

  if (mode === "DRY RUN") {
    console.log(`[cleanup-legacy-qa-order] DRY RUN only. Real deletion requires --confirm ${CONFIRM_TOKEN}`);
  } else {
    const encodedOrderId = encodeURIComponent(TARGET_ORDER_ID);
    const encodedItemId = encodeURIComponent(TARGET_ORDER_ITEM_ID);
    deletedNotifications = await deleteRows(config, `/rest/v1/notifications?order_id=eq.${encodedOrderId}`);
    deletedOrderItems = await deleteRows(config, `/rest/v1/order_items?id=eq.${encodedItemId}&order_id=eq.${encodedOrderId}`);
    deletedOrders = await deleteRows(config, `/rest/v1/orders?id=eq.${encodedOrderId}`);

    const verification = await loadSnapshot(config);
    assert(verification.orders.length === 0, "Verification failed: target order still exists.");
    assert(verification.orderItems.length === 0, "Verification failed: target order_items still exist.");
    assert(verification.notifications.length === 0, "Verification failed: target notifications still exist.");
  }

  console.log("[cleanup-legacy-qa-order] Final summary:");
  console.log(JSON.stringify({
    mode,
    target_order_id: TARGET_ORDER_ID,
    target_order_item_id: TARGET_ORDER_ITEM_ID,
    deleted_notifications_count: deletedNotifications,
    deleted_order_items_count: deletedOrderItems,
    deleted_orders_count: deletedOrders,
    would_delete_when_confirmed: mode === "DRY RUN"
      ? {
        orders: [safeOrder(order)],
        order_items: [safeItem(item)],
        notifications: snapshot.notifications.map(row => ({
          id: row.id,
          customer_id: row.customer_id,
          order_id: row.order_id,
          contact_message_id: row.contact_message_id,
          read: row.read,
          created_at: row.created_at,
        })),
      }
      : null,
  }, null, 2));
}

main().catch(err => {
  console.error(`[cleanup-legacy-qa-order] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

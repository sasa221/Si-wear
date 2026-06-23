const API_BASE = process.env.QA_API_BASE || "http://localhost:5001/api";
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "")
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/i, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const STRICT_SCHEMA = process.env.QA_STRICT_SCHEMA === "1";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `Qa-${suffix}-Aa1!`;
const qa = {
  productId: crypto.randomUUID(),
  variantWhiteId: crypto.randomUUID(),
  variantBlackId: crypto.randomUUID(),
  deleteProductId: crypto.randomUUID(),
  deleteVariantId: crypto.randomUUID(),
  customerEmail: `qa-customer-${suffix}@example.com`,
  blockedEmail: `qa-blocked-${suffix}@example.com`,
  adminEmail: `qa-admin-${suffix}@example.com`,
  promotedEmail: `qa-promote-${suffix}@example.com`,
  customerPhone: `010${String(Date.now()).slice(-8)}`,
  blockedPhone: `011${String(Date.now()).slice(-8)}`,
  adminPhone: `012${String(Date.now()).slice(-8)}`,
  promotedPhone: `015${String(Date.now()).slice(-8)}`,
  orderA: `QA-ORDER-A-${suffix}`,
  orderB: `QA-ORDER-B-${suffix}`,
  contactId: crypto.randomUUID(),
  returnId: crypto.randomUUID(),
  discountFixed: `QAFIX${suffix.replace(/[^a-z0-9]/gi, "").slice(-8)}`.toUpperCase(),
  discountPercent: `QAPCT${suffix.replace(/[^a-z0-9]/gi, "").slice(-8)}`.toUpperCase(),
  discountExpired: `QAEXP${suffix.replace(/[^a-z0-9]/gi, "").slice(-8)}`.toUpperCase(),
  zoneGov: `QA Governorate ${suffix}`,
  hoodieSlug: `hoodies-${suffix.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
};

const state = {
  authUserIds: [],
  customerId: "",
  blockedId: "",
  adminId: "",
  promotedId: "",
  customerToken: "",
  blockedToken: "",
  adminToken: "",
  originalSettings: null,
  discountFixedId: "",
  discountPercentId: "",
  discountExpiredId: "",
  shippingZoneId: "",
  contactMessageId: "",
  categoryIds: [],
  warnings: [],
  passed: [],
};

function log(message) {
  console.log(`[qa] ${message}`);
}

function pass(message) {
  state.passed.push(message);
  console.log(`PASS ${message}`);
}

function warn(message) {
  state.warnings.push(message);
  console.warn(`WARN ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readPayload(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload) {
  return payload?.message || payload?.error || JSON.stringify(payload);
}

async function api(path, init = {}) {
  const headers = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    ...(init.headers || {}),
  };
  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = await readPayload(response);
  if (init.expectStatus !== undefined) {
    assert(
      response.status === init.expectStatus,
      `${init.method || "GET"} ${path} expected ${init.expectStatus}, got ${response.status}: ${payloadMessage(payload)}`,
    );
  } else if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed ${response.status}: ${payloadMessage(payload)}`);
  }
  return { status: response.status, payload };
}

async function supabase(path, init = {}) {
  const key = init.anon ? ANON_KEY : SERVICE_ROLE_KEY;
  const token = init.token || key;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = await readPayload(response);
  if (init.expectStatus !== undefined) {
    assert(
      response.status === init.expectStatus,
      `${init.method || "GET"} ${path} expected ${init.expectStatus}, got ${response.status}: ${payloadMessage(payload)}`,
    );
  } else if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed ${response.status}: ${payloadMessage(payload)}`);
  }
  return payload;
}

async function optionalSupabase(label, fn) {
  try {
    return await fn();
  } catch (err) {
    warn(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function createAuthUser(email, phone, role) {
  const payload = await supabase("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `QA ${role}`, phone },
    },
  });
  const user = payload.user || payload;
  assert(user?.id, `Auth user was not created for ${role}`);
  state.authUserIds.push(user.id);
  await supabase("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      id: user.id,
      full_name: `QA ${role}`,
      phone,
      email,
      role,
      blocked: false,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  });
  return user.id;
}

async function signIn(email) {
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
  assert(response.ok && payload.access_token, `Sign-in failed for ${email}: ${payloadMessage(payload)}`);
  return payload.access_token;
}

async function cleanup() {
  log("cleanup started");
  const encodedOrders = [qa.orderA, qa.orderB].map(encodeURIComponent).join(",");
  const encodedUsers = state.authUserIds.map(encodeURIComponent).join(",");
  const safe = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      warn(`${label} cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (state.originalSettings) {
    await safe("settings restore", () => api("/admin/settings", {
      method: "PUT",
      token: state.adminToken,
      body: state.originalSettings,
    }));
  }

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

  if (state.contactMessageId) {
    await safe("contact_message_replies", () => supabase(`/rest/v1/contact_message_replies?contact_message_id=eq.${encodeURIComponent(state.contactMessageId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
  }
  await safe("contact_messages", () => supabase(`/rest/v1/contact_messages?id=eq.${encodeURIComponent(state.contactMessageId || qa.contactId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }));
  await safe("discount fixed", () => supabase(`/rest/v1/discount_codes?code=eq.${encodeURIComponent(qa.discountFixed)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }));
  await safe("discount percent", () => supabase(`/rest/v1/discount_codes?code=eq.${encodeURIComponent(qa.discountPercent)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }));
  await safe("discount expired", () => supabase(`/rest/v1/discount_codes?code=eq.${encodeURIComponent(qa.discountExpired)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }));
  if (state.shippingZoneId) {
    await safe("shipping zone", () => supabase(`/rest/v1/shipping_zones?id=eq.${encodeURIComponent(state.shippingZoneId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }));
  }
  for (const categoryId of state.categoryIds) {
    await safe(`category ${categoryId}`, () => supabase(`/rest/v1/categories?id=eq.${encodeURIComponent(categoryId)}`, {
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
  await safe("delete variants", () => supabase(`/rest/v1/product_variants?product_id=eq.${encodeURIComponent(qa.deleteProductId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }));
  await safe("delete product", () => supabase(`/rest/v1/products?id=eq.${encodeURIComponent(qa.deleteProductId)}`, {
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
  log("cleanup finished");
}

async function auditSchema() {
  const required = {
    profiles: ["id", "full_name", "phone", "email", "role", "blocked", "is_active", "last_login_at", "created_at"],
    products: ["id", "name", "slug", "category", "price_egp", "description", "images", "status", "is_new", "is_best_seller"],
    product_variants: ["id", "product_id", "size", "color", "stock", "sku", "active"],
    categories: ["id", "slug", "name", "cover_image_url", "active", "sort_order"],
    orders: [
      "id", "user_id", "status", "admin_notes", "cancellation_requested", "cancellation_status",
      "cancellation_reason", "cancellation_requested_at", "cancellation_resolved_at",
      "cancellation_reviewed_at", "cancellation_reviewed_by", "cancellation_admin_note",
    ],
    order_items: ["id", "order_id", "product_id", "variant_id", "product_name", "size", "color", "quantity", "price_egp"],
    notifications: ["id", "customer_id", "order_id", "contact_message_id", "message", "read", "created_at"],
    shipping_zones: ["id", "governorate", "city_area", "delivery_fee_egp", "free_shipping_min_egp", "active"],
    discount_codes: ["id", "code", "discount_type", "discount_value", "minimum_order_egp", "usage_limit", "used_count", "active", "expires_at"],
    contact_messages: ["id", "customer_id", "subject", "message", "status", "admin_reply", "replied_by", "replied_at", "closed_at", "closed_by", "last_reply_at", "last_reply_by"],
    contact_message_replies: ["id", "contact_message_id", "sender_id", "sender_role", "message", "created_at"],
    return_requests: ["id", "order_id", "order_number", "user_id", "reason", "message", "preferred_action", "status", "admin_note"],
    store_settings: ["id", "brand_name", "whatsapp_number", "announcement_bar_text", "instagram_url", "tiktok_url", "facebook_url", "store_location", "shipping_note", "returns_policy_text", "support_info"],
  };

  for (const [table, columns] of Object.entries(required)) {
    const result = await optionalSupabase(`schema ${table}`, () => supabase(
      `/rest/v1/${table}?select=${encodeURIComponent(columns.join(","))}&limit=0`,
      { headers: { Accept: "application/json" } },
    ));
    if (result === null) {
      const message = `Missing table/columns in ${table}. Run the matching non-destructive migration.`;
      if (STRICT_SCHEMA) throw new Error(message);
      warn(message);
    }
  }

  const duplicateCategories = await supabase("/rest/v1/categories?select=name,slug");
  const canonical = new Map();
  for (const row of Array.isArray(duplicateCategories) ? duplicateCategories : []) {
    const key = String(row.name || row.slug || "").trim().toLowerCase();
    if (!key) continue;
    canonical.set(key, (canonical.get(key) || 0) + 1);
  }
  for (const [key, count] of canonical) {
    if (["t-shirts", "shirts", "pants"].includes(key) && count > 1) {
      warn(`Duplicate canonical category detected: ${key} (${count})`);
    }
  }

  const brokenOrderItems = await supabase("/rest/v1/order_items?variant_id=is.null&select=id,order_id,product_id,product_name,size,color,quantity&limit=10");
  if (Array.isArray(brokenOrderItems) && brokenOrderItems.length > 0) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const legacyRows = brokenOrderItems.filter(row => !uuidPattern.test(String(row.product_id || "")));
    const fixableRows = brokenOrderItems.filter(row => uuidPattern.test(String(row.product_id || "")));
    if (legacyRows.length > 0) {
      const preview = legacyRows
        .map(row => `${row.id}/${row.order_id}/${row.product_name || "unknown product"} (${row.product_id}, ${row.size}/${row.color})`)
        .join("; ");
      warn(
        `Non-blocking legacy data: ${legacyRows.length} order_items row(s) have no variant_id because they use pre-UUID product_id values and cannot be safely mapped to current product_variants. ` +
        `Order pages keep displaying product name, size, color, quantity, and price. Rows: ${preview}`,
      );
    }
    if (fixableRows.length > 0) {
      const message = `Found ${fixableRows.length} UUID-backed order_items without variant_id. Run artifacts/swear/supabase-order-items-variant-backfill-migration.sql and review any rows it returns.`;
      if (STRICT_SCHEMA) throw new Error(message);
      warn(message);
    }
  }

  const orphanItems = await supabase("/rest/v1/order_items?select=id,order_id,variant_id&limit=500");
  const productVariants = await supabase("/rest/v1/product_variants?select=id&limit=10000");
  const variantIds = new Set((Array.isArray(productVariants) ? productVariants : []).map(row => row.id));
  const missingVariant = (Array.isArray(orphanItems) ? orphanItems : []).find(row => row.variant_id && !variantIds.has(row.variant_id));
  assert(!missingVariant, `Found order_item with broken variant reference: ${missingVariant?.id}`);

  pass("database schema audit completed");
}

async function setup() {
  assert(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY, "Supabase env is missing.");
  await api("/healthz");
  pass("API healthz");

  state.customerId = await createAuthUser(qa.customerEmail, qa.customerPhone, "customer");
  state.blockedId = await createAuthUser(qa.blockedEmail, qa.blockedPhone, "customer");
  state.adminId = await createAuthUser(qa.adminEmail, qa.adminPhone, "admin");
  state.promotedId = await createAuthUser(qa.promotedEmail, qa.promotedPhone, "customer");
  await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(state.blockedId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: { blocked: true, is_active: false },
  });

  state.customerToken = await signIn(qa.customerEmail);
  state.blockedToken = await signIn(qa.blockedEmail);
  state.adminToken = await signIn(qa.adminEmail);
  pass("QA auth users created and signed in");
}

async function testAdminAuthAndUsers() {
  const login = await api("/admin/login", {
    method: "POST",
    body: { email: qa.adminEmail, password },
  });
  assert(login.payload.ok && login.payload.session?.access_token, "Admin login did not return a session.");

  await api("/admin/orders", { token: state.customerToken, expectStatus: 403 });

  const users = await api("/admin/users", { token: state.adminToken });
  assert(users.payload.users?.some(user => user.id === state.customerId), "Admin users did not include QA customer.");

  const details = await api(`/admin/users/${encodeURIComponent(state.customerId)}`, { token: state.adminToken });
  assert(details.payload.user?.id === state.customerId, "Admin user details did not load.");

  await api(`/admin/users/${encodeURIComponent(state.promotedId)}/role`, {
    method: "PATCH",
    token: state.adminToken,
    body: { role: "admin" },
  });
  await api(`/admin/users/${encodeURIComponent(state.promotedId)}/role`, {
    method: "PATCH",
    token: state.adminToken,
    body: { role: "customer" },
  });
  await api(`/admin/users/${encodeURIComponent(state.customerId)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { blocked: true, isActive: false },
  });
  await api(`/admin/users/${encodeURIComponent(state.customerId)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { blocked: false, isActive: true },
  });
  await api(`/admin/users/${encodeURIComponent(state.adminId)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { blocked: true, isActive: false },
    expectStatus: 400,
  });

  pass("admin auth and user lifecycle");
}

async function testCatalogShippingDiscountSettings() {
  const categories = await api("/categories");
  assert(categories.payload.categories?.some(cat => cat.name === "T-Shirts"), "Public categories missing T-Shirts.");
  const hoodieName = categories.payload.categories?.some(cat => cat.name === "Hoodies")
    ? `Hoodies QA ${suffix}`
    : "Hoodies";

  await api("/admin/categories", {
    method: "POST",
    token: state.adminToken,
    body: { name: "T-Shirts", active: true, sort_order: 1 },
    expectStatus: 409,
  });
  const hoodie = await api("/admin/categories", {
    method: "POST",
    token: state.adminToken,
    body: {
      name: hoodieName,
      slug: qa.hoodieSlug,
      active: true,
      sort_order: 50,
      cover_image_url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop",
    },
  });
  assert(hoodie.payload.category?.id, "Hoodies category was not created.");
  state.categoryIds.push(hoodie.payload.category.id);

  await api("/admin/categories", {
    method: "POST",
    token: state.adminToken,
    body: { name: `Duplicate ${hoodieName}`, slug: qa.hoodieSlug, active: true },
    expectStatus: 409,
  });
  let publicCategories = await api("/categories");
  assert(publicCategories.payload.categories?.some(cat => cat.id === hoodie.payload.category.id && cat.name === hoodieName), "Public categories did not include active Hoodies category.");

  const updatedCoverImage = "https://images.unsplash.com/photo-1578681994506-b8f463449011?w=600&h=750&fit=crop";
  const imageUpdate = await api(`/admin/categories/${encodeURIComponent(hoodie.payload.category.id)}/image`, {
    method: "POST",
    token: state.adminToken,
    body: { cover_image_url: updatedCoverImage },
  });
  assert(
    String(imageUpdate.payload.category?.cover_image_url || "").startsWith(updatedCoverImage) &&
      String(imageUpdate.payload.category?.cover_image_url || "").includes("v="),
    "Category image update did not return a cache-busted image URL.",
  );

  await api(`/admin/categories/${encodeURIComponent(hoodie.payload.category.id)}/deactivate`, {
    method: "POST",
    token: state.adminToken,
  });
  publicCategories = await api("/categories");
  assert(!publicCategories.payload.categories?.some(cat => cat.id === hoodie.payload.category.id), "Deactivated category leaked to public categories.");

  await api(`/admin/categories/${encodeURIComponent(hoodie.payload.category.id)}/restore`, {
    method: "POST",
    token: state.adminToken,
  });
  publicCategories = await api("/categories");
  assert(publicCategories.payload.categories?.some(cat => cat.id === hoodie.payload.category.id), "Restored category did not return to public categories.");

  await api("/admin/categories", {
    method: "POST",
    token: state.adminToken,
    body: { name: "Custom Design", active: true },
    expectStatus: 400,
  });
  publicCategories = await api("/categories");
  assert(!publicCategories.payload.categories?.some(cat => String(cat.slug).toLowerCase() === "custom-design"), "Custom Design appeared as a public product category.");
  pass("categories create image duplicate deactivate restore rejected");

  await api("/admin/products/sync", {
    method: "POST",
    token: state.adminToken,
    body: {
      product: {
        id: qa.productId,
        name: "QA Test Tee",
        slug: `qa-test-tee-${suffix}`,
        category: "T-Shirts",
        price_egp: 250,
        description: "QA product generated by automated test.",
        images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop"],
        status: "active",
        is_new: true,
        is_best_seller: false,
      },
      variants: [
        {
          id: qa.variantWhiteId,
          product_id: qa.productId,
          size: "M",
          color: "White",
          stock: 5,
          sku: `qa-white-${suffix}`,
          active: true,
          created_at: new Date().toISOString(),
        },
        {
          id: qa.variantBlackId,
          product_id: qa.productId,
          size: "L",
          color: "Black",
          stock: 0,
          sku: `qa-black-${suffix}`,
          active: true,
          created_at: new Date().toISOString(),
        },
      ],
      removedVariantIds: [],
    },
  });
  let publicProducts = await api("/products");
  assert(publicProducts.payload.products?.some(product => product.id === qa.productId), "Active QA product did not appear publicly.");
  const publicVariants = publicProducts.payload.variants?.filter(variant => variant.product_id === qa.productId) || [];
  assert(publicVariants.some(variant => variant.id === qa.variantWhiteId && variant.stock === 5), "In-stock variant missing or wrong.");
  assert(publicVariants.some(variant => variant.id === qa.variantBlackId && variant.stock === 0), "Out-of-stock variant missing.");

  let adminProducts = await api("/admin/products", { token: state.adminToken });
  assert(adminProducts.payload.products?.some(product => product.id === qa.productId), "Default admin products did not include active product.");

  await api(`/admin/products/variants/${encodeURIComponent(qa.variantWhiteId)}`, {
    method: "PATCH",
    token: state.adminToken,
    body: { stock: 6, active: true },
  });
  await api(`/admin/products/${encodeURIComponent(qa.productId)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { status: "draft" },
  });
  publicProducts = await api("/products");
  assert(!publicProducts.payload.products?.some(product => product.id === qa.productId), "Draft product leaked to public products.");
  adminProducts = await api("/admin/products", { token: state.adminToken });
  assert(adminProducts.payload.products?.some(product => product.id === qa.productId), "Default admin products should include draft products.");
  await api(`/admin/products/${encodeURIComponent(qa.productId)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { status: "active" },
  });

  await api(`/admin/products/${encodeURIComponent(qa.productId)}/archive`, {
    method: "POST",
    token: state.adminToken,
  });
  publicProducts = await api("/products");
  assert(!publicProducts.payload.products?.some(product => product.id === qa.productId), "Archived product leaked to public products.");
  adminProducts = await api("/admin/products", { token: state.adminToken });
  assert(!adminProducts.payload.products?.some(product => product.id === qa.productId), "Archived product appeared in default admin products.");
  const archivedProducts = await api("/admin/products?status=archived", { token: state.adminToken });
  assert(archivedProducts.payload.products?.some(product => product.id === qa.productId && product.status === "archived"), "Archived product missing from Archived admin filter.");
  await api(`/admin/products/${encodeURIComponent(qa.productId)}/restore`, {
    method: "POST",
    token: state.adminToken,
  });
  publicProducts = await api("/products");
  assert(publicProducts.payload.products?.some(product => product.id === qa.productId), "Restored product did not return to public products.");
  adminProducts = await api("/admin/products", { token: state.adminToken });
  assert(adminProducts.payload.products?.some(product => product.id === qa.productId), "Restored product did not return to default admin products.");

  await api("/admin/products/sync", {
    method: "POST",
    token: state.adminToken,
    body: {
      product: {
        id: qa.deleteProductId,
        name: "QA Delete Tee",
        slug: `qa-delete-tee-${suffix}`,
        category: "T-Shirts",
        price_egp: 199,
        description: "QA product for permanent delete.",
        images: [],
        status: "active",
        is_new: false,
        is_best_seller: false,
      },
      variants: [{
        id: qa.deleteVariantId,
        product_id: qa.deleteProductId,
        size: "M",
        color: "Black",
        stock: 2,
        sku: `qa-delete-${suffix}`,
        active: true,
        created_at: new Date().toISOString(),
      }],
      removedVariantIds: [],
    },
  });
  const permanentDelete = await api(`/admin/products/${encodeURIComponent(qa.deleteProductId)}`, {
    method: "DELETE",
    token: state.adminToken,
  });
  assert(permanentDelete.payload.action === "deleted", "Product without orders was not permanently deleted.");
  const deletedProductRows = await supabase(`/rest/v1/products?id=eq.${encodeURIComponent(qa.deleteProductId)}&select=id`);
  const deletedVariantRows = await supabase(`/rest/v1/product_variants?product_id=eq.${encodeURIComponent(qa.deleteProductId)}&select=id`);
  assert(deletedProductRows.length === 0 && deletedVariantRows.length === 0, "Permanent delete left product or variants behind.");

  pass("products inventory archive restore permanent delete lifecycle");

  const zone = await api("/admin/shipping-zones", {
    method: "POST",
    token: state.adminToken,
    body: {
      governorate: qa.zoneGov,
      city_area: "QA City",
      delivery_fee_egp: 41,
      free_shipping_min_egp: 1000,
      active: true,
    },
  });
  state.shippingZoneId = zone.payload.zone?.id;
  assert(state.shippingZoneId, "Shipping zone was not created.");
  await api(`/admin/shipping-zones/${encodeURIComponent(state.shippingZoneId)}`, {
    method: "PATCH",
    token: state.adminToken,
    body: { governorate: qa.zoneGov, city_area: "QA City", delivery_fee_egp: 42, active: true },
  });
  const publicZones = await api("/shipping-zones");
  assert(publicZones.payload.zones?.some(item => item.id === state.shippingZoneId && item.delivery_fee_egp === 42), "Public shipping zones did not reflect update.");
  pass("shipping zone create/edit/public read");

  const fixed = await api("/admin/discount-codes", {
    method: "POST",
    token: state.adminToken,
    body: { code: qa.discountFixed, discount_type: "fixed", discount_value: 30, minimum_order_egp: 100, usage_limit: 1, active: true },
  });
  state.discountFixedId = fixed.payload.code?.id;
  const percent = await api("/admin/discount-codes", {
    method: "POST",
    token: state.adminToken,
    body: { code: qa.discountPercent, discount_type: "percentage", discount_value: 10, minimum_order_egp: 0, active: true },
  });
  state.discountPercentId = percent.payload.code?.id;
  const expired = await api("/admin/discount-codes", {
    method: "POST",
    token: state.adminToken,
    body: { code: qa.discountExpired, discount_type: "fixed", discount_value: 10, expires_at: "2000-01-01T00:00:00.000Z", active: true },
  });
  state.discountExpiredId = expired.payload.code?.id;

  let validation = await api("/discount-codes/validate", {
    method: "POST",
    body: { code: qa.discountFixed, subtotal_egp: 250 },
  });
  assert(validation.payload.valid && validation.payload.discount_amount === 30, "Fixed discount did not validate.");
  await api(`/discount-codes/${encodeURIComponent(state.discountFixedId)}/apply`, {
    method: "POST",
    body: { subtotal_egp: 250 },
  });
  validation = await api("/discount-codes/validate", {
    method: "POST",
    body: { code: qa.discountFixed, subtotal_egp: 250 },
  });
  assert(validation.payload.valid === false, "Usage-limited discount remained valid after apply.");
  validation = await api("/discount-codes/validate", {
    method: "POST",
    body: { code: qa.discountPercent, subtotal_egp: 250 },
  });
  assert(validation.payload.valid && validation.payload.discount_amount === 25, "Percentage discount did not calculate.");
  validation = await api("/discount-codes/validate", {
    method: "POST",
    body: { code: qa.discountExpired, subtotal_egp: 250 },
  });
  assert(validation.payload.valid === false, "Expired discount validated.");
  await api(`/admin/discount-codes/${encodeURIComponent(state.discountPercentId)}`, {
    method: "PATCH",
    token: state.adminToken,
    body: { active: false },
  });
  await api(`/admin/discount-codes/${encodeURIComponent(state.discountPercentId)}/deactivate`, {
    method: "POST",
    token: state.adminToken,
  });
  pass("discount code validation/apply/edit/deactivate");

  const settings = await api("/settings");
  state.originalSettings = settings.payload.settings;
  await api("/admin/settings", {
    method: "PUT",
    token: state.adminToken,
    body: {
      ...state.originalSettings,
      brand_name: "S! Wear QA",
      whatsapp_number: "201000000000",
      announcement_bar_text: `QA announcement ${suffix}`,
      instagram_url: "instagram.com/siwearqa",
      tiktok_url: "@siwearqa",
      facebook_url: "facebook.com/siwearqa",
      support_info: "+20 100 000 0000",
    },
  });
  const publicSettings = await api("/settings");
  assert(publicSettings.payload.settings?.announcement_bar_text?.includes("QA announcement"), "Settings did not persist publicly.");
  assert(publicSettings.payload.settings?.instagram_url === "https://instagram.com/siwearqa", "Instagram URL was not normalized.");
  assert(publicSettings.payload.settings?.tiktok_url === "https://www.tiktok.com/@siwearqa", "TikTok URL was not normalized.");
  assert(publicSettings.payload.settings?.facebook_url === "https://facebook.com/siwearqa", "Facebook URL was not normalized.");
  pass("settings save/public read/social normalization");
}

async function variantStock() {
  const rows = await supabase(`/rest/v1/product_variants?id=eq.${encodeURIComponent(qa.variantWhiteId)}&select=stock&limit=1`);
  return Number(rows?.[0]?.stock ?? -1);
}

async function placeOrder(orderId, token, userId, quantity = 1) {
  return api("/orders/place", {
    method: "POST",
    token,
    body: {
      order_payload: {
        id: orderId,
        user_id: userId,
        customer_name: "QA Customer",
        phone: qa.customerPhone,
        governorate: qa.zoneGov,
        city_area: "QA City",
        full_address: "QA address, building 1, floor 2",
        notes: null,
        subtotal_egp: 250 * quantity,
        shipping_egp: 42,
        total_egp: 250 * quantity + 42,
        discount_code: null,
        discount_amount: 0,
        payment_method: "Cash on Delivery",
        status: "Pending",
        created_at: new Date().toISOString(),
      },
      items_payload: [{
        order_id: orderId,
        product_id: qa.productId,
        variant_id: qa.variantWhiteId,
        product_name: "QA Test Tee",
        size: "M",
        color: "White",
        quantity,
        price_egp: 250,
      }],
    },
  });
}

async function testOrdersCancellationStock() {
  await api(`/admin/products/variants/${encodeURIComponent(qa.variantWhiteId)}`, {
    method: "PATCH",
    token: state.adminToken,
    body: { stock: 6, active: true },
  });
  await placeOrder(qa.orderA, state.customerToken, state.customerId, 1);
  assert(await variantStock() === 5, "Stock did not decrease exactly once after order A.");

  await placeOrder(qa.orderB, state.customerToken, state.customerId, 2);
  assert(await variantStock() === 3, "Stock did not decrease exactly once after order B.");

  const items = await supabase(`/rest/v1/order_items?order_id=in.(${encodeURIComponent(qa.orderA)},${encodeURIComponent(qa.orderB)})&select=order_id,variant_id,quantity`);
  assert(items.length === 2 && items.every(item => item.variant_id === qa.variantWhiteId), "Order items were not saved with real variant_id.");

  await placeOrder(`QA-BLOCKED-${suffix}`, state.blockedToken, state.blockedId, 1).then(
    () => { throw new Error("Blocked user was able to place an order."); },
    err => {
      assert(String(err.message).includes("403"), `Blocked order failed with unexpected error: ${err.message}`);
    },
  );

  const customerOrders = await api("/orders", { token: state.customerToken });
  assert(customerOrders.payload.orders?.some(order => order.id === qa.orderA), "Customer orders did not include order A.");

  const cancel = await api(`/orders/${encodeURIComponent(qa.orderA)}/cancel-request`, {
    method: "POST",
    token: state.customerToken,
    body: { reason: "QA cancellation request" },
  });
  assert(cancel.payload.order?.cancellation_requested === true, "Cancellation request did not persist.");

  const refreshed = await api(`/orders/${encodeURIComponent(qa.orderA)}`, { token: state.customerToken });
  assert(String(refreshed.payload.order?.cancellation_status).toLowerCase() === "pending", "Cancellation did not survive reload.");
  await api(`/orders/${encodeURIComponent(qa.orderA)}/cancel-request`, {
    method: "POST",
    token: state.customerToken,
    body: { reason: "QA duplicate cancellation" },
    expectStatus: 409,
  });
  const adminOrders = await api("/admin/orders", { token: state.adminToken });
  assert(adminOrders.payload.orders?.some(order => order.id === qa.orderA && String(order.cancellation_status).toLowerCase() === "pending"), "Admin orders missing pending cancellation.");
  await api(`/admin/orders/${encodeURIComponent(qa.orderA)}/cancellation/reject`, {
    method: "POST",
    token: state.adminToken,
    body: { admin_note: "QA reject" },
  });
  const rejected = await api(`/orders/${encodeURIComponent(qa.orderA)}`, { token: state.customerToken });
  assert(String(rejected.payload.order?.cancellation_status).toLowerCase() === "rejected", "Cancellation reject did not persist.");

  await api(`/orders/${encodeURIComponent(qa.orderB)}/cancel-request`, {
    method: "POST",
    token: state.customerToken,
    body: { reason: "QA approve cancellation" },
  });
  await api(`/admin/orders/${encodeURIComponent(qa.orderB)}/cancellation/approve`, {
    method: "POST",
    token: state.adminToken,
    body: { admin_note: "QA approve" },
  });
  const approved = await api(`/admin/orders/${encodeURIComponent(qa.orderB)}`, { token: state.adminToken });
  assert(approved.payload.order?.status === "Cancelled", "Approve did not set order status Cancelled.");
  assert(await variantStock() === 5, "Cancellation approve did not restore stock once.");
  await api(`/admin/orders/${encodeURIComponent(qa.orderB)}/cancellation/approve`, {
    method: "POST",
    token: state.adminToken,
    body: { admin_note: "QA duplicate approve" },
    expectStatus: 409,
  });
  assert(await variantStock() === 5, "Duplicate cancellation approve restored stock twice.");

  await api(`/admin/orders/${encodeURIComponent(qa.orderA)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { status: "Confirmed" },
  });
  await api(`/admin/orders/${encodeURIComponent(qa.orderA)}/notes`, {
    method: "PATCH",
    token: state.adminToken,
    body: { admin_notes: "QA private note" },
  });
  const notes = await api(`/admin/orders/${encodeURIComponent(qa.orderA)}`, { token: state.adminToken });
  assert(notes.payload.order?.admin_notes === "QA private note", "Admin order notes did not save.");

  const notifications = await supabase(`/rest/v1/notifications?customer_id=eq.${encodeURIComponent(state.customerId)}&select=message,order_id`);
  assert(notifications.some(row => row.order_id === qa.orderA), "Order/cancellation notification was not created.");

  const historyDelete = await api(`/admin/products/${encodeURIComponent(qa.productId)}`, {
    method: "DELETE",
    token: state.adminToken,
  });
  assert(historyDelete.payload.action === "archived" && historyDelete.payload.orderHistory === true, "Product with order history was not archived instead of deleted.");
  const archivedProducts = await api("/admin/products?status=archived", { token: state.adminToken });
  assert(archivedProducts.payload.products?.some(product => product.id === qa.productId), "Order-history product missing from Archived after delete attempt.");
  const remainingVariants = await supabase(`/rest/v1/product_variants?product_id=eq.${encodeURIComponent(qa.productId)}&select=id`);
  assert(remainingVariants.some(row => row.id === qa.variantWhiteId), "Order-history delete removed product variants.");
  const remainingItems = await supabase(`/rest/v1/order_items?order_id=in.(${encodeURIComponent(qa.orderA)},${encodeURIComponent(qa.orderB)})&select=order_id,variant_id`);
  assert(remainingItems.length === 2 && remainingItems.every(row => row.variant_id === qa.variantWhiteId), "Order-history delete changed order items.");

  pass("orders, stock, cancellation, notes, notifications, order-history product archive");
}

async function testMessagesAndReturns() {
  const createdMessage = await api("/messages", {
    method: "POST",
    token: state.customerToken,
    body: {
      subject: "QA contact message",
      message: "This is a QA contact message with enough detail.",
      order_id: qa.orderA,
    },
  });
  state.contactMessageId = createdMessage.payload.message?.id;
  assert(state.contactMessageId, "Customer contact message was not created through the API.");
  assert(createdMessage.payload.message?.status === "open", "New contact message did not start open.");

  const messages = await api("/admin/messages", { token: state.adminToken });
  assert(messages.payload.messages?.some(message => message.id === state.contactMessageId), "Admin messages missing QA contact message.");

  await api(`/admin/messages/${encodeURIComponent(state.contactMessageId)}/reply`, {
    method: "POST",
    token: state.adminToken,
    body: { message: "QA first reply from admin", replied_by: "QA Admin" },
  });

  const customerAfterAdminReply = await api(`/messages/${encodeURIComponent(state.contactMessageId)}`, { token: state.customerToken });
  assert(customerAfterAdminReply.payload.message?.status === "admin_replied", "Customer thread did not show admin replied status.");
  assert(
    customerAfterAdminReply.payload.message?.replies?.some(reply => reply.senderRole === "admin" && reply.message === "QA first reply from admin"),
    "Customer thread missing first admin reply.",
  );

  await api(`/messages/${encodeURIComponent(state.contactMessageId)}/reply`, {
    method: "POST",
    token: state.customerToken,
    body: { message: "QA customer follow-up reply after admin answered." },
  });

  const customerRefresh = await api(`/messages/${encodeURIComponent(state.contactMessageId)}`, { token: state.customerToken });
  assert(
    customerRefresh.payload.message?.replies?.some(reply => reply.senderRole === "customer" && reply.message.includes("customer follow-up")),
    "Customer follow-up reply did not persist after refresh.",
  );

  const pendingAdmin = await api("/admin/messages", { token: state.adminToken });
  assert(
    pendingAdmin.payload.messages?.some(message => message.id === state.contactMessageId && message.status === "customer_replied"),
    "Admin messages did not show customer replied / pending admin.",
  );

  await api(`/admin/messages/${encodeURIComponent(state.contactMessageId)}/reply`, {
    method: "POST",
    token: state.adminToken,
    body: { message: "QA second reply from admin", replied_by: "QA Admin" },
  });

  const customerAfterSecondAdminReply = await api(`/messages/${encodeURIComponent(state.contactMessageId)}`, { token: state.customerToken });
  assert(
    customerAfterSecondAdminReply.payload.message?.replies?.some(reply => reply.senderRole === "admin" && reply.message === "QA second reply from admin"),
    "Customer thread missing second admin reply.",
  );

  const messageNotification = await supabase(`/rest/v1/notifications?customer_id=eq.${encodeURIComponent(state.customerId)}&contact_message_id=eq.${encodeURIComponent(state.contactMessageId)}&select=id`);
  assert(messageNotification.length > 0, "Admin message reply did not create notification.");

  await api(`/admin/messages/${encodeURIComponent(state.contactMessageId)}/close`, {
    method: "POST",
    token: state.adminToken,
  });
  const closedThread = await api(`/messages/${encodeURIComponent(state.contactMessageId)}`, { token: state.customerToken });
  assert(closedThread.payload.message?.status === "closed", "Closed contact thread did not persist for customer.");
  await api(`/messages/${encodeURIComponent(state.contactMessageId)}/reply`, {
    method: "POST",
    token: state.customerToken,
    body: { message: "QA should not be accepted after close." },
    expectStatus: 409,
  });
  const adminClosedThread = await api(`/admin/messages/${encodeURIComponent(state.contactMessageId)}`, { token: state.adminToken });
  assert(adminClosedThread.payload.message?.status === "closed", "Admin could not view closed contact thread.");
  pass("contact support thread lifecycle and notifications");

  await api(`/admin/orders/${encodeURIComponent(qa.orderA)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { status: "Delivered" },
  });
  await supabase("/rest/v1/return_requests", {
    method: "POST",
    anon: true,
    token: state.customerToken,
    headers: { Prefer: "return=representation" },
    body: {
      id: qa.returnId,
      order_id: qa.orderA,
      order_number: qa.orderA,
      user_id: state.customerId,
      reason: "QA return",
      message: "QA return message with enough detail.",
      preferred_action: "return",
      status: "Pending",
      created_at: new Date().toISOString(),
    },
  });
  const returns = await api("/admin/returns", { token: state.adminToken });
  assert(returns.payload.returns?.some(row => row.id === qa.returnId), "Admin returns missing QA return request.");
  await api(`/admin/returns/${encodeURIComponent(qa.returnId)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { status: "Accepted", admin_note: "QA accepted" },
  });
  await api(`/admin/returns/${encodeURIComponent(qa.returnId)}/status`, {
    method: "PATCH",
    token: state.adminToken,
    body: { status: "Completed", admin_note: "QA completed" },
  });
  const returnNotifications = await supabase(`/rest/v1/notifications?customer_id=eq.${encodeURIComponent(state.customerId)}&order_id=eq.${encodeURIComponent(qa.orderA)}&select=message`);
  assert(returnNotifications.some(row => String(row.message).toLowerCase().includes("return")), "Return status update did not notify customer.");
  pass("returns list/status/notification");
}

async function main() {
  try {
    await setup();
    await auditSchema();
    await testAdminAuthAndUsers();
    await testCatalogShippingDiscountSettings();
    await testOrdersCancellationStock();
    await testMessagesAndReturns();
    console.log(JSON.stringify({
      ok: true,
      passed: state.passed,
      warnings: state.warnings,
    }, null, 2));
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error(JSON.stringify({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
    passed: state.passed,
    warnings: state.warnings,
  }, null, 2));
  process.exitCode = 1;
});

import { Router, type IRouter } from "express";

const router: IRouter = Router();

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price_egp: number;
  description: string;
  images: string[];
  status: "active" | "draft";
  is_new?: boolean | null;
  is_best_seller?: boolean | null;
  created_at?: string;
};

type ProductVariantRow = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  stock: number;
  sku: string;
  active: boolean;
  created_at: string;
};

const PRODUCT_SELECT_WITH_FLAGS = [
  "id",
  "name",
  "slug",
  "category",
  "price_egp",
  "description",
  "images",
  "status",
  "is_new",
  "is_best_seller",
  "created_at",
].join(",");

const PRODUCT_SELECT_BASE = [
  "id",
  "name",
  "slug",
  "category",
  "price_egp",
  "description",
  "images",
  "status",
  "created_at",
].join(",");

const VARIANT_SELECT = [
  "id",
  "product_id",
  "size",
  "color",
  "stock",
  "sku",
  "active",
  "created_at",
].join(",");

const PRODUCT_FLAGS_MIGRATION_WARNING =
  "Product flags were not saved because products.is_new/is_best_seller columns are missing. Run artifacts/swear/supabase-product-flags-migration.sql.";

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

function isMissingProductFlagColumns(message: string): boolean {
  const normalized = message.toLowerCase();
  const namesFlagColumn = normalized.includes("is_new") || normalized.includes("is_best_seller");
  return namesFlagColumn && (
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    normalized.includes("pgrst204") ||
    normalized.includes("could not find")
  );
}

async function requireAdminUserId(config: ReturnType<typeof getSupabaseConfig>, token: string): Promise<string> {
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

  const profileRes = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=role,blocked,is_active&limit=1`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json",
      },
    },
  );

  const profilePayload = await readJson(profileRes);
  if (!profileRes.ok) {
    throw Object.assign(new Error(errorMessage(profilePayload, "Failed to verify admin profile.")), { status: 500 });
  }

  const profile = Array.isArray(profilePayload) ? profilePayload[0] as Record<string, unknown> | undefined : undefined;
  const role = String(profile?.role ?? "").toLowerCase();
  const blocked = profile?.blocked === true || profile?.blocked === "true";
  const isActive = !(profile?.is_active === false || profile?.is_active === "false");

  if (role !== "admin" || blocked || !isActive) {
    throw Object.assign(new Error("Admin access is required to manage products."), { status: 403 });
  }

  return authUser.id;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function parseProductRow(value: unknown): ProductRow {
  if (!value || typeof value !== "object") {
    throw Object.assign(new Error("Product payload is required."), { status: 400 });
  }

  const row = value as Partial<ProductRow>;
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.category !== "string" ||
    typeof row.description !== "string" ||
    !isStringArray(row.images) ||
    !["active", "draft"].includes(String(row.status)) ||
    !Number.isFinite(Number(row.price_egp))
  ) {
    throw Object.assign(new Error("Invalid product payload."), { status: 400 });
  }

  return {
    id: row.id,
    name: row.name.trim(),
    slug: row.slug.trim(),
    category: row.category,
    price_egp: Math.max(1, Number(row.price_egp)),
    description: row.description,
    images: row.images,
    status: row.status as "active" | "draft",
    is_new: row.is_new === true,
    is_best_seller: row.is_best_seller === true,
  };
}

function parseVariantRows(value: unknown, productId: string): ProductVariantRow[] {
  if (!Array.isArray(value)) {
    throw Object.assign(new Error("Variant payload is required."), { status: 400 });
  }

  return value.map(item => {
    const row = item as Partial<ProductVariantRow>;
    if (
      !row ||
      typeof row.id !== "string" ||
      row.product_id !== productId ||
      typeof row.size !== "string" ||
      typeof row.color !== "string" ||
      typeof row.sku !== "string" ||
      typeof row.created_at !== "string"
    ) {
      throw Object.assign(new Error("Invalid variant payload."), { status: 400 });
    }

    return {
      id: row.id,
      product_id: productId,
      size: row.size,
      color: row.color,
      stock: Math.max(0, Number(row.stock) || 0),
      sku: row.sku,
      active: row.active !== false,
      created_at: row.created_at,
    };
  });
}

function parseRemovedVariantIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!isStringArray(value)) {
    throw Object.assign(new Error("Invalid removed variant ids."), { status: 400 });
  }
  return value;
}

async function supabaseRequest(
  config: ReturnType<typeof getSupabaseConfig>,
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

function productWithoutFlags(product: ProductRow): Omit<ProductRow, "is_new" | "is_best_seller"> {
  const { is_new: _isNew, is_best_seller: _isBestSeller, ...rest } = product;
  return rest;
}

function normalizeFetchedProduct(row: ProductRow): ProductRow {
  return {
    ...row,
    images: Array.isArray(row.images) ? row.images : [],
    status: row.status === "draft" ? "draft" : "active",
    is_new: row.is_new === true,
    is_best_seller: row.is_best_seller === true,
  };
}

async function upsertProduct(
  config: ReturnType<typeof getSupabaseConfig>,
  product: ProductRow,
): Promise<string[]> {
  try {
    await supabaseRequest(config, "/rest/v1/products?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(product),
    });
    return [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingProductFlagColumns(message)) throw err;
  }

  await supabaseRequest(config, "/rest/v1/products?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(productWithoutFlags(product)),
  });
  return [PRODUCT_FLAGS_MIGRATION_WARNING];
}

async function fetchProductRows(
  config: ReturnType<typeof getSupabaseConfig>,
  activeOnly: boolean,
): Promise<{ rows: ProductRow[]; warnings: string[] }> {
  const buildPath = (select: string) => {
    const params = [
      `select=${encodeURIComponent(select)}`,
      "order=created_at.desc",
      ...(activeOnly ? ["status=eq.active"] : []),
    ];
    return `/rest/v1/products?${params.join("&")}`;
  };

  try {
    const rows = await supabaseRequest(config, buildPath(PRODUCT_SELECT_WITH_FLAGS), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return {
      rows: Array.isArray(rows) ? rows.map(row => normalizeFetchedProduct(row as ProductRow)) : [],
      warnings: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingProductFlagColumns(message)) throw err;
  }

  const rows = await supabaseRequest(config, buildPath(PRODUCT_SELECT_BASE), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return {
    rows: Array.isArray(rows) ? rows.map(row => normalizeFetchedProduct(row as ProductRow)) : [],
    warnings: [PRODUCT_FLAGS_MIGRATION_WARNING],
  };
}

async function fetchVariantRows(
  config: ReturnType<typeof getSupabaseConfig>,
  productIds: string[],
  activeOnly: boolean,
): Promise<ProductVariantRow[]> {
  if (productIds.length === 0) return [];
  const encodedIds = productIds.map(id => encodeURIComponent(id)).join(",");
  const params = [
    `select=${encodeURIComponent(VARIANT_SELECT)}`,
    `product_id=in.(${encodedIds})`,
    "order=created_at.asc",
    ...(activeOnly ? ["active=eq.true"] : []),
  ];
  const rows = await supabaseRequest(config, `/rest/v1/product_variants?${params.join("&")}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows as ProductVariantRow[] : [];
}

async function fetchProductDataset(config: ReturnType<typeof getSupabaseConfig>, activeOnly: boolean) {
  const products = await fetchProductRows(config, activeOnly);
  const variants = await fetchVariantRows(config, products.rows.map(row => row.id), activeOnly);
  return {
    products: products.rows,
    variants,
    warnings: products.warnings,
  };
}

router.get("/products", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const dataset = await fetchProductDataset(config, true);
    return res.json(dataset);
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Products could not be loaded.";
    req.log.error({ err: message, status }, "public products fetch failed");
    return res.status(status).json({ error: "PRODUCTS_FETCH_FAILED", message });
  }
});

router.get("/admin/products", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to load products." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    const dataset = await fetchProductDataset(config, false);
    req.log.info({ admin_user_id: adminUserId, products: dataset.products.length }, "admin products fetched");
    return res.json(dataset);
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Products could not be loaded.";
    req.log.error({ err: message, status }, "admin products fetch failed");
    return res.status(status).json({ error: "PRODUCTS_FETCH_FAILED", message });
  }
});

router.post("/admin/products/sync", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to save products." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    const product = parseProductRow(req.body?.product);
    const variants = parseVariantRows(req.body?.variants, product.id);
    const removedVariantIds = parseRemovedVariantIds(req.body?.removedVariantIds);
    const warnings = await upsertProduct(config, product);

    if (variants.length > 0) {
      await supabaseRequest(config, "/rest/v1/product_variants?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(variants),
      });
    }

    await Promise.all(
      removedVariantIds.map(variantId =>
        supabaseRequest(
          config,
          `/rest/v1/product_variants?id=eq.${encodeURIComponent(variantId)}&product_id=eq.${encodeURIComponent(product.id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ active: false, stock: 0 }),
          },
        ),
      ),
    );

    req.log.info({ admin_user_id: adminUserId, product_id: product.id, variants: variants.length }, "product synced");
    return res.json({ ok: true, warnings });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Product sync failed.";
    req.log.error({ err: message, status }, "product sync failed");
    return res.status(status).json({ error: "PRODUCT_SYNC_FAILED", message });
  }
});

router.patch("/admin/products/:id/status", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to update products." });
    }

    const status = req.body?.status;
    if (!["active", "draft"].includes(String(status))) {
      return res.status(400).json({ error: "INVALID_PRODUCT_STATUS", message: "Product status must be active or draft." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    await supabaseRequest(config, `/rest/v1/products?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status }),
    });

    req.log.info({ admin_user_id: adminUserId, product_id: req.params.id, status }, "product status updated");
    return res.json({ ok: true });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Product status update failed.";
    req.log.error({ err: message, status }, "product status update failed");
    return res.status(status).json({ error: "PRODUCT_STATUS_FAILED", message });
  }
});

router.patch("/admin/products/variants/:id", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to update inventory." });
    }

    const body: Record<string, unknown> = {};
    if (req.body?.stock !== undefined) {
      const stock = Number(req.body.stock);
      if (!Number.isFinite(stock) || stock < 0) {
        return res.status(400).json({ error: "INVALID_STOCK", message: "Stock must be 0 or more." });
      }
      body.stock = Math.round(stock);
    }
    if (req.body?.active !== undefined) {
      body.active = req.body.active === true;
    }
    if (Object.keys(body).length === 0) {
      return res.status(400).json({ error: "EMPTY_INVENTORY_UPDATE", message: "Send stock or active to update inventory." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    await supabaseRequest(config, `/rest/v1/product_variants?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });

    req.log.info({ admin_user_id: adminUserId, variant_id: req.params.id, body }, "variant inventory updated");
    return res.json({ ok: true });
  } catch (err) {
    const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : "Inventory update failed.";
    req.log.error({ err: message, status }, "variant inventory update failed");
    return res.status(status).json({ error: "INVENTORY_UPDATE_FAILED", message });
  }
});

export default router;

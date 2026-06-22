import { Router, type IRouter } from "express";
import { setPublicReadCache } from "../lib/cacheHeaders.js";

const router: IRouter = Router();

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price_egp: number;
  description: string;
  images: string[] | string | null;
  status: ProductStatus;
  active?: boolean | null;
  is_new?: boolean | null;
  is_best_seller?: boolean | null;
  created_at?: string;
};

type ProductStatus = "active" | "draft" | "archived";
type ProductFilter = "public" | "admin-default" | "all" | ProductStatus;

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

const PRODUCT_SELECT_WITH_FLAGS_AND_ACTIVE = [
  "id",
  "name",
  "slug",
  "category",
  "price_egp",
  "description",
  "images",
  "status",
  "active",
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

const PRODUCT_SELECT_BASE_AND_ACTIVE = [
  "id",
  "name",
  "slug",
  "category",
  "price_egp",
  "description",
  "images",
  "status",
  "active",
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
const PRODUCT_ACTIVE_COLUMN_WARNING =
  "products.active column is missing; product visibility uses products.status only.";
const PRODUCT_ARCHIVED_STATUS_WARNING =
  "products.status must allow 'archived'. Run artifacts/swear/supabase-product-archive-status-migration.sql.";

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

function isMissingColumn(message: string, column: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes(column.toLowerCase()) && (
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    normalized.includes("pgrst204") ||
    normalized.includes("could not find")
  );
}

function isArchivedStatusUnsupported(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("archived") && (
    normalized.includes("check constraint") ||
    normalized.includes("violates") ||
    normalized.includes("invalid input value") ||
    normalized.includes("status")
  );
}

function getErrorStatus(err: unknown): number {
  return typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
    ? (err as { status: number }).status
    : 500;
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

function parseProductStatus(value: unknown): ProductStatus | null {
  const normalized = String(value || "").toLowerCase();
  return normalized === "active" || normalized === "published"
    ? "active"
    : normalized === "draft" || normalized === "archived"
      ? normalized
      : null;
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
    !parseProductStatus(row.status) ||
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
    status: parseProductStatus(row.status) ?? "active",
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

function parseImages(value: ProductRow["images"]): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  } catch {
    return [];
  }
}

function normalizeFetchedProduct(row: ProductRow): ProductRow {
  const parsedStatus = parseProductStatus(row.status);
  return {
    ...row,
    images: parseImages(row.images),
    status: parsedStatus ?? "active",
    active: row.active === false ? false : true,
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
  filter: ProductFilter,
): Promise<{ rows: ProductRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const buildPath = (select: string) => {
    const params = [
      `select=${encodeURIComponent(select)}`,
      "order=created_at.desc",
    ];
    return `/rest/v1/products?${params.join("&")}`;
  };

  const selectAttempts = [
    PRODUCT_SELECT_WITH_FLAGS_AND_ACTIVE,
    PRODUCT_SELECT_WITH_FLAGS,
    PRODUCT_SELECT_BASE_AND_ACTIVE,
    PRODUCT_SELECT_BASE,
  ];

  let rows: unknown = [];
  let loaded = false;
  for (const select of selectAttempts) {
    try {
      rows = await supabaseRequest(config, buildPath(select), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      loaded = true;
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const missingFlags = isMissingProductFlagColumns(message);
      const missingActive = isMissingColumn(message, "active");
      if (!missingFlags && !missingActive) throw err;
      if (missingFlags && !warnings.includes(PRODUCT_FLAGS_MIGRATION_WARNING)) {
        warnings.push(PRODUCT_FLAGS_MIGRATION_WARNING);
      }
      if (missingActive && !warnings.includes(PRODUCT_ACTIVE_COLUMN_WARNING)) {
        warnings.push(PRODUCT_ACTIVE_COLUMN_WARNING);
      }
    }
  }

  if (!loaded) {
    throw Object.assign(new Error("Products could not be loaded."), { status: 500 });
  }

  const normalizedRows = Array.isArray(rows) ? rows.map(row => normalizeFetchedProduct(row as ProductRow)) : [];
  return {
    rows: normalizedRows.filter(row => {
      if (filter === "public") return row.status === "active" && row.active !== false;
      if (filter === "admin-default") return row.status !== "archived";
      if (filter === "all") return true;
      if (filter === "active") return row.status === "active" && row.active !== false;
      return row.status === filter;
    }),
    warnings,
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

async function fetchProductDataset(config: ReturnType<typeof getSupabaseConfig>, filter: ProductFilter) {
  const products = await fetchProductRows(config, filter);
  const activeVariantsOnly = filter === "public";
  const variants = await fetchVariantRows(config, products.rows.map(row => row.id), activeVariantsOnly);
  return {
    products: products.rows,
    variants,
    warnings: products.warnings,
  };
}

async function fetchProductById(config: ReturnType<typeof getSupabaseConfig>, productId: string): Promise<ProductRow> {
  const products = await fetchProductRows(config, "all");
  const product = products.rows.find(row => row.id === productId);
  if (!product) {
    throw Object.assign(new Error("Product was not found."), { status: 404 });
  }
  return product;
}

async function patchProductById(
  config: ReturnType<typeof getSupabaseConfig>,
  productId: string,
  body: Record<string, unknown>,
): Promise<{ product: ProductRow; warnings: string[] }> {
  const warnings: string[] = [];
  const patch = async (payload: Record<string, unknown>) => {
    return supabaseRequest(config, `/rest/v1/products?id=eq.${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
  };

  let rows: unknown;
  try {
    rows = await patch(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if ("active" in body && isMissingColumn(message, "active")) {
      warnings.push(PRODUCT_ACTIVE_COLUMN_WARNING);
      const { active: _active, ...withoutActive } = body;
      try {
        rows = await patch(withoutActive);
      } catch (retryErr) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        if (withoutActive.status === "archived" && isArchivedStatusUnsupported(retryMessage)) {
          throw Object.assign(new Error(PRODUCT_ARCHIVED_STATUS_WARNING), { status: 500 });
        }
        throw retryErr;
      }
    } else if (body.status === "archived" && isArchivedStatusUnsupported(message)) {
      throw Object.assign(new Error(PRODUCT_ARCHIVED_STATUS_WARNING), { status: 500 });
    } else {
      throw err;
    }
  }

  const product = Array.isArray(rows) ? rows[0] as ProductRow | undefined : undefined;
  if (!product) {
    throw Object.assign(new Error("Product was not found."), { status: 404 });
  }

  return { product: normalizeFetchedProduct(product), warnings };
}

async function setProductArchived(
  config: ReturnType<typeof getSupabaseConfig>,
  productId: string,
): Promise<{ product: ProductRow; warnings: string[] }> {
  await fetchProductById(config, productId);
  return patchProductById(config, productId, { status: "archived", active: false });
}

async function setProductRestored(
  config: ReturnType<typeof getSupabaseConfig>,
  productId: string,
): Promise<{ product: ProductRow; warnings: string[] }> {
  await fetchProductById(config, productId);
  return patchProductById(config, productId, { status: "active", active: true });
}

async function fetchProductVariantsForDelete(
  config: ReturnType<typeof getSupabaseConfig>,
  productId: string,
): Promise<ProductVariantRow[]> {
  return fetchVariantRows(config, [productId], false);
}

async function productHasOrderHistory(
  config: ReturnType<typeof getSupabaseConfig>,
  productId: string,
  variantIds: string[],
): Promise<boolean> {
  const byProduct = await supabaseRequest(
    config,
    `/rest/v1/order_items?product_id=eq.${encodeURIComponent(productId)}&select=id&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  if (Array.isArray(byProduct) && byProduct.length > 0) return true;
  if (variantIds.length === 0) return false;

  const encodedIds = variantIds.map(id => encodeURIComponent(id)).join(",");
  const byVariant = await supabaseRequest(
    config,
    `/rest/v1/order_items?variant_id=in.(${encodedIds})&select=id&limit=1`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(byVariant) && byVariant.length > 0;
}

function productImageStoragePath(config: ReturnType<typeof getSupabaseConfig>, imageUrl: string): string | null {
  const value = imageUrl.trim();
  if (!value) return null;
  if (value.startsWith("products/")) return value;

  try {
    const url = new URL(value);
    const supabaseUrl = new URL(config.url);
    if (url.host !== supabaseUrl.host) return null;

    const marker = "/storage/v1/object/public/product-images/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

async function deleteProductImages(
  config: ReturnType<typeof getSupabaseConfig>,
  images: string[],
): Promise<string[]> {
  const paths = [...new Set(images.map(image => productImageStoragePath(config, image)).filter((path): path is string => !!path))];
  if (paths.length === 0) return [];

  const response = await fetch(`${config.url}/storage/v1/object/product-images`, {
    method: "DELETE",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    return [`Storage delete failed: ${errorMessage(payload, response.statusText || "Storage delete failed.")}`];
  }
  return [];
}

router.get("/products", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const dataset = await fetchProductDataset(config, "public");
    setPublicReadCache(res);
    return res.json(dataset);
  } catch (err) {
    const status = getErrorStatus(err);
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
    const requestedStatus = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "";
    const includeArchived = req.query.includeArchived === "true";
    const filter: ProductFilter =
      requestedStatus === "active" || requestedStatus === "draft" || requestedStatus === "archived"
        ? requestedStatus
        : requestedStatus === "all" || includeArchived
          ? "all"
          : "admin-default";
    const dataset = await fetchProductDataset(config, filter);
    req.log.info({ admin_user_id: adminUserId, products: dataset.products.length }, "admin products fetched");
    return res.json(dataset);
  } catch (err) {
    const status = getErrorStatus(err);
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
    const status = getErrorStatus(err);
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
    const nextStatus = parseProductStatus(status);
    if (!nextStatus) {
      return res.status(400).json({ error: "INVALID_PRODUCT_STATUS", message: "Product status must be active, draft, or archived." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    const body: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "archived") body.active = false;
    if (nextStatus === "active") body.active = true;
    const result = await patchProductById(config, req.params.id, body);

    req.log.info({ admin_user_id: adminUserId, product_id: req.params.id, status: nextStatus }, "product status updated");
    return res.json({ ok: true, product: result.product, warnings: result.warnings });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Product status update failed.";
    req.log.error({ err: message, status }, "product status update failed");
    return res.status(status).json({ error: "PRODUCT_STATUS_FAILED", message });
  }
});

router.post("/admin/products/:id/archive", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to archive products." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    const result = await setProductArchived(config, req.params.id);
    req.log.info({ admin_user_id: adminUserId, product_id: req.params.id }, "product archived");
    return res.json({
      ok: true,
      action: "archived",
      product: result.product,
      warnings: result.warnings,
      message: "Product archived.",
    });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Product archive failed.";
    req.log.error({ err: message, status }, "product archive failed");
    return res.status(status).json({ error: status === 404 ? "PRODUCT_NOT_FOUND" : "PRODUCT_ARCHIVE_FAILED", message });
  }
});

router.post("/admin/products/:id/restore", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to restore products." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    const result = await setProductRestored(config, req.params.id);
    req.log.info({ admin_user_id: adminUserId, product_id: req.params.id }, "product restored");
    return res.json({
      ok: true,
      action: "restored",
      product: result.product,
      warnings: result.warnings,
      message: "Product restored.",
    });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Product restore failed.";
    req.log.error({ err: message, status }, "product restore failed");
    return res.status(status).json({ error: status === 404 ? "PRODUCT_NOT_FOUND" : "PRODUCT_RESTORE_FAILED", message });
  }
});

router.delete("/admin/products/:id", async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const token = getBearerToken(req.header("authorization"));
    if (!token) {
      return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to delete products." });
    }

    const adminUserId = await requireAdminUserId(config, token);
    const product = await fetchProductById(config, req.params.id);
    const variants = await fetchProductVariantsForDelete(config, req.params.id);
    const hasOrderHistory = await productHasOrderHistory(config, req.params.id, variants.map(variant => variant.id));

    if (hasOrderHistory) {
      const archived = await setProductArchived(config, req.params.id);
      req.log.info({ admin_user_id: adminUserId, product_id: req.params.id }, "product archived instead of deleted because order history exists");
      return res.json({
        ok: true,
        action: "archived",
        orderHistory: true,
        product: archived.product,
        warnings: archived.warnings,
        message: "Product archived because it has order history.",
      });
    }

    await supabaseRequest(config, `/rest/v1/product_variants?product_id=eq.${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    await supabaseRequest(config, `/rest/v1/products?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    const storageWarnings = await deleteProductImages(config, parseImages(product.images));

    req.log.info({ admin_user_id: adminUserId, product_id: req.params.id, storage_warnings: storageWarnings.length }, "product permanently deleted");
    return res.json({
      ok: true,
      action: "deleted",
      storageWarnings,
      message: storageWarnings.length > 0
        ? "Product permanently deleted. Some storage files could not be removed."
        : "Product permanently deleted.",
    });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Product delete failed.";
    req.log.error({ err: message, status }, "product delete failed");
    return res.status(status).json({ error: status === 404 ? "PRODUCT_NOT_FOUND" : "PRODUCT_DELETE_FAILED", message });
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
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Inventory update failed.";
    req.log.error({ err: message, status }, "variant inventory update failed");
    return res.status(status).json({ error: "INVENTORY_UPDATE_FAILED", message });
  }
});

export default router;

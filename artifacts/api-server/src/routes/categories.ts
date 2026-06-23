import { Router, type IRouter } from "express";
import { adminAuthMiddleware, getErrorStatus, getSupabaseConfig, supabaseRequest, type AdminLocals } from "../lib/supabaseAdmin.js";
import { setNoStore } from "../lib/cacheHeaders.js";

const router: IRouter = Router();

const RESERVED_CATEGORY_SLUGS = new Set([
  "custom-design",
  "admin",
  "api",
  "checkout",
  "cart",
  "login",
  "signup",
]);

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  display_name?: string | null;
  cover_image_url: string | null;
  cover_image?: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

function normalizeCategory(row: Record<string, any>): CategoryRow {
  const name = String(row.name || row.display_name || "");
  return {
    ...row,
    id: String(row.id),
    slug: String(row.slug || slugify(name)),
    name,
    display_name: row.display_name ?? name,
    cover_image_url: row.cover_image_url ?? row.cover_image ?? null,
    cover_image: row.cover_image ?? row.cover_image_url ?? null,
    active: row.active !== false,
    sort_order: Number(row.sort_order) || 0,
    created_at: row.created_at || new Date().toISOString(),
  };
}

function legacyCategoryBody(category: Record<string, unknown>): Record<string, unknown> {
  return {
    name: category["name"],
    display_name: category["name"],
    cover_image: category["cover_image_url"] ?? category["cover_image"] ?? null,
    active: category["active"],
    sort_order: category["sort_order"],
    ...(category["created_at"] ? { created_at: category["created_at"] } : {}),
  };
}

function isLegacyCategorySchemaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return message.includes("slug") ||
    message.includes("cover_image_url") ||
    message.includes("cover_image") ||
    message.includes("display_name") ||
    message.includes("schema cache") ||
    message.includes("could not find");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanCategory(body: Record<string, unknown>, existing?: Partial<CategoryRow>) {
  const rawName = typeof body["name"] === "string" ? body["name"].trim().replace(/\s+/g, " ") : existing?.name ?? "";
  if (!rawName) {
    throw Object.assign(new Error("Category name is required."), { status: 400 });
  }
  if (rawName.length > 80) {
    throw Object.assign(new Error("Category name is too long."), { status: 400 });
  }

  const rawSlug = typeof body["slug"] === "string" && body["slug"].trim() ? body["slug"].trim() : existing?.slug || rawName;
  const slug = slugify(rawSlug);
  if (!slug) {
    throw Object.assign(new Error("Category slug is required."), { status: 400 });
  }
  if (RESERVED_CATEGORY_SLUGS.has(slug)) {
    throw Object.assign(new Error("This category slug is reserved."), { status: 400 });
  }

  return {
    slug,
    name: rawName,
    cover_image_url: typeof body["cover_image_url"] === "string"
      ? body["cover_image_url"].trim() || null
      : typeof body["cover_image"] === "string"
        ? body["cover_image"].trim() || null
        : existing?.cover_image_url ?? null,
    active: body["active"] === undefined ? existing?.active !== false : body["active"] === true,
    sort_order: Math.max(1, Math.round(Number(body["sort_order"] ?? existing?.sort_order ?? 1)) || 1),
  };
}

function cacheBustImageUrl(value: string | null): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return value;
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}v=${Date.now()}`;
}

function canonicalCategoryBody(category: Record<string, unknown>): Record<string, unknown> {
  return {
    name: category["name"],
    slug: category["slug"],
    cover_image_url: category["cover_image_url"] ?? null,
    active: category["active"],
    sort_order: category["sort_order"],
    ...(category["created_at"] ? { created_at: category["created_at"] } : {}),
  };
}

async function fetchCategories(config: ReturnType<typeof getSupabaseConfig>): Promise<CategoryRow[]> {
  const rows = await supabaseRequest(config, "/rest/v1/categories?select=*&order=sort_order.asc,created_at.asc", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows.map(row => normalizeCategory(row as Record<string, any>)) : [];
}

async function findCategoryByNameOrSlug(
  config: ReturnType<typeof getSupabaseConfig>,
  name: string,
  slug: string,
): Promise<CategoryRow | null> {
  const normalizedName = name.trim().toLowerCase();
  const normalizedSlug = slug.trim().toLowerCase();
  const rows = await fetchCategories(config);
  return rows.find(row =>
    row.name.trim().toLowerCase() === normalizedName ||
    row.slug.trim().toLowerCase() === normalizedSlug
  ) ?? null;
}

async function patchCategory(
  config: ReturnType<typeof getSupabaseConfig>,
  id: string,
  category: Record<string, unknown>,
): Promise<CategoryRow | null> {
  let rows;
  try {
    rows = await supabaseRequest(config, `/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(canonicalCategoryBody(category)),
    });

    try {
      await supabaseRequest(config, `/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(legacyCategoryBody(category)),
      });
    } catch (err) {
      if (!isLegacyCategorySchemaError(err)) throw err;
    }
  } catch (err) {
    if (!isLegacyCategorySchemaError(err)) throw err;
    rows = await supabaseRequest(config, `/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(legacyCategoryBody(category)),
    });
  }

  return Array.isArray(rows) && rows[0] ? normalizeCategory(rows[0] as Record<string, any>) : null;
}

async function getCategory(config: ReturnType<typeof getSupabaseConfig>, id: string): Promise<CategoryRow | null> {
  const rows = await supabaseRequest(config, `/rest/v1/categories?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) && rows[0] ? normalizeCategory(rows[0] as Record<string, any>) : null;
}

router.get("/categories", async (_req, res) => {
  try {
    const config = getSupabaseConfig();
    const rows = await supabaseRequest(config, "/rest/v1/categories?select=*&active=eq.true&order=sort_order.asc,created_at.asc", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    setNoStore(res);
    return res.json({ categories: Array.isArray(rows) ? rows.map(row => normalizeCategory(row as Record<string, any>)) : [] });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Categories could not be loaded.";
    return res.status(status).json({ error: "CATEGORIES_FETCH_FAILED", message });
  }
});

router.get("/admin/categories", adminAuthMiddleware, async (_req, res: any) => {
  try {
    const { supabaseConfig } = res.locals as AdminLocals;
    return res.json({ categories: await fetchCategories(supabaseConfig) });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Categories could not be loaded.";
    return res.status(status).json({ error: "CATEGORIES_FETCH_FAILED", message });
  }
});

router.post("/admin/categories", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const category = {
      id: globalThis.crypto?.randomUUID?.(),
      ...cleanCategory(req.body ?? {}),
      created_at: new Date().toISOString(),
    };
    const existing = await findCategoryByNameOrSlug(supabaseConfig, category.name, category.slug);
    if (existing) {
      return res.status(409).json({ error: "CATEGORY_EXISTS", message: "Category already exists." });
    }

    let rows;
    try {
      rows = await supabaseRequest(supabaseConfig, "/rest/v1/categories?on_conflict=slug", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(canonicalCategoryBody(category)),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (message.includes("categories_name_allowed")) {
        return res.status(500).json({
          error: "CATEGORY_SCHEMA_REQUIRES_MIGRATION",
          message: "Run artifacts/swear/supabase-flexible-categories-migration.sql to enable flexible product categories.",
        });
      }
      if (message.includes("duplicate") || message.includes("categories_name_key") || message.includes("categories_slug_key")) {
        return res.status(409).json({ error: "CATEGORY_EXISTS", message: "Category already exists." });
      }
      if (!isLegacyCategorySchemaError(err)) throw err;
      rows = await supabaseRequest(supabaseConfig, "/rest/v1/categories", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(legacyCategoryBody(category)),
      });
    }
    req.log.info({ admin_user_id: adminUserId, slug: category.slug }, "category saved");
    return res.json({ ok: true, category: Array.isArray(rows) && rows[0] ? normalizeCategory(rows[0] as Record<string, any>) : category });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Category could not be saved.";
    req.log.error({ err: message, status }, "category save failed");
    return res.status(status).json({ error: "CATEGORY_SAVE_FAILED", message });
  }
});

router.patch("/admin/categories/:id", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const categoryId = String(req.params.id);
    const existing = await getCategory(supabaseConfig, categoryId);
    if (!existing) return res.status(404).json({ error: "CATEGORY_NOT_FOUND", message: "Category was not found." });
    const category = cleanCategory(req.body ?? {}, existing);
    const duplicate = await findCategoryByNameOrSlug(supabaseConfig, category.name, category.slug);
    if (duplicate && duplicate.id !== categoryId) {
      return res.status(409).json({ error: "CATEGORY_EXISTS", message: "Category already exists." });
    }
    const updated = await patchCategory(supabaseConfig, categoryId, category);
    req.log.info({ admin_user_id: adminUserId, category_id: categoryId }, "category updated");
    return res.json({ ok: true, category: updated });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Category could not be updated.";
    req.log.error({ err: message, status }, "category update failed");
    return res.status(status).json({ error: "CATEGORY_UPDATE_FAILED", message });
  }
});

router.post("/admin/categories/:id/deactivate", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const categoryId = String(req.params.id);
    const existing = await getCategory(supabaseConfig, categoryId);
    if (!existing) return res.status(404).json({ error: "CATEGORY_NOT_FOUND", message: "Category was not found." });
    const updated = await patchCategory(supabaseConfig, categoryId, { ...existing, active: false });
    req.log.info({ admin_user_id: adminUserId, category_id: categoryId }, "category deactivated");
    return res.json({ ok: true, category: updated });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Category could not be deactivated.";
    req.log.error({ err: message, status }, "category deactivate failed");
    return res.status(status).json({ error: "CATEGORY_DEACTIVATE_FAILED", message });
  }
});

router.post("/admin/categories/:id/restore", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const categoryId = String(req.params.id);
    const existing = await getCategory(supabaseConfig, categoryId);
    if (!existing) return res.status(404).json({ error: "CATEGORY_NOT_FOUND", message: "Category was not found." });
    const updated = await patchCategory(supabaseConfig, categoryId, { ...existing, active: true });
    req.log.info({ admin_user_id: adminUserId, category_id: categoryId }, "category restored");
    return res.json({ ok: true, category: updated });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Category could not be restored.";
    req.log.error({ err: message, status }, "category restore failed");
    return res.status(status).json({ error: "CATEGORY_RESTORE_FAILED", message });
  }
});

router.post("/admin/categories/:id/image", adminAuthMiddleware, async (req, res: any) => {
  try {
    const { supabaseConfig, adminUserId } = res.locals as AdminLocals;
    const categoryId = String(req.params.id);
    const existing = await getCategory(supabaseConfig, categoryId);
    if (!existing) return res.status(404).json({ error: "CATEGORY_NOT_FOUND", message: "Category was not found." });
    if (!("cover_image_url" in (req.body ?? {}))) {
      return res.status(400).json({ error: "CATEGORY_IMAGE_REQUIRED", message: "Category image URL is required." });
    }
    const coverImageUrl = typeof req.body?.cover_image_url === "string" ? cacheBustImageUrl(req.body.cover_image_url.trim() || null) : null;
    const rows = await patchCategory(supabaseConfig, categoryId, { ...existing, cover_image_url: coverImageUrl, cover_image: coverImageUrl });
    req.log.info({ admin_user_id: adminUserId, category_id: categoryId }, "category image updated");
    return res.json({ ok: true, category: rows });
  } catch (err) {
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : "Category image could not be updated.";
    req.log.error({ err: message, status }, "category image update failed");
    return res.status(status).json({ error: "CATEGORY_IMAGE_FAILED", message });
  }
});

export default router;

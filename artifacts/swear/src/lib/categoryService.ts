import { ALLOWED_CATEGORIES } from "@/data/products";
import { adminApiFetchJson, apiFetchJson } from "@/lib/apiClient";
import { SUPABASE_NOT_CONNECTED_MESSAGE, supabaseConfigured, useDevOrderMock } from "@/lib/supabase";

const CATEGORIES_KEY = "swear_categories";
const CATEGORIES_VERSION_KEY = "swear_categories_version";
const CATEGORIES_VERSION = "v3-fixed";
const CATEGORY_IMAGES_KEY = "swear_category_images";

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  cover_image_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

type CategoriesPayload = {
  categories?: CategoryRow[];
  category?: CategoryRow | null;
};

export type CategoryRecord = {
  id: string;
  slug: string;
  name: string;
  coverImageUrl?: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

export type CategoryInput = {
  id?: string;
  name: string;
  coverImageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shouldUseLocalCategories(): boolean {
  if (supabaseConfigured) return false;
  if (useDevOrderMock) return true;
  throw new Error(SUPABASE_NOT_CONNECTED_MESSAGE);
}

function rowToCategory(row: CategoryRow): CategoryRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    coverImageUrl: row.cover_image_url,
    active: row.active !== false,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
  };
}

function categoryToRow(input: CategoryInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    slug: slugify(input.name),
    cover_image_url: input.coverImageUrl?.trim() || null,
    active: input.active !== false,
    sort_order: Math.max(0, Math.round(Number(input.sortOrder) || 0)),
  };
}

function readLocalCategoryNames(): string[] {
  try {
    const version = localStorage.getItem(CATEGORIES_VERSION_KEY);
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (version === CATEGORIES_VERSION && stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(cat => (ALLOWED_CATEGORIES as readonly string[]).includes(cat));
      }
    }
  } catch {}
  const defaults = [...ALLOWED_CATEGORIES];
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(defaults));
  localStorage.setItem(CATEGORIES_VERSION_KEY, CATEGORIES_VERSION);
  return defaults;
}

function readLocalImages(): Record<string, string> {
  try {
    const stored = localStorage.getItem(CATEGORY_IMAGES_KEY);
    return stored ? JSON.parse(stored) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function writeLocalCategories(categories: CategoryRecord[]) {
  const activeNames = categories
    .filter(category => category.active)
    .map(category => category.name)
    .filter(name => (ALLOWED_CATEGORIES as readonly string[]).includes(name));
  const images = categories.reduce<Record<string, string>>((acc, category) => {
    if (category.coverImageUrl) acc[category.name] = category.coverImageUrl;
    return acc;
  }, {});

  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(activeNames));
  localStorage.setItem(CATEGORIES_VERSION_KEY, CATEGORIES_VERSION);
  localStorage.setItem(CATEGORY_IMAGES_KEY, JSON.stringify(images));
}

function getLocalCategories(includeInactive = false): CategoryRecord[] {
  const names = readLocalCategoryNames();
  const images = readLocalImages();
  const now = new Date(0).toISOString();
  const categories = (ALLOWED_CATEGORIES as readonly string[]).map((name, index) => ({
    id: slugify(name),
    slug: slugify(name),
    name,
    coverImageUrl: images[name] ?? null,
    active: names.includes(name),
    sortOrder: index,
    createdAt: now,
  }));
  return includeInactive ? categories : categories.filter(category => category.active);
}

export async function getCategoriesAsync(includeInactive = false, admin = false): Promise<CategoryRecord[]> {
  if (shouldUseLocalCategories()) return getLocalCategories(includeInactive);

  const payload = admin || includeInactive
    ? await adminApiFetchJson<CategoriesPayload>("/admin/categories", {}, "Failed to load categories.")
    : await apiFetchJson<CategoriesPayload>("/categories", {}, "Failed to load categories.");
  const categories = (payload.categories ?? []).map(rowToCategory);
  return includeInactive ? categories : categories.filter(category => category.active);
}

export async function getCategoryNamesAsync(admin = false): Promise<string[]> {
  const categories = await getCategoriesAsync(false, admin);
  return categories.map(category => category.name);
}

export async function saveCategory(input: CategoryInput): Promise<CategoryRecord> {
  const normalized = categoryToRow(input);

  if (shouldUseLocalCategories()) {
    const categories = getLocalCategories(true);
    const id = input.id || String(normalized.slug);
    const next: CategoryRecord = {
      id,
      slug: String(normalized.slug),
      name: String(normalized.name),
      coverImageUrl: normalized.cover_image_url as string | null,
      active: normalized.active !== false,
      sortOrder: Number(normalized.sort_order) || 0,
      createdAt: categories.find(category => category.id === id)?.createdAt || new Date().toISOString(),
    };
    const updated = categories.some(category => category.id === id)
      ? categories.map(category => category.id === id ? next : category)
      : [...categories, next];
    writeLocalCategories(updated);
    return next;
  }

  const payload = input.id
    ? await adminApiFetchJson<CategoriesPayload>(
        `/admin/categories/${encodeURIComponent(input.id)}`,
        { method: "PATCH", body: JSON.stringify(normalized) },
        "Failed to update category."
      )
    : await adminApiFetchJson<CategoriesPayload>(
        "/admin/categories",
        { method: "POST", body: JSON.stringify(normalized) },
        "Failed to save category."
      );
  if (!payload.category) throw new Error("Category API did not return a category.");
  return rowToCategory(payload.category);
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  if (shouldUseLocalCategories()) {
    const categories = getLocalCategories(true).map(category =>
      category.id === id ? { ...category, active } : category
    );
    writeLocalCategories(categories);
    return;
  }

  if (!active) {
    await adminApiFetchJson(
      `/admin/categories/${encodeURIComponent(id)}/deactivate`,
      { method: "POST" },
      "Failed to deactivate category."
    );
    return;
  }

  await adminApiFetchJson(
    `/admin/categories/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify({ active: true }) },
    "Failed to activate category."
  );
}

export async function saveCategoryImage(id: string, coverImageUrl: string | null): Promise<CategoryRecord> {
  if (shouldUseLocalCategories()) {
    const categories = getLocalCategories(true);
    const updated = categories.map(category =>
      category.id === id ? { ...category, coverImageUrl } : category
    );
    writeLocalCategories(updated);
    const category = updated.find(item => item.id === id);
    if (!category) throw new Error("Category was not found.");
    return category;
  }

  const payload = await adminApiFetchJson<CategoriesPayload>(
    `/admin/categories/${encodeURIComponent(id)}/image`,
    {
      method: "POST",
      body: JSON.stringify({ cover_image_url: coverImageUrl || "" }),
    },
    "Failed to update category image."
  );
  if (!payload.category) throw new Error("Category API did not return a category.");
  return rowToCategory(payload.category);
}

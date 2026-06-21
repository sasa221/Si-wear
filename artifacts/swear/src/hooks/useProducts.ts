import {
  ALLOWED_CATEGORIES,
  defaultProducts,
  defaultCategories,
  findVariant,
  getActiveVariants,
  isUuid,
  migrateProduct,
  normalizeVariantOption,
  normalizeProduct,
  Product,
  ProductVariant,
} from "@/data/products";
import { getSupabaseAccessToken, supabase, supabaseConfigured } from "@/lib/supabase";
import { apiUrl } from "@/lib/apiConfig";
import type { OrderItem } from "@/lib/types";

const PRODUCTS_VERSION = "v6-uuid-variants";
const CATEGORIES_VERSION = "v3-fixed";
const CART_ITEM_UPDATED_MESSAGE = "This item was updated. Please remove it and add it again.";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price_egp: number;
  description: string;
  images: string[] | string | null;
  status: Product["status"];
  active?: boolean | null;
  is_new?: boolean | null;
  is_best_seller?: boolean | null;
  created_at: string;
};

type ProductVariantRow = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  stock: number;
  sku: string | null;
  active: boolean;
  created_at: string;
};

type ProductApiPayload = {
  ok?: boolean;
  action?: "archived" | "deleted" | "restored";
  orderHistory?: boolean;
  product?: ProductRow;
  products?: ProductRow[];
  variants?: ProductVariantRow[];
  storageWarnings?: string[];
  warnings?: string[];
  message?: string;
  error?: string;
};

type ProductStatusFilter = "all" | "active" | "draft" | "archived";

type ProductLoadOptions = {
  activeOnly?: boolean;
  admin?: boolean;
  status?: ProductStatusFilter;
  includeArchived?: boolean;
};

export type ProductDeleteResult = {
  action: "archived" | "deleted";
  orderHistory?: boolean;
  message?: string;
  storageWarnings?: string[];
};

export interface StockCheckItem {
  product: Product;
  variantId?: string;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
}

export function getProducts(): Product[] {
  try {
    const version = localStorage.getItem("swear_products_version");
    if (version === PRODUCTS_VERSION) {
      const stored = localStorage.getItem("swear_products");
      if (stored) return (JSON.parse(stored) as Product[]).map(normalizeProduct);
    }
    const stored = localStorage.getItem("swear_products");
    if (stored) {
      const migrated = (JSON.parse(stored) as Product[]).map(migrateProduct);
      saveProducts(migrated);
      return migrated;
    }
  } catch {}
  localStorage.setItem("swear_products", JSON.stringify(defaultProducts));
  localStorage.setItem("swear_products_version", PRODUCTS_VERSION);
  return defaultProducts;
}

export function getCategories(): string[] {
  try {
    const version = localStorage.getItem("swear_categories_version");
    if (version === CATEGORIES_VERSION) {
      const stored = localStorage.getItem("swear_categories");
      if (stored) return (JSON.parse(stored) as string[]).filter(cat => ALLOWED_CATEGORIES.includes(cat as any));
    }
  } catch {}
  localStorage.setItem("swear_categories", JSON.stringify(defaultCategories));
  localStorage.setItem("swear_categories_version", CATEGORIES_VERSION);
  return defaultCategories;
}

export function saveProducts(products: Product[]): void {
  localStorage.setItem("swear_products", JSON.stringify(products.map(normalizeProduct)));
  localStorage.setItem("swear_products_version", PRODUCTS_VERSION);
}

export function saveCategories(categories: string[]): void {
  const fixed = categories.filter(cat => ALLOWED_CATEGORIES.includes(cat as any));
  localStorage.setItem("swear_categories", JSON.stringify(fixed));
  localStorage.setItem("swear_categories_version", CATEGORIES_VERSION);
}

export function getCategoryImages(): Record<string, string> {
  try {
    const stored = localStorage.getItem("swear_category_images");
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

export function saveCategoryImages(images: Record<string, string>): void {
  localStorage.setItem("swear_category_images", JSON.stringify(images));
}

async function readApiPayload(res: Response): Promise<ProductApiPayload> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) as ProductApiPayload : {};
  } catch {
    return { message: text };
  }
}

function apiMessage(payload: ProductApiPayload, fallback: string): string {
  return typeof payload.message === "string" && payload.message
    ? payload.message
    : typeof payload.error === "string" && payload.error
      ? payload.error
      : fallback;
}

function groupApiVariantsByProduct(rows: ProductVariantRow[] = []): Map<string, ProductVariant[]> {
  return groupVariantsByProduct(rows);
}

async function fetchProductsFromApi(options: ProductLoadOptions): Promise<Product[]> {
  const admin = options.admin === true;
  const activeOnly = options.activeOnly !== false;
  const token = getSupabaseAccessToken();
  const adminParams = new URLSearchParams();
  if (options.status && options.status !== "all") adminParams.set("status", options.status);
  if (options.includeArchived) adminParams.set("includeArchived", "true");
  const adminQuery = adminParams.toString();
  const path = admin
    ? `/admin/products${adminQuery ? `?${adminQuery}` : ""}`
    : `/products?activeOnly=${activeOnly ? "true" : "false"}`;

  if (admin && !token) {
    throw new Error("Admin login is required to load products. Sign in again.");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      headers: admin && token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error("Product API is not reachable. Start the API server and try again.");
  }

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(apiMessage(payload, "Failed to load products."));
  }

  if (payload.warnings?.length) {
    console.warn("[S! Wear] Product API warnings:", payload.warnings.join(" "));
  }

  const variantsByProduct = groupApiVariantsByProduct(payload.variants ?? []);
  return (payload.products ?? []).map(row => rowToProduct(row, variantsByProduct.get(row.id) ?? []));
}

async function productApiRequest(
  path: string,
  init: RequestInit,
  fallback: string
): Promise<ProductApiPayload> {
  const token = getSupabaseAccessToken();
  if (!token) throw new Error("Admin login is required. Sign in again.");

  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    response = await fetch(apiUrl(path), {
      ...init,
      headers,
    });
  } catch {
    throw new Error("Product API is not reachable. Start the API server and try again.");
  }

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(apiMessage(payload, fallback));
  }
  return payload;
}

async function productApiPatch(path: string, body: Record<string, unknown>, fallback: string): Promise<void> {
  await productApiRequest(
    path,
    { method: "PATCH", body: JSON.stringify(body) },
    fallback
  );
}

function findCartVariant(products: Product[], item: StockCheckItem) {
  const product = products.find(p => p.id === item.product.id) ?? item.product;
  return getActiveVariants(product).find(variant => variant.id === item.variantId) ??
    findVariant(product, item.selectedSize, item.selectedColor);
}

function groupItemsByVariant(items: StockCheckItem[]): StockCheckItem[] {
  const grouped = new Map<string, StockCheckItem>();

  for (const item of items) {
    const key = item.variantId || `${item.product.id}:${item.selectedColor}:${item.selectedSize}`;
    const existing = grouped.get(key);
    grouped.set(key, existing ? { ...existing, quantity: existing.quantity + item.quantity } : item);
  }

  return [...grouped.values()];
}

function rowToVariant(row: Record<string, any>): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    size: row.size,
    color: row.color,
    stock: Number(row.stock) || 0,
    sku: row.sku ?? undefined,
    active: row.active !== false,
    createdAt: row.created_at,
  };
}

function parseImages(value: ProductRow["images"]): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function rowToProduct(row: ProductRow, variants: ProductVariant[] = []): Product {
  return normalizeProduct({
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: Number(row.price_egp) || 0,
    category: row.category,
    description: row.description || "",
    images: parseImages(row.images),
    status: row.status || "active",
    variants,
    sizes: [],
    colors: [],
    isNew: row.is_new === true,
    isBestSeller: row.is_best_seller === true,
  });
}

function groupVariantsByProduct(rows: ProductVariantRow[]): Map<string, ProductVariant[]> {
  const grouped = new Map<string, ProductVariant[]>();
  for (const row of rows) {
    const variant = rowToVariant(row);
    grouped.set(row.product_id, [...(grouped.get(row.product_id) ?? []), variant]);
  }
  return grouped;
}

export async function getProductsAsync(options: ProductLoadOptions = {}): Promise<Product[]> {
  if (!supabaseConfigured || !supabase) {
    const localProducts = getProducts();
    return options.activeOnly
      ? localProducts.filter(product => product.status === "active")
      : localProducts;
  }

  if (options.admin) {
    return fetchProductsFromApi({ ...options, activeOnly: false, admin: true });
  }

  return fetchProductsFromApi({ ...options, activeOnly: options.activeOnly !== false });
}

function requireProductApi(): void {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Product API is required for admin product changes.");
  }
}

export async function setProductStatusAsync(productId: string, status: Product["status"]): Promise<void> {
  requireProductApi();
  await productApiPatch(
    `/admin/products/${encodeURIComponent(productId)}/status`,
    { status },
    "Failed to update product status."
  );
}

export async function archiveProductAsync(productId: string): Promise<void> {
  requireProductApi();
  await productApiRequest(
    `/admin/products/${encodeURIComponent(productId)}/archive`,
    { method: "POST" },
    "Failed to archive product."
  );
}

export async function restoreProductAsync(productId: string): Promise<void> {
  requireProductApi();
  await productApiRequest(
    `/admin/products/${encodeURIComponent(productId)}/restore`,
    { method: "POST" },
    "Failed to restore product."
  );
}

export async function deleteProductAsync(productId: string): Promise<ProductDeleteResult> {
  requireProductApi();
  const payload = await productApiRequest(
    `/admin/products/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
    "Failed to delete product."
  );

  return {
    action: payload.action === "deleted" ? "deleted" : "archived",
    orderHistory: payload.orderHistory === true,
    message: payload.message,
    storageWarnings: payload.storageWarnings,
  };
}

export async function updateVariantInventoryAsync(
  variantId: string,
  update: { stock?: number; active?: boolean }
): Promise<void> {
  requireProductApi();
  await productApiPatch(
    `/admin/products/variants/${encodeURIComponent(variantId)}`,
    update,
    "Failed to update inventory."
  );
}

export async function getProductByIdOrSlug(idOrSlug: string): Promise<Product | null> {
  const products = await getProductsAsync({ activeOnly: true });
  return products.find(product => product.id === idOrSlug || product.slug === idOrSlug) ?? null;
}

async function getRemoteVariant(variantId: string | undefined): Promise<ProductVariant | null> {
  if (!supabaseConfigured || !supabase || !variantId || !isUuid(variantId)) return null;

  const { data, error } = await supabase
    .from("product_variants")
    .select("id,product_id,size,color,stock,sku,active,created_at")
    .eq("id", variantId);

  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row ? rowToVariant(row) : null;
}

async function getRemoteProductStatus(productId: string | undefined): Promise<string | null> {
  if (!supabaseConfigured || !supabase || !productId || !isUuid(productId)) return null;

  const { data, error } = await supabase
    .from("products")
    .select("id,status")
    .eq("id", productId);

  if (error) throw new Error(error.message);
  return (data?.[0] as { status?: string } | undefined)?.status ?? null;
}

function cartItemNeedsRefresh(item: StockCheckItem): boolean {
  return !item.variantId || !isUuid(item.variantId);
}

function variantMatchesCartSelection(variant: ProductVariant, item: StockCheckItem): boolean {
  return normalizeVariantOption(variant.size) === normalizeVariantOption(item.selectedSize) &&
    normalizeVariantOption(variant.color) === normalizeVariantOption(item.selectedColor);
}

export async function validateCartStock(items: StockCheckItem[]): Promise<string | null> {
  if (supabaseConfigured && supabase) {
    const products = await fetchProductsFromApi({ activeOnly: true });

    for (const item of groupItemsByVariant(items)) {
      if (cartItemNeedsRefresh(item)) return CART_ITEM_UPDATED_MESSAGE;

      const product = products.find(p => p.id === item.product.id);
      if (!product || product.status !== "active") {
        return `${item.product.name} is not available for ordering.`;
      }
      const variant = product.variants.find(row => row.id === item.variantId);
      if (!variant) return CART_ITEM_UPDATED_MESSAGE;
      if (variant.productId !== item.product.id || !variantMatchesCartSelection(variant, item)) {
        return CART_ITEM_UPDATED_MESSAGE;
      }
      if (!variant.active) {
        return `${item.product.name} (${item.selectedSize} / ${item.selectedColor}) is no longer available.`;
      }
      if (variant.stock < item.quantity) {
        return `${item.product.name} (${variant.size} / ${variant.color}) has only ${variant.stock} left.`;
      }
    }

    return null;
  }

  const products = getProducts();

  for (const item of groupItemsByVariant(items)) {
    if (cartItemNeedsRefresh(item)) return CART_ITEM_UPDATED_MESSAGE;
    const product = products.find(p => p.id === item.product.id) ?? item.product;
    if (product.status !== "active") {
      return `${product.name} is not available for ordering.`;
    }
    const variant = findCartVariant(products, item);
    if (!variant) {
      return `${item.product.name} (${item.selectedSize} / ${item.selectedColor}) is no longer available.`;
    }
    if (variant.stock < item.quantity) {
      return `${item.product.name} (${variant.size} / ${variant.color}) has only ${variant.stock} left.`;
    }
  }

  return null;
}

async function decrementRemoteStock(items: StockCheckItem[]): Promise<void> {
  if (!supabaseConfigured || !supabase) return;

  for (const item of groupItemsByVariant(items)) {
    if (cartItemNeedsRefresh(item)) throw new Error(CART_ITEM_UPDATED_MESSAGE);
    const variant = await getRemoteVariant(item.variantId);
    if (!variant || variant.productId !== item.product.id || !variantMatchesCartSelection(variant, item)) {
      throw new Error(CART_ITEM_UPDATED_MESSAGE);
    }
    if (!variant.active) {
      throw new Error(`${item.product.name} is no longer available.`);
    }
    if (variant.stock < item.quantity) {
      throw new Error(`${item.product.name} (${variant.size} / ${variant.color}) has only ${variant.stock} left.`);
    }

    const { error } = await supabase
      .from("product_variants")
      .update({ stock: Math.max(0, variant.stock - item.quantity) })
      .eq("id", variant.id);

    if (error) throw new Error(error.message);
  }
}

function decrementLocalStock(items: StockCheckItem[]): void {
  const products = getProducts();
  const updated = products.map(product => ({
    ...product,
    variants: product.variants.map(variant => {
      const orderedQty = items
        .filter(item => {
          const sameProduct = item.product.id === product.id;
          const sameVariant = item.variantId
            ? item.variantId === variant.id
            : item.selectedSize === variant.size && item.selectedColor === variant.color;
          return sameProduct && sameVariant;
        })
        .reduce((sum, item) => sum + item.quantity, 0);

      if (orderedQty <= 0) return variant;
      return { ...variant, stock: Math.max(0, variant.stock - orderedQty) };
    }),
  }));

  saveProducts(updated);
}

export async function decrementCartStock(items: StockCheckItem[]): Promise<void> {
  await decrementRemoteStock(items);
  decrementLocalStock(items);
}

async function restoreRemoteStock(items: OrderItem[]): Promise<void> {
  if (!supabaseConfigured || !supabase) return;

  for (const item of items) {
    const variant = await getRemoteVariant(item.variantId);
    if (!variant || !variant.active) continue;

    const { error } = await supabase
      .from("product_variants")
      .update({ stock: variant.stock + item.quantity })
      .eq("id", variant.id);

    if (error) throw new Error(error.message);
  }
}

function restoreLocalStock(items: OrderItem[]): void {
  const products = getProducts();
  const updated = products.map(product => ({
    ...product,
    variants: product.variants.map(variant => {
      const restoreQty = items
        .filter(item => item.productId === product.id && item.variantId === variant.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      return restoreQty > 0 ? { ...variant, stock: variant.stock + restoreQty } : variant;
    }),
  }));

  saveProducts(updated);
}

export async function restoreOrderStock(items: OrderItem[]): Promise<void> {
  await restoreRemoteStock(items);
  restoreLocalStock(items);
}

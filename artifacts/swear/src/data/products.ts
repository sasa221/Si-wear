export const PRODUCT_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
export const ALLOWED_CATEGORIES = ["T-Shirts", "Shirts", "Pants"] as const;

export type ProductStatus = "active" | "draft";
export type InventoryStatus = "active" | "draft" | "out_of_stock" | "low_stock";

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  stock: number;
  sku?: string;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  category: string;
  description: string;
  images: string[];
  status: ProductStatus;
  variants: ProductVariant[];
  sizes: string[];
  colors: string[];
  isNew?: boolean;
  isBestSeller?: boolean;
}

export const defaultCategories: string[] = [...ALLOWED_CATEGORIES];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SEED_PRODUCT_IDS: Record<string, string> = {
  "prod-oversized-heavy-cotton-tshirt": "11111111-1111-4111-8111-111111111111",
  "prod-custom-design-tshirt": "22222222-2222-4222-8222-222222222222",
  "prod-boxy-fit-shirt": "33333333-3333-4333-8333-333333333333",
  "prod-wide-leg-pant": "44444444-4444-4444-8444-444444444444",
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableUuid(seed: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex = (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (Math.imul(h1 ^ h2, 2654435761) >>> 0).toString(16).padStart(8, "0") +
    (Math.imul(h2 ^ h1, 1597334677) >>> 0).toString(16).padStart(8, "0");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function isUuid(value: string | undefined): boolean {
  return !!value && UUID_RE.test(value);
}

export function createProductId(seed: string): string {
  if (isUuid(seed)) return seed;
  return SEED_PRODUCT_IDS[seed] ?? stableUuid(seed);
}

export function createVariantId(productId: string, color: string, size: string): string {
  return stableUuid(`${productId}:${slugify(color)}:${slugify(size)}`);
}

export function normalizeVariantOption(value: string): string {
  return value.trim().toLowerCase();
}

function makeVariants(
  productId: string,
  matrix: Record<string, Partial<Record<string, number>>>
): ProductVariant[] {
  const now = "2026-01-01T00:00:00.000Z";
  return Object.entries(matrix).flatMap(([color, sizes]) =>
    Object.entries(sizes).map(([size, stock]) => ({
      id: createVariantId(productId, color, size),
      productId,
      size,
      color,
      stock: Math.max(0, Number(stock) || 0),
      sku: `${productId}-${slugify(color)}-${slugify(size)}`.toUpperCase(),
      active: true,
      createdAt: now,
    }))
  );
}

export function normalizeProduct(product: Product): Product {
  const variants = (product.variants ?? []).map(variant => ({
    ...variant,
    id: isUuid(variant.id) ? variant.id : createVariantId(product.id, variant.color, variant.size),
    productId: variant.productId || product.id,
    stock: Math.max(0, Number(variant.stock) || 0),
    active: variant.active !== false,
    createdAt: variant.createdAt || new Date().toISOString(),
  }));
  return {
    ...product,
    slug: product.slug || slugify(product.name),
    status: product.status || "active",
    variants,
    sizes: getProductSizes({ ...product, variants }),
    colors: getProductColors({ ...product, variants }),
  };
}

export function migrateProduct(product: Partial<Product> & { id: string; name: string; price: number }): Product {
  const productId = createProductId(product.id);
  const legacySizes = product.sizes?.length ? product.sizes : ["M", "L"];
  const legacyColors = product.colors?.length ? product.colors : ["Black"];
  const variants = product.variants?.length
    ? product.variants.map(variant => ({
        ...variant,
        id: isUuid(variant.id) ? variant.id : createVariantId(productId, variant.color, variant.size),
        productId,
      }))
    : legacyColors.flatMap(color =>
        legacySizes.map(size => ({
          id: createVariantId(productId, color, size),
          productId,
          size,
          color,
          stock: 5,
          sku: `${productId}-${slugify(color)}-${slugify(size)}`.toUpperCase(),
          active: true,
          createdAt: new Date().toISOString(),
        }))
      );

  return normalizeProduct({
    id: productId,
    name: product.name,
    slug: product.slug || slugify(product.name),
    price: product.price,
    category: product.category || "T-Shirts",
    description: product.description || "",
    images: product.images || [],
    status: product.status || "active",
    variants,
    sizes: legacySizes,
    colors: legacyColors,
    isNew: product.isNew,
    isBestSeller: product.isBestSeller,
  });
}

export function getActiveVariants(product: { variants?: ProductVariant[] }): ProductVariant[] {
  return (product.variants ?? []).filter(variant => variant.active);
}

export function getProductSizes(product: Pick<Product, "variants">): string[] {
  return [...new Set(getActiveVariants(product).map(variant => variant.size))];
}

export function getProductColors(product: Pick<Product, "variants">): string[] {
  return [...new Set(getActiveVariants(product).map(variant => variant.color))];
}

export function getSizesForColor(product: Product, color: string): ProductVariant[] {
  const normalizedColor = normalizeVariantOption(color);
  return getActiveVariants(product).filter(variant => normalizeVariantOption(variant.color) === normalizedColor);
}

export function findVariant(product: Product, size: string, color: string): ProductVariant | undefined {
  const normalizedSize = normalizeVariantOption(size);
  const normalizedColor = normalizeVariantOption(color);
  return getActiveVariants(product).find(variant =>
    normalizeVariantOption(variant.size) === normalizedSize &&
    normalizeVariantOption(variant.color) === normalizedColor
  );
}

export function getTotalStock(product: Product): number {
  return getActiveVariants(product).reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);
}

export function getInventoryStatus(product: Product): InventoryStatus {
  if (product.status === "draft") return "draft";
  const stock = getTotalStock(product);
  if (stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "active";
}

export function getStockLabel(product: Product): string {
  const status = getInventoryStatus(product);
  if (status === "draft") return "Draft";
  if (status === "out_of_stock") return "Out of stock";
  if (status === "low_stock") return "Low stock";
  return "Active";
}

function makeProduct(product: Omit<Product, "sizes" | "colors">): Product {
  return normalizeProduct({ ...product, sizes: [], colors: [] });
}

export const defaultProducts: Product[] = [
  makeProduct({
    id: SEED_PRODUCT_IDS["prod-oversized-heavy-cotton-tshirt"],
    name: "Oversized Heavy Cotton T-Shirt",
    slug: "oversized-heavy-cotton-tshirt",
    price: 299,
    category: "T-Shirts",
    status: "active",
    description:
      "320GSM heavyweight cotton. Oversized street fit with dropped shoulders and a ribbed collar. Pre-washed for everyday comfort.",
    images: [
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=750&fit=crop",
    ],
    variants: makeVariants(SEED_PRODUCT_IDS["prod-oversized-heavy-cotton-tshirt"], {
      Black: { S: 5, M: 3, L: 0, XL: 2, "2XL": 1 },
      White: { S: 4, M: 0, L: 1, XL: 0, "2XL": 0 },
      Stone: { S: 2, M: 2, L: 3, XL: 1, "2XL": 0 },
    }),
    isNew: true,
    isBestSeller: true,
  }),
  makeProduct({
    id: SEED_PRODUCT_IDS["prod-boxy-fit-shirt"],
    name: "Boxy Fit Shirt",
    slug: "boxy-fit-shirt",
    price: 399,
    category: "Shirts",
    status: "active",
    description:
      "Premium cotton shirt with a boxy silhouette, dropped shoulders, and a clean open collar. Easy to layer or wear alone.",
    images: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1555274175-6cbf6f3b137b?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1516826957135-700dedea698c?w=600&h=750&fit=crop",
    ],
    variants: makeVariants(SEED_PRODUCT_IDS["prod-boxy-fit-shirt"], {
      Black: { S: 0, M: 4, L: 3, XL: 2, "2XL": 1 },
      Ivory: { S: 2, M: 2, L: 1, XL: 0, "2XL": 0 },
      Sage: { S: 1, M: 2, L: 2, XL: 1, "2XL": 0 },
    }),
    isBestSeller: true,
  }),
  makeProduct({
    id: SEED_PRODUCT_IDS["prod-wide-leg-pant"],
    name: "Wide Leg Pant",
    slug: "wide-leg-pant",
    price: 499,
    category: "Pants",
    status: "active",
    description:
      "Heavy twill wide-leg pant with a relaxed street silhouette, high waist, and practical pockets for everyday wear.",
    images: [
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=750&fit=crop",
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&h=750&fit=crop",
    ],
    variants: makeVariants(SEED_PRODUCT_IDS["prod-wide-leg-pant"], {
      Black: { S: 0, M: 3, L: 3, XL: 2, "2XL": 1 },
      Olive: { S: 1, M: 2, L: 2, XL: 1, "2XL": 0 },
      Stone: { S: 1, M: 1, L: 0, XL: 1, "2XL": 0 },
    }),
    isBestSeller: true,
  }),
];

export const products = defaultProducts;

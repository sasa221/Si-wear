import { defaultProducts, defaultCategories, Product } from "@/data/products";

const PRODUCTS_VERSION = "v2";
const CATEGORIES_VERSION = "v1";

export function getProducts(): Product[] {
  try {
    const version = localStorage.getItem("swear_products_version");
    if (version === PRODUCTS_VERSION) {
      const stored = localStorage.getItem("swear_products");
      if (stored) return JSON.parse(stored);
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
      if (stored) return JSON.parse(stored);
    }
  } catch {}
  localStorage.setItem("swear_categories", JSON.stringify(defaultCategories));
  localStorage.setItem("swear_categories_version", CATEGORIES_VERSION);
  return defaultCategories;
}

export function saveProducts(products: Product[]): void {
  localStorage.setItem("swear_products", JSON.stringify(products));
  localStorage.setItem("swear_products_version", PRODUCTS_VERSION);
}

export function saveCategories(categories: string[]): void {
  localStorage.setItem("swear_categories", JSON.stringify(categories));
  localStorage.setItem("swear_categories_version", CATEGORIES_VERSION);
}

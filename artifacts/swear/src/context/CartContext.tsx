import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "../data/products";
import { findVariant, migrateProduct } from "@/data/products";

export const CART_ITEM_UPDATED_MESSAGE = "This item was updated. Please remove it and add it again.";

export interface CartItem {
  product: Product;
  variantId: string;
  productId: string;
  productName: string;
  selectedSize: string;
  selectedColor: string;
  price: number;
  quantity: number;
  image: string;
  variantIssue?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size: string, color: string, variantId?: string) => void;
  updateQuantity: (productId: string, size: string, color: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function cartLineMatches(item: CartItem, productId: string, size: string, color: string, variantId?: string): boolean {
  if (variantId) return item.variantId === variantId;
  return item.product.id === productId &&
    item.selectedSize === size &&
    item.selectedColor === color;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("swear_cart");
    if (saved) {
      try {
        return (JSON.parse(saved) as CartItem[])
          .map(item => {
            const product = migrateProduct(item.product);
            const savedVariantId = typeof item.variantId === "string" ? item.variantId : "";
            const variant = product.variants.find(v => v.id === savedVariantId) ??
              findVariant(product, item.selectedSize, item.selectedColor);
            const variantId = variant?.id || "";
            return {
              ...item,
              product,
              variantId,
              productId: product.id,
              productName: item.productName || product.name,
              price: item.price || product.price,
              image: item.image || product.images[0] || "",
              variantIssue: variantId ? undefined : CART_ITEM_UPDATED_MESSAGE,
            };
          });
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("swear_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (newItem: CartItem) => {
    if (!newItem.variantId) return;
    setItems((prev) => {
      const existing = prev.find(
        (i) =>
          i.variantId === newItem.variantId
      );

      if (existing) {
        return prev.map((i) =>
          i === existing
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        );
      }

      return [...prev, newItem];
    });
  };

  const removeItem = (productId: string, size: string, color: string, variantId?: string) => {
    setItems((prev) =>
      prev.filter((i) => !cartLineMatches(i, productId, size, color, variantId))
    );
  };

  const updateQuantity = (
    productId: string,
    size: string,
    color: string,
    quantity: number,
    variantId?: string
  ) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((i) =>
        cartLineMatches(i, productId, size, color, variantId)
          ? { ...i, quantity }
          : i
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

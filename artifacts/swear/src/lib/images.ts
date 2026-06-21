import type { SyntheticEvent } from "react";

export const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&h=750&fit=crop&q=80";

export function getProductImage(images: string[] | undefined, index = 0): string {
  const image = images?.[index]?.trim();
  return image || FALLBACK_PRODUCT_IMAGE;
}

export function useFallbackImage(event: SyntheticEvent<HTMLImageElement, Event>): void {
  const img = event.currentTarget;
  if (img.src !== FALLBACK_PRODUCT_IMAGE) img.src = FALLBACK_PRODUCT_IMAGE;
}

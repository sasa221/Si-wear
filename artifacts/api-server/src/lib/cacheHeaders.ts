import type { Response } from "express";

const PUBLIC_READ_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

export function setPublicReadCache(res: Response): void {
  res.set("Cache-Control", PUBLIC_READ_CACHE);
}

export function setNoStore(res: Response): void {
  res.set("Cache-Control", "no-store");
}

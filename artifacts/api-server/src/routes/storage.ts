import express, { Router, type IRouter } from "express";

const router: IRouter = Router();
const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

function encodeStoragePath(path: string): string {
  return path.split("/").map(part => encodeURIComponent(part)).join("/");
}

function cleanStoragePath(value: string | undefined): string | null {
  const path = value?.trim().replace(/^\/+/, "");
  if (
    !path ||
    path.includes("..") ||
    path.endsWith("/") ||
    !(path.startsWith("products/") || path.startsWith("categories/"))
  ) return null;
  return path;
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
    throw Object.assign(new Error("Admin access is required to upload product images."), { status: 403 });
  }

  return authUser.id;
}

router.post(
  "/storage/product-images",
  express.raw({ type: ["image/*", "application/octet-stream"], limit: MAX_UPLOAD_BYTES }),
  async (req, res) => {
    try {
      const config = getSupabaseConfig();
      const token = getBearerToken(req.header("authorization"));
      if (!token) {
        return res.status(401).json({ error: "ADMIN_LOGIN_REQUIRED", message: "Admin login is required to upload images." });
      }

      const contentType = req.header("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
      if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
        return res.status(400).json({ error: "INVALID_IMAGE_TYPE", message: "Upload JPG, PNG, WebP, or GIF images only." });
      }

      const path = cleanStoragePath(req.header("x-storage-path"));
      if (!path) {
        return res.status(400).json({ error: "INVALID_STORAGE_PATH", message: "Invalid product image path." });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "EMPTY_UPLOAD", message: "Choose an image file to upload." });
      }

      const adminUserId = await requireAdminUserId(config, token);
      const uploadRes = await fetch(
        `${config.url}/storage/v1/object/${PRODUCT_IMAGES_BUCKET}/${encodeStoragePath(path)}`,
        {
          method: "POST",
          headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            "Content-Type": contentType,
            "x-upsert": "true",
          },
          body: req.body,
        },
      );

      const uploadPayload = await readJson(uploadRes);
      if (!uploadRes.ok) {
        return res.status(uploadRes.status).json({
          error: "STORAGE_UPLOAD_FAILED",
          message: errorMessage(uploadPayload, "Storage upload failed."),
        });
      }

      req.log.info({ admin_user_id: adminUserId, path }, "product image uploaded");
      return res.json({
        ok: true,
        path,
        publicUrl: `${config.url}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encodeStoragePath(path)}`,
      });
    } catch (err) {
      const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
      const message = err instanceof Error ? err.message : "Storage upload failed.";
      req.log.error({ err: message, status }, "product image upload failed");
      return res.status(status).json({ error: "STORAGE_UPLOAD_FAILED", message });
    }
  },
);

export default router;

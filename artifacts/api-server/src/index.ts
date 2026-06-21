import app from "./app";
import { logger } from "./lib/logger";

// Extract masked project ref from Supabase URL
function maskProjectRef(url: string | undefined): string {
  try {
    if (!url) return "missing";
    const u = new URL(url);
    const host = u.hostname; // e.g. abcde123.supabase.co
    const parts = host.split(".");
    const ref = parts[0] ?? "";
    if (ref.length <= 6) return `${ref.replace(/./g, "*")}.${parts.slice(1).join(".")}`;
    const start = ref.slice(0, 4);
    const end = ref.slice(-3);
    return `${start}...${end}.${parts.slice(1).join(".")}`;
  } catch {
    return "invalid-url";
  }
}

const rawPort = process.env["PORT"] || "5001";
const supabaseUrl = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const projectRef = maskProjectRef(supabaseUrl);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, supabase_project: projectRef }, "Server listening");
});

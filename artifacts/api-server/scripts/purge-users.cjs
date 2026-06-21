const fs = require("node:fs");
const path = require("node:path");

const KEEP_EMAIL = "admin2.siwear@gmail.com";
const CONFIRM_TOKEN = "DELETE_ALL_USERS_EXCEPT_ADMIN2";
const envPath = path.resolve(__dirname, "../.env");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function parseArgs(argv) {
  const args = { keepEmail: KEEP_EMAIL, confirm: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--keep-email") {
      args.keepEmail = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--confirm") {
      args.confirm = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log([
    "Usage:",
    "  pnpm --filter @workspace/api-server run purge-users -- --keep-email admin2.siwear@gmail.com",
    "  pnpm --filter @workspace/api-server run purge-users -- --keep-email admin2.siwear@gmail.com --confirm DELETE_ALL_USERS_EXCEPT_ADMIN2",
    "",
    "Default mode is DRY RUN. Real deletion requires the exact --confirm token.",
  ].join("\n"));
}

function normalizeSupabaseUrl(value) {
  return String(value || "").replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload, fallback) {
  if (payload && typeof payload === "object") {
    return [payload.message, payload.details, payload.hint, payload.code]
      .filter(part => typeof part === "string" && part.length > 0)
      .join(" ") || fallback;
  }
  return fallback;
}

function publicUser(user) {
  return {
    id: user.id || "",
    email: user.email || "",
    created_at: user.created_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
  };
}

function publicProfile(profile) {
  return {
    id: profile.id || "",
    email: profile.email || "",
    full_name: profile.full_name || null,
    role: profile.role || null,
    blocked: profile.blocked ?? null,
    is_active: profile.is_active ?? null,
  };
}

function isFkBlockedError(err) {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return message.includes("foreign key") ||
    message.includes("violates foreign key constraint") ||
    message.includes("23503");
}

function printDeletePlan({ mode, keepUser, keepProfile, authUsersToDelete, profilesToDelete }) {
  console.log(`[purge-users] Mode: ${mode}`);
  console.log(`[purge-users] Kept admin auth user: ${safeJson(publicUser(keepUser))}`);
  console.log(`[purge-users] Kept admin profile ${mode === "DRY RUN" ? "(current; real delete will enforce admin/active/unblocked)" : "(enforced)"}: ${safeJson(publicProfile(keepProfile))}`);
  console.log(`[purge-users] Auth users that ${mode === "DRY RUN" ? "would be deleted" : "will be deleted"} (${authUsersToDelete.length}):`);
  console.log(safeJson(authUsersToDelete.map(publicUser)));
  console.log(`[purge-users] Profiles that ${mode === "DRY RUN" ? "would be deleted" : "will be deleted"} (${profilesToDelete.length}):`);
  console.log(safeJson(profilesToDelete.map(publicProfile)));
  console.log("[purge-users] No products, orders, order_items, categories, settings, shipping, or discounts are touched by this script.");
}

async function supabaseRequest(config, pathName, init = {}) {
  const response = await fetch(`${config.url}${pathName}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${pathName} failed ${response.status}: ${payloadMessage(payload, response.statusText || "Supabase request failed.")}`);
  }
  return payload;
}

async function listAuthUsers(config) {
  const allUsers = [];
  const perPage = 200;
  for (let page = 1; page <= 100; page += 1) {
    const payload = await supabaseRequest(
      config,
      `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { method: "GET", headers: { Accept: "application/json" } },
    );
    const users = Array.isArray(payload.users) ? payload.users : Array.isArray(payload) ? payload : [];
    allUsers.push(...users);
    if (users.length < perPage) break;
  }
  return allUsers;
}

async function listProfiles(config) {
  const rows = await supabaseRequest(
    config,
    "/rest/v1/profiles?select=id,email,full_name,role,blocked,is_active,created_at&order=created_at.desc",
    { method: "GET", headers: { Accept: "application/json" } },
  );
  return Array.isArray(rows) ? rows : [];
}

async function patchKeptAdminProfile(config, keepUser, existingProfile) {
  const body = {
    id: keepUser.id,
    email: keepUser.email || KEEP_EMAIL,
    role: "admin",
    blocked: false,
    is_active: true,
  };

  const rows = await supabaseRequest(config, "/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      ...body,
      full_name: existingProfile?.full_name || "S! Wear Admin",
      phone: existingProfile?.phone || null,
      created_at: existingProfile?.created_at || new Date().toISOString(),
    }),
  });

  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile) {
    throw new Error("Kept admin profile could not be verified after upsert.");
  }
  return profile;
}

async function deleteAuthUser(config, userId) {
  await supabaseRequest(config, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

async function deleteProfiles(config, profileIds) {
  if (profileIds.length === 0) return 0;
  const encodedIds = profileIds.map(id => encodeURIComponent(id)).join(",");
  const rows = await supabaseRequest(config, `/rest/v1/profiles?id=in.(${encodedIds})`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  return Array.isArray(rows) ? rows.length : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  loadEnvFile(envPath);

  const keepEmail = normalizeEmail(args.keepEmail || KEEP_EMAIL);
  if (keepEmail !== KEEP_EMAIL) {
    throw new Error(`Refusing to keep "${args.keepEmail}". This script is locked to ${KEEP_EMAIL}.`);
  }

  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in artifacts/api-server/.env.");
  }

  const mode = args.confirm === CONFIRM_TOKEN ? "DELETE" : "DRY RUN";
  if (args.confirm && args.confirm !== CONFIRM_TOKEN) {
    throw new Error(`Invalid --confirm token. Expected ${CONFIRM_TOKEN}.`);
  }

  const config = { url, serviceRoleKey };
  const authUsers = await listAuthUsers(config);
  const keepUser = authUsers.find(user => normalizeEmail(user.email) === keepEmail);
  if (!keepUser?.id) {
    throw new Error(`Kept admin auth user was not found: ${KEEP_EMAIL}`);
  }

  const profiles = await listProfiles(config);
  const existingKeepProfile = profiles.find(profile => profile.id === keepUser.id) ||
    profiles.find(profile => normalizeEmail(profile.email) === keepEmail);
  if (!existingKeepProfile) {
    throw new Error(`Kept admin profile was not found for ${KEEP_EMAIL}. Create the profile before purging users.`);
  }
  if (String(existingKeepProfile.role || "").toLowerCase() !== "admin") {
    throw new Error(`Kept user profile role is "${existingKeepProfile.role || "missing"}", expected admin. Refusing to purge.`);
  }

  let keepProfile = existingKeepProfile;
  const authUsersToDelete = authUsers.filter(user => user.id !== keepUser.id);
  const profilesToDelete = profiles.filter(profile => profile.id !== keepUser.id);

  printDeletePlan({ mode, keepUser, keepProfile, authUsersToDelete, profilesToDelete });

  let deletedAuthUsers = 0;
  let deletedProfiles = 0;

  if (mode === "DRY RUN") {
    console.log(`[purge-users] DRY RUN only. Real deletion requires --confirm ${CONFIRM_TOKEN}`);
  } else {
    keepProfile = await patchKeptAdminProfile(config, keepUser, existingKeepProfile);
    console.log(`[purge-users] Kept admin profile enforced: ${safeJson(publicProfile(keepProfile))}`);

    for (const user of authUsersToDelete) {
      await deleteAuthUser(config, user.id);
      deletedAuthUsers += 1;
      console.log(`[purge-users] Deleted auth user ${user.id} ${user.email || "(no email)"}`);
    }

    try {
      deletedProfiles = await deleteProfiles(config, profilesToDelete.map(profile => profile.id));
    } catch (err) {
      if (isFkBlockedError(err)) {
        console.error("[purge-users] Profile deletion was blocked by a foreign key.");
        console.error(`[purge-users] Safe reason: ${err.message}`);
        console.error("[purge-users] No database tables were deleted. Related rows such as orders, notifications, contact_messages, or return_requests may still reference those profile ids.");
        console.error("[purge-users] Suggested cleanup: inspect those related rows and decide whether to reassign, anonymize, or explicitly purge them in a separate script.");
      }
      throw err;
    }
  }

  const remainingAuthUsers = await listAuthUsers(config);
  const remainingProfiles = await listProfiles(config);
  const remainingKeepUser = remainingAuthUsers.find(user => user.id === keepUser.id);
  const remainingKeepProfile = remainingProfiles.find(profile => profile.id === keepUser.id);
  const remainingOtherAuthUsers = remainingAuthUsers.filter(user => user.id !== keepUser.id);
  const remainingOtherProfiles = remainingProfiles.filter(profile => profile.id !== keepUser.id);

  if (!remainingKeepUser) throw new Error("Verification failed: kept admin no longer exists in auth.");
  if (!remainingKeepProfile) throw new Error("Verification failed: kept admin no longer exists in profiles.");
  if (mode === "DELETE" && remainingOtherAuthUsers.length > 0) {
    throw new Error(`Verification failed: ${remainingOtherAuthUsers.length} other auth user(s) remain.`);
  }
  if (mode === "DELETE" && remainingOtherProfiles.length > 0) {
    throw new Error(`Verification failed: ${remainingOtherProfiles.length} other profile row(s) remain.`);
  }

  console.log("[purge-users] Final summary:");
  console.log(safeJson({
    mode,
    kept_admin_id: keepUser.id,
    deleted_auth_users_count: deletedAuthUsers,
    deleted_profiles_count: deletedProfiles,
    remaining_auth_users: remainingAuthUsers.map(publicUser),
    remaining_profiles: remainingProfiles.map(publicProfile),
  }));
}

main().catch(err => {
  console.error(`[purge-users] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

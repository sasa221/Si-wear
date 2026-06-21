#!/usr/bin/env node

/**
 * Create or update a Supabase Auth admin user and promote them in public.profiles.
 * Verifies password works by attempting login after setup.
 * Usage: node create-admin.cjs --email admin@example.com --password mysecret --name "Admin" --phone "1234567890"
 */

const fs = require("node:fs");
const path = require("node:path");

// Load .env from artifacts/api-server/.env
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error(`Error: .env file not found at ${envPath}`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const env = {};

  envContent.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join("=").trim();
    }
  });

  return env;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        parsed[key] = value;
        i++;
      }
    }
  }

  return parsed;
}

// Normalize Supabase URL
function normalizeSupabaseUrl(value) {
  if (!value) return value;
  return value.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

// Extract masked project ref from Supabase URL
function maskProjectRef(url) {
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

// Main
async function main() {
  const env = loadEnv();
  const args = parseArgs();

  const supabaseUrl = normalizeSupabaseUrl(
    env["SUPABASE_URL"] || env["VITE_SUPABASE_URL"]
  );
  const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];
  const anonKey = env["SUPABASE_ANON_KEY"] || env["VITE_SUPABASE_ANON_KEY"];

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error(
      "Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY must be set in .env"
    );
    process.exit(1);
  }

  const projectRef = maskProjectRef(supabaseUrl);
  console.log(`[create-admin] Supabase project: ${projectRef}`);

  const { email, password, name, phone } = args;

  if (!email || !password) {
    console.error(
      "Error: --email and --password are required\nUsage: node create-admin.cjs --email admin@example.com --password mysecret --name 'Admin' --phone '1234567890'"
    );
    process.exit(1);
  }

  const fullName = name || email.split("@")[0];
  const cleanPhone = phone || null;

  try {
    // Import Supabase client
    const { createClient } = await import("@supabase/supabase-js");
    
    // Admin client (service role)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    // Regular client (anon key) for verification
    const authClient = createClient(supabaseUrl, anonKey);

    console.log("Checking if auth user exists...");

    // List all users to find by email (case-insensitive)
    const { data: authData, error: listError } =
      await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("Failed to list users:", listError.message);
      process.exit(1);
    }

    const users = authData?.users || [];
    const lowerEmail = (email || "").toLowerCase();
    const existingUser = users.find(
      (u) => (u.email || "").toLowerCase() === lowerEmail
    );

    let userId;
    let isNew = false;

    if (existingUser) {
      // User exists, update password
      userId = existingUser.id;
      console.log("Auth user exists. Updating password...");

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { password, email_confirm: true }
      );

      if (updateError) {
        console.error("Failed to update password:", updateError.message);
        process.exit(1);
      }

      console.log("✓ Admin user password updated");
    } else {
      // User does not exist, create
      console.log("Auth user does not exist. Creating...");

      const { data: newUserData, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createError) {
        console.error("Failed to create auth user:", createError.message);
        process.exit(1);
      }

      userId = newUserData?.user?.id;
      isNew = true;
      console.log("✓ Admin user created");
    }

    if (!userId) {
      console.error("Error: User ID not obtained");
      process.exit(1);
    }

    // Upsert profile using admin client
    console.log("Promoting profile to admin...");

    const updatePayload = {
      role: "admin",
      blocked: false,
      is_active: true,
      email: email,
    };

    if (fullName) updatePayload.full_name = fullName;
    if (cleanPhone) updatePayload.phone = cleanPhone;

    // Try UPDATE first
    const { error: updateProfileError } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);

    if (updateProfileError) {
      // If update fails, try INSERT
      console.log("Profile does not exist, creating...");

      const insertPayload = {
        id: userId,
        role: "admin",
        blocked: false,
        is_active: true,
        email: email,
      };

      if (fullName) insertPayload.full_name = fullName;
      if (cleanPhone) insertPayload.phone = cleanPhone;

      const { error: insertProfileError } = await adminClient
        .from("profiles")
        .insert([insertPayload]);

      if (insertProfileError) {
        console.error(
          "Failed to create profile:",
          insertProfileError.message || insertProfileError
        );
        process.exit(1);
      }
    }

    console.log("✓ Profile promoted to admin");
    console.log("");

    // ===== VERIFICATION STEP: Test login with regular client =====
    console.log("Verifying auth login...");
    
    const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      console.error("AUTH LOGIN VERIFICATION FAILED");
      console.error(loginError.message);
      process.exit(1);
    }

    if (!loginData?.user) {
      console.error("AUTH LOGIN VERIFICATION FAILED");
      console.error("No user returned from login");
      process.exit(1);
    }

    console.log("AUTH LOGIN VERIFIED");

    // Verify profile admin status
    const { data: profileData, error: profileError } = await authClient
      .from("profiles")
      .select("role, blocked, is_active")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      console.error("Failed to verify profile:", profileError?.message);
      process.exit(1);
    }

    if (profileData.role !== "admin") {
      console.error("Profile is not admin role:", profileData.role);
      process.exit(1);
    }

    console.log("PROFILE ADMIN VERIFIED");
    console.log("");
    console.log("=== ADMIN SETUP COMPLETE ===");
    console.log(`Email:  ${email}`);
    console.log(`User ID: ${userId}`);
    console.log(`Project: ${projectRef}`);
    console.log(`Status:  ${isNew ? "Created" : "Updated"}`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();

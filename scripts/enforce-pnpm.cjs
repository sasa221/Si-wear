const fs = require("node:fs");
const path = require("node:path");

const userAgent = process.env.npm_config_user_agent || "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead of npm or yarn.");
  process.exit(1);
}

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const lockfilePath = path.resolve(__dirname, "..", lockfile);
  try {
    if (fs.existsSync(lockfilePath)) {
      fs.rmSync(lockfilePath, { force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not remove ${lockfile}: ${message}`);
  }
}

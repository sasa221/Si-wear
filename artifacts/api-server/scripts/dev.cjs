const { spawnSync } = require("node:child_process");
const path = require("node:path");

const env = { ...process.env, NODE_ENV: "development" };
const root = path.resolve(__dirname, "..");

function runCommand(cmd) {
  // Use shell:true to allow Windows to resolve pnpm.cmd and other shell shims.
  const result = spawnSync(cmd, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exitCode = result.status ?? 1;
  if (process.exitCode !== 0) process.exit(process.exitCode);
}

runCommand("pnpm run build");
runCommand("pnpm run start");

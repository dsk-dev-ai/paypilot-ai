import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * Run a command with variables loaded from an env file (e.g. .env.local).
 * Next.js loads .env.local automatically; Prisma CLI does not, so DB scripts
 * use this shim. Real process env wins over the file.
 *
 * Usage: node scripts/run-with-env.mjs .env.local prisma migrate deploy
 */

const [, , file, ...command] = process.argv;

if (!file || command.length === 0) {
  console.error("Usage: node scripts/run-with-env.mjs <env-file> <command> [...args]");
  process.exit(1);
}

const env = { ...process.env };

if (existsSync(file)) {
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);

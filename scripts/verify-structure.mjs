#!/usr/bin/env node
/*
 * Checks the repository against the agreed architecture:
 *   - the required folders and entry files exist,
 *   - there are ZERO .html files in the source tree,
 *   - the frontend never imports a database driver, and never calls the AI
 *     service or a database host directly.
 *
 * Dependency and build folders (node_modules, .venv, .next, dist) are third-
 * party or generated and are reported separately, not counted as source.
 *
 *   node scripts/verify-structure.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED = new Set(["node_modules", ".venv", ".next", "dist", "__pycache__", ".pytest_cache", ".git"]);

const REQUIRED = [
  "frontend/app/layout.tsx", "frontend/app/page.tsx", "frontend/app/login/page.tsx", "frontend/app/register/page.tsx",
  "frontend/app/dashboard/page.tsx", "frontend/app/profile/page.tsx", "frontend/app/analytics/page.tsx", "frontend/app/settings/page.tsx",
  "frontend/components/ui", "frontend/components/navbar", "frontend/components/sidebar", "frontend/components/dashboard",
  "frontend/components/forms", "frontend/components/analytics", "frontend/hooks", "frontend/lib/api.ts", "frontend/lib/auth.ts",
  "frontend/types", "frontend/public", "frontend/package.json", "frontend/tsconfig.json", "frontend/next.config.ts",
  "backend/src/config", "backend/src/controllers", "backend/src/routes", "backend/src/services", "backend/src/models",
  "backend/src/repositories", "backend/src/middleware", "backend/src/validators", "backend/src/utils", "backend/src/server.ts",
  "backend/package.json", "backend/tsconfig.json",
  "ai/models", "ai/preprocessing", "ai/training", "ai/inference", "ai/services", "ai/api", "ai/main.py", "ai/requirements.txt",
  "analytics/dashboards", "analytics/data_processing", "analytics/reports", "analytics/models",
  "database/postgresql/migrations", "database/postgresql/schema", "database/postgresql/seeds",
  "database/mongodb/schemas", "database/mongodb/collections",
  "docs", "scripts", ".env.example", ".gitignore", "docker-compose.yml", "package.json", "README.md",
];

function walk(dir, onFile, generated = false) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const isGenerated = generated || GENERATED.has(name);
    if (statSync(full).isDirectory()) walk(full, onFile, isGenerated);
    else onFile(full, isGenerated);
  }
}

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};

console.log("required structure");
for (const path of REQUIRED) {
  if (existsSync(join(ROOT, path))) console.log(`  ok    ${path}`);
  else fail(`${path} is missing`);
}

console.log("\n.html files");
const htmlSource = [];
let htmlGenerated = 0;
walk(ROOT, (file, generated) => {
  if (!file.toLowerCase().endsWith(".html")) return;
  if (generated) htmlGenerated++;
  else htmlSource.push(relative(ROOT, file));
});
if (htmlSource.length) htmlSource.forEach((f) => fail(`source .html file: ${f}`));
else console.log("  ok    0 .html files in the source tree");
console.log(`  info  ${htmlGenerated} .html files inside dependency/build folders (third-party or generated, git-ignored)`);

console.log("\nfrontend separation");
const forbidden = [
  { re: /from\s+["'](pg|mongodb|mongoose|psycopg|@prisma\/client)["']/, why: "imports a database driver" },
  { re: /(postgres(ql)?:\/\/|mongodb(\+srv)?:\/\/)/, why: "contains a database connection string" },
  { re: /AI_SERVICE_(URL|TOKEN)|:8000\/v1\//, why: "references the AI service directly" },
  { re: /(POSTGRES|MONGO)_[A-Z_]*PASSWORD|JWT_ACCESS_SECRET|DATA_ENCRYPTION_KEY/, why: "references a server secret" },
];
let scanned = 0;
walk(join(ROOT, "frontend"), (file, generated) => {
  if (generated || !/\.(ts|tsx|js|mjs|json)$/.test(file)) return;
  scanned++;
  const text = readFileSync(file, "utf8");
  for (const rule of forbidden) if (rule.re.test(text)) fail(`${relative(ROOT, file)} ${rule.why}`);
});
if (!failures) console.log(`  ok    ${scanned} frontend source files talk only to /api/v1`);

console.log(failures ? `\n${failures} problem(s) found` : "\nstructure verified");
process.exit(failures ? 1 : 0);

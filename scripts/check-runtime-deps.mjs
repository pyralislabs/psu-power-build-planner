#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const pkgPath = join(repoRoot, "package.json");

if (!existsSync(pkgPath)) {
  console.error("check-runtime-deps: package.json not found.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const deps = pkg.dependencies ?? {};
const opt = pkg.optionalDependencies ?? {};
const peer = pkg.peerDependencies ?? {};

const fail = [];
if (Object.keys(deps).length > 0) {
  fail.push(`dependencies must be empty, found ${Object.keys(deps).join(", ")}`);
}
if (Object.keys(opt).length > 0) {
  fail.push(`optionalDependencies must be empty, found ${Object.keys(opt).join(", ")}`);
}
if (Object.keys(peer).length > 0) {
  fail.push(`peerDependencies must be empty, found ${Object.keys(peer).join(", ")}`);
}

if (fail.length > 0) {
  console.error("check-runtime-deps: FAILED");
  for (const f of fail) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}

console.info("check-runtime-deps: OK (zero runtime dependencies, zero peer dependencies)");

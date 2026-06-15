#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdtempSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const pkgPath = join(repoRoot, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const tarballName = `${pkg.name}-${pkg.version}.tgz`;

const work = mkdtempSync(join(tmpdir(), "psu-pack-"));

function run(cmd) {
  console.info(`verify-pack: ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: repoRoot });
  } catch {
    rmSync(work, { recursive: true, force: true });
    console.error(`verify-pack: command failed: ${cmd}`);
    process.exit(1);
  }
}

try {
  run("pnpm pack --pack-destination " + work);
  const tarball = join(work, tarballName);
  if (!existsSync(tarball)) {
    const files = readdirSync(work);
    throw new Error(`Tarball not found: ${tarball}; saw ${files.join(", ")}`);
  }
  const extractDir = join(work, "extract");
  run(`mkdir -p ${extractDir}`);
  run(`tar -xzf ${tarball} -C ${extractDir}`);

  const pkgDir = join(extractDir, "package");
  const required = [
    "package.json",
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/cli/main.js",
    "dist/data/index.js",
    "dist/data/components.json",
    "dist/data/sources.json",
    "dist/data/efficiency-profiles.json",
  ];
  for (const p of required) {
    if (!existsSync(join(pkgDir, p))) {
      throw new Error(`Missing required file in tarball: ${p}`);
    }
  }

  const disallowed = [
    "tests",
    "scripts",
    "playwright-report",
    "test-results",
    "src",
    ".github",
    "data",
    "eslint.config.js",
    "tsconfig.json",
    "tsconfig.build.json",
    "vitest.config.ts",
    "vite.config.ts",
    "playwright.config.ts",
    ".editorconfig",
    ".gitignore",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".prettierrc.json",
    ".prettierignore",
    ".npmrc",
    ".pnpmrc",
    ".changeset",
  ];
  for (const p of disallowed) {
    if (existsSync(join(pkgDir, p))) {
      throw new Error(`Disallowed file/dir in tarball: ${p}`);
    }
  }

  const packedPkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  if (Object.keys(packedPkg.dependencies ?? {}).length > 0) {
    throw new Error("Packed package has dependencies.");
  }
  if (Object.keys(packedPkg.optionalDependencies ?? {}).length > 0) {
    throw new Error("Packed package has optionalDependencies.");
  }
  if (!packedPkg.bin || !packedPkg.bin["psu-build-plan"]) {
    throw new Error("Packed package missing psu-build-plan bin.");
  }
  const binPath = join(pkgDir, packedPkg.bin["psu-build-plan"]);
  if (!existsSync(binPath)) {
    throw new Error(`Packed package bin file missing: ${binPath}`);
  }
  const binText = readFileSync(binPath, "utf8");
  if (!binText.startsWith("#!")) {
    throw new Error("Packed package bin file is missing a shebang.");
  }

  const widgetDist = join(pkgDir, "dist", "widget");
  if (!existsSync(widgetDist)) {
    console.warn(
      "verify-pack: widget build not present in dist/widget (widget build is separate).",
    );
  }
  if (!existsSync(join(widgetDist, "embed.js"))) {
    throw new Error("Widget bundle missing: dist/widget/embed.js");
  }
  if (!existsSync(join(widgetDist, "widget.html"))) {
    throw new Error("Widget HTML missing: dist/widget/widget.html");
  }

  const size = statSync(tarball).size;
  console.info(`verify-pack: OK (${(size / 1024).toFixed(1)} KiB tarball)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

#!/usr/bin/env node
import { cpSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const distDir = join(repoRoot, "dist");
const dataDir = join(repoRoot, "data");

function fail(message) {
  console.error(`build-package: ${message}`);
  process.exit(1);
}

function cleanDist() {
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
}

function compileTypeScript() {
  console.info("build-package: compiling TypeScript with tsc");
  const result = spawnSync(
    process.execPath,
    [
      join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      join(repoRoot, "tsconfig.build.json"),
    ],
    { stdio: "inherit", cwd: repoRoot },
  );
  if (result.status !== 0) {
    fail("tsc compilation failed.");
  }
}

function copyDataArtifacts() {
  const targetDataDir = join(distDir, "data");
  if (!existsSync(targetDataDir)) {
    fail(`dist/data does not exist after compilation.`);
  }
  for (const name of readdirSync(dataDir)) {
    if (!name.endsWith(".json")) continue;
    const src = join(dataDir, name);
    const dest = join(targetDataDir, name);
    if (statSync(src).isFile()) {
      cpSync(src, dest);
    }
  }
  console.info(`build-package: copied data artifacts to ${targetDataDir}`);
}

function copyBootstrap() {
  const target = join(distDir, "bootstrap.md");
  cpSync(join(repoRoot, "bootstrap.md"), target);
  console.info("build-package: copied bootstrap.md into dist for reference");
}

function main() {
  cleanDist();
  compileTypeScript();
  copyDataArtifacts();
  copyBootstrap();
  console.info("build-package: done");
}

main();

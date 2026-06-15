import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdtempSync, readFileSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

describe("packed package", () => {
  let tarball = "";
  let work = "";
  let pkgDir = "";

  beforeAll(() => {
    work = mkdtempSync(join(tmpdir(), "psu-pack-"));
    execFileSync("pnpm", ["pack", "--pack-destination", work], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    tarball = join(work, `${pkg.name}-${pkg.version}.tgz`);
    const extractDir = join(work, "extract");
    execFileSync("mkdir", ["-p", extractDir], { stdio: "ignore" });
    execFileSync("tar", ["-xzf", tarball, "-C", extractDir], { stdio: "ignore" });
    pkgDir = join(extractDir, "package");
  });

  afterAll(() => {
    if (work) {
      rmSync(work, { recursive: true, force: true });
    }
  });

  it("contains the documented runtime artifacts", () => {
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
      expect(existsSync(join(pkgDir, p)), `missing: ${p}`).toBe(true);
    }
  });

  it("does not contain source-only files", () => {
    const disallowed = [
      "tests",
      "scripts",
      "src",
      "playwright-report",
      "test-results",
      "eslint.config.js",
      "tsconfig.json",
      "tsconfig.build.json",
      "vitest.config.ts",
      "vite.config.ts",
      "playwright.config.ts",
      ".editorconfig",
      ".gitignore",
      "pnpm-lock.yaml",
      ".changeset",
      "data",
    ];
    for (const p of disallowed) {
      expect(existsSync(join(pkgDir, p)), `disallowed: ${p}`).toBe(false);
    }
  });

  it("has no runtime dependencies in package.json", () => {
    const packed = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    expect(Object.keys(packed.dependencies ?? {})).toEqual([]);
    expect(Object.keys(packed.optionalDependencies ?? {})).toEqual([]);
    expect(Object.keys(packed.peerDependencies ?? {})).toEqual([]);
  });

  it("has a working CLI binary in the tarball", () => {
    const packed = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    const binPath = packed.bin?.["psu-build-plan"];
    expect(binPath).toBeTruthy();
    const abs = join(pkgDir, binPath!);
    expect(existsSync(abs)).toBe(true);
    const stat = statSync(abs);
    expect(stat.isFile()).toBe(true);
    const text = readFileSync(abs, "utf8");
    expect(text.startsWith("#!")).toBe(true);
  });

  it("exposes the public API surface", () => {
    const text = readFileSync(join(pkgDir, "dist", "index.js"), "utf8");
    const required = [
      "planBuild",
      "recommendPsu",
      "evaluatePsu",
      "calculateEfficiency",
      "calculateEnergyCost",
      "listComponents",
      "getComponent",
      "listSources",
      "getSource",
      "listEfficiencyProfiles",
      "getEfficiencyProfile",
      "PlannerValidationError",
      "PlannerUnsupportedError",
      "validatePlannerInput",
    ];
    for (const name of required) {
      const re = new RegExp(
        `export\\s+(?:\\*|\\{[^}]*\\b${name}\\b|function\\s+${name}|const\\s+${name})`,
        "m",
      );
      expect(re.test(text) || text.includes(`"${name}"`), `missing export: ${name}`).toBe(true);
    }
  });

  it("runs the CLI from the packed artifact", () => {
    const packed = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    const binPath = join(pkgDir, packed.bin["psu-build-plan"]);
    const r = spawnSync(process.execPath, [binPath, "--version"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^psu-build-plan \d+\.\d+\.\d+/);
  });

  it("runs an example plan from the packed artifact", () => {
    const packed = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    const binPath = join(pkgDir, packed.bin["psu-build-plan"]);
    const examplePath = join(repoRoot, "examples", "gaming-single-gpu.json");
    const r = spawnSync(
      process.execPath,
      [binPath, "plan", "--input", examplePath, "--json", "--quiet"],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.ok).toBe(true);
  });
});

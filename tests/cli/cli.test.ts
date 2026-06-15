import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const cliPath = join(repoRoot, "dist", "cli", "main.js");

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(args: string[], stdin?: string, env: NodeJS.ProcessEnv = {}): Promise<CliResult> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: { ...process.env, NO_COLOR: "1", ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", rejectP);
    child.on("close", (code) => {
      resolveP({ status: code ?? 0, stdout, stderr });
    });
    if (stdin !== undefined) {
      child.stdin.end(stdin);
    } else {
      child.stdin.end();
    }
  });
}

function writeTempPlan(name: string, contents: object): string {
  const dir = mkdtempSync(join(tmpdir(), "psu-cli-"));
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(contents));
  return path;
}

const baseInput = {
  schemaVersion: 1,
  lines: [
    { id: "platform", componentId: "generic-atx-platform-baseline" },
    { id: "cpu", componentId: "intel-core-i7-14700k" },
    { id: "gpu", componentId: "nvidia-rtx-4070-ti-super" },
  ],
  operatingProfile: {
    preset: "gaming",
    poweredHoursPerDay: 4,
    daysPerYear: 365,
    workloadShare: 0.75,
    categoryUtilization: {},
    fallbackUtilization: 0.2,
    ratePerKwh: 0.16,
    currency: "USD",
  },
  efficiencyProfileId: "generic-80-plus-gold-115v-conservative",
};

describe("CLI", () => {
  it("prints help", async () => {
    const r = await run(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("psu-build-plan");
  });

  it("prints version", async () => {
    const r = await run(["--version"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^psu-build-plan \d+\.\d+\.\d+/);
  });

  it("plans a build (human)", async () => {
    const path = writeTempPlan("plan.json", baseInput);
    const r = await run(["plan", "--input", path, "--quiet"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PSU recommendation");
    rmSync(dirname(path), { recursive: true, force: true });
  });

  it("plans a build (json)", async () => {
    const path = writeTempPlan("plan.json", baseInput);
    const r = await run(["plan", "--input", path, "--json"]);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.totals.sustainedDcWatts).toBeGreaterThan(0);
    expect(json.data.recommendation.recommendedCapacityWatts).not.toBeNull();
    rmSync(dirname(path), { recursive: true, force: true });
  });

  it("evaluates a PSU capacity", async () => {
    const path = writeTempPlan("plan.json", baseInput);
    const r = await run(["evaluate", "--input", path, "--psu-watts", "850", "--json"]);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.evaluatedPsu.capacityWatts).toBe(850);
    rmSync(dirname(path), { recursive: true, force: true });
  });

  it("evaluate requires --psu-watts", async () => {
    const path = writeTempPlan("plan.json", baseInput);
    const r = await run(["evaluate", "--input", path]);
    expect(r.status).toBe(2);
    const json = JSON.parse(r.stdout);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("MISSING_PSU_WATTS");
    rmSync(dirname(path), { recursive: true, force: true });
  });

  it("returns 4 on unknown component", async () => {
    const input = {
      ...baseInput,
      lines: [{ id: "cpu", componentId: "no-such-component" }],
    };
    const path = writeTempPlan("bad.json", input);
    const r = await run(["plan", "--input", path, "--json"]);
    expect(r.status).toBe(4);
    rmSync(dirname(path), { recursive: true, force: true });
  });

  it("returns 3 on malformed JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "psu-cli-bad-"));
    const path = join(dir, "bad.json");
    writeFileSync(path, "this is not json");
    const r = await run(["plan", "--input", path, "--json"]);
    expect(r.status).toBe(3);
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns 3 on missing file", async () => {
    const r = await run(["plan", "--input", "/tmp/does-not-exist-12345.json", "--json"]);
    expect(r.status).toBe(3);
  });

  it("lists components filtered by category", async () => {
    const r = await run(["components", "--category", "gpu", "--json"]);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.ok).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.every((c: { category: string }) => c.category === "gpu")).toBe(true);
  });

  it("returns 4 on unknown component lookup", async () => {
    const r = await run(["component", "no-such-id", "--json"]);
    expect(r.status).toBe(4);
    const json = JSON.parse(r.stdout);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("UNKNOWN_COMPONENT");
  });

  it("returns 2 on missing component argument", async () => {
    const r = await run(["component"]);
    expect(r.status).toBe(2);
  });

  it("lists sources", async () => {
    const r = await run(["sources", "--json"]);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.data.length).toBeGreaterThan(20);
  });

  it("lists efficiency profiles", async () => {
    const r = await run(["efficiency-profiles", "--json"]);
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.data.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects invalid --category", async () => {
    const r = await run(["components", "--category", "no-such-category"]);
    expect(r.status).toBe(2);
  });

  it("rejects unknown command", async () => {
    const r = await run(["no-such-command"]);
    expect(r.status).toBe(2);
  });

  it("supports plan from all examples", async () => {
    for (const example of [
      "gaming-single-gpu.json",
      "homelab-low-power.json",
      "local-ai-dual-gpu.json",
      "manual-components.json",
    ]) {
      const r = await run(["plan", "--input", join(repoRoot, "examples", example), "--json"]);
      expect(r.status, `example ${example}`).toBe(0);
    }
  });
});

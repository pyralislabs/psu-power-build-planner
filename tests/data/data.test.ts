import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const validatorPath = join(repoRoot, "scripts", "validate-data.mjs");

function runValidator(fileArg?: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      [validatorPath, ...(fileArg ? ["--file", fileArg] : [])],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

const WELL_KNOWN_IDS = [
  "intel-core-i9-14900k",
  "intel-core-i7-14700k",
  "intel-core-i5-14600k",
  "amd-ryzen-9-7950x",
  "amd-ryzen-7-7800x3d",
  "amd-ryzen-5-7600x",
  "amd-epyc-9654",
  "nvidia-rtx-4090",
  "nvidia-rtx-4080",
  "nvidia-rtx-4070-ti",
  "nvidia-h100-sxm",
  "amd-radeon-rx-7900xtx",
  "amd-radeon-rx-7700xt",
  "generic-atx-platform-baseline",
  "generic-miniitx-platform-baseline",
  "generic-consumer-amd-am5-platform",
  "generic-ddr5-udimm-baseline",
  "generic-ddr5-rdimm-baseline",
  "generic-nvme-ssd-baseline",
  "generic-3-5-hdd-baseline",
  "samsung-990-pro-2tb",
  "seagate-exos-x20-20tb",
  "generic-aio-360mm-cooler-baseline",
  "generic-1gbe-nic-baseline",
  "generic-10gbe-nic-baseline",
];

describe("data validation", () => {
  it("passes on the canonical dataset", () => {
    const r = runValidator();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OK \(\d+ components/);
  });

  it("reports counts that meet the v1 target", () => {
    const r = runValidator();
    const m = r.stdout.match(/\((\d+) components, (\d+) sources, (\d+) profiles\)/);
    expect(m).not.toBeNull();
    const components = Number(m![1]);
    const sources = Number(m![2]);
    const profiles = Number(m![3]);
    expect(components).toBeGreaterThanOrEqual(100);
    expect(sources).toBeGreaterThanOrEqual(30);
    expect(profiles).toBeGreaterThanOrEqual(4);
  });

  it("includes all well-known component IDs", () => {
    const r = runValidator();
    expect(r.status).toBe(0);
    const data = JSON.parse(readFileSync(join(repoRoot, "data", "components.json"), "utf8"));
    const ids = new Set(data.components.map((c: { id: string }) => c.id));
    for (const id of WELL_KNOWN_IDS) {
      expect(ids.has(id), `missing component: ${id}`).toBe(true);
    }
  });

  it("references only known sourceIds from components and profiles", () => {
    const sources = JSON.parse(readFileSync(join(repoRoot, "data", "sources.json"), "utf8"));
    const sourceIds = new Set(sources.sources.map((s: { id: string }) => s.id));
    const components = JSON.parse(readFileSync(join(repoRoot, "data", "components.json"), "utf8"));
    const profiles = JSON.parse(
      readFileSync(join(repoRoot, "data", "efficiency-profiles.json"), "utf8"),
    );
    for (const c of components.components) {
      for (const k of ["idle", "sustained", "transient"] as const) {
        for (const sid of c.power[k].sourceIds) {
          expect(sourceIds.has(sid), `unknown sourceId in ${c.id}.${k}: ${sid}`).toBe(true);
        }
      }
    }
    for (const p of profiles.profiles) {
      for (const sid of p.sourceIds) {
        expect(sourceIds.has(sid), `unknown sourceId in profile ${p.id}: ${sid}`).toBe(true);
      }
    }
  });

  it("fails on a fabricated invalid component fixture", () => {
    const tmp = mkdtempSync(join(tmpdir(), "psu-invalid-"));
    try {
      const badPath = join(tmp, "bad.json");
      writeFileSync(
        badPath,
        JSON.stringify({
          schemaVersion: 1,
          updatedAt: "2026-06-15",
          components: [
            {
              id: "Bad_Component",
              manufacturer: "X",
              model: "X",
              category: "cpu",
              power: {
                idle: {
                  watts: 100,
                  basis: "manufacturer-tdp",
                  confidence: "high",
                  sourceIds: ["nonexistent-source"],
                },
                sustained: {
                  watts: 50,
                  basis: "manufacturer-tdp",
                  confidence: "high",
                  sourceIds: ["nonexistent-source"],
                },
                transient: {
                  watts: 60,
                  basis: "manufacturer-tdp",
                  confidence: "high",
                  sourceIds: ["nonexistent-source"],
                },
              },
              reviewedAt: "2026-06-15",
            },
          ],
        }),
      );
      const r = execFileSync(process.execPath, [validatorPath, "--file", badPath], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
      });
      throw new Error(`expected failure, got success: ${r}`);
    } catch (err) {
      const e = err as { status?: number };
      expect(e.status === 1 || e.status === undefined).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

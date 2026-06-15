import { describe, expect, it } from "vitest";
import { aggregateTotals, buildTotals, computeTransient } from "../../src/core/calculate-build.js";
import { resolveBuild } from "../../src/core/resolve-build.js";
import { createWarningCollector } from "../../src/core/warnings.js";
import type { ResolvedBuildLine } from "../../src/core/types.js";
import type { OperatingProfileInput } from "../../src/core/types.js";

const _profile: OperatingProfileInput = {
  preset: "gaming",
  poweredHoursPerDay: 4,
  workloadShare: 0.75,
  categoryUtilization: {},
  fallbackUtilization: 0.2,
  ratePerKwh: 0.16,
  currency: "USD",
};
void _profile;

function manualLine(args: {
  id: string;
  category: "cpu" | "gpu" | "storage" | "platform" | "memory" | "cooling" | "network" | "accessory";
  idle: number;
  sustained: number;
  transient: number;
  quantity?: number;
}): ResolvedBuildLine {
  const q = args.quantity ?? 1;
  return {
    id: args.id,
    name: args.id,
    category: args.category,
    quantity: q,
    powerEach: {
      idleDcWattsEach: args.idle,
      sustainedDcWattsEach: args.sustained,
      transientDcWattsEach: args.transient,
    },
    powerTotals: {
      idleDcWatts: args.idle * q,
      sustainedDcWatts: args.sustained * q,
      transientDcWatts: args.transient * q,
    },
    workloadUtilization: 0,
    workloadDcWatts: 0,
    transientCorrelation: 1,
    confidence: "medium",
    sourceIds: [],
    manual: true,
    overriddenFields: [],
  };
}

describe("aggregateTotals", () => {
  it("sums idle, workload, sustained", () => {
    const lines = [
      manualLine({ id: "a", category: "cpu", idle: 5, sustained: 100, transient: 130 }),
      manualLine({ id: "b", category: "gpu", idle: 20, sustained: 300, transient: 360 }),
    ];
    lines[0]!.workloadDcWatts = 50;
    lines[1]!.workloadDcWatts = 200;
    const t = aggregateTotals(lines);
    expect(t.idleDcWatts).toBe(25);
    expect(t.workloadDcWatts).toBe(250);
    expect(t.sustainedDcWatts).toBe(400);
  });
});

describe("computeTransient", () => {
  it("applies correlation per line", () => {
    const lines = [
      manualLine({ id: "a", category: "cpu", idle: 5, sustained: 100, transient: 100 }),
      manualLine({ id: "b", category: "storage", idle: 2, sustained: 5, transient: 10 }),
    ];
    lines[0]!.transientCorrelation = 1;
    lines[1]!.transientCorrelation = 0.5;
    const t = computeTransient(lines, 105);
    // cpu has no delta, storage delta = 5*0.5 = 2.5
    expect(t).toBe(105 + 2.5);
  });

  it("treats negative deltas as zero", () => {
    const lines = [
      manualLine({ id: "a", category: "cpu", idle: 5, sustained: 100, transient: 100 }),
    ];
    const t = computeTransient(lines, 100);
    expect(t).toBe(100);
  });
});

describe("buildTotals", () => {
  it("computes totals with utilization and correlation", () => {
    const w = createWarningCollector();
    const gamingProfile: OperatingProfileInput = {
      preset: "gaming",
      poweredHoursPerDay: 4,
      workloadShare: 0.75,
      categoryUtilization: { cpu: 0.55, gpu: 0.85 },
      fallbackUtilization: 0.2,
      ratePerKwh: 0.16,
      currency: "USD",
    };
    const result = resolveBuild(
      {
        lines: [
          {
            id: "cpu",
            manualComponent: {
              name: "CPU",
              category: "cpu",
              idleDcWattsEach: 5,
              sustainedDcWattsEach: 100,
              transientDcWattsEach: 130,
            },
            quantity: 1,
          },
          {
            id: "gpu",
            manualComponent: {
              name: "GPU",
              category: "gpu",
              idleDcWattsEach: 20,
              sustainedDcWattsEach: 300,
              transientDcWattsEach: 360,
            },
            quantity: 1,
          },
        ],
        profile: gamingProfile,
      },
      w,
    );
    const totals = buildTotals(result.lines);
    expect(totals.idleDcWatts).toBe(25);
    expect(totals.sustainedDcWatts).toBe(400);
    // cpu workload = 5 + (100-5)*0.55 = 57.25
    // gpu workload = 20 + (300-20)*0.85 = 258
    // total workload = 315.25
    expect(totals.workloadDcWatts).toBeCloseTo(315.25, 6);
    // cpu transient delta = 30 * 1.0 = 30
    // gpu transient delta = 60 * 1.0 = 60
    // sustained baseline = 400
    // total = 400 + 30 + 60 = 490
    expect(totals.transientDcWatts).toBeCloseTo(490, 6);
  });
});

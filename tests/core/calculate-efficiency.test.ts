import { describe, expect, it } from "vitest";
import { calculateEfficiency, efficiencyAt } from "../../src/core/calculate-efficiency.js";
import type { EfficiencyCurve, PlannerWarning } from "../../src/core/types.js";

const sampleCurve: EfficiencyCurve = {
  points: [
    { loadFraction: 0.1, efficiencyFraction: 0.82 },
    { loadFraction: 0.2, efficiencyFraction: 0.87 },
    { loadFraction: 0.5, efficiencyFraction: 0.9 },
    { loadFraction: 1.0, efficiencyFraction: 0.88 },
  ],
};

describe("efficiencyAt", () => {
  it("uses the lowest point below range and warns", () => {
    const w: PlannerWarning[] = [];
    const eff = efficiencyAt(0.05, sampleCurve, w);
    expect(eff).toBe(0.82);
    expect(w.some((x) => x.code === "EFFICIENCY_BELOW_CURVE_RANGE")).toBe(true);
  });

  it("uses the exact value at a known point", () => {
    const w: PlannerWarning[] = [];
    expect(efficiencyAt(0.5, sampleCurve, w)).toBe(0.9);
  });

  it("linearly interpolates between points", () => {
    const w: PlannerWarning[] = [];
    // between 0.2 (0.87) and 0.5 (0.9)
    // at 0.35: 0.87 + (0.9 - 0.87) * (0.15 / 0.3) = 0.87 + 0.015 = 0.885
    expect(efficiencyAt(0.35, sampleCurve, w)).toBeCloseTo(0.885, 6);
  });

  it("uses the highest point above range and warns", () => {
    const w: PlannerWarning[] = [];
    const eff = efficiencyAt(1.0, sampleCurve, w);
    expect(eff).toBe(0.88);
    expect(w.some((x) => x.code === "EFFICIENCY_ABOVE_CURVE_RANGE")).toBe(false);
  });
});

describe("calculateEfficiency", () => {
  it("returns null when dc exceeds capacity", () => {
    const r = calculateEfficiency(1200, 1000, sampleCurve);
    expect(r.efficiencyFraction).toBeNull();
    expect(r.warnings.some((w) => w.code === "PSU_UNDERSIZED")).toBe(true);
  });

  it("returns null when capacity is 0", () => {
    const r = calculateEfficiency(100, 0, sampleCurve);
    expect(r.efficiencyFraction).toBeNull();
  });

  it("returns null when dc is negative", () => {
    const r = calculateEfficiency(-1, 1000, sampleCurve);
    expect(r.efficiencyFraction).toBeNull();
  });

  it("computes ac input and conversion loss", () => {
    const r = calculateEfficiency(500, 1000, sampleCurve);
    expect(r.efficiencyFraction).toBe(0.9);
    expect(r.acInputWatts).toBeCloseTo(500 / 0.9, 6);
    expect(r.conversionLossWatts).toBeCloseTo(500 / 0.9 - 500, 6);
  });
});

import { describe, expect, it } from "vitest";
import { calculateEnergyCost } from "../../src/core/calculate-cost.js";

describe("calculateEnergyCost", () => {
  it("returns 0 cost at 0 rate", () => {
    const r = calculateEnergyCost({
      idleDcWatts: 50,
      workloadDcWatts: 200,
      idleAcInputWatts: 55,
      workloadAcInputWatts: 220,
      poweredHoursPerDay: 24,
      daysPerYear: 365,
      workloadShare: 0.5,
      ratePerKwh: 0,
      currency: "USD",
    });
    expect(r.annualAcEnergyKwh).not.toBeNull();
    expect(r.annualCost).toBe(0);
  });

  it("returns null cost when AC is missing but keeps DC energy", () => {
    const r = calculateEnergyCost({
      idleDcWatts: 50,
      workloadDcWatts: 200,
      idleAcInputWatts: null,
      workloadAcInputWatts: null,
      poweredHoursPerDay: 24,
      daysPerYear: 365,
      workloadShare: 0.5,
      ratePerKwh: 0.16,
      currency: "USD",
    });
    expect(r.annualAcEnergyKwh).toBeNull();
    expect(r.annualCost).toBeNull();
    expect(r.annualDcEnergyKwh).toBeGreaterThan(0);
  });

  it("uses daysPerYear for annual scaling", () => {
    const a = calculateEnergyCost({
      idleDcWatts: 100,
      workloadDcWatts: 200,
      idleAcInputWatts: 110,
      workloadAcInputWatts: 220,
      poweredHoursPerDay: 24,
      daysPerYear: 365,
      workloadShare: 0.5,
      ratePerKwh: 0.1,
      currency: "USD",
    });
    const b = calculateEnergyCost({
      idleDcWatts: 100,
      workloadDcWatts: 200,
      idleAcInputWatts: 110,
      workloadAcInputWatts: 220,
      poweredHoursPerDay: 24,
      daysPerYear: 366,
      workloadShare: 0.5,
      ratePerKwh: 0.1,
      currency: "USD",
    });
    expect(b.annualAcEnergyKwh!).toBeGreaterThan(a.annualAcEnergyKwh!);
  });

  it("handles 24/7 always-on operation", () => {
    const r = calculateEnergyCost({
      idleDcWatts: 50,
      workloadDcWatts: 200,
      idleAcInputWatts: 55,
      workloadAcInputWatts: 220,
      poweredHoursPerDay: 24,
      daysPerYear: 365,
      workloadShare: 0,
      ratePerKwh: 0.16,
      currency: "USD",
    });
    expect(r.idleHoursPerDay).toBe(24);
    expect(r.workloadHoursPerDay).toBe(0);
  });

  it("handles full-workload share", () => {
    const r = calculateEnergyCost({
      idleDcWatts: 50,
      workloadDcWatts: 200,
      idleAcInputWatts: 55,
      workloadAcInputWatts: 220,
      poweredHoursPerDay: 24,
      daysPerYear: 365,
      workloadShare: 1,
      ratePerKwh: 0.16,
      currency: "USD",
    });
    expect(r.workloadHoursPerDay).toBe(24);
  });
});

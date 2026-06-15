import { describe, expect, it } from "vitest";
import {
  DEFAULT_STANDARD_CAPACITIES_WATTS,
  MULTI_GPU_DEFAULT_POLICY,
  SINGLE_GPU_DEFAULT_POLICY,
  evaluatePsu,
  recommendPsu,
  roundUpToStandard,
} from "../../src/core/recommend-psu.js";
import type { BuildPowerTotals } from "../../src/core/types.js";

const baseTotals = (over: Partial<BuildPowerTotals> = {}): BuildPowerTotals => ({
  idleDcWatts: 50,
  workloadDcWatts: 200,
  sustainedDcWatts: 400,
  transientDcWatts: 500,
  ...over,
});

describe("roundUpToStandard", () => {
  it("rounds up to the next standard capacity", () => {
    expect(roundUpToStandard(700, DEFAULT_STANDARD_CAPACITIES_WATTS)).toBe(700);
    expect(roundUpToStandard(701, DEFAULT_STANDARD_CAPACITIES_WATTS)).toBe(750);
    expect(roundUpToStandard(1000.5, DEFAULT_STANDARD_CAPACITIES_WATTS)).toBe(1100);
  });
  it("returns -1 when above the highest", () => {
    expect(roundUpToStandard(2500, DEFAULT_STANDARD_CAPACITIES_WATTS)).toBe(-1);
  });
});

describe("recommendPsu", () => {
  it("uses single-GPU policy for 0 or 1 GPU", () => {
    const r0 = recommendPsu(baseTotals(), undefined, 0);
    const r1 = recommendPsu(baseTotals(), undefined, 1);
    expect(r0.policy.targetSustainedLoadFraction).toBe(
      SINGLE_GPU_DEFAULT_POLICY.targetSustainedLoadFraction,
    );
    expect(r1.policy.targetSustainedLoadFraction).toBe(
      SINGLE_GPU_DEFAULT_POLICY.targetSustainedLoadFraction,
    );
  });

  it("uses multi-GPU policy for 2+ GPUs", () => {
    const r = recommendPsu(baseTotals(), undefined, 2);
    expect(r.policy.targetSustainedLoadFraction).toBe(
      MULTI_GPU_DEFAULT_POLICY.targetSustainedLoadFraction,
    );
    expect(r.policy.minimumCapacityWatts).toBe(MULTI_GPU_DEFAULT_POLICY.minimumCapacityWatts);
  });

  it("controls by sustained-utilization when sustained is the binding constraint", () => {
    const r = recommendPsu(
      baseTotals({ sustainedDcWatts: 800, transientDcWatts: 850 }),
      undefined,
      1,
    );
    expect(r.controllingConstraint).toBe("sustained-utilization");
    expect(r.minimumRequiredCapacityWatts).toBe(800 / 0.8);
  });

  it("controls by transient-utilization when transient is binding", () => {
    const r = recommendPsu(
      baseTotals({ sustainedDcWatts: 100, transientDcWatts: 950 }),
      undefined,
      1,
    );
    expect(r.controllingConstraint).toBe("transient-utilization");
    expect(r.minimumRequiredCapacityWatts).toBe(950 / 0.95);
  });

  it("controls by reserve when reserve is binding", () => {
    const r = recommendPsu(
      baseTotals({ sustainedDcWatts: 700, transientDcWatts: 700 }),
      undefined,
      1,
    );
    // capacityForSustained = 700/0.8 = 875
    // capacityForTransient = 700/0.95 = 736.84
    // capacityForReserve = 700 + 100 = 800
    // minCapacity = 875 -> sustained
    expect(r.controllingConstraint).toBe("sustained-utilization");
  });

  it("controls by minimum-capacity when nothing else binds", () => {
    const r = recommendPsu(
      baseTotals({ sustainedDcWatts: 100, transientDcWatts: 110 }),
      undefined,
      1,
    );
    expect(r.controllingConstraint).toBe("minimum-capacity");
    expect(r.recommendedCapacityWatts).toBe(450);
  });

  it("returns null recommendation when required capacity exceeds 2000W", () => {
    const r = recommendPsu(
      baseTotals({ sustainedDcWatts: 1700, transientDcWatts: 1700 }),
      undefined,
      1,
    );
    expect(r.recommendedCapacityWatts).toBeNull();
    expect(r.minimumRequiredCapacityWatts).toBeGreaterThan(2000);
  });

  it("uses custom standard capacities when provided", () => {
    const r = recommendPsu(
      baseTotals({ sustainedDcWatts: 100, transientDcWatts: 100 }),
      {
        minimumCapacityWatts: 300,
        minimumReserveWatts: 0,
        standardCapacitiesWatts: [300, 400, 500, 600],
      },
      0,
    );
    expect(r.recommendedCapacityWatts).toBe(300);
  });
});

describe("evaluatePsu", () => {
  it("classifies undersized", () => {
    const policy = {
      ...SINGLE_GPU_DEFAULT_POLICY,
      standardCapacitiesWatts: DEFAULT_STANDARD_CAPACITIES_WATTS.slice(),
    };
    const r = evaluatePsu(
      450,
      baseTotals({ sustainedDcWatts: 600, transientDcWatts: 700 }),
      policy,
    );
    expect(r.status).toBe("undersized");
  });

  it("classifies oversized", () => {
    const policy = {
      ...SINGLE_GPU_DEFAULT_POLICY,
      standardCapacitiesWatts: DEFAULT_STANDARD_CAPACITIES_WATTS.slice(),
    };
    const r = evaluatePsu(
      2000,
      baseTotals({ sustainedDcWatts: 100, transientDcWatts: 110 }),
      policy,
    );
    expect(r.status).toBe("oversized");
  });

  it("classifies marginal when load is near limits", () => {
    const policy = {
      ...SINGLE_GPU_DEFAULT_POLICY,
      standardCapacitiesWatts: DEFAULT_STANDARD_CAPACITIES_WATTS.slice(),
    };
    const r = evaluatePsu(
      1500,
      baseTotals({ sustainedDcWatts: 1200, transientDcWatts: 1400 }),
      policy,
    );
    expect(r.status).toBe("marginal");
  });

  it("classifies meets-policy", () => {
    const policy = {
      ...SINGLE_GPU_DEFAULT_POLICY,
      standardCapacitiesWatts: DEFAULT_STANDARD_CAPACITIES_WATTS.slice(),
    };
    const r = evaluatePsu(
      1500,
      baseTotals({ sustainedDcWatts: 800, transientDcWatts: 900 }),
      policy,
    );
    expect(r.status).toBe("meets-policy");
  });
});

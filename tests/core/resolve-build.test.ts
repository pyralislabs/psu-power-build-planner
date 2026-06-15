import { describe, expect, it } from "vitest";
import {
  PROFILE_PRESET_TABLE,
  resolveBuild,
  selectTransientCorrelation,
  selectUtilization,
} from "../../src/core/resolve-build.js";
import { createWarningCollector } from "../../src/core/warnings.js";
import type { OperatingProfileInput } from "../../src/core/types.js";
import { PlannerValidationError } from "../../src/core/errors.js";

const profile: OperatingProfileInput = {
  preset: "local-ai-inference",
  poweredHoursPerDay: 8,
  workloadShare: 0.5,
  categoryUtilization: {},
  fallbackUtilization: 0.2,
  ratePerKwh: 0.16,
  currency: "USD",
};

describe("selectUtilization", () => {
  it("prefers line override over category", () => {
    expect(selectUtilization(profile, "gpu", 0.9)).toBe(0.9);
  });
  it("falls back to category utilization", () => {
    expect(
      selectUtilization({ ...profile, categoryUtilization: { gpu: 0.5 } }, "gpu", undefined),
    ).toBe(0.5);
  });
  it("falls back to profile fallback", () => {
    expect(selectUtilization(profile, "platform", undefined)).toBe(0.2);
  });
  it("clamps invalid values", () => {
    expect(selectUtilization(profile, "gpu", 1.5)).toBe(1);
    expect(selectUtilization(profile, "gpu", -0.5)).toBe(0);
  });
});

describe("selectTransientCorrelation", () => {
  it("uses 1.0 for gpu in a single-GPU build", () => {
    const r = selectTransientCorrelation("gpu", 1, undefined);
    expect(r.value).toBe(1);
    expect(r.defaulted).toBe(1);
  });
  it("uses 1.0 for gpu in a multi-GPU build", () => {
    const r = selectTransientCorrelation("gpu", 4, undefined);
    expect(r.value).toBe(1);
  });
  it("uses 1.0 for cpu by default", () => {
    expect(selectTransientCorrelation("cpu", 0, undefined).value).toBe(1);
  });
  it("uses 0.5 for storage by default", () => {
    expect(selectTransientCorrelation("storage", 0, undefined).value).toBe(0.5);
  });
  it("respects line override", () => {
    const r = selectTransientCorrelation("storage", 0, 0.9);
    expect(r.value).toBe(0.9);
    expect(r.defaulted).toBe(0.5);
  });
});

describe("PROFILE_PRESET_TABLE", () => {
  it("contains all 6 presets", () => {
    expect(Object.keys(PROFILE_PRESET_TABLE)).toHaveLength(6);
  });
  it("local-ai-inference uses high GPU utilization", () => {
    expect(PROFILE_PRESET_TABLE["local-ai-inference"].utilization.gpu).toBeGreaterThan(0.7);
  });
});

describe("resolveBuild", () => {
  it("throws on unknown componentId", () => {
    const w = createWarningCollector();
    expect(() =>
      resolveBuild(
        {
          lines: [{ id: "missing", componentId: "no-such-component" }],
          profile,
        },
        w,
      ),
    ).toThrow(PlannerValidationError);
  });

  it("throws when neither componentId nor manualComponent is provided", () => {
    const w = createWarningCollector();
    expect(() => resolveBuild({ lines: [{ id: "x" }], profile }, w)).toThrow(/INVALID_LINE/);
  });

  it("emits MANUAL_COMPONENT and MANUAL_TRANSIENT_DEFAULTED for transient-less manual lines", () => {
    const w = createWarningCollector();
    const result = resolveBuild(
      {
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "Thing",
              category: "accessory",
              idleDcWattsEach: 1,
              sustainedDcWattsEach: 5,
            },
          },
        ],
        profile,
      },
      w,
    );
    const codes = w.warnings.map((x) => x.code);
    expect(codes).toContain("MANUAL_COMPONENT");
    expect(codes).toContain("MANUAL_TRANSIENT_DEFAULTED");
    expect(result.lines[0]!.powerEach.transientDcWattsEach).toBe(5);
  });

  it("emits FIELD_OVERRIDE_USED when overrides are provided", () => {
    const w = createWarningCollector();
    resolveBuild(
      {
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "Thing",
              category: "accessory",
              idleDcWattsEach: 1,
              sustainedDcWattsEach: 5,
              transientDcWattsEach: 6,
            },
            overrides: { idleDcWattsEach: 2 },
          },
        ],
        profile,
      },
      w,
    );
    const codes = w.warnings.map((x) => x.code);
    expect(codes).toContain("FIELD_OVERRIDE_USED");
  });

  it("emits TRANSIENT_CORRELATION_OVERRIDDEN when override differs from default", () => {
    const w = createWarningCollector();
    resolveBuild(
      {
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "Storage",
              category: "storage",
              idleDcWattsEach: 1,
              sustainedDcWattsEach: 5,
              transientDcWattsEach: 6,
            },
            transientCorrelation: 0.9,
          },
        ],
        profile,
      },
      w,
    );
    const codes = w.warnings.map((x) => x.code);
    expect(codes).toContain("TRANSIENT_CORRELATION_OVERRIDDEN");
  });

  it("counts GPUs from GPU category and quantity", () => {
    const w = createWarningCollector();
    const result = resolveBuild(
      {
        lines: [
          {
            id: "gpus",
            manualComponent: {
              name: "Card",
              category: "gpu",
              idleDcWattsEach: 10,
              sustainedDcWattsEach: 300,
              transientDcWattsEach: 360,
            },
            quantity: 2,
          },
        ],
        profile,
      },
      w,
    );
    expect(result.gpuCount).toBe(2);
  });

  it("rejects bad power ordering after overrides", () => {
    const w = createWarningCollector();
    expect(() =>
      resolveBuild(
        {
          lines: [
            {
              id: "m",
              manualComponent: {
                name: "X",
                category: "accessory",
                idleDcWattsEach: 5,
                sustainedDcWattsEach: 5,
                transientDcWattsEach: 5,
              },
              overrides: { idleDcWattsEach: 10 },
            },
          ],
          profile,
        },
        w,
      ),
    ).toThrow(/INVALID_POWER_VALUES/);
  });
});

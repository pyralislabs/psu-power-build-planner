import { describe, expect, it } from "vitest";
import { validatePlannerInput, validateEfficiencyCurvePublic } from "../../src/core/validate.js";
import { PlannerValidationError } from "../../src/core/errors.js";

describe("validatePlannerInput", () => {
  const baseInput = {
    schemaVersion: 1 as const,
    lines: [
      {
        id: "cpu",
        componentId: "intel-core-i9-14900k",
        quantity: 1,
      },
    ],
    operatingProfile: {
      preset: "local-ai-inference" as const,
      poweredHoursPerDay: 8,
      daysPerYear: 365,
      workloadShare: 0.5,
      categoryUtilization: {},
      fallbackUtilization: 0.2,
      ratePerKwh: 0.16,
      currency: "USD",
    },
  };

  it("accepts a well-formed minimal input", () => {
    const out = validatePlannerInput(baseInput);
    expect(out.schemaVersion).toBe(1);
    expect(out.lines).toHaveLength(1);
    expect(out.operatingProfile.currency).toBe("USD");
  });

  it("rejects unknown schemaVersion", () => {
    expect(() => validatePlannerInput({ ...baseInput, schemaVersion: 2 })).toThrow(
      PlannerValidationError,
    );
  });

  it("rejects unknown field", () => {
    expect(() => validatePlannerInput({ ...baseInput, extraField: "nope" })).toThrow(
      /UNKNOWN_FIELD/,
    );
  });

  it("rejects prototype-polluting keys", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        // Bypass Object.create to set __proto__ as own property
        ...({ ["__proto__" as string]: { polluted: true } } as Record<string, unknown>),
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects empty lines array", () => {
    expect(() => validatePlannerInput({ ...baseInput, lines: [] })).toThrow(/EMPTY_BUILD/);
  });

  it("rejects duplicate line ids", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          { id: "cpu", componentId: "intel-core-i9-14900k", quantity: 1 },
          { id: "cpu", componentId: "intel-core-i9-14900k", quantity: 1 },
        ],
      }),
    ).toThrow(/DUPLICATE_LINE_ID/);
  });

  it("rejects invalid quantity", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "cpu", componentId: "intel-core-i9-14900k", quantity: 0 }],
      }),
    ).toThrow(/INVALID_QUANTITY/);
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "cpu", componentId: "intel-core-i9-14900k", quantity: 33 }],
      }),
    ).toThrow(/INVALID_QUANTITY/);
  });

  it("rejects non-integer quantity", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "cpu", componentId: "intel-core-i9-14900k", quantity: 1.5 }],
      }),
    ).toThrow(/INVALID_QUANTITY/);
  });

  it("rejects line that references both componentId and manualComponent", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "cpu",
            componentId: "intel-core-i9-14900k",
            manualComponent: {
              name: "Manual CPU",
              category: "cpu",
              idleDcWattsEach: 5,
              sustainedDcWattsEach: 100,
            },
          },
        ],
      }),
    ).toThrow(/INVALID_LINE/);
  });

  it("accepts a valid manual component", () => {
    const out = validatePlannerInput({
      ...baseInput,
      lines: [
        {
          id: "manual-cpu",
          manualComponent: {
            name: "Test CPU",
            category: "cpu",
            idleDcWattsEach: 5,
            sustainedDcWattsEach: 100,
            transientDcWattsEach: 130,
          },
        },
      ],
    });
    expect(out.lines[0]!.manualComponent).toBeDefined();
  });

  it("rejects invalid manual power ordering", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "manual-cpu",
            manualComponent: {
              name: "Bad ordering",
              category: "cpu",
              idleDcWattsEach: 100,
              sustainedDcWattsEach: 50,
            },
          },
        ],
      }),
    ).toThrow(/INVALID_POWER_VALUES/);
  });

  it("rejects utilization outside 0..1", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          { id: "cpu", componentId: "intel-core-i9-14900k", quantity: 1, workloadUtilization: 1.1 },
        ],
      }),
    ).toThrow(/INVALID_UTILIZATION/);
  });

  it("rejects negative ratePerKwh", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, ratePerKwh: -0.01 },
      }),
    ).toThrow(/INVALID_RATE/);
  });

  it("rejects invalid currency", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, currency: "us" },
      }),
    ).toThrow(/INVALID_CURRENCY/);
  });

  it("rejects powered hours above 24", () => {
    try {
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, poweredHoursPerDay: 25 },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PlannerValidationError);
      const issues = (err as PlannerValidationError).issues;
      expect(issues.some((i) => i.path === "operatingProfile.poweredHoursPerDay")).toBe(true);
    }
  });

  it("rejects invalid psu policy fraction", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { targetSustainedLoadFraction: 0 },
      }),
    ).toThrow(/INVALID_PSU_POLICY/);
  });

  it("rejects unsorted standard capacity list", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { standardCapacitiesWatts: [500, 450] },
      }),
    ).toThrow(/INVALID_CAPACITY_LIST/);
  });

  it("rejects duplicate entries in standard capacity list", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { standardCapacitiesWatts: [450, 450, 500] },
      }),
    ).toThrow(/INVALID_CAPACITY_LIST/);
  });

  it("rejects efficiency override at or below 0", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        efficiencyOverrideFraction: 0,
      }),
    ).toThrow(/INVALID_EFFICIENCY_OVERRIDE/);
  });

  it("rejects evaluatedPsuCapacityWatts out of range", () => {
    expect(() => validatePlannerInput({ ...baseInput, evaluatedPsuCapacityWatts: 10 })).toThrow(
      /INVALID_PSU_CAPACITY/,
    );
  });

  it("omits daysPerYear from the result when the input omits it", () => {
    const op = { ...baseInput.operatingProfile };
    delete (op as { daysPerYear?: number }).daysPerYear;
    const out = validatePlannerInput({ ...baseInput, operatingProfile: op });
    expect(out.operatingProfile.daysPerYear).toBeUndefined();
  });

  it("accepts explicit daysPerYear", () => {
    const out = validatePlannerInput({
      ...baseInput,
      operatingProfile: { ...baseInput.operatingProfile, daysPerYear: 366 },
    });
    expect(out.operatingProfile.daysPerYear).toBe(366);
  });

  it("rejects non-integer daysPerYear", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, daysPerYear: 365.5 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects daysPerYear above 366", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, daysPerYear: 400 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects daysPerYear below 1", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, daysPerYear: 0 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects workloadShare above 1", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, workloadShare: 1.5 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects negative workloadShare", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, workloadShare: -0.1 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-finite workloadShare", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, workloadShare: NaN },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-finite poweredHoursPerDay", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, poweredHoursPerDay: NaN },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-finite fallbackUtilization", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, fallbackUtilization: NaN },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-finite ratePerKwh", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, ratePerKwh: NaN },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-string currency", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, currency: 123 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-string currency with 4 letters", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, currency: "USDA" },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-string categoryUtilization entry", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: {
          ...baseInput.operatingProfile,
          categoryUtilization: { cpu: "abc" as unknown as number },
        },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects unknown category in categoryUtilization", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: {
          ...baseInput.operatingProfile,
          categoryUtilization: { invalid_category: 0.5 as unknown as number },
        },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-object categoryUtilization", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: {
          ...baseInput.operatingProfile,
          categoryUtilization: 123 as unknown as never,
        },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects line that has neither componentId nor manualComponent", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "x" }],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-string componentId", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "x", componentId: 123 as unknown as string }],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-integer quantity", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "x", componentId: "intel-core-i9-14900k", quantity: 1.5 }],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects manual component with non-finite idle", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "X",
              category: "platform",
              idleDcWattsEach: NaN,
              sustainedDcWattsEach: 10,
            },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects manual component with non-finite sustained", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "X",
              category: "platform",
              idleDcWattsEach: 5,
              sustainedDcWattsEach: NaN,
            },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects manual component with negative transient", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "X",
              category: "platform",
              idleDcWattsEach: 5,
              sustainedDcWattsEach: 10,
              transientDcWattsEach: -1,
            },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-finite override", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "x",
            componentId: "intel-core-i9-14900k",
            overrides: { idleDcWattsEach: NaN },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects negative override", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "x",
            componentId: "intel-core-i9-14900k",
            overrides: { idleDcWattsEach: -1 },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects psu policy targetSustainedLoadFraction > 1", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { targetSustainedLoadFraction: 1.1 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects psu policy maxTransientLoadFraction > 1", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { maxTransientLoadFraction: 1.5 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects psu policy negative minimumReserveWatts", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { minimumReserveWatts: -10 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects psu policy minimumCapacityWatts out of range", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { minimumCapacityWatts: 1 },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects efficiencyProfileId with non-kebab characters", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        efficiencyProfileId: "Invalid ID",
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-string efficiencyProfileId", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        efficiencyProfileId: 123 as unknown as string,
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects empty efficiencyProfileId", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        efficiencyProfileId: "",
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects empty buildName when provided", () => {
    expect(() => validatePlannerInput({ ...baseInput, buildName: "" })).toThrow(
      PlannerValidationError,
    );
  });

  it("rejects non-array lines", () => {
    expect(() => validatePlannerInput({ ...baseInput, lines: "x" })).toThrow(
      PlannerValidationError,
    );
  });

  it("rejects too many lines", () => {
    const lines: Array<{ id: string; componentId: string }> = [];
    for (let i = 0; i < 501; i++) {
      lines.push({ id: `l${i}`, componentId: "intel-core-i9-14900k" });
    }
    expect(() => validatePlannerInput({ ...baseInput, lines })).toThrow(PlannerValidationError);
  });

  it("rejects too few lines", () => {
    expect(() => validatePlannerInput({ ...baseInput, lines: [] })).toThrow(PlannerValidationError);
  });

  it("rejects when lines is missing", () => {
    const obj = { ...baseInput } as Record<string, unknown>;
    delete obj["lines"];
    expect(() => validatePlannerInput(obj)).toThrow(PlannerValidationError);
  });

  it("rejects non-array standardCapacitiesWatts", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { standardCapacitiesWatts: "not-array" as unknown as number[] },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects standardCapacitiesWatts with too few entries", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { standardCapacitiesWatts: [500] },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects standardCapacitiesWatts with non-integer entry", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { standardCapacitiesWatts: [500, 500.5, 600] },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects standardCapacitiesWatts with entry out of range", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        psuPolicy: { standardCapacitiesWatts: [500, 5, 600] },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-string line id", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: 123 as unknown as string, componentId: "intel-core-i9-14900k" }],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects empty line id", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "", componentId: "intel-core-i9-14900k" }],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects line id that is not kebab-case", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "Bad_Id", componentId: "intel-core-i9-14900k" }],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-object manualComponent", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [{ id: "m", manualComponent: "not-an-object" as unknown as never }],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects manualComponent with non-string name", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "m",
            manualComponent: {
              name: 123 as unknown as string,
              category: "platform",
              idleDcWattsEach: 5,
              sustainedDcWattsEach: 10,
            },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects manualComponent with name too long", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "a".repeat(200),
              category: "platform",
              idleDcWattsEach: 5,
              sustainedDcWattsEach: 10,
            },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects manualComponent with invalid category", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "X",
              category: "invalid" as never,
              idleDcWattsEach: 5,
              sustainedDcWattsEach: 10,
            },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects manualComponent with negative sustained", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "m",
            manualComponent: {
              name: "X",
              category: "platform",
              idleDcWattsEach: 5,
              sustainedDcWattsEach: -10,
            },
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects invalid preset", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, preset: "invalid-preset" as never },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects non-string preset", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        operatingProfile: { ...baseInput.operatingProfile, preset: 123 as unknown as never },
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects invalid line workloadUtilization", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "cpu",
            componentId: "intel-core-i9-14900k",
            workloadUtilization: 1.5,
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("rejects invalid line transientCorrelation", () => {
    expect(() =>
      validatePlannerInput({
        ...baseInput,
        lines: [
          {
            id: "cpu",
            componentId: "intel-core-i9-14900k",
            transientCorrelation: 1.5,
          },
        ],
      }),
    ).toThrow(PlannerValidationError);
  });

  it("accepts non-string buildName (rejects) only non-empty strings", () => {
    expect(() =>
      validatePlannerInput({ ...baseInput, buildName: 123 as unknown as string }),
    ).toThrow(PlannerValidationError);
  });
});

describe("validateEfficiencyCurvePublic", () => {
  it("accepts a valid curve", () => {
    const curve = validateEfficiencyCurvePublic({
      points: [
        { loadFraction: 0.1, efficiencyFraction: 0.82 },
        { loadFraction: 0.5, efficiencyFraction: 0.9 },
        { loadFraction: 1.0, efficiencyFraction: 0.88 },
      ],
    });
    expect(curve.points).toHaveLength(3);
  });

  it("rejects an unsorted curve", () => {
    expect(() =>
      validateEfficiencyCurvePublic({
        points: [
          { loadFraction: 0.5, efficiencyFraction: 0.9 },
          { loadFraction: 0.1, efficiencyFraction: 0.82 },
        ],
      }),
    ).toThrow(/INVALID_EFFICIENCY_CURVE/);
  });

  it("rejects zero efficiency", () => {
    expect(() =>
      validateEfficiencyCurvePublic({
        points: [
          { loadFraction: 0.1, efficiencyFraction: 0 },
          { loadFraction: 0.5, efficiencyFraction: 0.9 },
        ],
      }),
    ).toThrow(/INVALID_EFFICIENCY_CURVE/);
  });
});

import { describe, expect, it } from "vitest";
import { addWarning, createWarningCollector, finalizeWarnings } from "../../src/core/warnings.js";

describe("warning helpers", () => {
  it("accumulates warnings", () => {
    const c = createWarningCollector();
    addWarning(c, { code: "FOO", severity: "info", message: "x" });
    addWarning(c, { code: "BAR", severity: "warning", message: "y" });
    expect(c.warnings).toHaveLength(2);
  });

  it("finalizeWarnings appends the two mandatory planner notes", () => {
    const c = createWarningCollector();
    const out = finalizeWarnings(c);
    const codes = out.map((w) => w.code);
    expect(codes).toContain("ESTIMATE_NOT_MEASUREMENT");
    expect(codes).toContain("PSU_COMPATIBILITY_NOT_CHECKED");
  });

  it("finalizeWarnings does not duplicate mandatory notes when called twice", () => {
    const c = createWarningCollector();
    const a = finalizeWarnings(c);
    const b = finalizeWarnings(c);
    const countA = a.filter((w) => w.code === "ESTIMATE_NOT_MEASUREMENT").length;
    const countB = b.filter((w) => w.code === "ESTIMATE_NOT_MEASUREMENT").length;
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });
});

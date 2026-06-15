import { describe, expect, it } from "vitest";
import { PlannerValidationError, PlannerUnsupportedError } from "../../src/core/errors.js";

describe("PlannerValidationError", () => {
  it("sets the code to the first issue's code", () => {
    const err = new PlannerValidationError([
      { code: "INVALID_LINE", path: "lines[0]", message: "bad line" },
    ]);
    expect(err.code).toBe("INVALID_LINE");
    expect(err.issues).toHaveLength(1);
    expect(err.issues[0]!.code).toBe("INVALID_LINE");
  });

  it("uses the fallback code when no issues", () => {
    const err = new PlannerValidationError([], "EMPTY_BUILD");
    expect(err.code).toBe("EMPTY_BUILD");
  });

  it("freezes the issues array", () => {
    const err = new PlannerValidationError([
      { code: "INVALID_LINE", path: "lines[0]", message: "x" },
    ]);
    expect(() => {
      (err.issues as unknown as { push: (v: unknown) => void }).push({} as never);
    }).toThrow();
  });

  it("single() returns a one-issue error", () => {
    const err = PlannerValidationError.single({
      code: "EMPTY_BUILD",
      path: "lines",
      message: "no lines",
    });
    expect(err.issues).toHaveLength(1);
    expect(err.code).toBe("EMPTY_BUILD");
  });
});

describe("PlannerUnsupportedError", () => {
  it("carries a code and a message", () => {
    const err = new PlannerUnsupportedError("OVER_RANGE", "Too much");
    expect(err.code).toBe("OVER_RANGE");
    expect(err.message).toBe("Too much");
    expect(err.name).toBe("PlannerUnsupportedError");
  });
});

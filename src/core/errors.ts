export type PlannerValidationCode =
  | "INVALID_INPUT"
  | "INVALID_LINE"
  | "INVALID_LINE_ID"
  | "DUPLICATE_LINE_ID"
  | "INVALID_QUANTITY"
  | "INVALID_GPU_QUANTITY"
  | "INVALID_MANUAL_COMPONENT"
  | "INVALID_POWER_VALUES"
  | "INVALID_OVERRIDE"
  | "INVALID_UTILIZATION"
  | "INVALID_CORRELATION"
  | "INVALID_OPERATING_PROFILE"
  | "INVALID_RATE"
  | "INVALID_CURRENCY"
  | "INVALID_PSU_POLICY"
  | "INVALID_CAPACITY_LIST"
  | "INVALID_PSU_CAPACITY"
  | "INVALID_EFFICIENCY_OVERRIDE"
  | "INVALID_EFFICIENCY_CURVE"
  | "UNKNOWN_FIELD"
  | "UNKNOWN_COMPONENT"
  | "SCHEMA_VERSION_MISMATCH"
  | "EMPTY_BUILD";

export interface PlannerValidationIssue {
  code: PlannerValidationCode;
  path: string;
  message: string;
}

export class PlannerValidationError extends Error {
  public readonly issues: ReadonlyArray<PlannerValidationIssue>;
  public readonly code: PlannerValidationCode;

  constructor(
    issues: PlannerValidationIssue[],
    fallbackCode: PlannerValidationCode = "INVALID_INPUT",
  ) {
    const summary = issues.length === 0 ? fallbackCode : issues[0]!.code;
    super(`Planner validation failed: ${summary}`);
    this.name = "PlannerValidationError";
    this.issues = Object.freeze(issues.slice());
    this.code = summary;
  }

  public static single(issue: PlannerValidationIssue): PlannerValidationError {
    return new PlannerValidationError([issue], issue.code);
  }
}

export class PlannerUnsupportedError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PlannerUnsupportedError";
    this.code = code;
  }
}

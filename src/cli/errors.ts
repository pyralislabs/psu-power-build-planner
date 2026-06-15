import { PlannerValidationError, PlannerUnsupportedError } from "../core/errors.js";

export type CliExitCode = 0 | 1 | 2 | 3 | 4 | 5;

const VALID_EXIT_CODES: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5]);

export function toExitCode(err: unknown): CliExitCode {
  if (err instanceof PlannerValidationError) {
    return 4;
  }
  if (err instanceof PlannerUnsupportedError) {
    return 5;
  }
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; exitCode?: unknown };
    if (typeof e.exitCode === "number" && VALID_EXIT_CODES.has(e.exitCode)) {
      return e.exitCode as CliExitCode;
    }
    if (typeof e.code === "string") {
      if (e.code === "INVALID_INPUT" || e.code === "INVALID_ARGUMENTS") {
        return 2;
      }
      if (e.code === "INPUT_READ_ERROR" || e.code === "INPUT_PARSE_ERROR") {
        return 3;
      }
    }
  }
  return 1;
}

export interface CliErrorShape {
  code: string;
  message: string;
  issues?: Array<{ path: string; message: string }>;
}

export function toErrorEnvelope(err: unknown): CliErrorShape {
  if (err instanceof PlannerValidationError) {
    return {
      code: "VALIDATION_FAILED",
      message: err.message,
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    };
  }
  if (err instanceof PlannerUnsupportedError) {
    return {
      code: err.code,
      message: err.message,
    };
  }
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    if (typeof e.code === "string" && typeof e.message === "string") {
      return { code: e.code, message: e.message };
    }
  }
  return { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) };
}

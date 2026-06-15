import type { PlannerWarning } from "./types.js";

export interface WarningCollector {
  warnings: PlannerWarning[];
  readonly mandatoryAdded: boolean;
}

export function createWarningCollector(): WarningCollector {
  return { warnings: [], mandatoryAdded: false };
}

export function addWarning(c: WarningCollector, w: PlannerWarning): void {
  c.warnings.push(w);
}

export function finalizeWarnings(c: WarningCollector): PlannerWarning[] {
  if (!c.mandatoryAdded) {
    c.warnings.push({
      code: "ESTIMATE_NOT_MEASUREMENT",
      severity: "info",
      message: "These values are component-derived planning estimates, not measured wall power.",
    });
    c.warnings.push({
      code: "PSU_COMPATIBILITY_NOT_CHECKED",
      severity: "info",
      message:
        "Wattage alone does not establish PSU connector, rail, cable, ATX, or physical compatibility. Verify with the PSU manufacturer and system integrator.",
    });
    (c as { mandatoryAdded: boolean }).mandatoryAdded = true;
  }
  return c.warnings.slice();
}

import type { EfficiencyCurve, EfficiencyResult, PlannerWarning } from "./types.js";
import { createWarningCollector } from "./warnings.js";

export function calculateEfficiency(
  dcWatts: number,
  psuCapacityWatts: number,
  curve: EfficiencyCurve,
): EfficiencyResult {
  const warnings = createWarningCollector();
  if (psuCapacityWatts <= 0) {
    warnings.warnings.push({
      code: "PSU_UNDERSIZED",
      severity: "critical",
      message: "PSU capacity must be greater than zero to compute efficiency.",
    });
    return {
      dcWatts,
      psuCapacityWatts,
      loadFraction: 0,
      efficiencyFraction: null,
      acInputWatts: null,
      conversionLossWatts: null,
      warnings: warnings.warnings,
    };
  }
  if (dcWatts < 0) {
    warnings.warnings.push({
      code: "INVALID_INPUT",
      severity: "critical",
      message: "DC demand must be non-negative.",
    });
    return {
      dcWatts,
      psuCapacityWatts,
      loadFraction: 0,
      efficiencyFraction: null,
      acInputWatts: null,
      conversionLossWatts: null,
      warnings: warnings.warnings,
    };
  }
  const loadFraction = dcWatts / psuCapacityWatts;
  if (loadFraction > 1) {
    warnings.warnings.push({
      code: "PSU_UNDERSIZED",
      severity: "critical",
      message: `DC demand ${dcWatts}W exceeds PSU capacity ${psuCapacityWatts}W.`,
    });
    return {
      dcWatts,
      psuCapacityWatts,
      loadFraction,
      efficiencyFraction: null,
      acInputWatts: null,
      conversionLossWatts: null,
      warnings: warnings.warnings,
    };
  }
  const efficiencyFraction = efficiencyAt(loadFraction, curve, warnings.warnings);
  if (efficiencyFraction === null) {
    return {
      dcWatts,
      psuCapacityWatts,
      loadFraction,
      efficiencyFraction: null,
      acInputWatts: null,
      conversionLossWatts: null,
      warnings: warnings.warnings,
    };
  }
  const acInputWatts = dcWatts / efficiencyFraction;
  return {
    dcWatts,
    psuCapacityWatts,
    loadFraction,
    efficiencyFraction,
    acInputWatts,
    conversionLossWatts: acInputWatts - dcWatts,
    warnings: warnings.warnings,
  };
}

export function efficiencyAt(
  loadFraction: number,
  curve: EfficiencyCurve,
  warnings: PlannerWarning[],
): number | null {
  const points = curve.points;
  if (points.length === 0) {
    return null;
  }
  if (loadFraction <= points[0]!.loadFraction) {
    if (loadFraction < points[0]!.loadFraction) {
      warnings.push({
        code: "EFFICIENCY_BELOW_CURVE_RANGE",
        severity: "info",
        message: `Load fraction ${loadFraction.toFixed(4)} is below the lowest curve point (${points[0]!.loadFraction}).`,
      });
    }
    return points[0]!.efficiencyFraction;
  }
  const last = points[points.length - 1]!;
  if (loadFraction >= last.loadFraction) {
    if (loadFraction > last.loadFraction) {
      warnings.push({
        code: "EFFICIENCY_ABOVE_CURVE_RANGE",
        severity: "info",
        message: `Load fraction ${loadFraction.toFixed(4)} is above the highest curve point (${last.loadFraction}); PSU is likely overloaded.`,
      });
    }
    return last.efficiencyFraction;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (loadFraction >= a.loadFraction && loadFraction <= b.loadFraction) {
      if (a.loadFraction === b.loadFraction) {
        return a.efficiencyFraction;
      }
      const t = (loadFraction - a.loadFraction) / (b.loadFraction - a.loadFraction);
      return a.efficiencyFraction + (b.efficiencyFraction - a.efficiencyFraction) * t;
    }
  }
  return last.efficiencyFraction;
}

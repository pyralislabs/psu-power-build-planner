import { validatePlannerInput } from "./core/validate.js";
import { resolveBuild } from "./core/resolve-build.js";
import { buildTotals } from "./core/calculate-build.js";
import { evaluatePsu, recommendPsu } from "./core/recommend-psu.js";
import { calculateEfficiency } from "./core/calculate-efficiency.js";
import { calculateEnergyCost } from "./core/calculate-cost.js";
import { createWarningCollector, finalizeWarnings } from "./core/warnings.js";
import type {
  AcPowerResult,
  BuildPowerTotals,
  EfficiencyProfile,
  EnergyCostResult,
  OperatingProfileInput,
  PlannerAssumptions,
  PlannerInput,
  PlannerResult,
  PlannerWarning,
  PsuEvaluation,
  PsuRecommendation,
  ResolvedBuildLine,
} from "./core/types.js";
import { PlannerUnsupportedError } from "./core/errors.js";
import { getEfficiencyProfile } from "./data/index.js";

export { recommendPsu, evaluatePsu } from "./core/recommend-psu.js";
export { calculateEfficiency } from "./core/calculate-efficiency.js";
export { calculateEnergyCost } from "./core/calculate-cost.js";
export { PlannerValidationError, PlannerUnsupportedError } from "./core/errors.js";
export {
  listComponents,
  getComponent,
  listSources,
  getSource,
  listEfficiencyProfiles,
  getEfficiencyProfile,
  datasetMeta,
} from "./data/index.js";
export { validatePlannerInput, validateEfficiencyCurvePublic } from "./core/validate.js";
export {
  DEFAULT_TRANSIENT_CORRELATION,
  PROFILE_PRESET_TABLE,
  selectUtilization,
  selectTransientCorrelation,
} from "./core/resolve-build.js";
export {
  DEFAULT_STANDARD_CAPACITIES_WATTS,
  SINGLE_GPU_DEFAULT_POLICY,
  MULTI_GPU_DEFAULT_POLICY,
} from "./core/recommend-psu.js";

export type {
  BuildLineInput,
  BuildPowerTotals,
  ComponentCategory,
  ComponentFilters,
  Confidence,
  ControllingConstraint,
  EfficiencyCurve,
  EfficiencyPoint,
  EfficiencyProfile,
  EfficiencyResult,
  AcPowerResult,
  EnergyCostInput,
  EnergyCostResult,
  LinePowerTotals,
  ManualComponentInput,
  OperatingProfileInput,
  PlannerAssumptions,
  PlannerInput,
  PlannerResult,
  PlannerWarning,
  PowerValues,
  PsuEvaluation,
  PsuEvaluationStatus,
  PsuPolicyInput,
  PsuRecommendation,
  ResolvedBuildLine,
  ValueBasis,
  WorkloadPreset,
} from "./core/types.js";
export type { PlannerValidationIssue } from "./core/errors.js";
export type {
  ComponentRecord,
  ComponentsFile,
  SourceRecord,
  SourcesFile,
  SourcedPowerValue,
  SourceType,
  EfficiencyProfilesFile,
} from "./data/types.js";

function normalizeOperatingProfile(input: OperatingProfileInput): Required<OperatingProfileInput> {
  return {
    preset: input.preset ?? "custom",
    poweredHoursPerDay: input.poweredHoursPerDay,
    daysPerYear: input.daysPerYear ?? 365,
    workloadShare: input.workloadShare,
    categoryUtilization: { ...input.categoryUtilization },
    fallbackUtilization: input.fallbackUtilization,
    ratePerKwh: input.ratePerKwh,
    currency: input.currency,
  };
}

function resolveEfficiency(
  profileId: string | undefined,
  overrideFraction: number | undefined,
): { profile: EfficiencyProfile | undefined; overrideFraction: number | undefined } {
  if (profileId === undefined && overrideFraction === undefined) {
    return { profile: undefined, overrideFraction: undefined };
  }
  let profile: EfficiencyProfile | undefined;
  if (profileId !== undefined) {
    profile = getEfficiencyProfile(profileId);
    if (!profile) {
      throw new PlannerUnsupportedError(
        "UNKNOWN_EFFICIENCY_PROFILE",
        `Unknown efficiencyProfileId "${profileId}".`,
      );
    }
  }
  return { profile, overrideFraction };
}

interface AcStateResult {
  dcWatts: number;
  psuCapacityWatts: number;
  loadFraction: number;
  efficiencyFraction: number | null;
  acInputWatts: number | null;
  conversionLossWatts: number | null;
  warnings: PlannerWarning[];
}

function computeAcState(
  dc: number,
  psuCapacityWatts: number,
  profile: EfficiencyProfile | undefined,
  overrideFraction: number | undefined,
): AcStateResult {
  if (overrideFraction !== undefined) {
    if (dc <= 0) {
      return {
        dcWatts: dc,
        psuCapacityWatts,
        loadFraction: 0,
        efficiencyFraction: overrideFraction,
        acInputWatts: dc,
        conversionLossWatts: 0,
        warnings: [],
      };
    }
    const ac = dc / overrideFraction;
    return {
      dcWatts: dc,
      psuCapacityWatts,
      loadFraction: dc / psuCapacityWatts,
      efficiencyFraction: overrideFraction,
      acInputWatts: ac,
      conversionLossWatts: ac - dc,
      warnings: [],
    };
  }
  if (!profile) {
    return {
      dcWatts: dc,
      psuCapacityWatts,
      loadFraction: dc / psuCapacityWatts,
      efficiencyFraction: null,
      acInputWatts: null,
      conversionLossWatts: null,
      warnings: [],
    };
  }
  return calculateEfficiency(dc, psuCapacityWatts, profile);
}

function buildAcPowerResult(args: {
  psuCapacityWatts: number | null;
  profile: EfficiencyProfile | undefined;
  overrideFraction: number | undefined;
  idleDc: number;
  workloadDc: number;
  sustainedDc: number;
}): AcPowerResult {
  const { psuCapacityWatts, profile, overrideFraction, idleDc, workloadDc, sustainedDc } = args;
  if (psuCapacityWatts === null) {
    return {
      psuCapacityWatts: null,
      ...(profile ? { efficiencyProfileId: profile.id } : {}),
      idle: emptyAcState(idleDc),
      workload: emptyAcState(workloadDc),
      sustained: emptyAcState(sustainedDc),
    };
  }
  return {
    psuCapacityWatts,
    ...(profile ? { efficiencyProfileId: profile.id } : {}),
    idle: computeAcState(idleDc, psuCapacityWatts, profile, overrideFraction),
    workload: computeAcState(workloadDc, psuCapacityWatts, profile, overrideFraction),
    sustained: computeAcState(sustainedDc, psuCapacityWatts, profile, overrideFraction),
  };
}

function emptyAcState(dc: number): AcStateResult {
  return {
    dcWatts: dc,
    psuCapacityWatts: 0,
    loadFraction: 0,
    efficiencyFraction: null,
    acInputWatts: null,
    conversionLossWatts: null,
    warnings: [],
  };
}

function buildAssumptions(
  profile: Required<OperatingProfileInput>,
  policy: PsuRecommendation["policy"],
  profileId: string | undefined,
  overrideFraction: number | undefined,
  overrides: ResolvedBuildLine[],
): PlannerAssumptions {
  return {
    operatingProfile: profile,
    psuPolicy: policy,
    ...(profileId ? { efficiencyProfileId: profileId } : {}),
    ...(overrideFraction !== undefined ? { efficiencyOverrideFraction: overrideFraction } : {}),
    overrides: overrides.flatMap((line) =>
      line.overriddenFields.map((field) => ({
        lineId: line.id,
        field,
        value: line.powerEach[field],
      })),
    ),
  };
}

export function planBuild(rawInput: unknown): PlannerResult {
  const input: PlannerInput = validatePlannerInput(rawInput);
  const warnings = createWarningCollector();

  const { lines: resolvedLines, gpuCount } = resolveBuild(
    { lines: input.lines, profile: input.operatingProfile },
    warnings,
  );

  if (gpuCount >= 2) {
    warnings.warnings.push({
      code: "MULTI_GPU_BUILD",
      severity: "info",
      message: `Build contains ${gpuCount} GPUs; multi-GPU PSU policy is in effect.`,
    });
  }
  if (gpuCount > 8) {
    warnings.warnings.push({
      code: "GPU_COUNT_HIGH",
      severity: "warning",
      message: `Build contains ${gpuCount} GPUs; this exceeds typical workstation configurations.`,
    });
  }

  const totals: BuildPowerTotals = buildTotals(resolvedLines);
  const recommendation: PsuRecommendation = recommendPsu(totals, input.psuPolicy, gpuCount);
  if (recommendation.recommendedCapacityWatts === null) {
    warnings.warnings.push({
      code: "CAPACITY_EXCEEDS_V1_RANGE",
      severity: "critical",
      message: `Minimum required PSU capacity (${recommendation.minimumRequiredCapacityWatts.toFixed(0)} W) exceeds the v1 standard range (max 2000 W).`,
    });
  }

  let evaluatedPsu: PsuEvaluation | undefined;
  if (input.evaluatedPsuCapacityWatts !== undefined) {
    evaluatedPsu = evaluatePsu(input.evaluatedPsuCapacityWatts, totals, recommendation.policy);
    if (evaluatedPsu.status === "undersized") {
      warnings.warnings.push({
        code: "PSU_UNDERSIZED",
        severity: "critical",
        message: `Evaluated PSU (${input.evaluatedPsuCapacityWatts} W) is below the minimum required capacity (${recommendation.minimumRequiredCapacityWatts.toFixed(0)} W).`,
      });
    } else if (evaluatedPsu.status === "marginal") {
      warnings.warnings.push({
        code: "PSU_MARGINAL",
        severity: "warning",
        message: `Evaluated PSU (${input.evaluatedPsuCapacityWatts} W) only marginally satisfies the policy.`,
      });
    } else if (evaluatedPsu.status === "oversized") {
      warnings.warnings.push({
        code: "PSU_OVERSIZED",
        severity: "info",
        message: `Evaluated PSU (${input.evaluatedPsuCapacityWatts} W) is oversized; sustained load is below 35% of capacity.`,
      });
    }
  }

  const { profile, overrideFraction } = resolveEfficiency(
    input.efficiencyProfileId,
    input.efficiencyOverrideFraction,
  );

  const acCapacity = input.evaluatedPsuCapacityWatts ?? recommendation.recommendedCapacityWatts;
  const acPower = buildAcPowerResult({
    psuCapacityWatts: acCapacity ?? null,
    profile,
    overrideFraction,
    idleDc: totals.idleDcWatts,
    workloadDc: totals.workloadDcWatts,
    sustainedDc: totals.sustainedDcWatts,
  });
  for (const w of [
    ...acPower.idle.warnings,
    ...acPower.workload.warnings,
    ...acPower.sustained.warnings,
  ]) {
    warnings.warnings.push(w);
  }

  const profile2 = normalizeOperatingProfile(input.operatingProfile);
  const energyCost: EnergyCostResult = calculateEnergyCost({
    idleDcWatts: totals.idleDcWatts,
    workloadDcWatts: totals.workloadDcWatts,
    idleAcInputWatts: acPower.idle.acInputWatts,
    workloadAcInputWatts: acPower.workload.acInputWatts,
    poweredHoursPerDay: profile2.poweredHoursPerDay,
    daysPerYear: profile2.daysPerYear,
    workloadShare: profile2.workloadShare,
    ratePerKwh: profile2.ratePerKwh,
    currency: profile2.currency,
  });

  const assumptions = buildAssumptions(
    profile2,
    recommendation.policy,
    input.efficiencyProfileId,
    input.efficiencyOverrideFraction,
    resolvedLines,
  );

  const finalWarnings = finalizeWarnings(warnings);

  const result: PlannerResult = {
    schemaVersion: 1,
    ...(typeof input.buildName === "string" ? { buildName: input.buildName } : {}),
    resolvedLines: resolvedLines as ResolvedBuildLine[],
    totals,
    recommendation,
    ...(evaluatedPsu ? { evaluatedPsu } : {}),
    acPower,
    energyCost,
    assumptions,
    warnings: finalWarnings,
  };
  return result;
}

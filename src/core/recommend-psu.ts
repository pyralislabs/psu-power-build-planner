import type {
  BuildPowerTotals,
  ControllingConstraint,
  PsuEvaluation,
  PsuEvaluationStatus,
  PsuRecommendation,
} from "./types.js";

export const DEFAULT_STANDARD_CAPACITIES_WATTS: ReadonlyArray<number> = [
  450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 1000, 1100, 1200, 1300, 1350, 1500, 1600, 1800,
  2000,
];

export const SINGLE_GPU_DEFAULT_POLICY = {
  targetSustainedLoadFraction: 0.8,
  maxTransientLoadFraction: 0.95,
  minimumReserveWatts: 100,
  minimumCapacityWatts: 450,
} as const;

export const MULTI_GPU_DEFAULT_POLICY = {
  targetSustainedLoadFraction: 0.7,
  maxTransientLoadFraction: 0.9,
  minimumReserveWatts: 200,
  minimumCapacityWatts: 850,
} as const;

const V1_MAX_RECOMMENDED_CAPACITY = 2000;
const OVERSIZED_THRESHOLD = 0.35;
const MARGINAL_TRANSIENT_GAP = 0.05;

export interface PsuPolicy {
  targetSustainedLoadFraction: number;
  maxTransientLoadFraction: number;
  minimumReserveWatts: number;
  minimumCapacityWatts: number;
  standardCapacitiesWatts: number[];
}

function defaultPolicyFor(gpuCount: number): {
  targetSustainedLoadFraction: number;
  maxTransientLoadFraction: number;
  minimumReserveWatts: number;
  minimumCapacityWatts: number;
} {
  return gpuCount >= 2 ? { ...MULTI_GPU_DEFAULT_POLICY } : { ...SINGLE_GPU_DEFAULT_POLICY };
}

function mergePolicy(gpuCount: number, override: Partial<PsuPolicy> | undefined): PsuPolicy {
  const base = defaultPolicyFor(gpuCount);
  return {
    targetSustainedLoadFraction:
      override?.targetSustainedLoadFraction ?? base.targetSustainedLoadFraction,
    maxTransientLoadFraction: override?.maxTransientLoadFraction ?? base.maxTransientLoadFraction,
    minimumReserveWatts: override?.minimumReserveWatts ?? base.minimumReserveWatts,
    minimumCapacityWatts: override?.minimumCapacityWatts ?? base.minimumCapacityWatts,
    standardCapacitiesWatts:
      override?.standardCapacitiesWatts ?? DEFAULT_STANDARD_CAPACITIES_WATTS.slice(),
  };
}

export function roundUpToStandard(value: number, standard: ReadonlyArray<number>): number {
  for (const capacity of standard) {
    if (capacity >= value) {
      return capacity;
    }
  }
  return -1;
}

export function recommendPsu(
  totals: BuildPowerTotals,
  policyOverride?: Partial<PsuPolicy>,
  gpuCount: number = 0,
): PsuRecommendation {
  const policy = mergePolicy(gpuCount, policyOverride);
  const capacityForSustained = totals.sustainedDcWatts / policy.targetSustainedLoadFraction;
  const capacityForTransient = totals.transientDcWatts / policy.maxTransientLoadFraction;
  const capacityForReserve = totals.sustainedDcWatts + policy.minimumReserveWatts;
  const minimumRequiredCapacityWatts = Math.max(
    capacityForSustained,
    capacityForTransient,
    capacityForReserve,
    policy.minimumCapacityWatts,
  );

  let controllingConstraint: ControllingConstraint;
  if (minimumRequiredCapacityWatts === policy.minimumCapacityWatts) {
    controllingConstraint = "minimum-capacity";
  } else if (minimumRequiredCapacityWatts === capacityForTransient) {
    controllingConstraint = "transient-utilization";
  } else if (minimumRequiredCapacityWatts === capacityForReserve) {
    controllingConstraint = "reserve";
  } else {
    controllingConstraint = "sustained-utilization";
  }

  let recommendedCapacityWatts: number | null;
  if (minimumRequiredCapacityWatts > V1_MAX_RECOMMENDED_CAPACITY) {
    recommendedCapacityWatts = null;
  } else {
    const rounded = roundUpToStandard(minimumRequiredCapacityWatts, policy.standardCapacitiesWatts);
    recommendedCapacityWatts = rounded === -1 ? null : rounded;
  }

  return {
    recommendedCapacityWatts,
    minimumRequiredCapacityWatts,
    controllingConstraint,
    capacityForSustainedWatts: capacityForSustained,
    capacityForTransientWatts: capacityForTransient,
    capacityForReserveWatts: capacityForReserve,
    policy,
  };
}

export function evaluatePsu(
  capacityWatts: number,
  totals: BuildPowerTotals,
  policy: PsuPolicy,
): PsuEvaluation {
  const sustainedLoadFraction = capacityWatts > 0 ? totals.sustainedDcWatts / capacityWatts : 0;
  const transientLoadFraction = capacityWatts > 0 ? totals.transientDcWatts / capacityWatts : 0;
  const reserveWatts = capacityWatts - totals.sustainedDcWatts;
  const capacityForTransient = totals.transientDcWatts / policy.maxTransientLoadFraction;
  const capacityForSustained = totals.sustainedDcWatts / policy.targetSustainedLoadFraction;
  const minimumRequiredCapacityWatts = Math.max(
    capacityForSustained,
    capacityForTransient,
    totals.sustainedDcWatts + policy.minimumReserveWatts,
    policy.minimumCapacityWatts,
  );

  let status: PsuEvaluationStatus;
  if (capacityWatts < minimumRequiredCapacityWatts - 1e-9) {
    status = "undersized";
  } else if (sustainedLoadFraction < OVERSIZED_THRESHOLD) {
    status = "oversized";
  } else if (
    sustainedLoadFraction > policy.targetSustainedLoadFraction + 1e-9 ||
    transientLoadFraction > policy.maxTransientLoadFraction - MARGINAL_TRANSIENT_GAP
  ) {
    status = "marginal";
  } else {
    status = "meets-policy";
  }

  return {
    capacityWatts,
    status,
    sustainedLoadFraction,
    transientLoadFraction,
    reserveWatts,
  };
}

export type ComponentCategory =
  | "platform"
  | "cpu"
  | "gpu"
  | "memory"
  | "storage"
  | "cooling"
  | "network"
  | "accessory";

export const COMPONENT_CATEGORIES: ReadonlyArray<ComponentCategory> = [
  "platform",
  "cpu",
  "gpu",
  "memory",
  "storage",
  "cooling",
  "network",
  "accessory",
];

export type Confidence = "high" | "medium" | "low";

export type ValueBasis =
  | "measured-dc"
  | "measured-wall-derived"
  | "manufacturer-tbp"
  | "manufacturer-tdp"
  | "manufacturer-maximum"
  | "review-estimate"
  | "maintainer-estimate";

export const VALUE_BASISES: ReadonlyArray<ValueBasis> = [
  "measured-dc",
  "measured-wall-derived",
  "manufacturer-tbp",
  "manufacturer-tdp",
  "manufacturer-maximum",
  "review-estimate",
  "maintainer-estimate",
];

export interface BuildLineInput {
  id: string;
  componentId?: string;
  manualComponent?: ManualComponentInput;
  quantity?: number;
  workloadUtilization?: number;
  transientCorrelation?: number;
  overrides?: Partial<PowerValues>;
}

export interface ManualComponentInput {
  name: string;
  category: ComponentCategory;
  idleDcWattsEach: number;
  sustainedDcWattsEach: number;
  transientDcWattsEach?: number;
}

export interface PowerValues {
  idleDcWattsEach: number;
  sustainedDcWattsEach: number;
  transientDcWattsEach: number;
}

export interface LinePowerTotals {
  idleDcWatts: number;
  sustainedDcWatts: number;
  transientDcWatts: number;
}

export type WorkloadPreset =
  | "local-ai-inference"
  | "local-ai-always-on"
  | "gaming"
  | "homelab-light"
  | "workstation"
  | "custom";

export const WORKLOAD_PRESETS: ReadonlyArray<WorkloadPreset> = [
  "local-ai-inference",
  "local-ai-always-on",
  "gaming",
  "homelab-light",
  "workstation",
  "custom",
];

export interface OperatingProfileInput {
  preset?: WorkloadPreset;
  poweredHoursPerDay: number;
  daysPerYear?: number;
  workloadShare: number;
  categoryUtilization: Partial<Record<ComponentCategory, number>>;
  fallbackUtilization: number;
  ratePerKwh: number;
  currency: string;
}

export interface PsuPolicyInput {
  targetSustainedLoadFraction?: number;
  maxTransientLoadFraction?: number;
  minimumReserveWatts?: number;
  minimumCapacityWatts?: number;
  standardCapacitiesWatts?: number[];
}

export interface PlannerInput {
  schemaVersion: 1;
  buildName?: string;
  lines: BuildLineInput[];
  operatingProfile: OperatingProfileInput;
  psuPolicy?: PsuPolicyInput;
  evaluatedPsuCapacityWatts?: number;
  efficiencyProfileId?: string;
  efficiencyOverrideFraction?: number;
}

export interface PlannerWarning {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  lineId?: string;
  field?: string;
}

export interface PlannerResult {
  schemaVersion: 1;
  buildName?: string;
  resolvedLines: ResolvedBuildLine[];
  totals: BuildPowerTotals;
  recommendation: PsuRecommendation;
  evaluatedPsu?: PsuEvaluation;
  acPower: AcPowerResult;
  energyCost: EnergyCostResult;
  assumptions: PlannerAssumptions;
  warnings: PlannerWarning[];
}

export interface ResolvedBuildLine {
  id: string;
  componentId?: string;
  name: string;
  category: ComponentCategory;
  quantity: number;
  powerEach: PowerValues;
  powerTotals: LinePowerTotals;
  workloadUtilization: number;
  workloadDcWatts: number;
  transientCorrelation: number;
  confidence: Confidence;
  sourceIds: string[];
  manual: boolean;
  overriddenFields: Array<keyof PowerValues>;
}

export interface BuildPowerTotals {
  idleDcWatts: number;
  workloadDcWatts: number;
  sustainedDcWatts: number;
  transientDcWatts: number;
}

export type ControllingConstraint =
  | "sustained-utilization"
  | "transient-utilization"
  | "reserve"
  | "minimum-capacity";

export interface PsuRecommendation {
  recommendedCapacityWatts: number | null;
  minimumRequiredCapacityWatts: number;
  controllingConstraint: ControllingConstraint;
  capacityForSustainedWatts: number;
  capacityForTransientWatts: number;
  capacityForReserveWatts: number;
  policy: Required<PsuPolicyInput>;
}

export type PsuEvaluationStatus = "undersized" | "marginal" | "meets-policy" | "oversized";

export interface PsuEvaluation {
  capacityWatts: number;
  status: PsuEvaluationStatus;
  sustainedLoadFraction: number;
  transientLoadFraction: number;
  reserveWatts: number;
}

export interface EfficiencyPoint {
  loadFraction: number;
  efficiencyFraction: number;
}

export interface EfficiencyCurve {
  points: EfficiencyPoint[];
}

export interface EfficiencyProfile extends EfficiencyCurve {
  id: string;
  label: string;
  inputVoltage: "115v" | "230v" | "unspecified";
  positioning: "conservative-planning" | "custom-reference";
  sourceIds: string[];
  notes: string;
}

export interface EfficiencyResult {
  dcWatts: number;
  psuCapacityWatts: number;
  loadFraction: number;
  efficiencyFraction: number | null;
  acInputWatts: number | null;
  conversionLossWatts: number | null;
  warnings: PlannerWarning[];
}

export interface AcPowerResult {
  psuCapacityWatts: number | null;
  efficiencyProfileId?: string;
  idle: EfficiencyResult;
  workload: EfficiencyResult;
  sustained: EfficiencyResult;
}

export interface EnergyCostInput {
  idleDcWatts: number;
  workloadDcWatts: number;
  idleAcInputWatts: number | null;
  workloadAcInputWatts: number | null;
  poweredHoursPerDay: number;
  daysPerYear: number;
  workloadShare: number;
  ratePerKwh: number;
  currency: string;
}

export interface EnergyCostResult {
  idleHoursPerDay: number;
  workloadHoursPerDay: number;
  annualDcEnergyKwh: number;
  annualAcEnergyKwh: number | null;
  annualCost: number | null;
  ratePerKwh: number;
  currency: string;
}

export interface PlannerAssumptions {
  operatingProfile: Required<OperatingProfileInput>;
  psuPolicy: Required<PsuPolicyInput>;
  efficiencyProfileId?: string;
  efficiencyOverrideFraction?: number;
  overrides: Array<{ lineId: string; field: keyof PowerValues; value: number }>;
}

export interface ComponentFilters {
  category?: ComponentCategory;
  manufacturer?: string;
  query?: string;
}

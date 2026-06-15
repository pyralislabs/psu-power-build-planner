import { getComponent } from "../data/index.js";
import type { ComponentRecord } from "../data/types.js";
import type {
  BuildLineInput,
  ComponentCategory,
  Confidence,
  OperatingProfileInput,
  PowerValues,
  ResolvedBuildLine,
  WorkloadPreset,
} from "./types.js";
import { PlannerValidationError } from "./errors.js";
import { addWarning, type WarningCollector } from "./warnings.js";

export const PROFILE_PRESET_TABLE: Readonly<
  Record<
    WorkloadPreset,
    {
      utilization: Readonly<Record<ComponentCategory, number>>;
      poweredHoursPerDay: number;
      workloadShare: number;
    }
  >
> = {
  "local-ai-inference": {
    utilization: {
      platform: 0.25,
      cpu: 0.55,
      gpu: 0.85,
      memory: 0.2,
      storage: 0.2,
      cooling: 0.6,
      network: 0.25,
      accessory: 0.25,
    },
    poweredHoursPerDay: 8,
    workloadShare: 0.5,
  },
  "local-ai-always-on": {
    utilization: {
      platform: 0.2,
      cpu: 0.35,
      gpu: 0.65,
      memory: 0.2,
      storage: 0.2,
      cooling: 0.5,
      network: 0.2,
      accessory: 0.2,
    },
    poweredHoursPerDay: 24,
    workloadShare: 0.35,
  },
  gaming: {
    utilization: {
      platform: 0.2,
      cpu: 0.55,
      gpu: 0.85,
      memory: 0.15,
      storage: 0.15,
      cooling: 0.6,
      network: 0.2,
      accessory: 0.2,
    },
    poweredHoursPerDay: 4,
    workloadShare: 0.75,
  },
  "homelab-light": {
    utilization: {
      platform: 0.2,
      cpu: 0.2,
      gpu: 0.05,
      memory: 0.25,
      storage: 0.25,
      cooling: 0.35,
      network: 0.2,
      accessory: 0.2,
    },
    poweredHoursPerDay: 24,
    workloadShare: 0.15,
  },
  workstation: {
    utilization: {
      platform: 0.3,
      cpu: 0.65,
      gpu: 0.55,
      memory: 0.35,
      storage: 0.35,
      cooling: 0.55,
      network: 0.3,
      accessory: 0.3,
    },
    poweredHoursPerDay: 8,
    workloadShare: 0.7,
  },
  custom: {
    utilization: {
      platform: 0,
      cpu: 0,
      gpu: 0,
      memory: 0,
      storage: 0,
      cooling: 0,
      network: 0,
      accessory: 0,
    },
    poweredHoursPerDay: 0,
    workloadShare: 0,
  },
};

export const DEFAULT_TRANSIENT_CORRELATION: Readonly<Record<ComponentCategory, number>> = {
  platform: 0.5,
  cpu: 1.0,
  gpu: 1.0,
  memory: 0.5,
  storage: 0.5,
  cooling: 0.5,
  network: 0.5,
  accessory: 0.5,
};

function clamp01(v: number): number {
  if (!Number.isFinite(v) || v < 0) {
    return 0;
  }
  if (v > 1) {
    return 1;
  }
  return v;
}

export function selectUtilization(
  profile: OperatingProfileInput,
  category: ComponentCategory,
  lineOverride: number | undefined,
): number {
  if (lineOverride !== undefined) {
    return clamp01(lineOverride);
  }
  const fromCategory = profile.categoryUtilization[category];
  if (fromCategory !== undefined) {
    return clamp01(fromCategory);
  }
  return clamp01(profile.fallbackUtilization);
}

export function selectTransientCorrelation(
  category: ComponentCategory,
  gpuCount: number,
  lineOverride: number | undefined,
): { value: number; defaulted: number } {
  const defaulted =
    category === "gpu" && gpuCount >= 1 ? 1.0 : DEFAULT_TRANSIENT_CORRELATION[category];
  if (lineOverride === undefined) {
    return { value: clamp01(defaulted), defaulted };
  }
  return { value: clamp01(lineOverride), defaulted };
}

export interface ResolveBuildInput {
  lines: ReadonlyArray<BuildLineInput>;
  profile: OperatingProfileInput;
}

export interface ResolveBuildResult {
  lines: ResolvedBuildLine[];
  gpuCount: number;
  manualCount: number;
  overrideCount: number;
}

export function resolveBuild(
  input: ResolveBuildInput,
  warnings: WarningCollector,
): ResolveBuildResult {
  const resolved: ResolvedBuildLine[] = [];
  let gpuCount = 0;
  let manualCount = 0;
  let overrideCount = 0;

  for (const line of input.lines) {
    const quantity = line.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 32) {
      throw PlannerValidationError.single({
        code: "INVALID_QUANTITY",
        path: `lines.${line.id}.quantity`,
        message: `Quantity must be an integer in 1..32, got ${quantity}.`,
      });
    }
    let power: PowerValues;
    let confidence: Confidence;
    let sourceIds: string[];
    let manual: boolean;
    let category: ComponentCategory;
    let componentId: string | undefined;
    let name: string;

    if (line.manualComponent) {
      manual = true;
      manualCount += quantity;
      const m = line.manualComponent;
      category = m.category;
      name = m.name;
      componentId = undefined;
      power = {
        idleDcWattsEach: m.idleDcWattsEach,
        sustainedDcWattsEach: m.sustainedDcWattsEach,
        transientDcWattsEach: m.transientDcWattsEach ?? m.sustainedDcWattsEach,
      };
      if (line.manualComponent.transientDcWattsEach === undefined) {
        addWarning(warnings, {
          code: "MANUAL_TRANSIENT_DEFAULTED",
          severity: "info",
          message: `Manual component "${name}" did not specify transientDcWattsEach; defaulted to sustained.`,
          lineId: line.id,
        });
      }
      addWarning(warnings, {
        code: "MANUAL_COMPONENT",
        severity: "info",
        message: `Line "${line.id}" uses a manual component (${name}); values are user-supplied.`,
        lineId: line.id,
      });
      confidence = "low";
      sourceIds = [];
    } else if (line.componentId) {
      componentId = line.componentId;
      const record: ComponentRecord | undefined = getComponent(componentId);
      if (!record) {
        throw PlannerValidationError.single({
          code: "UNKNOWN_COMPONENT",
          path: `lines.${line.id}.componentId`,
          message: `Unknown componentId "${componentId}".`,
        });
      }
      manual = false;
      category = record.category;
      name =
        record.manufacturer === "Generic" ? record.model : `${record.manufacturer} ${record.model}`;
      power = {
        idleDcWattsEach: record.power.idle.watts,
        sustainedDcWattsEach: record.power.sustained.watts,
        transientDcWattsEach: record.power.transient.watts,
      };
      confidence = record.power.sustained.confidence;
      sourceIds = record.power.sustained.sourceIds.slice();
      if (confidence === "low") {
        addWarning(warnings, {
          code: "DATA_LOW_CONFIDENCE",
          severity: "warning",
          message: `Component "${name}" has low confidence on its sustained power value.`,
          lineId: line.id,
        });
      }
    } else {
      throw PlannerValidationError.single({
        code: "INVALID_LINE",
        path: `lines.${line.id}`,
        message: `Line must reference componentId or manualComponent.`,
      });
    }

    const overriddenFields: Array<keyof PowerValues> = [];
    if (line.overrides) {
      for (const key of [
        "idleDcWattsEach",
        "sustainedDcWattsEach",
        "transientDcWattsEach",
      ] as const) {
        const v = line.overrides[key];
        if (v !== undefined) {
          power = { ...power, [key]: v };
          overriddenFields.push(key);
          overrideCount++;
          addWarning(warnings, {
            code: "FIELD_OVERRIDE_USED",
            severity: "info",
            message: `Field override applied to "${line.id}.${key}" (=${v}).`,
            lineId: line.id,
            field: key,
          });
        }
      }
    }
    if (
      power.idleDcWattsEach < 0 ||
      power.sustainedDcWattsEach < 0 ||
      power.transientDcWattsEach < 0
    ) {
      throw PlannerValidationError.single({
        code: "INVALID_POWER_VALUES",
        path: `lines.${line.id}`,
        message: `Resolved power values must be non-negative.`,
      });
    }
    if (
      power.idleDcWattsEach > power.sustainedDcWattsEach ||
      power.sustainedDcWattsEach > power.transientDcWattsEach
    ) {
      throw PlannerValidationError.single({
        code: "INVALID_POWER_VALUES",
        path: `lines.${line.id}`,
        message: `Power ordering must satisfy idle <= sustained <= transient.`,
      });
    }

    if (category === "gpu") {
      gpuCount += quantity;
    }

    const utilization = selectUtilization(input.profile, category, line.workloadUtilization);
    const correlation = selectTransientCorrelation(category, gpuCount, line.transientCorrelation);
    if (line.transientCorrelation !== undefined && correlation.value !== correlation.defaulted) {
      addWarning(warnings, {
        code: "TRANSIENT_CORRELATION_OVERRIDDEN",
        severity: "info",
        message: `Transient correlation for "${line.id}" overridden from ${correlation.defaulted} to ${correlation.value}.`,
        lineId: line.id,
        field: "transientCorrelation",
      });
    }

    const idleTotal = power.idleDcWattsEach * quantity;
    const sustainedTotal = power.sustainedDcWattsEach * quantity;
    const workloadDcWatts = idleTotal + (sustainedTotal - idleTotal) * utilization;

    resolved.push({
      id: line.id,
      ...(componentId !== undefined ? { componentId } : {}),
      name,
      category,
      quantity,
      powerEach: power,
      powerTotals: {
        idleDcWatts: idleTotal,
        sustainedDcWatts: sustainedTotal,
        transientDcWatts: power.transientDcWattsEach * quantity,
      },
      workloadUtilization: utilization,
      workloadDcWatts,
      transientCorrelation: correlation.value,
      confidence,
      sourceIds,
      manual,
      overriddenFields,
    });
  }

  return { lines: resolved, gpuCount, manualCount, overrideCount };
}

import { PlannerValidationError, type PlannerValidationIssue } from "./errors.js";
import {
  COMPONENT_CATEGORIES,
  WORKLOAD_PRESETS,
  type BuildLineInput,
  type ComponentCategory,
  type EfficiencyCurve,
  type ManualComponentInput,
  type OperatingProfileInput,
  type PlannerInput,
  type PsuPolicyInput,
} from "./types.js";

const ISO_4217_LIKE = /^[A-Z]{3}$/;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0.0-9]+)*$/;
const PROTOTYPE_POLLUTING_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const MAX_BUILD_NAME_LEN = 160;
const MAX_LINE_ID_LEN = 160;
const MAX_MANUAL_NAME_LEN = 160;
const MAX_LINES = 500;
const MIN_LINES = 1;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 32;
const HIGH_GPU_QUANTITY = 8;
const MAX_BUILD_BYTES = 1_048_576;
const PSU_CAPACITY_MIN = 50;
const PSU_CAPACITY_MAX = 10_000;
const EFFICIENCY_MAX = 1;
const EFFICIENCY_MIN_EXCLUSIVE = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function fail(
  issues: PlannerValidationIssue[],
  code: PlannerValidationIssue["code"],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function requireFinite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw PlannerValidationError.single({
      code: "INVALID_INPUT",
      path,
      message: `Expected a finite number at ${path}, got ${typeof value}.`,
    });
  }
  return value;
}

function checkObject(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
  code: PlannerValidationIssue["code"],
  allowExtras: ReadonlyArray<string>,
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    fail(issues, code, path, `Expected an object at ${path}.`);
    return {};
  }
  for (const key of Object.keys(value)) {
    if (PROTOTYPE_POLLUTING_KEYS.has(key)) {
      fail(issues, "UNKNOWN_FIELD", `${path}.${key}`, `Forbidden key at ${path}.${key}.`);
      continue;
    }
    if (!allowExtras.includes(key)) {
      fail(issues, "UNKNOWN_FIELD", `${path}.${key}`, `Unknown field at ${path}.${key}.`);
    }
  }
  return value;
}

function validateCategory(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
): ComponentCategory | undefined {
  if (typeof value !== "string") {
    fail(issues, "INVALID_LINE", path, `Category at ${path} must be a string.`);
    return undefined;
  }
  if (!(COMPONENT_CATEGORIES as ReadonlyArray<string>).includes(value)) {
    fail(
      issues,
      "INVALID_LINE",
      path,
      `Category at ${path} must be one of ${COMPONENT_CATEGORIES.join(", ")}.`,
    );
    return undefined;
  }
  return value as ComponentCategory;
}

function validateUtilization(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
  code: PlannerValidationIssue["code"],
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(issues, code, path, `Expected a finite number at ${path}.`);
    return undefined;
  }
  if (value < 0 || value > 1) {
    fail(issues, code, path, `Value at ${path} must be within 0..1, got ${value}.`);
    return undefined;
  }
  return value;
}

function validatePowerOrdering(
  issues: PlannerValidationIssue[],
  idle: number,
  sustained: number,
  transient: number,
  path: string,
): void {
  if (idle < 0 || sustained < 0 || transient < 0) {
    fail(issues, "INVALID_POWER_VALUES", path, `Power values at ${path} must be non-negative.`);
  }
  if (idle > sustained) {
    fail(
      issues,
      "INVALID_POWER_VALUES",
      `${path}.idleDcWattsEach`,
      `idle (${idle}) must be <= sustained (${sustained}).`,
    );
  }
  if (sustained > transient) {
    fail(
      issues,
      "INVALID_POWER_VALUES",
      `${path}.sustainedDcWattsEach`,
      `sustained (${sustained}) must be <= transient (${transient}).`,
    );
  }
}

function validateManualComponent(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
): ManualComponentInput | undefined {
  const obj = checkObject(issues, value, path, "INVALID_MANUAL_COMPONENT", [
    "name",
    "category",
    "idleDcWattsEach",
    "sustainedDcWattsEach",
    "transientDcWattsEach",
  ]);
  if (Object.keys(obj).length === 0) {
    return undefined;
  }
  const name = obj.name;
  if (typeof name !== "string" || name.length === 0) {
    fail(
      issues,
      "INVALID_MANUAL_COMPONENT",
      `${path}.name`,
      `Manual component name at ${path}.name is required.`,
    );
  } else if (name.length > MAX_MANUAL_NAME_LEN) {
    fail(
      issues,
      "INVALID_MANUAL_COMPONENT",
      `${path}.name`,
      `Manual component name at ${path}.name exceeds ${MAX_MANUAL_NAME_LEN} characters.`,
    );
  }
  const category = validateCategory(issues, obj.category, `${path}.category`);
  const idle = typeof obj.idleDcWattsEach === "number" ? obj.idleDcWattsEach : NaN;
  const sustained = typeof obj.sustainedDcWattsEach === "number" ? obj.sustainedDcWattsEach : NaN;
  const transient =
    typeof obj.transientDcWattsEach === "number" ? obj.transientDcWattsEach : sustained;
  if (!Number.isFinite(idle) || idle < 0) {
    fail(
      issues,
      "INVALID_POWER_VALUES",
      `${path}.idleDcWattsEach`,
      `idleDcWattsEach at ${path} must be a finite number >= 0.`,
    );
  }
  if (!Number.isFinite(sustained) || sustained < 0) {
    fail(
      issues,
      "INVALID_POWER_VALUES",
      `${path}.sustainedDcWattsEach`,
      `sustainedDcWattsEach at ${path} must be a finite number >= 0.`,
    );
  }
  if (obj.transientDcWattsEach !== undefined && (!Number.isFinite(transient) || transient < 0)) {
    fail(
      issues,
      "INVALID_POWER_VALUES",
      `${path}.transientDcWattsEach`,
      `transientDcWattsEach at ${path} must be a finite number >= 0.`,
    );
  }
  if (Number.isFinite(idle) && Number.isFinite(sustained) && Number.isFinite(transient)) {
    validatePowerOrdering(issues, idle, sustained, transient, path);
  }
  if (typeof name !== "string" || name.length === 0 || name.length > MAX_MANUAL_NAME_LEN) {
    return undefined;
  }
  return {
    name,
    category: category ?? "accessory",
    idleDcWattsEach: idle,
    sustainedDcWattsEach: sustained,
    transientDcWattsEach: Number.isFinite(transient) ? transient : sustained,
  };
}

function validatePowerOverride(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
): Partial<{
  idleDcWattsEach: number;
  sustainedDcWattsEach: number;
  transientDcWattsEach: number;
}> {
  const obj = checkObject(issues, value, path, "INVALID_OVERRIDE", [
    "idleDcWattsEach",
    "sustainedDcWattsEach",
    "transientDcWattsEach",
  ]);
  const out: Partial<{
    idleDcWattsEach: number;
    sustainedDcWattsEach: number;
    transientDcWattsEach: number;
  }> = {};
  for (const key of ["idleDcWattsEach", "sustainedDcWattsEach", "transientDcWattsEach"] as const) {
    const v = obj[key];
    if (v === undefined) {
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      fail(
        issues,
        "INVALID_OVERRIDE",
        `${path}.${key}`,
        `Override at ${path}.${key} must be a finite number >= 0.`,
      );
      continue;
    }
    out[key] = v;
  }
  return out;
}

function validateLine(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
): BuildLineInput | undefined {
  const obj = checkObject(issues, value, path, "INVALID_LINE", [
    "id",
    "componentId",
    "manualComponent",
    "quantity",
    "workloadUtilization",
    "transientCorrelation",
    "overrides",
  ]);
  if (Object.keys(obj).length === 0) {
    return undefined;
  }
  const id = obj.id;
  if (typeof id !== "string" || id.length === 0) {
    fail(issues, "INVALID_LINE_ID", `${path}.id`, `Line id at ${path}.id is required.`);
  } else if (id.length > MAX_LINE_ID_LEN) {
    fail(
      issues,
      "INVALID_LINE_ID",
      `${path}.id`,
      `Line id at ${path}.id exceeds ${MAX_LINE_ID_LEN} characters.`,
    );
  } else if (!KEBAB_CASE.test(id)) {
    fail(
      issues,
      "INVALID_LINE_ID",
      `${path}.id`,
      `Line id at ${path}.id must be lowercase kebab-case.`,
    );
  }
  const hasComponentId = obj.componentId !== undefined;
  const hasManual = obj.manualComponent !== undefined;
  if (hasComponentId === hasManual) {
    fail(
      issues,
      "INVALID_LINE",
      path,
      `Line at ${path} must reference exactly one of componentId or manualComponent.`,
    );
  }
  if (hasComponentId && typeof obj.componentId !== "string") {
    fail(
      issues,
      "INVALID_LINE",
      `${path}.componentId`,
      `componentId at ${path}.componentId must be a string.`,
    );
  }
  const manual =
    obj.manualComponent !== undefined
      ? validateManualComponent(issues, obj.manualComponent, `${path}.manualComponent`)
      : undefined;
  const quantityRaw = obj.quantity;
  let quantity = 1;
  if (quantityRaw !== undefined) {
    if (
      typeof quantityRaw !== "number" ||
      !Number.isInteger(quantityRaw) ||
      quantityRaw < MIN_QUANTITY ||
      quantityRaw > MAX_QUANTITY
    ) {
      fail(
        issues,
        "INVALID_QUANTITY",
        `${path}.quantity`,
        `Quantity at ${path}.quantity must be an integer in ${MIN_QUANTITY}..${MAX_QUANTITY}, got ${String(quantityRaw)}.`,
      );
    } else {
      quantity = quantityRaw;
    }
  }
  if (obj.workloadUtilization !== undefined) {
    validateUtilization(
      issues,
      obj.workloadUtilization,
      `${path}.workloadUtilization`,
      "INVALID_UTILIZATION",
    );
  }
  if (obj.transientCorrelation !== undefined) {
    validateUtilization(
      issues,
      obj.transientCorrelation,
      `${path}.transientCorrelation`,
      "INVALID_CORRELATION",
    );
  }
  const overrides =
    obj.overrides !== undefined
      ? validatePowerOverride(issues, obj.overrides, `${path}.overrides`)
      : undefined;
  return {
    id: typeof id === "string" ? id : "",
    ...(typeof obj.componentId === "string" ? { componentId: obj.componentId } : {}),
    ...(manual ? { manualComponent: manual } : {}),
    quantity,
    ...(obj.workloadUtilization !== undefined
      ? { workloadUtilization: obj.workloadUtilization as number }
      : {}),
    ...(obj.transientCorrelation !== undefined
      ? { transientCorrelation: obj.transientCorrelation as number }
      : {}),
    ...(overrides ? { overrides } : {}),
  };
}

function validateOperatingProfile(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
): OperatingProfileInput | undefined {
  const obj = checkObject(issues, value, path, "INVALID_OPERATING_PROFILE", [
    "preset",
    "poweredHoursPerDay",
    "daysPerYear",
    "workloadShare",
    "categoryUtilization",
    "fallbackUtilization",
    "ratePerKwh",
    "currency",
  ]);
  if (Object.keys(obj).length === 0) {
    return undefined;
  }
  let preset: OperatingProfileInput["preset"];
  if (obj.preset !== undefined) {
    if (
      typeof obj.preset !== "string" ||
      !(WORKLOAD_PRESETS as ReadonlyArray<string>).includes(obj.preset)
    ) {
      fail(
        issues,
        "INVALID_OPERATING_PROFILE",
        `${path}.preset`,
        `Preset at ${path}.preset must be one of ${WORKLOAD_PRESETS.join(", ")}.`,
      );
    } else {
      preset = obj.preset as OperatingProfileInput["preset"];
    }
  }
  const poweredHours = typeof obj.poweredHoursPerDay === "number" ? obj.poweredHoursPerDay : NaN;
  if (!Number.isFinite(poweredHours) || poweredHours <= 0 || poweredHours > 24) {
    fail(
      issues,
      "INVALID_OPERATING_PROFILE",
      `${path}.poweredHoursPerDay`,
      `poweredHoursPerDay at ${path} must be in (0..24], got ${String(poweredHours)}.`,
    );
  }
  const daysPerYear = obj.daysPerYear === undefined ? 365 : (obj.daysPerYear as number);
  if (!Number.isInteger(daysPerYear) || daysPerYear < 1 || daysPerYear > 366) {
    fail(
      issues,
      "INVALID_OPERATING_PROFILE",
      `${path}.daysPerYear`,
      `daysPerYear at ${path} must be an integer in 1..366, got ${String(obj.daysPerYear)}.`,
    );
  }
  const workloadShare = typeof obj.workloadShare === "number" ? obj.workloadShare : NaN;
  if (!Number.isFinite(workloadShare) || workloadShare < 0 || workloadShare > 1) {
    fail(
      issues,
      "INVALID_OPERATING_PROFILE",
      `${path}.workloadShare`,
      `workloadShare at ${path} must be in 0..1, got ${String(workloadShare)}.`,
    );
  }
  const categoryUtilization: Partial<Record<ComponentCategory, number>> = {};
  const cu = obj.categoryUtilization;
  if (cu !== undefined) {
    if (!isPlainObject(cu)) {
      fail(
        issues,
        "INVALID_OPERATING_PROFILE",
        `${path}.categoryUtilization`,
        `categoryUtilization at ${path} must be an object.`,
      );
    } else {
      for (const k of Object.keys(cu)) {
        if (PROTOTYPE_POLLUTING_KEYS.has(k)) {
          fail(issues, "UNKNOWN_FIELD", `${path}.categoryUtilization.${k}`, "Forbidden key.");
          continue;
        }
        if (!(COMPONENT_CATEGORIES as ReadonlyArray<string>).includes(k)) {
          fail(
            issues,
            "INVALID_OPERATING_PROFILE",
            `${path}.categoryUtilization.${k}`,
            `Unknown category ${k} in categoryUtilization.`,
          );
          continue;
        }
        const v = cu[k];
        const parsed = validateUtilization(
          issues,
          v,
          `${path}.categoryUtilization.${k}`,
          "INVALID_OPERATING_PROFILE",
        );
        if (parsed !== undefined) {
          categoryUtilization[k as ComponentCategory] = parsed;
        }
      }
    }
  }
  const fallback = typeof obj.fallbackUtilization === "number" ? obj.fallbackUtilization : NaN;
  if (!Number.isFinite(fallback) || fallback < 0 || fallback > 1) {
    fail(
      issues,
      "INVALID_OPERATING_PROFILE",
      `${path}.fallbackUtilization`,
      `fallbackUtilization at ${path} must be in 0..1, got ${String(fallback)}.`,
    );
  }
  const rate = typeof obj.ratePerKwh === "number" ? obj.ratePerKwh : NaN;
  if (!Number.isFinite(rate) || rate < 0) {
    fail(
      issues,
      "INVALID_RATE",
      `${path}.ratePerKwh`,
      `ratePerKwh at ${path} must be >= 0, got ${String(rate)}.`,
    );
  }
  const currency = obj.currency;
  if (typeof currency !== "string" || !ISO_4217_LIKE.test(currency)) {
    fail(
      issues,
      "INVALID_CURRENCY",
      `${path}.currency`,
      `currency at ${path} must be an ISO 4217-like uppercase three-letter code.`,
    );
  }
  return {
    ...(preset ? { preset } : {}),
    poweredHoursPerDay: poweredHours,
    ...(obj.daysPerYear !== undefined ? { daysPerYear: daysPerYear } : {}),
    workloadShare,
    categoryUtilization,
    fallbackUtilization: fallback,
    ratePerKwh: rate,
    currency: typeof currency === "string" ? currency : "",
  };
}

function validatePsuPolicy(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
): PsuPolicyInput | undefined {
  const obj = checkObject(issues, value, path, "INVALID_PSU_POLICY", [
    "targetSustainedLoadFraction",
    "maxTransientLoadFraction",
    "minimumReserveWatts",
    "minimumCapacityWatts",
    "standardCapacitiesWatts",
  ]);
  if (Object.keys(obj).length === 0) {
    return undefined;
  }
  const out: PsuPolicyInput = {};
  if (obj.targetSustainedLoadFraction !== undefined) {
    const v = obj.targetSustainedLoadFraction as number;
    if (!Number.isFinite(v) || v <= 0 || v > 1) {
      fail(
        issues,
        "INVALID_PSU_POLICY",
        `${path}.targetSustainedLoadFraction`,
        `targetSustainedLoadFraction must be in (0..1], got ${String(v)}.`,
      );
    } else {
      out.targetSustainedLoadFraction = v;
    }
  }
  if (obj.maxTransientLoadFraction !== undefined) {
    const v = obj.maxTransientLoadFraction as number;
    if (!Number.isFinite(v) || v <= 0 || v > 1) {
      fail(
        issues,
        "INVALID_PSU_POLICY",
        `${path}.maxTransientLoadFraction`,
        `maxTransientLoadFraction must be in (0..1], got ${String(v)}.`,
      );
    } else {
      out.maxTransientLoadFraction = v;
    }
  }
  if (obj.minimumReserveWatts !== undefined) {
    const v = obj.minimumReserveWatts as number;
    if (!Number.isFinite(v) || v < 0) {
      fail(
        issues,
        "INVALID_PSU_POLICY",
        `${path}.minimumReserveWatts`,
        `minimumReserveWatts must be >= 0, got ${String(v)}.`,
      );
    } else {
      out.minimumReserveWatts = v;
    }
  }
  if (obj.minimumCapacityWatts !== undefined) {
    const v = obj.minimumCapacityWatts as number;
    if (!Number.isFinite(v) || v < PSU_CAPACITY_MIN || v > PSU_CAPACITY_MAX) {
      fail(
        issues,
        "INVALID_PSU_POLICY",
        `${path}.minimumCapacityWatts`,
        `minimumCapacityWatts must be in ${PSU_CAPACITY_MIN}..${PSU_CAPACITY_MAX}, got ${String(v)}.`,
      );
    } else {
      out.minimumCapacityWatts = v;
    }
  }
  if (obj.standardCapacitiesWatts !== undefined) {
    const arr = obj.standardCapacitiesWatts;
    if (!Array.isArray(arr) || arr.length < 2) {
      fail(
        issues,
        "INVALID_CAPACITY_LIST",
        `${path}.standardCapacitiesWatts`,
        "Must contain at least 2 entries.",
      );
    } else {
      const numbers: number[] = [];
      let last = -Infinity;
      let ok = true;
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (
          typeof v !== "number" ||
          !Number.isFinite(v) ||
          !Number.isInteger(v) ||
          v < PSU_CAPACITY_MIN ||
          v > PSU_CAPACITY_MAX
        ) {
          fail(
            issues,
            "INVALID_CAPACITY_LIST",
            `${path}.standardCapacitiesWatts[${i}]`,
            `Entry must be an integer in ${PSU_CAPACITY_MIN}..${PSU_CAPACITY_MAX}.`,
          );
          ok = false;
        } else if (v <= last) {
          fail(
            issues,
            "INVALID_CAPACITY_LIST",
            `${path}.standardCapacitiesWatts[${i}]`,
            "Entries must be strictly increasing.",
          );
          ok = false;
        } else {
          numbers.push(v);
          last = v;
        }
      }
      if (ok) {
        out.standardCapacitiesWatts = numbers;
      }
    }
  }
  return out;
}

function validateEfficiencyCurve(
  issues: PlannerValidationIssue[],
  value: unknown,
  path: string,
): EfficiencyCurve | undefined {
  const obj = checkObject(issues, value, path, "INVALID_EFFICIENCY_CURVE", ["points"]);
  if (Object.keys(obj).length === 0) {
    return undefined;
  }
  const pts = obj.points;
  if (!Array.isArray(pts) || pts.length < 2) {
    fail(
      issues,
      "INVALID_EFFICIENCY_CURVE",
      `${path}.points`,
      "Efficiency curve needs at least 2 points.",
    );
    return undefined;
  }
  const points: { loadFraction: number; efficiencyFraction: number }[] = [];
  let last = -Infinity;
  let ok = true;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!isPlainObject(p)) {
      fail(issues, "INVALID_EFFICIENCY_CURVE", `${path}.points[${i}]`, "Point must be an object.");
      ok = false;
      continue;
    }
    const lf = p.loadFraction;
    const ef = p.efficiencyFraction;
    if (typeof lf !== "number" || !Number.isFinite(lf) || lf < 0 || lf > 1) {
      fail(
        issues,
        "INVALID_EFFICIENCY_CURVE",
        `${path}.points[${i}].loadFraction`,
        "loadFraction must be in 0..1.",
      );
      ok = false;
    }
    if (typeof ef !== "number" || !Number.isFinite(ef) || ef <= 0 || ef > 1) {
      fail(
        issues,
        "INVALID_EFFICIENCY_CURVE",
        `${path}.points[${i}].efficiencyFraction`,
        "efficiencyFraction must be in (0..1].",
      );
      ok = false;
    }
    if (typeof lf === "number" && lf <= last) {
      fail(
        issues,
        "INVALID_EFFICIENCY_CURVE",
        `${path}.points[${i}]`,
        "Points must be sorted by strictly increasing loadFraction.",
      );
      ok = false;
    } else if (typeof lf === "number") {
      last = lf;
    }
    if (typeof lf === "number" && typeof ef === "number") {
      points.push({ loadFraction: lf, efficiencyFraction: ef });
    }
  }
  if (!ok) {
    return undefined;
  }
  return { points };
}

export function validatePlannerInput(raw: unknown): PlannerInput {
  const issues: PlannerValidationIssue[] = [];
  const root = checkObject(issues, raw, "", "INVALID_INPUT", [
    "schemaVersion",
    "buildName",
    "lines",
    "operatingProfile",
    "psuPolicy",
    "evaluatedPsuCapacityWatts",
    "efficiencyProfileId",
    "efficiencyOverrideFraction",
  ]);
  if (Object.keys(root).length === 0) {
    throw new PlannerValidationError(
      issues.length > 0 ? issues : [{ code: "INVALID_INPUT", path: "", message: "Empty input." }],
    );
  }
  if (root.schemaVersion !== 1) {
    fail(issues, "SCHEMA_VERSION_MISMATCH", "schemaVersion", "schemaVersion must be 1.");
  }
  if (root.buildName !== undefined) {
    if (typeof root.buildName !== "string" || root.buildName.length === 0) {
      fail(
        issues,
        "INVALID_INPUT",
        "buildName",
        "buildName must be a non-empty string when provided.",
      );
    } else if (root.buildName.length > MAX_BUILD_NAME_LEN) {
      fail(
        issues,
        "INVALID_INPUT",
        "buildName",
        `buildName exceeds ${MAX_BUILD_NAME_LEN} characters.`,
      );
    }
  }
  const lines = root.lines;
  if (!Array.isArray(lines)) {
    fail(issues, "INVALID_INPUT", "lines", "lines must be an array.");
    throw new PlannerValidationError(issues);
  }
  if (lines.length < MIN_LINES || lines.length > MAX_LINES) {
    fail(
      issues,
      "EMPTY_BUILD",
      "lines",
      `lines must contain ${MIN_LINES}..${MAX_LINES} entries, got ${lines.length}.`,
    );
  }
  const seenIds = new Set<string>();
  const resolvedLines: BuildLineInput[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = validateLine(issues, lines[i], `lines[${i}]`);
    if (line) {
      if (line.id && seenIds.has(line.id)) {
        fail(issues, "DUPLICATE_LINE_ID", `lines[${i}].id`, `Duplicate line id: ${line.id}.`);
      }
      if (line.id) {
        seenIds.add(line.id);
      }
      resolvedLines.push(line);
    }
  }
  if (root.evaluatedPsuCapacityWatts !== undefined) {
    const v = root.evaluatedPsuCapacityWatts as number;
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < PSU_CAPACITY_MIN ||
      v > PSU_CAPACITY_MAX
    ) {
      fail(
        issues,
        "INVALID_PSU_CAPACITY",
        "evaluatedPsuCapacityWatts",
        `evaluatedPsuCapacityWatts must be in ${PSU_CAPACITY_MIN}..${PSU_CAPACITY_MAX}, got ${String(v)}.`,
      );
    }
  }
  if (root.efficiencyProfileId !== undefined) {
    if (typeof root.efficiencyProfileId !== "string" || root.efficiencyProfileId.length === 0) {
      fail(
        issues,
        "INVALID_INPUT",
        "efficiencyProfileId",
        "efficiencyProfileId must be a non-empty string.",
      );
    } else if (!KEBAB_CASE.test(root.efficiencyProfileId)) {
      fail(
        issues,
        "INVALID_INPUT",
        "efficiencyProfileId",
        "efficiencyProfileId must be lowercase kebab-case.",
      );
    }
  }
  if (root.efficiencyOverrideFraction !== undefined) {
    const v = root.efficiencyOverrideFraction as number;
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v <= EFFICIENCY_MIN_EXCLUSIVE ||
      v > EFFICIENCY_MAX
    ) {
      fail(
        issues,
        "INVALID_EFFICIENCY_OVERRIDE",
        "efficiencyOverrideFraction",
        `efficiencyOverrideFraction must be in (0..1], got ${String(v)}.`,
      );
    }
  }
  const profile = validateOperatingProfile(issues, root.operatingProfile, "operatingProfile");
  if (!profile) {
    throw new PlannerValidationError(
      issues.length > 0
        ? issues
        : [
            {
              code: "INVALID_OPERATING_PROFILE",
              path: "operatingProfile",
              message: "operatingProfile is required.",
            },
          ],
    );
  }
  const policy =
    root.psuPolicy !== undefined
      ? validatePsuPolicy(issues, root.psuPolicy, "psuPolicy")
      : undefined;
  if (issues.length > 0) {
    throw new PlannerValidationError(issues);
  }
  return {
    schemaVersion: 1,
    ...(typeof root.buildName === "string" ? { buildName: root.buildName } : {}),
    lines: resolvedLines,
    operatingProfile: profile,
    ...(policy ? { psuPolicy: policy } : {}),
    ...(typeof root.evaluatedPsuCapacityWatts === "number"
      ? { evaluatedPsuCapacityWatts: root.evaluatedPsuCapacityWatts }
      : {}),
    ...(typeof root.efficiencyProfileId === "string"
      ? { efficiencyProfileId: root.efficiencyProfileId }
      : {}),
    ...(typeof root.efficiencyOverrideFraction === "number"
      ? { efficiencyOverrideFraction: root.efficiencyOverrideFraction }
      : {}),
  };
}

export function validateEfficiencyCurvePublic(value: unknown): EfficiencyCurve {
  const issues: PlannerValidationIssue[] = [];
  const curve = validateEfficiencyCurve(issues, value, "curve");
  if (!curve || issues.length > 0) {
    throw new PlannerValidationError(
      issues.length > 0
        ? issues
        : [
            {
              code: "INVALID_EFFICIENCY_CURVE",
              path: "curve",
              message: "Invalid efficiency curve.",
            },
          ],
    );
  }
  return curve;
}

export const __test = {
  isPlainObject,
  PROTOTYPE_POLLUTING_KEYS,
  KEBAB_CASE,
  ISO_4217_LIKE,
  MAX_BUILD_NAME_LEN,
  MAX_LINE_ID_LEN,
  MAX_MANUAL_NAME_LEN,
  MAX_LINES,
  MIN_LINES,
  MIN_QUANTITY,
  MAX_QUANTITY,
  HIGH_GPU_QUANTITY,
  MAX_BUILD_BYTES,
  PSU_CAPACITY_MIN,
  PSU_CAPACITY_MAX,
  EFFICIENCY_MAX,
  EFFICIENCY_MIN_EXCLUSIVE,
  requireFinite,
};

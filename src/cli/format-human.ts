import type {
  ComponentCategory,
  EfficiencyProfile,
  PlannerResult,
  PlannerWarning,
} from "../core/types.js";
import type { ComponentRecord, SourceRecord } from "../data/types.js";

const NO_COLOR = (() => {
  const v = process.env["NO_COLOR"];
  return typeof v === "string" && v.length > 0;
})();
const FORCE_COLOR = process.env["FORCE_COLOR"] === "1";

function paint(open: number, close: number, text: string): string {
  if (NO_COLOR && !FORCE_COLOR) {
    return text;
  }
  return `\u001b[${open}m${text}\u001b[${close}m`;
}

const RESET = 0;
const BOLD = 1;
const DIM = 2;
const FG_GREEN = 32;
const FG_YELLOW = 33;
const FG_RED = 31;
const FG_CYAN = 36;
const FG_MAGENTA = 35;
const FG_BLUE = 34;
const FG_GREY = 90;

function bold(s: string): string {
  return paint(BOLD, RESET, s);
}
function dim(s: string): string {
  return paint(DIM, RESET, s);
}
function green(s: string): string {
  return paint(FG_GREEN, RESET, s);
}
function yellow(s: string): string {
  return paint(FG_YELLOW, RESET, s);
}
function red(s: string): string {
  return paint(FG_RED, RESET, s);
}
function cyan(s: string): string {
  return paint(FG_CYAN, RESET, s);
}
function magenta(s: string): string {
  return paint(FG_MAGENTA, RESET, s);
}
function blue(s: string): string {
  return paint(FG_BLUE, RESET, s);
}
function grey(s: string): string {
  return paint(FG_GREY, RESET, s);
}

function formatWatts(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) {
    return "n/a";
  }
  return `${n.toFixed(digits)} W`;
}

function formatKwh(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) {
    return "n/a";
  }
  return `${n.toFixed(digits)} kWh`;
}

function formatCurrency(amount: number | null, currency: string, locale: string = "en-US"): string {
  if (amount === null || !Number.isFinite(amount)) {
    return "n/a";
  }
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatFraction(n: number | null): string {
  if (n === null || !Number.isFinite(n)) {
    return "n/a";
  }
  return `${(n * 100).toFixed(1)}%`;
}

function formatConstraint(c: string): string {
  switch (c) {
    case "sustained-utilization":
      return "sustained-utilization";
    case "transient-utilization":
      return "transient-utilization";
    case "reserve":
      return "reserve";
    case "minimum-capacity":
      return "minimum-capacity";
    default:
      return c;
  }
}

function warningColor(w: PlannerWarning): (s: string) => string {
  switch (w.severity) {
    case "critical":
      return red;
    case "warning":
      return yellow;
    default:
      return cyan;
  }
}

export function formatPlannerResult(result: PlannerResult): string {
  const lines: string[] = [];
  if (result.buildName) {
    lines.push(bold(result.buildName));
    lines.push(dim("─".repeat(result.buildName.length)));
  } else {
    lines.push(bold("PSU Power Build Planner"));
    lines.push("");
  }

  lines.push(bold("Build DC states"));
  lines.push(`  Idle:      ${formatWatts(result.totals.idleDcWatts)}`);
  lines.push(`  Workload:  ${formatWatts(result.totals.workloadDcWatts)}`);
  lines.push(`  Sustained: ${formatWatts(result.totals.sustainedDcWatts)}`);
  lines.push(`  Transient: ${formatWatts(result.totals.transientDcWatts)}`);
  lines.push("");

  lines.push(bold("PSU recommendation"));
  if (result.recommendation.recommendedCapacityWatts === null) {
    lines.push(
      `  ${red("Recommendation: exceeds v1 range")} (${result.recommendation.minimumRequiredCapacityWatts.toFixed(0)} W required)`,
    );
  } else {
    lines.push(
      `  Recommended: ${green(result.recommendation.recommendedCapacityWatts.toString())} W`,
    );
  }
  lines.push(
    `  Required:    ${result.recommendation.minimumRequiredCapacityWatts.toFixed(2)} W (${formatConstraint(result.recommendation.controllingConstraint)})`,
  );
  lines.push(`  Sustained:   ${result.recommendation.capacityForSustainedWatts.toFixed(2)} W`);
  lines.push(`  Transient:   ${result.recommendation.capacityForTransientWatts.toFixed(2)} W`);
  lines.push(`  Reserve:     ${result.recommendation.capacityForReserveWatts.toFixed(2)} W`);
  lines.push("");

  if (result.evaluatedPsu) {
    const status = result.evaluatedPsu.status;
    const color =
      status === "undersized"
        ? red
        : status === "marginal"
          ? yellow
          : status === "oversized"
            ? cyan
            : green;
    lines.push(bold("Evaluated PSU"));
    lines.push(`  Capacity:    ${result.evaluatedPsu.capacityWatts} W (${color(status)})`);
    lines.push(
      `  Sustained:   ${formatFraction(result.evaluatedPsu.sustainedLoadFraction)} of capacity`,
    );
    lines.push(
      `  Transient:   ${formatFraction(result.evaluatedPsu.transientLoadFraction)} of capacity`,
    );
    lines.push(`  Reserve:     ${result.evaluatedPsu.reserveWatts.toFixed(2)} W`);
    lines.push("");
  }

  lines.push(bold("AC wall power"));
  if (result.acPower.psuCapacityWatts === null) {
    lines.push(`  ${dim("No AC estimate (no PSU capacity available).")}`);
  } else {
    const fmt = (label: string, e: typeof result.acPower.idle) => {
      if (e.efficiencyFraction === null) {
        return `  ${label}: ${dim("n/a")}`;
      }
      return `  ${label}: ${formatWatts(e.acInputWatts)} (efficiency ${(e.efficiencyFraction * 100).toFixed(1)}%, loss ${formatWatts(e.conversionLossWatts)})`;
    };
    lines.push(fmt("Idle", result.acPower.idle));
    lines.push(fmt("Workload", result.acPower.workload));
    lines.push(fmt("Sustained", result.acPower.sustained));
  }
  lines.push("");

  lines.push(bold("Annual energy and cost"));
  lines.push(
    `  Powered:        ${result.assumptions.operatingProfile.poweredHoursPerDay} h/day x ${result.assumptions.operatingProfile.daysPerYear} days`,
  );
  lines.push(
    `  Workload share: ${(result.assumptions.operatingProfile.workloadShare * 100).toFixed(1)}%`,
  );
  lines.push(`  Annual DC:      ${formatKwh(result.energyCost.annualDcEnergyKwh)}`);
  if (result.energyCost.annualAcEnergyKwh === null) {
    lines.push(`  Annual AC:      ${dim("n/a")}`);
    lines.push(`  Annual cost:    ${dim("n/a")}`);
  } else {
    lines.push(`  Annual AC:      ${formatKwh(result.energyCost.annualAcEnergyKwh)}`);
    lines.push(
      `  Annual cost:    ${formatCurrency(result.energyCost.annualCost, result.energyCost.currency)} @ ${result.energyCost.ratePerKwh.toFixed(2)} ${result.energyCost.currency}/kWh`,
    );
  }
  lines.push("");

  if (result.warnings.length > 0) {
    lines.push(bold("Warnings and assumptions"));
    for (const w of result.warnings) {
      const tag = `[${w.severity.toUpperCase()}]`;
      const color = warningColor(w);
      const where = w.lineId ? ` (line ${w.lineId}${w.field ? ` / ${w.field}` : ""})` : "";
      lines.push(`  ${color(tag)} ${bold(w.code)}${where}`);
      lines.push(`    ${w.message}`);
    }
    lines.push("");
  }

  lines.push(
    dim("These values are component-derived planning estimates, not measured wall power."),
  );
  lines.push(
    dim("Wattage alone does not establish PSU connector, rail, cable, or physical compatibility."),
  );

  return lines.join("\n");
}

export function formatComponentList(records: ReadonlyArray<ComponentRecord>): string {
  if (records.length === 0) {
    return dim("No components matched.");
  }
  const lines: string[] = [bold(`${records.length} component${records.length === 1 ? "" : "s"}`)];
  for (const c of records) {
    const conf = c.power.sustained.confidence;
    const confLabel =
      conf === "high" ? green("high") : conf === "medium" ? yellow("medium") : red("low");
    lines.push(
      `  ${magenta(c.id)}  ${c.manufacturer} ${c.model}  [${c.category}]  sustained=${c.power.sustained.watts}W (${confLabel})`,
    );
  }
  return lines.join("\n");
}

export function formatComponent(record: ComponentRecord): string {
  const lines: string[] = [];
  lines.push(bold(record.id));
  lines.push(`  ${record.manufacturer} ${record.model}`);
  lines.push(`  Category:  ${record.category}`);
  lines.push(`  Reviewed:  ${record.reviewedAt}`);
  lines.push("");
  lines.push(bold("Power"));
  const fmt = (
    label: string,
    e: { watts: number; basis: string; confidence: string; sourceIds: string[] },
  ) => {
    const conf = e.confidence;
    const confColor = conf === "high" ? green : conf === "medium" ? yellow : red;
    return `  ${label.padEnd(9)} ${e.watts.toString().padStart(6)} W  (${blue(e.basis)}, ${confColor(conf)})  sources: ${e.sourceIds.map((s) => grey(s)).join(", ")}`;
  };
  lines.push(fmt("Idle:", record.power.idle));
  lines.push(fmt("Sustained:", record.power.sustained));
  lines.push(fmt("Transient:", record.power.transient));
  if (record.notes) {
    lines.push("");
    lines.push(dim(record.notes));
  }
  return lines.join("\n");
}

export function formatSourceList(records: ReadonlyArray<SourceRecord>): string {
  if (records.length === 0) {
    return dim("No sources matched.");
  }
  const lines: string[] = [bold(`${records.length} source${records.length === 1 ? "" : "s"}`)];
  for (const s of records) {
    lines.push(`  ${magenta(s.id)}  ${s.title}`);
    lines.push(`    ${dim(s.publisher)} - ${grey(s.url)}`);
  }
  return lines.join("\n");
}

export function formatEfficiencyProfileList(profiles: ReadonlyArray<EfficiencyProfile>): string {
  if (profiles.length === 0) {
    return dim("No efficiency profiles available.");
  }
  const lines: string[] = [
    bold(`${profiles.length} efficiency profile${profiles.length === 1 ? "" : "s"}`),
  ];
  for (const p of profiles) {
    lines.push(`  ${magenta(p.id)}  ${p.label}  [${p.inputVoltage}, ${p.positioning}]`);
    for (const pt of p.points) {
      lines.push(
        `    ${(pt.loadFraction * 100).toFixed(0).padStart(3)}%  ${(pt.efficiencyFraction * 100).toFixed(1)}%`,
      );
    }
  }
  return lines.join("\n");
}

const CATEGORY_LABEL: Readonly<Record<ComponentCategory, string>> = {
  platform: "Platform/motherboard",
  cpu: "CPU",
  gpu: "GPU",
  memory: "Memory",
  storage: "Storage",
  cooling: "Cooling",
  network: "Networking",
  accessory: "Accessory",
};
export { CATEGORY_LABEL };

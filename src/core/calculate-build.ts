import type { BuildPowerTotals, ResolvedBuildLine } from "./types.js";

function clamp01(v: number): number {
  if (!Number.isFinite(v) || v < 0) {
    return 0;
  }
  if (v > 1) {
    return 1;
  }
  return v;
}

export function aggregateTotals(lines: ReadonlyArray<ResolvedBuildLine>): BuildPowerTotals {
  let idle = 0;
  let workload = 0;
  let sustained = 0;
  for (const line of lines) {
    idle += line.powerTotals.idleDcWatts;
    workload += line.workloadDcWatts;
    sustained += line.powerTotals.sustainedDcWatts;
  }
  return {
    idleDcWatts: idle,
    workloadDcWatts: workload,
    sustainedDcWatts: sustained,
    transientDcWatts: 0,
  };
}

export function computeTransient(
  lines: ReadonlyArray<ResolvedBuildLine>,
  sustainedTotal: number,
): number {
  let total = sustainedTotal;
  for (const line of lines) {
    const delta = Math.max(
      0,
      line.powerTotals.transientDcWatts - line.powerTotals.sustainedDcWatts,
    );
    total += delta * clamp01(line.transientCorrelation);
  }
  return total;
}

export function buildTotals(lines: ResolvedBuildLine[]): BuildPowerTotals {
  const totals = aggregateTotals(lines);
  totals.transientDcWatts = computeTransient(lines, totals.sustainedDcWatts);
  return totals;
}

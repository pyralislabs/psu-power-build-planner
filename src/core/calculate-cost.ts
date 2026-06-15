import type { EnergyCostInput, EnergyCostResult } from "./types.js";

export function calculateEnergyCost(input: EnergyCostInput): EnergyCostResult {
  const idleHoursPerDay = input.poweredHoursPerDay * (1 - input.workloadShare);
  const workloadHoursPerDay = input.poweredHoursPerDay * input.workloadShare;
  const dailyDcEnergyKwh =
    (input.idleDcWatts * idleHoursPerDay + input.workloadDcWatts * workloadHoursPerDay) / 1000;
  const annualDcEnergyKwh = dailyDcEnergyKwh * input.daysPerYear;
  let annualAcEnergyKwh: number | null = null;
  let annualCost: number | null = null;
  if (input.idleAcInputWatts !== null && input.workloadAcInputWatts !== null) {
    const dailyAcEnergyKwh =
      (input.idleAcInputWatts * idleHoursPerDay +
        input.workloadAcInputWatts * workloadHoursPerDay) /
      1000;
    annualAcEnergyKwh = dailyAcEnergyKwh * input.daysPerYear;
    annualCost = annualAcEnergyKwh * input.ratePerKwh;
  }
  return {
    idleHoursPerDay,
    workloadHoursPerDay,
    annualDcEnergyKwh,
    annualAcEnergyKwh,
    annualCost,
    ratePerKwh: input.ratePerKwh,
    currency: input.currency,
  };
}

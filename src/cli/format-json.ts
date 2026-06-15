import type { PlannerResult, EfficiencyProfile } from "../core/types.js";
import type { ComponentRecord, SourceRecord } from "../data/types.js";

export interface CliSuccessEnvelope<T> {
  schemaVersion: 1;
  ok: true;
  data: T;
}

export interface CliFailureEnvelope {
  schemaVersion: 1;
  ok: false;
  error: {
    code: string;
    message: string;
    issues?: Array<{ path: string; message: string }>;
  };
}

export function successEnvelope<T>(data: T): CliSuccessEnvelope<T> {
  return { schemaVersion: 1, ok: true, data };
}

export function failureEnvelope(
  code: string,
  message: string,
  issues?: Array<{ path: string; message: string }>,
): CliFailureEnvelope {
  return { schemaVersion: 1, ok: false, error: { code, message, ...(issues ? { issues } : {}) } };
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

export function serializePlannerResult(result: PlannerResult): string {
  return serializeJson(successEnvelope(result));
}

export function serializeComponents(records: ReadonlyArray<ComponentRecord>): string {
  return serializeJson(successEnvelope(records));
}

export function serializeComponent(record: ComponentRecord): string {
  return serializeJson(successEnvelope(record));
}

export function serializeSources(records: ReadonlyArray<SourceRecord>): string {
  return serializeJson(successEnvelope(records));
}

export function serializeEfficiencyProfiles(profiles: ReadonlyArray<EfficiencyProfile>): string {
  return serializeJson(successEnvelope(profiles));
}

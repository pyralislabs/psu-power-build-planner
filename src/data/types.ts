import type { ComponentCategory, Confidence, ValueBasis } from "../core/types.js";

export interface SourcedPowerValue {
  watts: number;
  basis: ValueBasis;
  confidence: Confidence;
  sourceIds: string[];
  rationale?: string;
}

export interface ComponentRecord {
  id: string;
  manufacturer: string;
  model: string;
  category: ComponentCategory;
  aliases?: string[];
  specifications?: Record<string, string>;
  power: {
    idle: SourcedPowerValue;
    sustained: SourcedPowerValue;
    transient: SourcedPowerValue;
  };
  notes?: string;
  reviewedAt: string;
}

export type SourceType =
  | "manufacturer-specification"
  | "manufacturer-guidance"
  | "independent-measurement"
  | "standard"
  | "maintainer-methodology";

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  sourceType: SourceType;
  publishedAt?: string;
  accessedAt: string;
  licenseOrUseNote: string;
  evidenceSummary: string;
}

export interface ComponentsFile {
  schemaVersion: 1;
  updatedAt: string;
  components: ComponentRecord[];
}

export interface SourcesFile {
  schemaVersion: 1;
  updatedAt: string;
  sources: SourceRecord[];
}

export interface EfficiencyProfile {
  id: string;
  label: string;
  inputVoltage: "115v" | "230v" | "unspecified";
  positioning: "conservative-planning" | "custom-reference";
  sourceIds: string[];
  notes: string;
  points: { loadFraction: number; efficiencyFraction: number }[];
}

export interface EfficiencyProfilesFile {
  schemaVersion: 1;
  updatedAt: string;
  profiles: EfficiencyProfile[];
}

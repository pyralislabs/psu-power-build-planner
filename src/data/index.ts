import { componentsFile } from "./_embedded/components.js";
import { sourcesFile } from "./_embedded/sources.js";
import { efficiencyProfilesFile } from "./_embedded/efficiency-profiles.js";
import type {
  ComponentRecord,
  ComponentsFile,
  SourceRecord,
  SourcesFile,
  EfficiencyProfile,
  EfficiencyProfilesFile,
} from "./types.js";
import type { ComponentFilters, ComponentCategory } from "../core/types.js";

const SOURCE_KIND_TO_CATEGORY: ReadonlyArray<ComponentCategory> = [
  "platform",
  "cpu",
  "gpu",
  "memory",
  "storage",
  "cooling",
  "network",
  "accessory",
];

function defensiveCopyComponents(): ComponentRecord[] {
  return componentsFile.components.map((c) => ({
    id: c.id,
    manufacturer: c.manufacturer,
    model: c.model,
    category: c.category,
    ...(c.aliases ? { aliases: c.aliases.slice() } : {}),
    ...(c.specifications ? { specifications: { ...c.specifications } } : {}),
    power: {
      idle: { ...c.power.idle, sourceIds: c.power.idle.sourceIds.slice() },
      sustained: { ...c.power.sustained, sourceIds: c.power.sustained.sourceIds.slice() },
      transient: { ...c.power.transient, sourceIds: c.power.transient.sourceIds.slice() },
    },
    ...(c.notes !== undefined ? { notes: c.notes } : {}),
    reviewedAt: c.reviewedAt,
  }));
}

function defensiveCopySources(): SourceRecord[] {
  return sourcesFile.sources.map((s) => ({ ...s }));
}

function defensiveCopyProfiles(): EfficiencyProfile[] {
  return efficiencyProfilesFile.profiles.map((p) => ({
    id: p.id,
    label: p.label,
    inputVoltage: p.inputVoltage,
    positioning: p.positioning,
    sourceIds: p.sourceIds.slice(),
    notes: p.notes,
    points: p.points.map((pt) => ({ ...pt })),
  }));
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return items.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function listComponents(filters?: ComponentFilters): ComponentRecord[] {
  const all = sortById(defensiveCopyComponents());
  if (!filters) {
    return all;
  }
  const q = filters.query?.toLowerCase().trim();
  return all.filter((c) => {
    if (filters.category && c.category !== filters.category) {
      return false;
    }
    if (
      filters.manufacturer &&
      c.manufacturer.toLowerCase() !== filters.manufacturer.toLowerCase()
    ) {
      return false;
    }
    if (q) {
      const hay = `${c.manufacturer} ${c.model} ${(c.aliases ?? []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export function getComponent(id: string): ComponentRecord | undefined {
  const found = componentsFile.components.find((c) => c.id === id);
  if (!found) {
    return undefined;
  }
  return {
    id: found.id,
    manufacturer: found.manufacturer,
    model: found.model,
    category: found.category,
    ...(found.aliases ? { aliases: found.aliases.slice() } : {}),
    ...(found.specifications ? { specifications: { ...found.specifications } } : {}),
    power: {
      idle: { ...found.power.idle, sourceIds: found.power.idle.sourceIds.slice() },
      sustained: { ...found.power.sustained, sourceIds: found.power.sustained.sourceIds.slice() },
      transient: { ...found.power.transient, sourceIds: found.power.transient.sourceIds.slice() },
    },
    ...(found.notes !== undefined ? { notes: found.notes } : {}),
    reviewedAt: found.reviewedAt,
  };
}

export function listSources(): SourceRecord[] {
  return sortById(defensiveCopySources());
}

export function getSource(id: string): SourceRecord | undefined {
  const found = sourcesFile.sources.find((s) => s.id === id);
  return found ? { ...found } : undefined;
}

export function listEfficiencyProfiles(): EfficiencyProfile[] {
  return sortById(defensiveCopyProfiles());
}

export function getEfficiencyProfile(id: string): EfficiencyProfile | undefined {
  const found = efficiencyProfilesFile.profiles.find((p) => p.id === id);
  if (!found) {
    return undefined;
  }
  return {
    id: found.id,
    label: found.label,
    inputVoltage: found.inputVoltage,
    positioning: found.positioning,
    sourceIds: found.sourceIds.slice(),
    notes: found.notes,
    points: found.points.map((pt) => ({ ...pt })),
  };
}

export const datasetMeta = {
  components: {
    schemaVersion: componentsFile.schemaVersion,
    updatedAt: componentsFile.updatedAt,
    count: componentsFile.components.length,
  },
  sources: {
    schemaVersion: sourcesFile.schemaVersion,
    updatedAt: sourcesFile.updatedAt,
    count: sourcesFile.sources.length,
  },
  efficiencyProfiles: {
    schemaVersion: efficiencyProfilesFile.schemaVersion,
    updatedAt: efficiencyProfilesFile.updatedAt,
    count: efficiencyProfilesFile.profiles.length,
  },
  categories: SOURCE_KIND_TO_CATEGORY,
} as const;

export const datasetTypes: {
  componentsFile: ComponentsFile;
  sourcesFile: SourcesFile;
  efficiencyProfilesFile: EfficiencyProfilesFile;
} = {
  componentsFile,
  sourcesFile,
  efficiencyProfilesFile,
};

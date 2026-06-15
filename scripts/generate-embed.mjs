#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const dataDir = join(repoRoot, "data");
const embeddedDir = join(repoRoot, "src", "data", "_embedded");

function fail(message) {
  console.error(`generate-embed: ${message}`);
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(`Could not parse ${path}: ${err.message}`);
  }
}

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function main() {
  ensureDir(embeddedDir);

  const componentsPath = join(dataDir, "components.json");
  const sourcesPath = join(dataDir, "sources.json");
  const profilesPath = join(dataDir, "efficiency-profiles.json");

  for (const p of [componentsPath, sourcesPath, profilesPath]) {
    if (!existsSync(p)) {
      fail(`Missing required data file: ${p}`);
    }
  }

  const components = readJson(componentsPath);
  const sources = readJson(sourcesPath);
  const profiles = readJson(profilesPath);

  const componentSource = `// AUTO-GENERATED. DO NOT EDIT. Source: data/components.json
import type { ComponentsFile } from "../types.js";

export const componentsFile: ComponentsFile = ${JSON.stringify(components, null, 2)} as const;
`;

  const sourceSource = `// AUTO-GENERATED. DO NOT EDIT. Source: data/sources.json
import type { SourcesFile } from "../types.js";

export const sourcesFile: SourcesFile = ${JSON.stringify(sources, null, 2)} as const;
`;

  const profileSource = `// AUTO-GENERATED. DO NOT EDIT. Source: data/efficiency-profiles.json
import type { EfficiencyProfilesFile } from "../types.js";

export const efficiencyProfilesFile: EfficiencyProfilesFile = ${JSON.stringify(profiles, null, 2)} as const;
`;

  writeFileSync(join(embeddedDir, "components.ts"), componentSource);
  writeFileSync(join(embeddedDir, "sources.ts"), sourceSource);
  writeFileSync(join(embeddedDir, "efficiency-profiles.ts"), profileSource);
  console.info(`generate-embed: wrote embedded modules to ${embeddedDir}`);
}

main();

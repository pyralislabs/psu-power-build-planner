#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const dataDir = join(repoRoot, "data");

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9.]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_RE = /^https:\/\//i;
const TRACKING_RE =
  /(?:^|[?&])(aff|tag|ref|utm_[a-z]+|affiliate|partner|irclickid|irgwc|clickid|li_fat_id|scm|ref_src|ref_)=/i;
const STOREFRONT_HOST_RE =
  /(?:^|\.)(amazon\.|amzn\.|newegg\.|bestbuy\.|microcenter\.|bhphotovideo\.|adorama\.|mwave\.|scan\.|overclockers\.|ebuyer\.|aria-pc\.|cclonline\.|box\.co\.uk|pccasegear\.|umart\.|centrecom\.|mightyape\.|pbtech\.|playtech\.|harveynorman\.|umart\.com)\b/i;
const VALID_BASIS = new Set([
  "measured-dc",
  "measured-wall-derived",
  "manufacturer-tbp",
  "manufacturer-tdp",
  "manufacturer-maximum",
  "review-estimate",
  "maintainer-estimate",
]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);
const VALID_CATEGORY = new Set([
  "platform",
  "cpu",
  "gpu",
  "memory",
  "storage",
  "cooling",
  "network",
  "accessory",
]);
const VALID_SOURCE_TYPE = new Set([
  "manufacturer-specification",
  "manufacturer-guidance",
  "independent-measurement",
  "standard",
  "maintainer-methodology",
]);
const CONFIDENCE_CEILING = {
  "maintainer-estimate": "low",
  "measured-wall-derived": "low",
  "manufacturer-tdp": "medium",
};

function fail(issues, code, path, message) {
  issues.push({ code, path, message });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function todayUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function notFuture(dateStr, path, issues, code) {
  if (!DATE_RE.test(dateStr)) {
    fail(issues, code, path, `Date must match YYYY-MM-DD, got ${dateStr}`);
    return;
  }
  if (dateStr > todayUtc()) {
    fail(issues, code, path, `Date ${dateStr} is in the future`);
  }
}

function validateSource(source, idx, issues) {
  const path = `sources[${idx}]`;
  if (!KEBAB_CASE.test(source.id)) {
    fail(
      issues,
      "INVALID_SOURCE_ID",
      `${path}.id`,
      `id must be lowercase kebab-case, got ${source.id}`,
    );
  }
  if (!HTTPS_RE.test(source.url)) {
    fail(issues, "INVALID_SOURCE_URL", `${path}.url`, `url must use https://`);
  } else if (TRACKING_RE.test(source.url)) {
    fail(
      issues,
      "TRACKING_PARAM_IN_URL",
      `${path}.url`,
      "url contains affiliate or tracking parameter",
    );
  } else if (STOREFRONT_HOST_RE.test(source.url)) {
    fail(
      issues,
      "STOREFRONT_URL",
      `${path}.url`,
      "url points to a storefront and is not acceptable as primary evidence",
    );
  }
  if (!VALID_SOURCE_TYPE.has(source.sourceType)) {
    fail(
      issues,
      "INVALID_SOURCE_TYPE",
      `${path}.sourceType`,
      `sourceType must be one of ${[...VALID_SOURCE_TYPE].join(", ")}`,
    );
  }
  if (typeof source.evidenceSummary !== "string" || source.evidenceSummary.length === 0) {
    fail(
      issues,
      "EMPTY_EVIDENCE_SUMMARY",
      `${path}.evidenceSummary`,
      "evidenceSummary must be a non-empty string",
    );
  } else if (source.evidenceSummary.length > 2000) {
    fail(
      issues,
      "EVIDENCE_SUMMARY_TOO_LONG",
      `${path}.evidenceSummary`,
      "evidenceSummary exceeds 2000 characters",
    );
  }
  if (typeof source.licenseOrUseNote !== "string" || source.licenseOrUseNote.length === 0) {
    fail(
      issues,
      "EMPTY_LICENSE_NOTE",
      `${path}.licenseOrUseNote`,
      "licenseOrUseNote must be a non-empty string",
    );
  }
  notFuture(source.accessedAt, `${path}.accessedAt`, issues, "FUTURE_DATE");
  if (source.publishedAt !== undefined) {
    notFuture(source.publishedAt, `${path}.publishedAt`, issues, "FUTURE_DATE");
  }
}

function validateSourcedValue(field, value, path, issues, sourceIds, isGeneric) {
  if (typeof value.watts !== "number" || !Number.isFinite(value.watts) || value.watts < 0) {
    fail(issues, "INVALID_WATTS", `${path}.watts`, `watts must be a finite number >= 0`);
  }
  if (!VALID_BASIS.has(value.basis)) {
    fail(
      issues,
      "INVALID_BASIS",
      `${path}.basis`,
      `basis must be one of ${[...VALID_BASIS].join(", ")}`,
    );
  }
  if (!VALID_CONFIDENCE.has(value.confidence)) {
    fail(
      issues,
      "INVALID_CONFIDENCE",
      `${path}.confidence`,
      "confidence must be high, medium, or low",
    );
  }
  const ceiling = CONFIDENCE_CEILING[value.basis];
  if (ceiling && value.confidence !== "low" && value.confidence !== ceiling) {
    fail(
      issues,
      "CONFIDENCE_OVER_CEILING",
      `${path}.confidence`,
      `basis ${value.basis} caps confidence at ${ceiling}, got ${value.confidence}`,
    );
  }
  if (!Array.isArray(value.sourceIds) || value.sourceIds.length === 0) {
    fail(issues, "MISSING_SOURCE_IDS", `${path}.sourceIds`, "sourceIds must be a non-empty array");
  } else {
    for (const sid of value.sourceIds) {
      if (!sourceIds.has(sid)) {
        fail(
          issues,
          "UNKNOWN_SOURCE_ID",
          `${path}.sourceIds`,
          `sourceId ${sid} is not defined in data/sources.json`,
        );
      }
    }
  }
  if (isGeneric && value.basis !== "maintainer-estimate") {
    fail(
      issues,
      "GENERIC_REQUIRES_MAINTAINER_ESTIMATE",
      `${path}.basis`,
      `generic-* records must use basis "maintainer-estimate", got ${value.basis}`,
    );
  }
}

function validateComponent(component, idx, issues, sourceIds) {
  const path = `components[${idx}]`;
  if (!KEBAB_CASE.test(component.id)) {
    fail(
      issues,
      "INVALID_COMPONENT_ID",
      `${path}.id`,
      `id must be lowercase kebab-case, got ${component.id}`,
    );
  }
  if (!VALID_CATEGORY.has(component.category)) {
    fail(
      issues,
      "INVALID_CATEGORY",
      `${path}.category`,
      `category must be one of ${[...VALID_CATEGORY].join(", ")}`,
    );
  }
  const power = component.power;
  if (!power || !power.idle || !power.sustained || !power.transient) {
    fail(
      issues,
      "MISSING_POWER_FIELD",
      `${path}.power`,
      "power object must include idle, sustained, transient",
    );
    return;
  }
  const isGeneric = component.id.startsWith("generic-");
  validateSourcedValue("idle", power.idle, `${path}.power.idle`, issues, sourceIds, isGeneric);
  validateSourcedValue(
    "sustained",
    power.sustained,
    `${path}.power.sustained`,
    issues,
    sourceIds,
    isGeneric,
  );
  validateSourcedValue(
    "transient",
    power.transient,
    `${path}.power.transient`,
    issues,
    sourceIds,
    isGeneric,
  );
  if (
    typeof power.idle.watts === "number" &&
    typeof power.sustained.watts === "number" &&
    typeof power.transient.watts === "number"
  ) {
    if (power.idle.watts > power.sustained.watts) {
      fail(
        issues,
        "POWER_ORDERING",
        `${path}.power`,
        `idle (${power.idle.watts}) must be <= sustained (${power.sustained.watts})`,
      );
    }
    if (power.sustained.watts > power.transient.watts) {
      fail(
        issues,
        "POWER_ORDERING",
        `${path}.power`,
        `sustained (${power.sustained.watts}) must be <= transient (${power.transient.watts})`,
      );
    }
  }
  notFuture(component.reviewedAt, `${path}.reviewedAt`, issues, "FUTURE_DATE");
  if (isGeneric) {
    if (typeof component.notes !== "string" || !/methodology/i.test(component.notes)) {
      fail(
        issues,
        "GENERIC_MISSING_METHODOLOGY",
        `${path}.notes`,
        "generic-* records must include a methodology note",
      );
    }
  }
}

function validateProfile(profile, idx, issues, sourceIds) {
  const path = `profiles[${idx}]`;
  if (!KEBAB_CASE.test(profile.id)) {
    fail(
      issues,
      "INVALID_PROFILE_ID",
      `${path}.id`,
      `id must be lowercase kebab-case, got ${profile.id}`,
    );
  }
  if (!Array.isArray(profile.points) || profile.points.length < 3) {
    fail(issues, "TOO_FEW_POINTS", `${path}.points`, "profiles must have at least 3 points");
    return;
  }
  let last = -Infinity;
  const seen = new Set();
  for (let i = 0; i < profile.points.length; i++) {
    const pt = profile.points[i];
    const pPath = `${path}.points[${i}]`;
    if (
      typeof pt.loadFraction !== "number" ||
      !Number.isFinite(pt.loadFraction) ||
      pt.loadFraction < 0 ||
      pt.loadFraction > 1
    ) {
      fail(
        issues,
        "INVALID_LOAD_FRACTION",
        `${pPath}.loadFraction`,
        "loadFraction must be in [0, 1]",
      );
    }
    if (
      typeof pt.efficiencyFraction !== "number" ||
      !Number.isFinite(pt.efficiencyFraction) ||
      pt.efficiencyFraction <= 0 ||
      pt.efficiencyFraction > 1
    ) {
      fail(
        issues,
        "INVALID_EFFICIENCY_FRACTION",
        `${pPath}.efficiencyFraction`,
        "efficiencyFraction must be in (0, 1]",
      );
    }
    if (typeof pt.loadFraction === "number" && pt.loadFraction <= last) {
      fail(issues, "UNSORTED_POINTS", pPath, "points must be strictly increasing by loadFraction");
    } else if (typeof pt.loadFraction === "number") {
      last = pt.loadFraction;
    }
    const key = `${pt.loadFraction}:${pt.efficiencyFraction}`;
    if (seen.has(key)) {
      fail(issues, "DUPLICATE_POINT", pPath, "duplicate curve point");
    }
    seen.add(key);
  }
  if (!Array.isArray(profile.sourceIds) || profile.sourceIds.length === 0) {
    fail(issues, "MISSING_SOURCE_IDS", `${path}.sourceIds`, "sourceIds must be a non-empty array");
  } else {
    for (const sid of profile.sourceIds) {
      if (!sourceIds.has(sid)) {
        fail(
          issues,
          "UNKNOWN_SOURCE_ID",
          `${path}.sourceIds`,
          `sourceId ${sid} is not defined in data/sources.json`,
        );
      }
    }
  }
  if (!/generic|planning|conservative/i.test(profile.label)) {
    fail(
      issues,
      "PROFILE_LABEL_GENERIC",
      `${path}.label`,
      "label must include 'generic' or 'planning' to avoid implying product-specific performance",
    );
  }
}

function assertSorted(items, key, issues, type) {
  let last = "";
  for (let i = 0; i < items.length; i++) {
    const id = items[i][key];
    if (id <= last) {
      fail(
        issues,
        "UNSORTED_IDS",
        `${type}[${i}].${key}`,
        `id ${id} is not strictly greater than previous id ${last}`,
      );
    }
    last = id;
  }
}

function assertUnique(items, key, issues, type) {
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    const id = items[i][key];
    if (seen.has(id)) {
      fail(issues, "DUPLICATE_ID", `${type}[${i}].${key}`, `duplicate id ${id}`);
    }
    seen.add(id);
  }
}

function validateTopLevel(file, fileName, issues) {
  if (file.schemaVersion !== 1) {
    fail(issues, "SCHEMA_VERSION", `${fileName}.schemaVersion`, "schemaVersion must be 1");
  }
  if (typeof file.updatedAt !== "string" || !DATE_RE.test(file.updatedAt)) {
    fail(issues, "INVALID_UPDATED_AT", `${fileName}.updatedAt`, "updatedAt must match YYYY-MM-DD");
  } else if (file.updatedAt > todayUtc()) {
    fail(issues, "FUTURE_DATE", `${fileName}.updatedAt`, "updatedAt is in the future");
  }
}

function main() {
  const args = process.argv.slice(2);
  let onlyFile = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      onlyFile = args[i + 1];
      i++;
    }
  }

  const files = {
    components: join(dataDir, "components.json"),
    sources: join(dataDir, "sources.json"),
    profiles: join(dataDir, "efficiency-profiles.json"),
  };
  for (const f of Object.values(files)) {
    if (!existsSync(f)) {
      console.error(`validate-data: missing ${f}`);
      process.exit(1);
    }
  }

  const sources = readJson(files.sources);
  const components = readJson(files.components);
  const profiles = readJson(files.profiles);

  const issues = [];
  validateTopLevel(sources, "sources", issues);
  validateTopLevel(components, "components", issues);
  validateTopLevel(profiles, "profiles", issues);

  assertUnique(sources.sources, "id", issues, "sources");
  assertSorted(sources.sources, "id", issues, "sources");
  for (let i = 0; i < sources.sources.length; i++) {
    validateSource(sources.sources[i], i, issues);
  }
  const sourceIds = new Set(sources.sources.map((s) => s.id));

  assertUnique(components.components, "id", issues, "components");
  assertSorted(components.components, "id", issues, "components");
  for (let i = 0; i < components.components.length; i++) {
    validateComponent(components.components[i], i, issues, sourceIds);
  }

  assertUnique(profiles.profiles, "id", issues, "profiles");
  assertSorted(profiles.profiles, "id", issues, "profiles");
  for (let i = 0; i < profiles.profiles.length; i++) {
    validateProfile(profiles.profiles[i], i, issues, sourceIds);
  }

  if (onlyFile) {
    const filtered = issues.filter((i) => i.path.startsWith(onlyFile));
    if (filtered.length === 0) {
      console.info(`validate-data: OK for ${onlyFile}`);
      return;
    }
    for (const i of filtered) {
      console.error(`  [${i.code}] ${i.path}: ${i.message}`);
    }
    process.exit(1);
  }

  if (issues.length === 0) {
    console.info(
      `validate-data: OK (${components.components.length} components, ${sources.sources.length} sources, ${profiles.profiles.length} profiles)`,
    );
    return;
  }
  for (const i of issues) {
    console.error(`  [${i.code}] ${i.path}: ${i.message}`);
  }
  console.error(`validate-data: FAILED (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
  process.exit(1);
}

main();

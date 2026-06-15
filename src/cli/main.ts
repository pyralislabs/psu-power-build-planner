#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  listComponents,
  getComponent,
  listSources,
  listEfficiencyProfiles,
} from "../data/index.js";
import { planBuild } from "../index.js";
import { readPlanFile, readStdin, InputReadError } from "./load-plan.js";
import { toExitCode, toErrorEnvelope } from "./errors.js";
import {
  formatComponent,
  formatComponentList,
  formatEfficiencyProfileList,
  formatPlannerResult,
  formatSourceList,
} from "./format-human.js";
import {
  failureEnvelope,
  serializeComponent,
  serializeComponents,
  serializeEfficiencyProfiles,
  serializeJson,
  serializePlannerResult,
  serializeSources,
} from "./format-json.js";
import type { ComponentCategory, ComponentFilters } from "../core/types.js";

const VERSION = "0.1.0";

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  "platform",
  "cpu",
  "gpu",
  "memory",
  "storage",
  "cooling",
  "network",
  "accessory",
]);

class CliUsageError extends Error {
  public readonly code: string;
  public readonly exitCode: number;
  constructor(code: string, message: string, exitCode = 2) {
    super(message);
    this.name = "CliUsageError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

function printVersion(): void {
  process.stdout.write(`psu-build-plan ${VERSION}\n`);
}

function printHelp(): void {
  const text = [
    "psu-build-plan — PSU Power Build Planner",
    "",
    "Usage:",
    "  psu-build-plan plan --input <file> [--json] [--quiet]",
    "  psu-build-plan plan --input <file> [--psu-watts <n>] [--json]  (also evaluates)",
    "  psu-build-plan evaluate --input <file> --psu-watts <n> [--json] [--quiet]",
    "  psu-build-plan components [--category <name>] [--query <text>] [--json]",
    "  psu-build-plan component <component-id> [--json]",
    "  psu-build-plan sources [--json]",
    "  psu-build-plan efficiency-profiles [--json]",
    "  psu-build-plan --version",
    "  psu-build-plan --help",
    "",
    "Flags:",
    "  --input <path>       Planner JSON input file (or read from stdin).",
    "  --psu-watts <n>      Evaluate this PSU capacity (watts).",
    "  --category <name>    Filter components by category.",
    "  --query <text>       Filter components by free-text query.",
    "  --json               Emit a versioned JSON envelope on stdout.",
    "  --quiet              Suppress the human 'Learn more' line.",
    "  --no-color           Disable ANSI colors in human output.",
    "",
    "Exit codes: 0 success, 2 usage error, 3 input read/parse error,",
    "            4 validation or unknown component error,",
    "            5 unsupported/out-of-range planning result, 1 unexpected error.",
  ].join("\n");
  process.stdout.write(text + "\n");
}

function psuWattsFromValue(v: string | boolean | undefined): number | undefined {
  if (typeof v !== "string") {
    return undefined;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    throw new CliUsageError("INVALID_PSU_WATTS", `--psu-watts must be a positive number, got ${v}`);
  }
  return n;
}

function categoryOrThrow(v: string | boolean | undefined): ComponentCategory | undefined {
  if (typeof v !== "string") {
    return undefined;
  }
  if (!VALID_CATEGORIES.has(v)) {
    throw new CliUsageError(
      "INVALID_CATEGORY",
      `--category must be one of ${[...VALID_CATEGORIES].join(", ")}, got ${v}`,
    );
  }
  return v as ComponentCategory;
}

function readInputSync(input: string | undefined): unknown {
  if (input === undefined) {
    return undefined;
  }
  if (input === "-") {
    return undefined;
  }
  return readPlanFile(input);
}
void readInputSync;

async function runPlanOrEvaluate(
  command: string,
  values: Record<string, string | boolean | undefined>,
  positional: string[],
): Promise<number> {
  void positional;
  const useJson = values["json"] === true;
  const quiet = values["quiet"] === true;
  const inputPath = typeof values["input"] === "string" ? values["input"] : undefined;
  const raw = inputPath === undefined ? await readStdinOnce() : readPlanFileSync(inputPath);
  let evaluatedPsuCapacityWatts: number | undefined;
  if (command === "evaluate") {
    const v = psuWattsFromValue(values["psu-watts"]);
    if (v === undefined) {
      throw new CliUsageError("MISSING_PSU_WATTS", "`evaluate` requires --psu-watts <n>.");
    }
    evaluatedPsuCapacityWatts = v;
  } else {
    evaluatedPsuCapacityWatts = psuWattsFromValue(values["psu-watts"]);
  }
  const result = planBuild({ ...(raw as object), evaluatedPsuCapacityWatts });
  if (useJson) {
    process.stdout.write(serializePlannerResult(result));
  } else {
    process.stdout.write(formatPlannerResult(result) + "\n");
    if (!quiet) {
      process.stdout.write(
        "\nLearn more: https://github.com/pyralis-labs/psu-power-build-planner (Local AI Rigs · MiniPCLab · Pyralis Labs)\n",
      );
    }
  }
  return 0;
}

function readPlanFileSync(path: string): unknown {
  return readPlanFile(path);
}

let cachedStdin: unknown = undefined;
async function readStdinOnce(): Promise<unknown> {
  if (cachedStdin !== undefined) {
    return cachedStdin;
  }
  cachedStdin = await readStdin();
  return cachedStdin;
}

function runComponents(values: Record<string, string | boolean | undefined>): number {
  const filters: ComponentFilters = {};
  const cat = categoryOrThrow(values["category"]);
  if (cat) {
    filters.category = cat;
  }
  if (typeof values["query"] === "string") {
    filters.query = values["query"];
  }
  const records = listComponents(filters);
  if (values["json"] === true) {
    process.stdout.write(serializeComponents(records));
  } else {
    process.stdout.write(formatComponentList(records) + "\n");
  }
  return 0;
}

function runComponent(
  values: Record<string, string | boolean | undefined>,
  positional: string[],
): number {
  const id = positional[0];
  if (!id) {
    throw new CliUsageError("MISSING_COMPONENT_ID", "`component` requires a component ID.");
  }
  const record = getComponent(id);
  if (!record) {
    const env = failureEnvelope("UNKNOWN_COMPONENT", `Unknown componentId "${id}".`);
    process.stdout.write(serializeJson(env));
    return 4;
  }
  if (values["json"] === true) {
    process.stdout.write(serializeComponent(record));
  } else {
    process.stdout.write(formatComponent(record) + "\n");
  }
  return 0;
}

function runSources(values: Record<string, string | boolean | undefined>): number {
  const records = listSources();
  if (values["json"] === true) {
    process.stdout.write(serializeSources(records));
  } else {
    process.stdout.write(formatSourceList(records) + "\n");
  }
  return 0;
}

function runEfficiencyProfiles(values: Record<string, string | boolean | undefined>): number {
  const records = listEfficiencyProfiles();
  if (values["json"] === true) {
    process.stdout.write(serializeEfficiencyProfiles(records));
  } else {
    process.stdout.write(formatEfficiencyProfileList(records) + "\n");
  }
  return 0;
}

async function parseAndDispatch(argv: ReadonlyArray<string>): Promise<number> {
  if (argv.length === 0) {
    printHelp();
    return 0;
  }
  const first = argv[0]!;
  if (first === "--help" || first === "-h") {
    printHelp();
    return 0;
  }
  if (first === "--version" || first === "-V") {
    printVersion();
    return 0;
  }
  const command = first;
  const rest = argv.slice(1);

  let values: Record<string, string | boolean | undefined> = {};
  let positionals: string[] = [];
  try {
    const parsed = parseArgs({
      args: rest,
      options: {
        input: { type: "string" },
        "psu-watts": { type: "string" },
        category: { type: "string" },
        query: { type: "string" },
        json: { type: "boolean" },
        quiet: { type: "boolean" },
        "no-color": { type: "boolean" },
      },
      allowPositionals: true,
      strict: true,
    });
    values = parsed.values as Record<string, string | boolean | undefined>;
    positionals = parsed.positionals;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const env = failureEnvelope("INVALID_ARGUMENTS", message);
    process.stdout.write(serializeJson(env));
    return 2;
  }

  if (values["no-color"] === true) {
    process.env["NO_COLOR"] = "1";
  }

  switch (command) {
    case "plan":
    case "evaluate":
      return runPlanOrEvaluate(command, values, positionals);
    case "components":
      return runComponents(values);
    case "component":
      return runComponent(values, positionals);
    case "sources":
      return runSources(values);
    case "efficiency-profiles":
      return runEfficiencyProfiles(values);
    default:
      throw new CliUsageError("UNKNOWN_COMMAND", `Unknown command: ${command}`);
  }
}

export async function main(argv: ReadonlyArray<string> = process.argv.slice(2)): Promise<number> {
  try {
    return await parseAndDispatch(argv);
  } catch (err) {
    if (err instanceof CliUsageError) {
      const env = failureEnvelope(err.code, err.message);
      process.stdout.write(serializeJson(env));
      return err.exitCode;
    }
    if (err instanceof InputReadError) {
      const env = failureEnvelope(err.code, err.message);
      process.stdout.write(serializeJson(env));
      return toExitCode(err);
    }
    const env = toErrorEnvelope(err);
    process.stderr.write(JSON.stringify(env, null, 2) + "\n");
    return toExitCode(err);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(
        `${err && typeof err === "object" && "stack" in err ? (err as Error).stack : String(err)}\n`,
      );
      process.exit(1);
    },
  );
}

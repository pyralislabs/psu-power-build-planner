# Architecture

## System Shape

The project is one zero-runtime-dependency TypeScript package with a pure calculation core, bundled
validated data, a Node CLI adapter, and two static-widget delivery modes.

```text
planner JSON / library input / widget form
  -> boundary parsing and validation
  -> component resolution + assumptions
  -> pure build-power calculations
  -> PSU recommendation/evaluation
  -> efficiency + energy/cost calculations
  -> warnings + versioned result
  -> CLI human/JSON output or widget rendering

components.json + sources.json + efficiency-profiles.json
  -> schema and semantic validation in CI/build
  -> read-only bundled runtime access
```

`planBuild` is the orchestration source of truth. CLI and widget code must not reimplement formulas.

## Dependency Direction

```text
src/core     -> no project-layer dependencies
src/data     -> data types and validated bundled JSON
src/cli      -> core + data + Node built-ins
src/widget   -> core + data + DOM APIs
src/index.ts -> approved core/data public exports
```

Forbidden directions:

- `core` importing from `data`, `cli`, or `widget`
- `data` importing from `cli` or `widget`
- CLI and widget importing one another
- any runtime layer importing development-only validators or build tooling

The core receives component/efficiency values as typed data. Orchestration resolves bundled records
before invoking the lowest-level calculations.

## Components

### Core

`src/core/` owns:

- public-domain input validation and typed errors;
- resolving line quantities, overrides, utilization, and transient correlation;
- idle, representative workload, sustained, and transient DC totals;
- PSU recommendation and evaluated-PSU status;
- efficiency interpolation and AC input/conversion loss;
- electricity energy/cost calculation;
- deterministic assumptions and warning generation.

Core functions are pure and side-effect free. They do not read files, environment variables,
current dates, locale defaults, bundled JSON, network resources, or mutable globals.

### Data

Canonical human-reviewable data lives under `data/`:

- `components.json`: component identities and field-level power evidence references;
- `sources.json`: normalized provenance and evidence summaries;
- `efficiency-profiles.json`: generic sourced planning curves;
- schemas: structural contracts;
- `METHODOLOGY.md`: how maintainers choose/derive values.

`scripts/validate-data.mjs` performs schema and semantic validation during development/CI.
`src/data/index.ts` exposes defensive, sorted copies of already validated bundled records at
runtime. The package does not ship the validator or development dependencies.

Dataset records describe planning evidence, not products to purchase. Price, retailer, affiliate,
availability, and rank data are architecturally forbidden.

### CLI

The CLI uses Node built-ins only. It:

- parses commands and flags with `util.parseArgs`;
- safely reads capped JSON files;
- converts text boundaries into typed input;
- calls shared orchestration/core functions;
- renders human output or exact versioned JSON envelopes;
- maps typed failures to documented exit codes; and
- keeps successful output on stdout and diagnostics on stderr.

It never prompts, performs network access, parses YAML, or writes shopping-list formats.

### Widget

The widget is static and client-only. The iframe and `<psu-power-build-planner>` custom element
share one UI/controller implementation.

The widget:

- uses native semantic controls;
- keeps state per instance and in memory only;
- resolves component search locally;
- calls the same planner API as the CLI;
- uses text APIs for all untrusted strings;
- imports/exports only the versioned planner JSON contract;
- exposes assumptions, warnings, and provenance summaries; and
- sends no user input anywhere.

Shadow DOM isolates script embeds from host CSS. The iframe build provides maximum isolation. Both
must preserve accessibility.

## Calculation Pipeline

```text
PlannerInput
  -> validate input structure and numeric bounds
  -> resolve each dataset/manual component
  -> apply explicit overrides
  -> select utilization and transient correlation
  -> calculate line and build DC states
  -> choose single-GPU or multi-GPU PSU policy defaults
  -> recommend standard capacity
  -> evaluate supplied PSU, if any
  -> select efficiency profile/override
  -> calculate AC state power
  -> calculate annual DC/AC energy and AC cost
  -> collect assumptions and warnings
  -> PlannerResult schemaVersion 1
```

No stage silently repairs invalid input. Defaults and overrides become explicit assumptions.

## Multi-GPU Model

Every GPU remains a normal build line with quantity. Multi-GPU behavior is activated when resolved
GPU quantity is at least two:

- all GPU transient deltas default to fully correlated;
- the PSU policy uses lower sustained/transient utilization targets and a larger reserve;
- `MULTI_GPU_BUILD` is emitted;
- high GPU counts and recommendations above the standard range produce additional warnings.

The architecture intentionally stops at power. It does not model lanes, bridges, slot spacing,
connectors, rails, cable counts, thermal load, room circuits, or redundant supplies.

## Public And Runtime Artifacts

Planned package exports:

```json
{
  ".": "./dist/index.js",
  "./components": "./dist/data/index.js",
  "./components.json": "./dist/data/components.json",
  "./sources.json": "./dist/data/sources.json",
  "./efficiency-profiles.json": "./dist/data/efficiency-profiles.json"
}
```

The package exposes the `psu-build-plan` binary. `package.json` must declare no runtime
`dependencies` or `optionalDependencies`.

Widget artifacts:

- `index.html` and hashed assets for iframe/Pages;
- `embed.js` defining the custom element;
- bundled/cached static dataset assets; and
- no service worker in v1.

## Error And Warning Model

Invalid input and impossible planning operations are typed errors with stable codes and field paths.
Warnings describe usable but uncertain/risky results.

Adapters map the same domain information to:

- library exceptions/results;
- CLI human diagnostics and exit codes;
- CLI JSON failure envelopes; and
- accessible widget summaries and field errors.

Unexpected errors are not swallowed. Normal output does not expose stack traces, local absolute
paths, or internal parser details.

## Trust Boundaries

Untrusted inputs:

- planner JSON files and uploads;
- CLI flags;
- custom-element attributes;
- manual component text/numbers;
- canonical dataset contributions;
- source URLs and evidence summaries.

Controls:

- size, count, length, numeric, and property limits;
- plain-data/schema validation;
- no expression/template evaluation;
- no runtime network;
- text-only DOM insertion;
- defensive dataset copies;
- deterministic outputs; and
- SSRF-hardened advisory source checks, if ever enabled.

## Determinism And Versioning

The same semantic input, bundled data version, and options produce the same result.

- No current time, random IDs, environment data, network data, or locale-default calculations.
- Core and JSON values are unrounded.
- Dataset and output ordering is stable.
- Planner/CLI result documents start with `schemaVersion: 1`.
- Public API, formulas, defaults, datasets, and JSON contracts follow SemVer rules in
  `bootstrap.md`.

## Architecture Decisions Requiring Approval

- Adding runtime dependencies
- Adding a backend, telemetry, persistence, network lookups, or service worker
- Adding automatic hardware detection or monitoring
- Adding PSU product selection, connectors/rails/cables/fit compatibility, or multiple-PSU design
- Adding whole-system measurement catalogs, BOM export/formatting, badges, or TCO features
- Changing formulas, policy defaults, standard capacities, dataset identity/provenance, warning
  meaning, or public contracts

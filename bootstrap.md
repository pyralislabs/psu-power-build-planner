# PSU Power Build Planner Bootstrap Specification

## 1. Mission And First-Ship Decision

Build an MIT-licensed, zero-runtime-dependency TypeScript core library, scriptable CLI, and
accessible static widget that turns a component-level PC or server build into:

- estimated idle, representative workload, sustained maximum, and transient DC power;
- a transparent recommended PSU capacity with configurable headroom;
- estimated PSU utilization and AC wall power at each operating state;
- annual energy use and electricity cost; and
- warnings for incomplete, unusual, or high-risk builds, especially multi-GPU AI rigs.

**This is the recommended first ship among the open-source tool ideas in
`git-projects/ideas.md`.** It has the strongest overlap with the Local AI Rigs and MiniPCLab
audiences while remaining a developer-facing goodwill, embed, and backlink asset rather than a
replacement for the monetized on-site planners.

This repository is documentation-only during bootstrap. Do not add product code unless a later task
explicitly requests implementation. This file is the implementation source of truth. Ask before
changing its product boundary, formulas, contracts, dataset identity model, planned tree, or
acceptance criteria.

## 2. Product Boundary

### In scope

- Accept a component-level build from CLI flags, a versioned JSON plan, library calls, or widget
  selections.
- Support CPUs, GPUs, motherboard/platform baselines, memory, storage, cooling, networking, and
  miscellaneous accessories.
- Support multiple quantities of every component, including heterogeneous and homogeneous
  multi-GPU builds.
- Use a curated, sourced component-power dataset and permit explicit manual component values.
- Calculate idle, representative workload, sustained maximum, and transient peak estimates.
- Recommend a standard PSU wattage using explicit headroom, continuous-load utilization, and
  transient-reserve rules.
- Estimate AC wall power using a documented PSU-efficiency curve or an explicit efficiency
  override.
- Estimate kWh and electricity cost from a user-supplied flat rate and operating profile.
- Publish one zero-runtime-dependency npm package with library and CLI entry points.
- Publish one backend-free static widget for iframe and script/custom-element embedding.
- Emit deterministic human and versioned JSON CLI output.
- Expose assumptions, provenance, confidence, missing data, and warnings in every form factor.
- Include relevant, unobtrusive backlinks to Local AI Rigs, MiniPCLab, and Pyralis Labs.

### Explicit boundaries with adjacent ideas

| Idea | Adjacent project owns | This project may do | This project must not do |
| --- | --- | --- | --- |
| #2 `mini-pc-power-calculator` | Whole-system measured idle/load dataset and whole-system electricity comparisons | Accept a manual whole-system baseline only as an explicitly labeled override or validation comparison | Curate mini-PC/tower/NAS wall-measurement records, become a whole-system comparison catalog, or claim component sums equal measured wall power |
| #4 `homelab-bom-exporter` | User-authored BOM validation, declared cost totals, and Markdown/CSV/JSON formatting | Accept a narrow planner JSON contract and later document an adapter from its normalized JSON | Become a general BOM formatter, parse YAML, render shopping lists, total component purchase cost, or inject affiliate links |
| #10 `homelab-idle-cost-badge` | SVG badge generation and hosted badge distribution | Expose reusable energy/cost results that a separate badge tool could consume | Generate badges, ship badge templates, or host a dynamic badge endpoint |
| #12 `nas-vs-minipc-vs-cloud-tco` | Hardware-versus-cloud TCO, break-even, depreciation, and buy/rent recommendations | Calculate electricity cost for the submitted build | Include purchase price, cloud price, depreciation, maintenance, break-even dates, or buy/rent recommendations |

### Non-goals

- Selecting a specific PSU product, seller, retailer, or affiliate offer
- Declaring connector, rail, cable, physical-fit, ATX-version, or electrical compatibility
- Replacing a PSU manufacturer's sizing guidance or a qualified system integrator
- Exact prediction of wall power, utility bills, performance, thermals, or transient behavior
- Live hardware monitoring, automatic hardware detection, telemetry, accounts, saved cloud state,
  cookies, or a backend
- Current price lookup, inventory lookup, shopping-cart generation, or purchase-cost totals
- Carbon estimates, demand charges, taxes, tiered tariffs, time-of-use tariffs, or currency
  conversion in v1
- Overclocking/undervolting simulation beyond explicit user-entered power overrides
- Redundant PSU, dual-PSU, datacenter PDU, UPS, or three-phase power planning in v1
- A general electronics calculator or a replacement for Local AI Rigs/MiniPCLab editorial content

## 3. Locked Technical Decisions

| Concern | Decision |
| --- | --- |
| Development/CLI runtime | Node.js 22 LTS or newer |
| Language | Strict TypeScript |
| Package manager | `pnpm`, exact version pinned in `packageManager` |
| Module format | ESM |
| npm package | `psu-power-build-planner` |
| CLI binary | `psu-build-plan` |
| Runtime dependencies | **Zero** in package core, CLI, and widget |
| CLI parsing | Node `util.parseArgs`; no CLI framework |
| Library/package build | `tsc` plus small repository-owned build/copy scripts |
| Widget build | Vite as a development dependency; output is static HTML/CSS/JS |
| Unit/integration tests | Vitest and fast-check as development dependencies |
| Browser/widget tests | Playwright and axe-core as development dependencies |
| Dataset validation | Repository-owned semantic validator plus JSON Schema checked in CI |
| Lint/format | ESLint and Prettier |
| Versioning/release | Changesets, SemVer, npm trusted publishing with provenance |
| Widget hosting | GitHub Pages first; Cloudflare Pages-compatible static output |
| Code license | MIT |
| Dataset license | CC BY 4.0 for original structured compilation; source facts retain their own terms |

Zero runtime dependencies means the published package's `dependencies` field is empty and the
widget loads no external JavaScript, CSS, fonts, images, or services. Development dependencies are
allowed for quality gates and build tooling.

## 4. Exact Target Repository Tree

Implementation must converge on this tree. Do not add alternate source roots, duplicate formulas,
or a backend.

```text
psu-power-build-planner/
├── .changeset/
│   └── config.json
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   ├── component-data.yml
│   │   └── feature.yml
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy-pages.yml
│   │   └── release.yml
│   ├── CODEOWNERS
│   └── dependabot.yml
├── data/
│   ├── components.json
│   ├── components.schema.json
│   ├── efficiency-profiles.json
│   ├── efficiency-profiles.schema.json
│   ├── sources.json
│   ├── sources.schema.json
│   ├── CONTRIBUTING.md
│   └── METHODOLOGY.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CODE_STANDARDS.md
│   ├── ROADMAP.md
│   └── TESTING.md
├── examples/
│   ├── gaming-single-gpu.json
│   ├── homelab-low-power.json
│   ├── local-ai-dual-gpu.json
│   └── manual-components.json
├── scripts/
│   ├── build-package.mjs
│   ├── check-runtime-deps.mjs
│   ├── validate-data.mjs
│   └── verify-pack.mjs
├── src/
│   ├── cli/
│   │   ├── args.ts
│   │   ├── errors.ts
│   │   ├── format-human.ts
│   │   ├── format-json.ts
│   │   ├── load-plan.ts
│   │   └── main.ts
│   ├── core/
│   │   ├── calculate-build.ts
│   │   ├── calculate-cost.ts
│   │   ├── calculate-efficiency.ts
│   │   ├── errors.ts
│   │   ├── recommend-psu.ts
│   │   ├── resolve-build.ts
│   │   ├── types.ts
│   │   ├── validate.ts
│   │   └── warnings.ts
│   ├── data/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── widget/
│   │   ├── app.ts
│   │   ├── embed.ts
│   │   ├── psu-planner-element.ts
│   │   ├── styles.css
│   │   └── widget.html
│   └── index.ts
├── tests/
│   ├── cli/
│   │   └── cli.test.ts
│   ├── core/
│   │   ├── calculate-build.test.ts
│   │   ├── calculate-cost.test.ts
│   │   ├── calculate-efficiency.test.ts
│   │   ├── recommend-psu.test.ts
│   │   ├── resolve-build.test.ts
│   │   └── warnings.test.ts
│   ├── data/
│   │   ├── fixtures/
│   │   │   ├── invalid-component.json
│   │   │   ├── invalid-source.json
│   │   │   └── valid-component.json
│   │   └── data.test.ts
│   ├── fixtures/
│   │   └── golden-builds.json
│   ├── package/
│   │   └── packed-package.test.ts
│   └── widget/
│       ├── accessibility.test.ts
│       ├── embed.test.ts
│       └── widget.test.ts
├── .editorconfig
├── .gitignore
├── .npmrc
├── AGENTS.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
├── bootstrap.md
├── eslint.config.js
├── package.json
├── pnpm-lock.yaml
├── tsconfig.build.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

Do not commit `dist/`, `coverage/`, Playwright artifacts, packed tarballs, or built Pages output.

## 5. Domain Model And Terminology

The planner distinguishes component-side DC demand from wall-side AC consumption.

- `idleDcWatts`: estimated component DC demand when powered on and idle.
- `workloadDcWatts`: estimated DC demand for the user's representative workload.
- `sustainedDcWatts`: estimated continuous maximum DC demand used for PSU capacity planning.
- `transientDcWatts`: estimated short-duration peak DC demand used for transient reserve planning.
- `psuCapacityWatts`: PSU nameplate continuous output capacity.
- `psuLoadFraction`: DC output divided by PSU nameplate capacity.
- `efficiencyFraction`: AC-to-DC conversion efficiency at a given PSU load fraction.
- `acInputWatts`: estimated wall power, calculated as DC demand divided by efficiency.
- `headroom`: capacity above sustained demand. It is not the same as efficiency loss.
- `workloadUtilization`: where the representative workload lies between idle and sustained demand.
- `transient` affects PSU recommendation and warnings, not annual energy cost in v1.

Component TDP/TBP/PBP/MTP values are planning evidence, not guaranteed wall measurements. Every
result must state that distinction.

## 6. Calculation Model

### 6.1 Resolve component values

Each build line resolves to one component dataset record or one explicit manual component. Manual
values are never silently merged with dataset values. An override replaces one named field and is
reported in `assumptions.overrides`.

For each line `i`:

```text
lineIdleDcWatts_i = quantity_i * idleDcWattsEach_i
lineSustainedDcWatts_i = quantity_i * sustainedDcWattsEach_i
lineTransientDcWatts_i = quantity_i * transientDcWattsEach_i
```

When a component has no meaningful transient behavior, its transient value equals sustained. For
manual components, omitted transient defaults to sustained and creates warning
`MANUAL_TRANSIENT_DEFAULTED`.

### 6.2 Build state totals

```text
idleDcWatts = sum(lineIdleDcWatts_i)
sustainedDcWatts = sum(lineSustainedDcWatts_i)
```

Representative workload is interpolated per line so mixed builds can use category-specific
utilization:

```text
lineWorkloadDcWatts_i =
  lineIdleDcWatts_i
  + ((lineSustainedDcWatts_i - lineIdleDcWatts_i) * utilization_i)

workloadDcWatts = sum(lineWorkloadDcWatts_i)
```

`utilization_i` is selected in this order:

1. line-level explicit override;
2. profile category utilization;
3. profile fallback utilization.

All utilization values are fractions within `0..1`. They affect representative workload and cost,
not sustained or transient PSU sizing.

### 6.3 Correlated transient model

Blindly summing every component's maximum transient can create false precision, but ignoring
simultaneous CPU/GPU peaks is unsafe for multi-GPU planning. V1 uses a transparent correlation
factor:

```text
transientDelta_i = max(0, lineTransientDcWatts_i - lineSustainedDcWatts_i)

transientDcWatts =
  sustainedDcWatts
  + sum(transientDelta_i * transientCorrelation_i)
```

Default correlation factors:

| Category/build condition | Default factor |
| --- | ---: |
| GPU in a single-GPU build | 1.00 |
| Every GPU in a multi-GPU build | 1.00 |
| CPU | 1.00 |
| Motherboard/platform, memory, storage, networking, cooling, accessory | 0.50 |

The defaults intentionally assume CPU and all GPUs can peak together. A caller may lower factors
only through explicit advanced input. Overrides appear in assumptions and create warning
`TRANSIENT_CORRELATION_OVERRIDDEN`.

### 6.4 Workload profiles

V1 ships editable convenience profiles. They are not hidden claims:

| Profile | CPU | GPU | Storage | Cooling | Other | Powered hours/day | Workload share of powered time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `local-ai-inference` | 0.55 | 0.85 | 0.20 | 0.60 | 0.25 | 8 | 0.50 |
| `local-ai-always-on` | 0.35 | 0.65 | 0.20 | 0.50 | 0.20 | 24 | 0.35 |
| `gaming` | 0.55 | 0.85 | 0.15 | 0.60 | 0.20 | 4 | 0.75 |
| `homelab-light` | 0.20 | 0.05 | 0.25 | 0.35 | 0.20 | 24 | 0.15 |
| `workstation` | 0.65 | 0.55 | 0.35 | 0.55 | 0.30 | 8 | 0.70 |
| `custom` | caller supplied | caller supplied | caller supplied | caller supplied | caller supplied | caller supplied | caller supplied |

The user's operating profile supplies:

- `poweredHoursPerDay` within `(0..24]`;
- `daysPerYear` integer within `1..366`, default `365`;
- `workloadShare` within `0..1`, with idle share equal to `1 - workloadShare`;
- category utilization values within `0..1`;
- flat `ratePerKwh >= 0`; and
- uppercase ISO 4217 `currency`.

### 6.5 PSU recommendation

V1 recommends a capacity class, not a product.

Default policy:

| Policy value | Single GPU / no GPU | Multi-GPU |
| --- | ---: | ---: |
| `targetSustainedLoadFraction` | 0.80 | 0.70 |
| `maxTransientLoadFraction` | 0.95 | 0.90 |
| `minimumReserveWatts` | 100 | 200 |
| `minimumCapacityWatts` | 450 | 850 |

```text
capacityForSustained = sustainedDcWatts / targetSustainedLoadFraction
capacityForTransient = transientDcWatts / maxTransientLoadFraction
capacityForReserve = sustainedDcWatts + minimumReserveWatts

minimumRequiredCapacityWatts =
  max(capacityForSustained, capacityForTransient, capacityForReserve, minimumCapacityWatts)
```

Round upward to the next standard capacity:

```text
450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 1000, 1100,
1200, 1300, 1350, 1500, 1600, 1800, 2000
```

If the minimum exceeds `2000`, return `recommendedCapacityWatts: null` and warning
`CAPACITY_EXCEEDS_V1_RANGE`. Do not recommend multiple PSUs.

Result diagnostics must name which constraint controlled the recommendation:
`sustained-utilization`, `transient-utilization`, `reserve`, or `minimum-capacity`.

User-supplied PSU capacity may be evaluated. It never changes the recommendation. Evaluation states:

- `undersized`: below minimum required capacity;
- `marginal`: meets mathematical minimum but sustained load is above policy target or transient
  load is within five percentage points of its maximum;
- `meets-policy`: meets all policy targets;
- `oversized`: sustained maximum is below 35% of capacity; informational, not unsafe.

The planner must warn that wattage alone does not establish connector, rail, cable, or physical
compatibility.

### 6.6 PSU efficiency and AC wall power

Efficiency is a curve, not a fixed multiplier. `data/efficiency-profiles.json` contains generic,
conservative planning curves with explicit provenance and input-voltage context. It must not imply
that every PSU carrying a certification performs exactly at the curve.

An efficiency curve contains sorted points:

```ts
interface EfficiencyPoint {
  loadFraction: number;       // 0.00..1.00
  efficiencyFraction: number; // >0..1.00
}
```

V1 interpolation:

- At a point, use that point.
- Between points, use linear interpolation.
- Below the lowest non-zero point, use the lowest point and emit
  `EFFICIENCY_BELOW_CURVE_RANGE`.
- Above the highest point through `1.00`, use the highest point and emit
  `EFFICIENCY_ABOVE_CURVE_RANGE`.
- Above `1.00`, the evaluated PSU is overloaded; return no AC estimate for that state.

```text
psuLoadFraction = dcWatts / psuCapacityWatts
acInputWatts = dcWatts / efficiencyAt(psuLoadFraction)
conversionLossWatts = acInputWatts - dcWatts
```

AC estimates use, in order:

1. user-supplied evaluated PSU capacity, when present and not overloaded;
2. recommended PSU capacity;
3. no AC estimate when neither exists.

The API permits an explicit fixed `efficiencyOverrideFraction` within `(0..1]`, but this is labeled
an advanced override and reported in assumptions. The widget should prefer sourced generic curves.

### 6.7 Electricity use and cost

Transients are excluded from energy calculations because v1 lacks duration/frequency evidence.

```text
idleHoursPerDay = poweredHoursPerDay * (1 - workloadShare)
workloadHoursPerDay = poweredHoursPerDay * workloadShare

dailyEnergyKwh =
  ((idleAcInputWatts * idleHoursPerDay)
  + (workloadAcInputWatts * workloadHoursPerDay)) / 1000

annualEnergyKwh = dailyEnergyKwh * daysPerYear
annualCost = annualEnergyKwh * ratePerKwh
```

If AC estimates are unavailable, return DC-side energy separately as
`annualDcEnergyKwh` and make `annualAcEnergyKwh`/`annualCost` null. Never silently treat DC demand
as wall power.

Core results are unrounded JavaScript numbers. JSON returns unrounded numbers. Human/UI output
rounds watts and kWh to two decimals and uses `Intl.NumberFormat` for currency. Displayed values are
never fed back into calculations.

## 7. Validation And Warning Rules

All core numeric inputs must be finite numbers, not numeric strings. Boundary adapters parse text.

Required invariants:

- Build has `1..500` lines and unique line IDs.
- Quantity is an integer `1..32`; GPU quantity above `8` requires a warning.
- Resolved/manual power values are non-negative.
- `idleDcWattsEach <= sustainedDcWattsEach <= transientDcWattsEach`.
- Utilization and correlation factors are within `0..1`.
- PSU policy fractions are within `(0..1]`.
- `minimumReserveWatts >= 0`.
- `poweredHoursPerDay` is within `(0..24]`.
- `daysPerYear` is integer `1..366`.
- `workloadShare` is within `0..1`.
- `ratePerKwh >= 0`.
- Currency is an uppercase three-letter ISO 4217-like code accepted by `Intl.NumberFormat`.
- Manual component names are non-empty and at most 160 visible characters.
- IDs are lowercase kebab-case.

Required warning families:

| Code | Trigger |
| --- | --- |
| `DATA_LOW_CONFIDENCE` | A selected power value has low confidence |
| `DATA_STALE` | A selected evidence record is older than the documented freshness threshold |
| `MANUAL_COMPONENT` | A line uses manual power values |
| `MANUAL_TRANSIENT_DEFAULTED` | Manual transient defaults to sustained |
| `FIELD_OVERRIDE_USED` | Dataset value is replaced by user input |
| `TRANSIENT_CORRELATION_OVERRIDDEN` | Caller changes correlation defaults |
| `MULTI_GPU_BUILD` | Build contains two or more GPUs |
| `GPU_COUNT_HIGH` | Build contains more than eight GPUs |
| `CAPACITY_EXCEEDS_V1_RANGE` | Recommendation exceeds standard v1 range |
| `PSU_UNDERSIZED` | Evaluated PSU is below required capacity |
| `PSU_MARGINAL` | Evaluated PSU barely meets a limit |
| `PSU_OVERSIZED` | Sustained maximum is below 35% capacity |
| `EFFICIENCY_BELOW_CURVE_RANGE` | PSU load is below sourced curve |
| `EFFICIENCY_ABOVE_CURVE_RANGE` | PSU load is above sourced curve |
| `PSU_COMPATIBILITY_NOT_CHECKED` | Always present when a PSU evaluation/recommendation is shown |
| `ESTIMATE_NOT_MEASUREMENT` | Always present in a complete result |

Expected invalid input throws a typed `PlannerValidationError` with stable code and field-level
issues. Warnings do not throw.

## 8. Public Library Contracts

The public exports from `src/index.ts` must be limited to the documented types and functions below.
Dataset internal validators and presentation helpers are not public.

```ts
export type ComponentCategory =
  | "platform"
  | "cpu"
  | "gpu"
  | "memory"
  | "storage"
  | "cooling"
  | "network"
  | "accessory";

export type Confidence = "high" | "medium" | "low";
export type ValueBasis =
  | "measured-dc"
  | "measured-wall-derived"
  | "manufacturer-tbp"
  | "manufacturer-tdp"
  | "manufacturer-maximum"
  | "review-estimate"
  | "maintainer-estimate";

export interface BuildLineInput {
  id: string;
  componentId?: string;
  manualComponent?: ManualComponentInput;
  quantity?: number;
  workloadUtilization?: number;
  transientCorrelation?: number;
  overrides?: Partial<PowerValues>;
}

export interface ManualComponentInput {
  name: string;
  category: ComponentCategory;
  idleDcWattsEach: number;
  sustainedDcWattsEach: number;
  transientDcWattsEach?: number;
}

export interface PowerValues {
  idleDcWattsEach: number;
  sustainedDcWattsEach: number;
  transientDcWattsEach: number;
}

export interface LinePowerTotals {
  idleDcWatts: number;
  sustainedDcWatts: number;
  transientDcWatts: number;
}

export interface OperatingProfileInput {
  preset?: "local-ai-inference" | "local-ai-always-on" | "gaming" | "homelab-light" | "workstation" | "custom";
  poweredHoursPerDay: number;
  daysPerYear?: number;
  workloadShare: number;
  categoryUtilization: Partial<Record<ComponentCategory, number>>;
  fallbackUtilization: number;
  ratePerKwh: number;
  currency: string;
}

export interface PsuPolicyInput {
  targetSustainedLoadFraction?: number;
  maxTransientLoadFraction?: number;
  minimumReserveWatts?: number;
  minimumCapacityWatts?: number;
  standardCapacitiesWatts?: number[];
}

export interface PlannerInput {
  schemaVersion: 1;
  buildName?: string;
  lines: BuildLineInput[];
  operatingProfile: OperatingProfileInput;
  psuPolicy?: PsuPolicyInput;
  evaluatedPsuCapacityWatts?: number;
  efficiencyProfileId?: string;
  efficiencyOverrideFraction?: number;
}

export interface PlannerWarning {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  lineId?: string;
  field?: string;
}

export interface PlannerResult {
  schemaVersion: 1;
  buildName?: string;
  resolvedLines: ResolvedBuildLine[];
  totals: BuildPowerTotals;
  recommendation: PsuRecommendation;
  evaluatedPsu?: PsuEvaluation;
  acPower: AcPowerResult;
  energyCost: EnergyCostResult;
  assumptions: PlannerAssumptions;
  warnings: PlannerWarning[];
}

export interface ResolvedBuildLine {
  id: string;
  componentId?: string;
  name: string;
  category: ComponentCategory;
  quantity: number;
  powerEach: PowerValues;
  powerTotals: LinePowerTotals;
  workloadUtilization: number;
  workloadDcWatts: number;
  transientCorrelation: number;
  confidence: Confidence;
  sourceIds: string[];
  manual: boolean;
  overriddenFields: Array<keyof PowerValues>;
}

export interface BuildPowerTotals {
  idleDcWatts: number;
  workloadDcWatts: number;
  sustainedDcWatts: number;
  transientDcWatts: number;
}

export interface PsuRecommendation {
  recommendedCapacityWatts: number | null;
  minimumRequiredCapacityWatts: number;
  controllingConstraint:
    | "sustained-utilization"
    | "transient-utilization"
    | "reserve"
    | "minimum-capacity";
  capacityForSustainedWatts: number;
  capacityForTransientWatts: number;
  capacityForReserveWatts: number;
  policy: Required<PsuPolicyInput>;
}

export interface PsuEvaluation {
  capacityWatts: number;
  status: "undersized" | "marginal" | "meets-policy" | "oversized";
  sustainedLoadFraction: number;
  transientLoadFraction: number;
  reserveWatts: number;
}

export interface EfficiencyPoint {
  loadFraction: number;
  efficiencyFraction: number;
}

export interface EfficiencyCurve {
  points: EfficiencyPoint[];
}

export interface EfficiencyProfile extends EfficiencyCurve {
  id: string;
  label: string;
  inputVoltage: "115v" | "230v" | "unspecified";
  positioning: "conservative-planning" | "custom-reference";
  sourceIds: string[];
  notes: string;
}

export interface EfficiencyResult {
  dcWatts: number;
  psuCapacityWatts: number;
  loadFraction: number;
  efficiencyFraction: number | null;
  acInputWatts: number | null;
  conversionLossWatts: number | null;
  warnings: PlannerWarning[];
}

export interface AcPowerResult {
  psuCapacityWatts: number | null;
  efficiencyProfileId?: string;
  idle: EfficiencyResult;
  workload: EfficiencyResult;
  sustained: EfficiencyResult;
}

export interface EnergyCostInput {
  idleDcWatts: number;
  workloadDcWatts: number;
  idleAcInputWatts: number | null;
  workloadAcInputWatts: number | null;
  poweredHoursPerDay: number;
  daysPerYear: number;
  workloadShare: number;
  ratePerKwh: number;
  currency: string;
}

export interface EnergyCostResult {
  idleHoursPerDay: number;
  workloadHoursPerDay: number;
  annualDcEnergyKwh: number;
  annualAcEnergyKwh: number | null;
  annualCost: number | null;
  ratePerKwh: number;
  currency: string;
}

export interface PlannerAssumptions {
  operatingProfile: Required<OperatingProfileInput>;
  psuPolicy: Required<PsuPolicyInput>;
  efficiencyProfileId?: string;
  efficiencyOverrideFraction?: number;
  overrides: Array<{ lineId: string; field: keyof PowerValues; value: number }>;
}

export interface ComponentFilters {
  category?: ComponentCategory;
  manufacturer?: string;
  query?: string;
}

export function planBuild(input: PlannerInput): PlannerResult;
export function recommendPsu(
  totals: BuildPowerTotals,
  policy?: PsuPolicyInput,
  gpuCount?: number,
): PsuRecommendation;
export function calculateEfficiency(
  dcWatts: number,
  psuCapacityWatts: number,
  curve: EfficiencyCurve,
): EfficiencyResult;
export function calculateEnergyCost(input: EnergyCostInput): EnergyCostResult;
export function listComponents(filters?: ComponentFilters): ComponentRecord[];
export function getComponent(id: string): ComponentRecord | undefined;
export function listSources(): SourceRecord[];
export function getSource(id: string): SourceRecord | undefined;
export function listEfficiencyProfiles(): EfficiencyProfile[];
```

`ComponentRecord`, `SourcedPowerValue`, and `SourceRecord` are the exported dataset contracts
defined in section 12. All returned dataset records are defensive copies sorted by stable ID.
`planBuild` is the preferred orchestration API. Lower-level functions remain deterministic and
independently testable.

## 9. Planner JSON Contract

CLI input files use `PlannerInput` with `schemaVersion: 1`, JSON only. JSON is intentionally narrow:
it is a planner contract, not idea #4's general BOM contract.

Example:

```json
{
  "schemaVersion": 1,
  "buildName": "Dual-GPU local AI rig",
  "lines": [
    { "id": "platform", "componentId": "generic-atx-platform-baseline" },
    { "id": "cpu", "componentId": "example-cpu-model" },
    { "id": "gpus", "componentId": "example-gpu-model", "quantity": 2 },
    { "id": "memory", "componentId": "generic-ddr5-dimm", "quantity": 4 }
  ],
  "operatingProfile": {
    "preset": "local-ai-always-on",
    "poweredHoursPerDay": 24,
    "daysPerYear": 365,
    "workloadShare": 0.35,
    "categoryUtilization": {},
    "fallbackUtilization": 0.25,
    "ratePerKwh": 0.16,
    "currency": "USD"
  },
  "efficiencyProfileId": "generic-80-plus-gold-115v-conservative"
}
```

Unknown fields fail validation. No YAML in v1.

## 10. CLI Contract

```bash
psu-build-plan plan --input build.json
psu-build-plan plan --input build.json --json
psu-build-plan evaluate --input build.json --psu-watts 1000 --json
psu-build-plan components --category gpu --query "model" --json
psu-build-plan component <component-id> --json
psu-build-plan efficiency-profiles --json
```

Rules:

- No interactive prompts; all commands are automation-friendly.
- `plan` uses the input file and optional documented overrides.
- `evaluate` requires `--psu-watts` and reports recommendation plus evaluated-PSU status.
- `components` and `component` expose provenance summaries, not copied source prose.
- `--json` writes one versioned JSON envelope to stdout.
- Human output is default and always shows assumptions/warnings.
- Successful output only goes to stdout. Diagnostics/errors go to stderr.
- No ANSI in JSON. Honor `NO_COLOR` in human output.
- No network access.
- Input file size is capped at 1 MiB.
- Exit codes: `0` success, `2` CLI usage error, `3` input read/parse error, `4` validation or unknown
  component error, `5` unsupported/out-of-range planning result, `1` unexpected internal error.

JSON envelopes:

```ts
type CliSuccess<T> = { schemaVersion: 1; ok: true; data: T };
type CliFailure = {
  schemaVersion: 1;
  ok: false;
  error: {
    code: string;
    message: string;
    issues?: Array<{ path: string; message: string }>;
  };
};
```

Package expectations:

```bash
npx psu-power-build-planner plan --input build.json
npm install psu-power-build-planner
```

## 11. Static Widget Contract

The widget provides a guided build planner, not a product recommender.

Required flow:

1. Choose a workload profile or custom assumptions.
2. Add/search components or add a manual component.
3. Set quantities, including multiple GPUs.
4. Optionally enter an existing PSU capacity.
5. Enter electricity rate/currency and schedule.
6. Review totals, recommendation, cost, warnings, and source/provenance summaries.

Required results:

- idle, representative workload, sustained, and transient DC watts;
- recommended capacity and controlling constraint;
- evaluated PSU status when supplied;
- idle/workload AC input and conversion losses;
- annual kWh and electricity cost;
- explicit assumptions and warning list; and
- a shareable/downloadable planner JSON file generated locally.

Embedding:

```html
<iframe
  src="https://pyralis-labs.github.io/psu-power-build-planner/"
  title="PSU power build planner"
  loading="lazy"
></iframe>
```

```html
<psu-power-build-planner
  data-profile="local-ai-always-on"
  data-currency="USD"
  data-rate-per-kwh="0.16"
></psu-power-build-planner>
<script
  type="module"
  src="https://pyralis-labs.github.io/psu-power-build-planner/embed.js"
></script>
```

Widget constraints:

- Static, responsive, and functional without a backend.
- Uses a custom element with Shadow DOM; supports multiple independent instances.
- Host attributes are optional conveniences, validated as untrusted text, and never throw into the
  host page.
- No remote runtime data, analytics, storage, cookies, affiliate links, or automatic rate lookup.
- Download uses a local Blob; upload accepts JSON only and enforces size limits.
- User input remains in memory for the current page only.
- Dataset search remains usable with at least 1,000 records.
- Total initial widget transfer target is under 250 kB gzip, including the initial dataset subset;
  full dataset may be a separately cached static asset under 500 kB gzip.

Accessibility:

- Target WCAG 2.2 AA.
- Use semantic headings, fieldsets, legends, labels, buttons, tables, and native inputs.
- Component search is keyboard-operable and does not require pointer input.
- Every error is associated with its field and summarized.
- Results and newly added warnings are announced through polite live regions.
- Focus moves predictably after validation failure, component add/remove, and JSON import.
- Color is never the only warning/status indicator.
- Support 200% zoom, narrow embeds, high contrast, reduced motion, and screen readers.
- Results tables have captions and remain understandable when linearized.

## 12. Component Dataset And Provenance

### 12.1 Dataset structure

`data/components.json`:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-06-15",
  "components": []
}
```

`data/sources.json`:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-06-15",
  "sources": []
}
```

Components reference reusable source records by stable source ID. Each power field has its own
evidence references because idle, sustained, and transient values may come from different evidence.

```ts
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

export interface SourcedPowerValue {
  watts: number;
  basis: ValueBasis;
  confidence: Confidence;
  sourceIds: string[];
  rationale?: string;
}

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  sourceType:
    | "manufacturer-specification"
    | "manufacturer-guidance"
    | "independent-measurement"
    | "standard"
    | "maintainer-methodology";
  publishedAt?: string;
  accessedAt: string;
  licenseOrUseNote: string;
  evidenceSummary: string;
}
```

### 12.2 Dataset identity and coverage

- A record represents one component model or a clearly named generic planning baseline.
- Do not create separate records for retailer listings of the same model.
- Variant-specific records are required when power specifications materially differ.
- IDs are stable lowercase kebab-case, usually `<manufacturer>-<model>-<variant>`.
- Generic records start with `generic-` and document the methodology used.
- Dataset records do not include prices, affiliate URLs, availability, seller data, or rankings.
- Search aliases are factual alternate names, not SEO keyword stuffing.
- V1 release target: at least 100 records:
  - 30 GPUs, including consumer and workstation examples;
  - 30 CPUs;
  - 10 platform/motherboard baselines;
  - 10 storage records/baselines;
  - 10 memory/cooling/network/accessory baselines;
  - sufficient components for every shipped example and test fixture.

### 12.3 Evidence hierarchy and confidence

Preferred evidence order:

1. independent, reproducible component-level or isolated rail measurement;
2. manufacturer maximum/board-power specification;
3. manufacturer TDP/TBP/PBP/MTP-style planning specification;
4. credible review estimate with method stated;
5. documented maintainer estimate for generic baselines.

Confidence rubric:

- `high`: direct component-level measurement or explicit manufacturer maximum/transient guidance
  that matches the field's meaning.
- `medium`: strong adjacent evidence or a manufacturer planning value used transparently for a
  nearby concept.
- `low`: maintainer estimate, weakly isolated wall-derived value, incomplete method, or uncertain
  mapping.

Mechanical ceilings:

- `maintainer-estimate` and `measured-wall-derived` cannot exceed `low`.
- `manufacturer-tdp` cannot exceed `medium`.
- `high` requires an independent measurement, manufacturer maximum, or manufacturer guidance source.
- Every field requires at least one source and a non-empty evidence summary.

### 12.4 Provenance and contribution rules

- Source URLs must be public HTTPS URLs pointing to evidence, not storefronts.
- Remove affiliate, tracking, session, and referral parameters.
- Do not copy copyrighted prose, tables, or charts. Record facts and write an original short
  evidence summary.
- Every source states access date and a license/use note.
- Dates cannot be in the future.
- A source's existence does not prove the selected value; reviewers verify the mapping.
- Dataset changes require a Changeset.
- Corrections explain why the old value was wrong and identify affected outputs.
- Record removal or stable ID changes are breaking changes.
- Canonical files use two-space JSON and sort records by ID.

CI rejects:

- schema or semantic validation failure;
- duplicate/unsorted IDs;
- impossible power ordering;
- missing field-level sources;
- confidence above its allowed ceiling;
- non-HTTPS, private-network, storefront-only, or tracking-bearing source URLs;
- future dates;
- empty evidence summaries;
- values outside documented sanity bounds; or
- dataset changes without required tests and Changeset.

Any automated link reachability check is advisory and SSRF-hardened. Manual review remains required.

## 13. Efficiency Profile Dataset

`data/efficiency-profiles.json` contains generic planning curves, not PSU product records.

```ts
interface EfficiencyProfile {
  id: string;
  label: string;
  inputVoltage: "115v" | "230v" | "unspecified";
  positioning: "conservative-planning" | "custom-reference";
  points: EfficiencyPoint[];
  sourceIds: string[];
  notes: string;
}
```

Rules:

- Points are unique and sorted by load fraction.
- Curves have at least points for low, medium, and full load.
- Every curve identifies voltage context and evidence.
- Labels may reference certification classes only when evidence permits and always include
  "generic" or "planning"; they must not claim product-specific performance.
- Widget defaults to a conservative generic curve and visibly allows custom selection.

## 14. Required Package Scripts

| Script | Required behavior |
| --- | --- |
| `build` | Build package, CLI, bundled data, and widget |
| `build:package` | Build library, CLI, and bundled data |
| `build:widget` | Build static iframe page and custom-element embed |
| `format` | Apply Prettier |
| `format:check` | Check formatting |
| `lint` | Run ESLint |
| `typecheck` | Run TypeScript without emit |
| `validate:data` | Validate schemas, semantics, provenance, and ordering |
| `test` | Run Vitest once |
| `test:coverage` | Run Vitest with enforced thresholds |
| `test:browser` | Run Playwright widget/accessibility tests |
| `check:runtime-deps` | Prove published runtime dependency count is zero |
| `check` | Run format check, lint, typecheck, data validation, tests, build, and pack verification |
| `changeset` | Create a Changeset |

## 15. Milestones And Acceptance Criteria

### M0: Repository foundation

- Exact tree, package metadata, planned docs, MIT license, contribution/security policies, issue
  templates, Changesets, and workflows exist.
- Strict TypeScript, lint, formatting, test, build, and pack scripts pass on a clean checkout.
- Runtime dependency check proves zero dependencies.
- No product behavior beyond scaffolding.

### M1: Pure calculation core

- Public contracts, validation, formulas, warnings, and typed errors are implemented.
- Single- and multi-GPU golden fixtures match expected output.
- Core never imports Node, DOM, locale state, network, or mutable global state.
- Core calculation/validation modules reach 100% branch coverage.

### M2: Dataset and provenance pipeline

- Component, source, and efficiency-profile schemas and validators exist.
- At least 100 sourced/reviewable component records meet coverage targets.
- Every power field resolves to reviewable evidence and confidence.
- Contribution guide, methodology, Changeset enforcement, and deterministic sorting pass CI.

### M3: CLI and npm package

- Every command, flag, exit code, warning, and JSON envelope is implemented and tested.
- Packed tarball has zero runtime dependencies and contains only intended runtime artifacts/docs.
- `npx psu-power-build-planner --help` and planning from all examples work from the packed tarball.
- npm package exports and CLI work on Node 22 and latest LTS.

### M4: Accessible static widget

- Guided component selection, manual entry, multi-GPU quantities, PSU evaluation, cost, JSON
  import/export, assumptions, warnings, and provenance summaries work.
- iframe and custom-element embeds work on plain external host pages.
- Keyboard, screen-reader, zoom, high-contrast, reduced-motion, and axe checks pass.
- No network calls occur except loading the widget's own static assets.
- Bundle budgets and zero-runtime-dependency constraints pass.

### M5: Public release and distribution

- npm trusted publishing with provenance and GitHub Pages deployment are live.
- README examples match released artifacts.
- Hosted widget has HTTPS, a provider-appropriate documented CSP/cache posture, and visible relevant
  backlinks.
- Release, rollback, deprecation, security-reporting, and dataset-contribution processes are tested.
- Local AI Rigs and MiniPCLab can embed or link to the tool without product-scope confusion.

## 16. Exhaustive Test Requirements

The detailed test strategy lives in `docs/TESTING.md`; implementation must include at minimum:

- golden single-GPU, dual-GPU, heterogeneous multi-GPU, CPU-only, low-power homelab, manual-only,
  and over-2000-W builds;
- table tests for every validation bound, warning, and controlling PSU constraint;
- property tests proving monotonicity and invariants;
- exact transient-correlation and efficiency-interpolation tests;
- cost tests for zero rate, zero workload share, 24/7, partial schedule, and leap year;
- tests proving transients never affect energy cost;
- tests proving DC energy is not mislabeled as AC energy when efficiency is unavailable;
- full dataset schema, semantic, provenance, confidence, source URL, date, and sort validation;
- CLI subprocess tests for all commands, exit codes, stdout/stderr, JSON, help, and malformed input;
- packed-package tests proving exports, bundled data, CLI, and zero runtime dependencies;
- widget unit, integration, import/export, multi-instance, host-isolation, no-network, and
  accessibility tests; and
- release smoke tests for npm install, `npx`, GitHub Pages, CSP, backlinks, and static assets.

Minimum coverage:

- 100% branches for core calculations, recommendation, validation, and warnings;
- 95% lines and 90% branches overall;
- every dataset rejection rule has one positive and one negative fixture;
- every documented warning and exit code has an assertion.

## 17. CI, npm Release, Pages, And Operations

### Pull-request CI

Run on Ubuntu using Node 22 and latest Node LTS:

1. `pnpm install --frozen-lockfile`
2. `pnpm format:check`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm validate:data`
6. `pnpm test:coverage`
7. `pnpm build`
8. `pnpm check:runtime-deps`
9. packed-package smoke test
10. Playwright Chromium accessibility/embed smoke
11. dependency audit blocking high/critical findings unless explicitly documented

Add Firefox and WebKit widget smoke tests before v1. Pin GitHub Actions to immutable commit SHAs.

### Release

- Changesets controls versioning and changelog.
- Follow SemVer.
- Dataset additions/corrections are patch changes.
- New optional APIs or compatible fields are minor changes.
- Formula meaning, defaults, stable IDs, schema, JSON envelopes, or public API breakage is major.
- Publish through GitHub Actions npm trusted publishing with provenance; no long-lived npm token.
- Tags use `vX.Y.Z`.
- Release attaches bundled datasets and static widget artifact.
- Never overwrite an npm version. Deprecate a bad version and publish a correction.

### GitHub Pages

- Deploy only built static widget assets from a reviewed workflow.
- Use a dedicated Pages environment with least-privilege permissions.
- Use hashed JS/CSS asset names and document GitHub Pages' provider-controlled cache behavior.
- Use a restrictive CSP meta policy for controls supported in HTML. Do not claim that GitHub Pages
  supplies configurable response headers such as `frame-ancestors`.
- The widget is intentionally embeddable. If configurable response headers, stricter cache control,
  or a restricted `frame-ancestors` policy becomes required, use the compatible Cloudflare Pages
  build as the canonical host and document the change.
- Roll back by redeploying the last known-good tagged artifact.
- Keep the build compatible with Cloudflare Pages, but do not add provider-specific runtime code.

## 18. Security, Privacy, And Supply Chain

- Treat CLI files, widget JSON uploads, embed attributes, dataset text, and source URLs as untrusted.
- Use text APIs, never `innerHTML`, for user/dataset content.
- Cap file sizes, line counts, quantities, string lengths, and numeric ranges.
- Reject prototype-polluting keys and unexpected object properties.
- Do not evaluate code, templates, expressions, or URLs from inputs.
- Widget performs no data submission, analytics, cookies, local storage, or third-party requests.
- CLI performs no network access.
- Keep runtime dependencies at zero.
- Pin Actions, use least permissions, enable Dependabot for development dependencies, and review
  lockfile changes.
- Release uses npm provenance and protected environments.
- Reachability checks, if added, must block private/reserved destinations, redirects, large
  responses, and long timeouts.
- Publish vulnerability-reporting instructions in `SECURITY.md`; do not ask reporters to open
  public issues for undisclosed vulnerabilities.

## 19. Backlink And Brand Policy

- README identifies the tool as an open-source Pyralis Labs project and includes plain links to:
  - `https://localairigs.com/` for local AI rig/build guidance;
  - `https://minipclab.com/` for low-power homelab/mini-PC guidance; and
  - `https://pyralislabs.io/` for the project publisher.
- Widget footer includes one unobtrusive publisher attribution plus contextually relevant links to
  Local AI Rigs and MiniPCLab.
- CLI human output may include one short "Learn more" line unless `--quiet`; JSON output never
  contains promotional copy.
- No affiliate links, hidden links, forced redirects, keyword stuffing, or license requirement to
  preserve backlinks.
- Component/source records never contain backlinks except factual evidence URLs.

## 20. Definition Of Done

V1 is done only when:

- M0 through M5 acceptance criteria pass.
- The project is publicly marked and shipped as the recommended first open-source tool from the
  idea set.
- Core API, planner JSON, CLI JSON, dataset, efficiency curve, and embed contracts are documented
  and versioned.
- Idle, workload, sustained, transient, headroom, efficiency, AC wall, and electricity-cost math is
  deterministic, transparent, and exhaustively tested.
- Multi-GPU behavior and warnings are explicit and tested.
- Dataset values have field-level provenance, confidence, review dates, and mechanical validation.
- npm package and CLI work from the published artifact with zero runtime dependencies.
- GitHub Pages widget is accessible, backend-free, private by design, and embeddable.
- README includes assumptions, limitations, examples, contribution path, security path, and
  relevant backlinks.
- Release, rollback, deprecation, and ownership procedures are documented and exercised.
- The tool makes no PSU product recommendation and clearly warns that wattage is not full electrical
  or physical compatibility.
- No responsibilities from ideas #2, #4, #10, or #12 have leaked into scope.

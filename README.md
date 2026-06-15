# PSU Power Build Planner

Component list in, transparent power plan out: idle/workload/sustained/transient
wattage, recommended PSU capacity, efficiency-adjusted wall power, and annual
electricity cost. Zero-runtime-dependency TypeScript library, scriptable
`psu-build-plan` CLI, and an accessible static widget for iframe and
custom-element embeds.

**Status: v0.1.0.** MIT-licensed library, CLI, and dataset. The bootstrap
specification in [`bootstrap.md`](./bootstrap.md) is the implementation source
of truth; the dataset, the planner JSON, and the JSON envelope are versioned
together with the library.

## Why this exists

Local AI Rigs and MiniPCLab readers need fast, transparent power and PSU
estimates without leaving their existing tool pages. This package ships a
small, embeddable planner that turns a component-level build into a
calibrated recommendation, without any runtime dependencies, network
calls, telemetry, cookies, or storage. The open-source planner complements
the editorial on-site buying journeys; it never recommends a specific PSU
product, fetches prices, or injects affiliate links.

## What you get

- **Library**: `planBuild(input)` orchestrates validation, resolution,
  calculation, recommendation, efficiency, and energy/cost. Public exports
  are listed in `src/index.ts` and follow the contracts in
  [`bootstrap.md`](./bootstrap.md) §8.
- **CLI**: `psu-build-plan` exposes `plan`, `evaluate`, `components`,
  `component`, `sources`, and `efficiency-profiles`. Human and versioned
  JSON output. See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the full
  command surface.
- **Dataset**: 100+ sourced component records, 5 generic PSU-efficiency
  planning curves, JSON Schemas, and a Node-built-in validator. See
  [`data/CONTRIBUTING.md`](./data/CONTRIBUTING.md) for the contribution
  workflow.
- **Widget**: accessible static widget with iframe and `<psu-power-build-planner>`
  Shadow-DOM custom-element delivery. Embed anywhere; no backend, no network
  requests, no analytics.

## Quick start

```bash
npm install psu-power-build-planner
# or
npx psu-power-build-planner plan --input build.json
```

```ts
import { planBuild } from "psu-power-build-planner";

const result = planBuild({
  schemaVersion: 1,
  lines: [
    { id: "platform", componentId: "generic-consumer-amd-am5-platform" },
    { id: "cpu", componentId: "amd-ryzen-9-7950x" },
    { id: "gpu", componentId: "nvidia-rtx-4090", quantity: 1 },
    { id: "memory", componentId: "generic-ddr5-udimm-baseline", quantity: 2 },
    { id: "storage", componentId: "samsung-990-pro-2tb" },
    { id: "cooler", componentId: "generic-aio-360mm-cooler-baseline" },
  ],
  operatingProfile: {
    preset: "local-ai-inference",
    poweredHoursPerDay: 8,
    daysPerYear: 365,
    workloadShare: 0.5,
    categoryUtilization: {},
    fallbackUtilization: 0.25,
    ratePerKwh: 0.16,
    currency: "USD",
  },
  efficiencyProfileId: "generic-80-plus-gold-115v-conservative",
});

console.log(result.recommendation.recommendedCapacityWatts, "W");
console.log(result.energyCost.annualCost, result.energyCost.currency);
```

## Embedding the widget

```html
<iframe
  src="https://pyralis-labs.github.io/psu-power-build-planner/"
  title="PSU power build planner"
  loading="lazy"
  width="100%"
  height="900"
></iframe>
```

```html
<psu-power-build-planner
  data-profile="local-ai-inference"
  data-currency="USD"
  data-rate-per-kwh="0.16"
></psu-power-build-planner>
<script
  type="module"
  src="https://pyralis-labs.github.io/psu-power-build-planner/embed.js"
></script>
```

## Core assumptions

- Component power specifications and estimates are planning inputs, not exact
  wall measurements.
- PSU headroom and efficiency are separate calculations.
- Transient peaks influence PSU sizing but not annual cost in v1.
- Users provide electricity rate and currency; the tool does not guess or
  convert them.
- A wattage recommendation does not verify PSU connectors, cables, rails, ATX
  compatibility, physical fit, or product quality.
- Results expose their assumptions and source confidence.

## Product boundary

This project owns component-derived power and PSU planning.

It does **not** replace:

- **idea #2**, `mini-pc-power-calculator`, for measured whole-system power
  comparisons;
- **idea #4**, `homelab-bom-exporter`, for general BOM
  validation/formatting/export;
- **idea #10**, `homelab-idle-cost-badge`, for badge generation; or
- **idea #12**, `nas-vs-minipc-vs-cloud-tco`, for buy-versus-rent TCO and
  break-even analysis.

It does not recommend a PSU product, fetch prices, total purchase cost, or
inject affiliate links. The dataset never contains retailer URLs, prices, or
affiliate parameters.

## Repository layout

```
psu-power-build-planner/
├── bootstrap.md           # Implementation source of truth
├── data/                  # Dataset (components, sources, efficiency profiles)
├── docs/                  # Architecture, code standards, testing, roadmap, release
├── examples/              # Example planner JSON inputs
├── scripts/               # Build, validation, runtime-dep check
├── src/                   # core/ + cli/ + data/ + widget/ + index.ts
└── tests/                 # Vitest suites (core, data, cli, widget, package)
```

The published npm package exposes:

```json
{
  ".": "./dist/index.js",
  "./components": "./dist/data/index.js",
  "./components.json": "./dist/data/components.json",
  "./sources.json": "./dist/data/sources.json",
  "./efficiency-profiles.json": "./dist/data/efficiency-profiles.json",
  "./widget": "./dist/widget/embed.js"
}
```

The `psu-build-plan` binary is at `./dist/cli/main.js`.

## Quality gates

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm validate:data
pnpm test:coverage
pnpm build
pnpm check:runtime-deps
pnpm verify:pack
pnpm check
```

Browser tests:

```bash
pnpm test:browser:install
pnpm test:browser
```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the workflow, code standards,
and dataset contribution rules. Dataset additions and corrections are patch
changes; new optional API and CLI flags are minor; formula or public-contract
changes are major. Every change ships with a Changeset entry under
`.changeset/`.

## Security

Please email [security@pyralislabs.io](mailto:security@pyralislabs.io) for
undisclosed vulnerabilities. See [`SECURITY.md`](./SECURITY.md) for the full
policy. **Do not open a public issue for an undisclosed vulnerability.**

## Strategic home

- [Local AI Rigs](https://localairigs.com/) owns local AI rig, GPU, and
  build-guide context.
- [MiniPCLab](https://minipclab.com/) owns low-power mini-PC and homelab
  context.
- [Pyralis Labs](https://pyralislabs.io/) is the publisher and
  developer-facing brand.

The open-source planner supplies reusable logic and embeds. The sites retain
editorial judgment, affiliate context, and polished on-page buying journeys.

## License

MIT for code. The original structured dataset compilation in
`data/components.json`, `data/sources.json`, and
`data/efficiency-profiles.json` is released under CC BY 4.0; source facts
and source materials retain their respective copyright and license terms.
See [`LICENSE`](./LICENSE) and the `licenseOrUseNote` field on each source
record for details.

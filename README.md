# PSU Power Build Planner

Component list in, transparent power plan out: idle/load/transient wattage, recommended PSU
capacity, efficiency-adjusted wall power, and annual electricity cost.

**Status: bootstrap/specification stage. No product code exists yet.**

**Portfolio decision: recommended first ship** from the open-source tool ideas because it serves
both local AI multi-GPU builders and low-power homelab operators while creating an npm, CLI, and
embeddable backlink asset.

## Planned Outputs

- Idle, representative workload, sustained maximum, and transient DC watts
- Recommended PSU capacity and the constraint that controlled it
- Evaluation of a user-entered PSU capacity
- AC wall-power and conversion-loss estimates from a documented efficiency curve
- Annual kWh and electricity cost from a user-supplied rate
- Explicit assumptions, confidence, provenance, and warnings
- Multi-GPU planning without pretending wattage proves connector or physical compatibility

## Planned Usage

```bash
npx psu-power-build-planner plan --input build.json
npx psu-power-build-planner evaluate --input build.json --psu-watts 1000 --json
```

```ts
import { planBuild } from "psu-power-build-planner";

const result = planBuild({
  schemaVersion: 1,
  buildName: "Dual-GPU local AI rig",
  lines: [
    { id: "platform", componentId: "generic-atx-platform-baseline" },
    { id: "gpu", componentId: "example-gpu-model", quantity: 2 },
  ],
  operatingProfile: {
    preset: "local-ai-always-on",
    poweredHoursPerDay: 24,
    workloadShare: 0.35,
    categoryUtilization: {},
    fallbackUtilization: 0.25,
    ratePerKwh: 0.16,
    currency: "USD",
  },
  efficiencyProfileId: "generic-80-plus-gold-115v-conservative",
});
```

The names above are contract examples; actual component records arrive during the dataset milestone.

## Core Assumptions

- Component power specifications and estimates are planning inputs, not exact wall measurements.
- PSU headroom and efficiency are separate calculations.
- Transient peaks influence PSU sizing but not annual cost in v1.
- Users provide electricity rate and currency; the tool does not guess or convert them.
- A wattage recommendation does not verify PSU connectors, cables, rails, ATX compatibility,
  physical fit, or product quality.
- Results expose their assumptions and source confidence.

## Product Boundary

This project owns component-derived power and PSU planning.

It does not replace:

- idea #2, `mini-pc-power-calculator`, for measured whole-system power comparisons;
- idea #4, `homelab-bom-exporter`, for general BOM validation/formatting/export;
- idea #10, `homelab-idle-cost-badge`, for badge generation; or
- idea #12, `nas-vs-minipc-vs-cloud-tco`, for buy-versus-rent TCO and break-even analysis.

It does not recommend a PSU product, fetch prices, total purchase cost, or inject affiliate links.

## Planned Deliverables

- Zero-runtime-dependency TypeScript library and npm package
- Scriptable `psu-build-plan` CLI with human and versioned JSON output
- Sourced component-power and generic PSU-efficiency datasets
- Accessible backend-free static widget for iframe/custom-element embeds
- GitHub Pages deployment, CI, trusted npm publishing, and contribution workflow

## Documentation

- [Bootstrap specification](bootstrap.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Code standards](docs/CODE_STANDARDS.md)
- [Testing strategy](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)

## Strategic Home

- [Local AI Rigs](https://localairigs.com/) owns local AI rig, GPU, and build-guide context.
- [MiniPCLab](https://minipclab.com/) owns low-power mini-PC and homelab context.
- [Pyralis Labs](https://pyralislabs.io/) is the publisher and developer-facing brand.

The open-source planner supplies reusable logic and embeds. The sites retain editorial judgment,
affiliate context, and polished on-page buying journeys.

## License

Planned: MIT for code. The original structured dataset compilation is planned as CC BY 4.0, while
linked source facts and source materials retain their respective terms.

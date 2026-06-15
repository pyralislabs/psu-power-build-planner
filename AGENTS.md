# AGENTS.md

These instructions apply to the entire `psu-power-build-planner` project.

## Start Here

Read, in order:

1. `bootstrap.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docs/CODE_STANDARDS.md`
5. `docs/TESTING.md`
6. `docs/ROADMAP.md`

`bootstrap.md` is the implementation source of truth. Do not silently change its formulas, public
contracts, dataset/provenance model, exact target tree, scope boundaries, or acceptance criteria.

## Product Role

This is the **recommended first ship** from `git-projects/ideas.md`.

It owns component-derived build power planning:

- idle, representative workload, sustained, and transient DC estimates;
- PSU capacity recommendation and evaluation;
- PSU efficiency and AC wall-power estimates;
- electricity use/cost for the submitted build;
- multi-GPU planning; and
- a sourced component-power dataset.

It ships as a zero-runtime-dependency TypeScript library, CLI, npm package, and accessible static
widget.

## Scope Boundaries

Do not add:

- Idea #2 responsibilities: a catalog of measured whole-system mini-PC/tower/NAS power comparisons
- Idea #4 responsibilities: generic BOM formatting/export, YAML parsing, shopping lists, purchase
  cost totals, or affiliate injection
- Idea #10 responsibilities: SVG badge generation or a hosted badge endpoint
- Idea #12 responsibilities: hardware/cloud TCO, depreciation, break-even, or buy/rent advice
- PSU product recommendations, current prices, retailer links, connector/rail/cable/fit claims, or a
  backend

Ask before crossing any boundary.

## Implementation Rules

- Use strict TypeScript and ESM.
- Keep published runtime dependencies at zero.
- Keep `src/core/` pure, deterministic, and independent of Node, DOM, network, current time, locale
  globals, and mutable state.
- Make the CLI and widget thin adapters around the same core.
- Use explicit units and state names such as `sustainedDcWatts` and `annualAcEnergyKwh`.
- Return unrounded numbers from core logic. Round only in presentation code.
- Never label component/TDP-derived values as measured wall power.
- Never silently use DC demand as AC input.
- Treat transients as a PSU-sizing input, not an electricity-cost input.
- Validate every external input at its boundary.
- Emit assumptions and warnings rather than hiding defaults.
- Keep public exports limited to contracts documented in `bootstrap.md`.
- Add a Changeset for user-visible behavior, formulas, public contracts, dataset records, CLI, or
  widget changes.

## Dataset Rules

- Follow the component, source, and efficiency-profile contracts in `bootstrap.md`.
- Every power field needs field-level provenance and confidence.
- Never add a retailer-only source, affiliate/tracking URL, copied prose/table, or unsourced value.
- Keep IDs stable, unique, lowercase kebab-case, and sorted.
- Use generic planning baselines only when their methodology is explicit.
- Explain corrections and their output impact.
- Manually review new or materially changed evidence even when CI passes.

## Verification

Before declaring implementation work complete, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm validate:data
pnpm test:coverage
pnpm build
pnpm check:runtime-deps
pnpm test:browser
pnpm check
```

Also run packed-package and Pages smoke tests for release-facing changes. Report commands that could
not run.

## Change Discipline

- Keep changes narrowly scoped.
- Update tests and relevant docs with behavior.
- Do not commit generated build, coverage, browser-test, or package artifacts.
- Do not add telemetry, storage, cookies, remote scripts, secret-bearing configuration, or network
  access.
- Do not remove relevant Local AI Rigs, MiniPCLab, or Pyralis Labs attribution without an explicit
  product decision.
- Do not claim a recommendation is electrically or physically compatible based on wattage alone.

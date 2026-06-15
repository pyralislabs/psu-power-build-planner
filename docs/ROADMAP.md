# Roadmap

The milestone acceptance criteria in `bootstrap.md` control completion. This roadmap defines the
implementation order and protects the product boundary.

## Priority

**Recommended first ship.** Build this before the other newly added open-source ideas because it
serves both Local AI Rigs and MiniPCLab, has a strong multi-GPU problem to solve, and creates npm,
CLI, widget, dataset, and backlink surfaces from one core.

The target is a focused v1, not a broad PC-part marketplace or compatibility engine.

## Phase 0: Foundation

- Create the exact target tree and package metadata.
- Add MIT license, planned dataset license note, contribution/security policies, issue templates,
  CODEOWNERS, and Changesets.
- Configure strict TypeScript, ESLint, Prettier, Vitest, Vite, Playwright, and fast-check.
- Add CI, Pages, trusted npm release workflows, and immutable Action pins.
- Add zero-runtime-dependency and packed-package checks.

Exit: M0 passes on a clean checkout; no product behavior beyond scaffolding.

## Phase 1: Calculation Core

- Implement public types, typed errors, validation, assumptions, and warning contracts.
- Implement component resolution and explicit overrides.
- Implement idle, workload, sustained, and correlated-transient calculations.
- Implement single-/multi-GPU PSU policies, standard capacity rounding, and evaluation states.
- Implement efficiency interpolation, AC wall power, conversion loss, and energy/cost.
- Add golden, boundary, warning, property, and invalid-input tests.

Exit: M1 passes with 100% branch coverage in core calculation/validation modules.

## Phase 2: Data And Provenance

- Implement component, source, and efficiency-profile schemas.
- Implement semantic/provenance/confidence validators.
- Write `data/METHODOLOGY.md` and the contribution workflow.
- Curate at least 100 reviewable records across the required categories.
- Ensure every shipped example and golden build resolves.
- Enforce deterministic sorting and Changesets for data changes.

Exit: M2 passes; no unsourced field, retailer-only source, copied prose, price, or affiliate data.

## Phase 3: CLI And npm Package

- Implement Node-built-in CLI parsing and capped JSON input loading.
- Add `plan`, `evaluate`, `components`, `component`, and `efficiency-profiles`.
- Implement human output, assumptions/warnings, exact JSON envelopes, and exit codes.
- Build the intended package exports and bundled datasets.
- Add subprocess, cross-platform, packed-tarball, `npx`, and zero-dependency tests.

Exit: M3 passes from the packed artifact, outside the source tree.

## Phase 4: Accessible Static Widget

- Build guided profiles, component search, manual input, quantities, and multi-GPU flow.
- Add PSU recommendation/evaluation, AC/cost results, warnings, and provenance summaries.
- Add local planner JSON import/export.
- Build shared iframe and Shadow DOM custom-element delivery.
- Complete accessibility, privacy, host-isolation, performance, and no-network testing.

Exit: M4 passes on plain external host pages and across required browsers.

## Phase 5: First Public Release

- Publish npm package with trusted publishing and provenance.
- Deploy the static widget to GitHub Pages with CSP/cache policy.
- Verify examples, `npx`, embeds, data artifacts, backlinks, and live accessibility.
- Test release rollback and npm deprecation/correction procedures.
- Add contextually relevant links/embeds from Local AI Rigs and MiniPCLab without duplicating their
  editorial/affiliate journeys.

Exit: M5 and the complete definition of done pass.

## Post-v1 Candidates Requiring Explicit Approval

- Additional sourced component coverage and efficiency curves
- User-defined workload-profile import/export
- More locales and presentation formats
- Optional adapter package for idea #4 normalized BOM JSON
- More nuanced transient scenarios backed by strong evidence
- Advanced undervolt/overclock overrides that remain explicit

These must not delay v1 or weaken zero-runtime-dependency, provenance, accessibility, or privacy
requirements.

## Permanently Separate Unless Portfolio Strategy Changes

- Idea #2 whole-system measured-power comparison catalog
- Idea #4 generic BOM formatting/export, purchase totals, and shopping-list workflows
- Idea #10 badge generation and hosted badge service
- Idea #12 hardware/cloud TCO, depreciation, break-even, and buy/rent recommendations
- PSU product ranking, retailer/affiliate lookup, and full electrical/physical compatibility

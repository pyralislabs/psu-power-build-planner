# Code Standards

## TypeScript And Modules

- Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `useUnknownInCatchVariables`.
- Use ESM and explicit `.js` extensions in emitted relative imports when required.
- Do not use `any`; accept `unknown` at boundaries and narrow it.
- Prefer interfaces for public object contracts and discriminated unions for finite states.
- Exhaustively handle union variants with a `never` check.
- Export only the API documented in `bootstrap.md`.

## Zero Runtime Dependencies

- `dependencies` and `optionalDependencies` in the published package must remain empty.
- Use platform APIs and small repository-owned code for runtime behavior.
- Development dependencies are allowed only for build, test, lint, formatting, release, and CI.
- Do not import development dependencies from shipped runtime modules.
- Run `pnpm check:runtime-deps` and packed-package tests after package-surface changes.

## Domain Naming And Units

Names must expose power side, state, and unit:

- Good: `sustainedDcWatts`, `idleAcInputWatts`, `ratePerKwh`, `annualAcEnergyKwh`
- Bad: `power`, `load`, `costRate`, `yearlyUsage`

Use:

- fractions within `0..1` for utilization/efficiency/correlation;
- watts for instantaneous power;
- kWh for energy;
- integers for quantities and standard PSU capacities; and
- JavaScript `number` for bounded planning arithmetic.

Do not call a component planning value a measurement unless its evidence basis supports that word.

## Core Logic

- Keep functions pure, deterministic, and narrowly responsible.
- Validate at every public boundary.
- Return unrounded values.
- Round/localize only in CLI/widget presentation code.
- Keep transient calculations out of energy/cost calculations.
- Keep headroom and efficiency as separate concepts.
- Never silently convert DC demand into AC input.
- Emit assumptions and warnings for defaults, overrides, low confidence, and risk.
- Formula/default changes require docs, regression/golden tests, and a Changeset.

## Error And Warning Handling

- Throw typed domain errors for invalid input and unsupported operations.
- Include stable codes and field/JSON Pointer paths.
- Collect independent validation issues where practical.
- Do not use assertions for user-controlled values.
- Warnings are structured data, not strings assembled only in presentation code.
- Do not expose stack traces or absolute paths in normal CLI/widget output.

## Dataset And Provenance

- Canonical JSON uses two spaces, LF, trailing newline, and records sorted by stable ID.
- Keep schema validation and semantic validation distinct.
- Require source references for each power field.
- Preserve evidence uncertainty; never upgrade confidence to make output look cleaner.
- Do not copy source prose, tables, or charts.
- Do not add affiliate/tracking/storefront URLs, prices, availability, rankings, or recommendations.
- Corrections require an explanation, tests, and a Changeset.
- Runtime accessors return defensive copies.

## CLI

- Use Node built-ins only.
- Keep command parsing, file I/O, formatting, and exit-code mapping out of core.
- stdout contains successful requested output only.
- stderr contains errors and diagnostics only.
- JSON is exact, versioned, deterministic, and contains no ANSI/promotional copy.
- Honor `NO_COLOR`.
- Cap input size before parsing.
- No prompts, network access, YAML, or hidden defaults.

## Widget

- Use semantic HTML and native controls before custom interaction patterns.
- Keep state isolated per custom-element/iframe instance.
- Use `textContent`, attributes, and created nodes; never interpolate untrusted content into
  `innerHTML`.
- Keep imported JSON capped and strictly validated.
- Do not use storage, cookies, analytics, remote assets, or network APIs.
- Ensure every interaction is keyboard-operable and every status is conveyed without color alone.
- CSS must support Shadow DOM, narrow containers, 200% zoom, high contrast, reduced motion, and host
  page color schemes.

## Security

- Reject unknown object properties and prototype-polluting keys.
- Bound collections, strings, numbers, file sizes, redirects, and response sizes.
- Never evaluate user or dataset content.
- Never load local paths referenced by input.
- Pin Actions and minimize workflow permissions.
- Keep secrets out of examples, fixtures, Pages builds, logs, and release artifacts.

## Tests And Documentation

- Every defect fix includes a regression test.
- Every warning/error/exit code has a test.
- Use golden tests for stable contracts and property tests for mathematical invariants.
- Update relevant docs and examples with behavior.
- Add a Changeset for user-visible behavior, public/API/CLI/widget contracts, formulas, or data.
- Comments explain domain reasoning or evidence limitations, not obvious syntax.

## Change Discipline

- Keep changes scoped; do not mix formula changes, dataset cleanup, and UI redesign.
- Do not commit generated `dist`, coverage, browser artifacts, or tarballs.
- Preserve boundaries with ideas #2, #4, #10, and #12.
- Do not make PSU product or full-compatibility claims.

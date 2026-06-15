# Testing Strategy

## Quality Gates

Every pull request must pass formatting, lint, strict typecheck, dataset validation, unit/integration
tests with coverage, build, runtime-dependency proof, packed-package smoke tests, and widget
accessibility smoke tests.

Before v1, Chromium, Firefox, and WebKit widget smoke tests and live Pages/release verification are
required.

## Core Golden Builds

`tests/fixtures/golden-builds.json` must include exact unrounded expected results for:

- CPU-only system;
- low-power homelab with storage and networking;
- single-GPU gaming build;
- single-GPU local AI inference build;
- homogeneous dual-GPU local AI build;
- heterogeneous multi-GPU build;
- manual-only build;
- build with explicit field and correlation overrides;
- evaluated undersized, marginal, meets-policy, and oversized PSUs;
- recommendation controlled independently by sustained utilization, transient utilization, reserve,
  and minimum capacity; and
- build whose required capacity exceeds 2,000 W.

Golden fixtures pin component records or inline resolved values so unrelated dataset additions do
not silently rewrite expected math.

## Calculation Unit Tests

### Component and build totals

Test:

- quantity multiplication at `1` and maximum;
- category-specific, line-specific, and fallback workload utilization precedence;
- utilization `0`, representative values, and `1`;
- idle equals sustained for constant-load components;
- exact sum of idle, workload, sustained, and transient totals;
- heterogeneous components and repeated component IDs on distinct line IDs;
- manual transient default and warning;
- every invalid power ordering and non-finite value.

### Transient model

Test:

- transient delta never goes negative;
- sustained baseline is counted once;
- CPU and all GPUs default to full correlation;
- supporting categories default to `0.50`;
- explicit correlation overrides are applied and warned;
- single- and multi-GPU transient totals;
- changing transient values/correlation changes recommendation when it is controlling; and
- changing transient values never changes energy/cost.

### PSU recommendation/evaluation

Test every standard capacity boundary and:

- default single-GPU/no-GPU policy;
- default multi-GPU policy;
- custom valid policy;
- sustained, transient, reserve, and minimum-capacity controlling constraints;
- exact upward rounding;
- exact-capacity no-round case;
- over-2,000-W null recommendation;
- undersized, marginal, meets-policy, and oversized classifications;
- warnings and compatibility disclaimer; and
- invalid fractions, reserve, capacities, and unsorted/duplicate custom capacity lists.

### Efficiency

Test:

- exact curve points;
- linear interpolation midpoint and non-midpoint;
- below-range and above-range warnings;
- `dcWatts=0`;
- exact full-capacity load;
- overload producing no AC estimate;
- conversion loss equals AC minus DC;
- explicit efficiency override; and
- invalid/unsorted/duplicate/impossible curve points.

### Energy and cost

Test:

- zero rate;
- zero workload share and full workload share;
- partial powered schedule and 24/7 operation;
- `daysPerYear=365` and `366`;
- AC calculation from idle/workload states;
- DC energy retained when AC estimate is unavailable;
- annual AC cost null when AC estimate is unavailable;
- no currency conversion or guessed rate; and
- unrounded core values versus presentation-only rounding.

## Property And Invariant Tests

Use fast-check or equivalent generated tables to prove:

- Increasing a valid line quantity never lowers any DC build state.
- Increasing sustained demand with other values valid never lowers minimum required PSU capacity.
- Increasing transient demand never lowers transient-controlled required capacity.
- Recommended standard capacity is never below mathematical minimum when non-null.
- Recommended capacity always belongs to the standard list.
- `idleDcWatts <= workloadDcWatts <= sustainedDcWatts <= transientDcWatts` for valid default
  utilization/correlation inputs.
- Increasing rate, days, powered hours, workload share when workload AC exceeds idle AC, or AC power
  never lowers cost.
- Efficiency within `(0..1]` implies `acInputWatts >= dcWatts`.
- Same semantic input and data yields deeply equal results.
- Dataset accessors cannot mutate bundled records.

## Validation And Warning Coverage

Every numeric bound, unknown property, missing field, duplicate line ID, unknown component, invalid
manual component, invalid currency, and impossible combination needs a rejection test.

Every warning code in `bootstrap.md` needs:

- one fixture that emits it;
- one nearby fixture that does not; and
- assertions for severity and relevant line/field association.

Core calculation, validation, recommendation, efficiency, and warning modules require 100% branch
coverage. Overall target is at least 95% lines and 90% branches.

## Dataset Tests

Validate all canonical component, source, and efficiency-profile files on every pull request:

- JSON Schema conformance;
- semantic numeric and ordering rules;
- stable unique lowercase-kebab IDs;
- deterministic sorting;
- field-level source references exist;
- confidence ceilings match evidence basis;
- source URLs are HTTPS, public-looking, tracking-free, and not storefront-only;
- dates are valid and not in the future;
- evidence summaries and license/use notes are present;
- generic records include methodology rationale;
- curves contain valid sorted unique points; and
- all shipped examples resolve.

Every dataset rejection rule needs valid and invalid fixtures. Automated URL reachability is
advisory only; reviewers manually verify new evidence.

Dataset regression tests must identify materially affected golden builds when a value changes.

## CLI Tests

Run the built CLI in subprocess tests and assert:

- every command and documented flag;
- human and exact JSON outputs;
- every exit code;
- stdout/stderr separation;
- `NO_COLOR`;
- malformed JSON, oversized file, unknown property, unknown component, and unreadable file;
- `plan` and `evaluate` behavior;
- component/provenance queries;
- warnings/assumptions visibility;
- `--help` and `--version`;
- no network access; and
- deterministic output on Linux, macOS, and Windows where applicable.

Pack the npm artifact and run all primary commands from the tarball, outside the source tree.

## Package Tests

The packed-package test must prove:

- package exports resolve in ESM;
- public API matches the documented surface;
- bundled datasets resolve;
- CLI binary executes;
- examples execute;
- no source-tree-only import is required;
- `dependencies` and `optionalDependencies` are absent/empty;
- package contains only intended runtime artifacts, README, license, changelog, and data; and
- no credentials, source maps with sensitive paths, unpublished notes, tests, or build config leak.

## Widget Tests

### DOM/component tests

- component search, add, remove, quantities, and manual entry;
- profile selection and editable assumptions;
- multi-GPU behavior;
- PSU evaluation;
- cost and warning rendering;
- provenance summaries;
- valid/invalid JSON import and local export;
- multiple independent custom-element instances;
- invalid host attributes failing accessibly;
- state reset;
- host-page CSS isolation; and
- no storage, analytics, or unintended network API use.

### Accessibility

Run axe checks for:

- initial empty state;
- populated build;
- validation-error summary;
- multi-GPU warnings;
- results tables;
- provenance disclosure; and
- import failure.

Browser tests cover keyboard-only completion, focus behavior, screen-reader live-region text,
200% zoom/reflow, high contrast, and reduced motion. No result/status may rely on color alone.

### Network/privacy

Intercept browser requests. After static assets load, calculations, edits, import, and export must
produce zero network requests. Assert no cookie, local storage, session storage, IndexedDB, beacon,
or analytics use.

## CI Matrix

- Node 22 and latest Node LTS for package/core/CLI tests.
- Ubuntu required; Windows and macOS smoke tests before v1 to catch path/newline differences.
- Chromium on pull requests.
- Firefox and WebKit on main/release before v1.
- Frozen lockfile and clean checkout for all required jobs.

## Release And Pages Verification

On release:

- install from npm and import the package;
- invoke `npx` and every example;
- confirm npm provenance;
- verify runtime dependency count is zero;
- fetch Pages HTML/assets/dataset;
- verify CSP, cache headers, no third-party requests, and embed behavior;
- run axe/keyboard smoke against live Pages;
- confirm relevant backlinks and no affiliate links; and
- test rollback using the previous tagged artifact before relying on the procedure.

## Regression Policy

Every bug fix requires a regression test in the same change. Formula, policy, warning, or dataset
corrections must state whether prior outputs change and include a Changeset.

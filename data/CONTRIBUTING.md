# Contributing Dataset Records

The dataset under `data/` is a planning aid for the
`psu-power-build-planner` core, CLI, and widget. It is consumed at build time
and bundled into the published package. This file describes how to add or
correct a record, what evidence is acceptable, and how to run the local
validator.

## File layout

- `data/components.json` — component records (CPUs, GPUs, platforms, storage,
  memory, cooling, network, accessories).
- `data/sources.json` — reusable source records with HTTPS URLs, publisher
  metadata, and access/license notes.
- `data/efficiency-profiles.json` — generic PSU-efficiency planning curves.
- `data/components.schema.json` / `sources.schema.json` /
  `efficiency-profiles.schema.json` — JSON Schemas used by the validator.

## Adding a new component

1. Search `data/sources.json` for an existing source that documents the new
   component. If none exists, add a source first (see below).
2. Open `data/components.json` and insert the new record. Records must be
   sorted alphabetically by `id`. Stable IDs follow
   `<manufacturer>-<model>-<variant>`, lowercase kebab-case.
3. Each power field (`idle`, `sustained`, `transient`) needs its own
   `sourceIds` (at least one), `basis`, and `confidence`. The
   `basis`/`confidence` ceilings are enforced by the validator. See
   `data/METHODOLOGY.md` for the evidence hierarchy and confidence rubric.
4. Set `reviewedAt` to today's date in `YYYY-MM-DD` form.
5. The `notes` field is short original prose (1-3 sentences) describing the
   planning interpretation, not copied source text.

## Correcting an existing component

1. Update the field(s) in `data/components.json`. Do not change the `id`
   unless the record is being replaced — ID changes are breaking.
2. Add the corrected `sourceId(s)` to `data/sources.json` and reference them
   from the affected power fields.
3. Update `reviewedAt`.
4. Explain the correction in the changeset. Identify which golden builds
   change. If a golden build's expected output changes, update the golden
   fixture and add a regression test.

## Adding a new source

1. Append a new record to `data/sources.json`. Records must be sorted by `id`.
2. The URL must be HTTPS, public, and free of affiliate, tracking, session,
   or referral parameters. URLs on `amazon.`, `amzn.`, `newegg.`, `bestbuy.`,
   or any other storefront are rejected by the validator.
3. `publisher` is the publishing organization. `sourceType` is one of
   `manufacturer-specification`, `manufacturer-guidance`,
   `independent-measurement`, `standard`, or `maintainer-methodology`.
4. `licenseOrUseNote` describes how the source is used. The dataset's
   original structured arrangement is CC BY 4.0; source facts retain their
   own terms.
5. `evidenceSummary` is a short, original summary of what the source says.
   Do not copy prose, tables, or charts.

## Adding an efficiency profile

1. Append a new record to `data/efficiency-profiles.json`. Records are sorted
   by `id`.
2. Use `inputVoltage` of `"115v"`, `"230v"`, or `"unspecified"`. Use
   `positioning` of `"conservative-planning"` for generic planning curves or
   `"custom-reference"` for advanced overrides.
3. Curve points must be sorted by strictly increasing `loadFraction` in
   `[0, 1]`, with `efficiencyFraction` in `(0, 1]`. Provide at least 3 points
   covering low, medium, and full load.
4. The label must include "Generic" and either "planning" or "conservative".
   Do not claim product-specific performance.
5. Reference at least one source from `data/sources.json`.

## Validation

Run the validator before opening a pull request:

```bash
pnpm validate:data
```

The validator checks:

- JSON parses and matches the schema.
- IDs are unique and sorted alphabetically.
- Power ordering `idle <= sustained <= transient` for every component.
- Every power field has at least one `sourceId` and every `sourceId` exists
  in `data/sources.json`.
- Confidence vs basis ceilings are honored.
- `reviewedAt` is not in the future and is in `YYYY-MM-DD` form.
- Source URLs are HTTPS, public, and free of affiliate/tracking parameters
  and storefront hostnames.
- Evidence summaries and license notes are non-empty.
- Generic records include methodology rationale in `notes`.
- Curve points are unique, sorted, and within bounds.

CI also rejects dataset changes without a Changeset.

## Changeset

Add a Changeset for every dataset change:

```bash
pnpm changeset
```

Dataset additions and corrections are patch changes per
[`docs/ROADMAP.md`](../../docs/ROADMAP.md).

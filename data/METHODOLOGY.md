# Dataset Methodology

This document describes how component, source, and efficiency-profile records are
selected, sourced, and reviewed in `data/`. The dataset is consumed by the
`psu-power-build-planner` core, CLI, and widget to provide component-derived
power, PSU, and electricity-cost estimates.

The dataset is a planning aid. It does not represent a guarantee of measured wall
power or PSU compatibility, and it never recommends a specific product.

## 1. Evidence hierarchy

Values are chosen in this priority order. Higher tiers produce higher confidence
ratings when the source supports the field's meaning.

1. **Independent, reproducible component-level DC or isolated-rail measurement** —
   published by a reviewer who states the methodology. Treated as
   `independent-measurement`. Confidence can be `high` when the methodology is
   transparent and the field maps cleanly to the measured quantity.
2. **Manufacturer maximum or board-power specification** — TDP, TBP, TGP, PBP,
   MTP, PPT, or TBP-class maximums published by the manufacturer on the official
   product page. Treated as `manufacturer-tbp` or `manufacturer-maximum`.
   Confidence is `high` when the value is documented as the product's maximum or
   turbo power.
3. **Manufacturer planning value** — TDP/TBP/TGP style values that the
   manufacturer publishes for general system sizing. Treated as
   `manufacturer-tdp`. Confidence is capped at `medium` per the spec because
   the value is a planning anchor, not a measured maximum.
4. **Credible review estimate with method stated** — published by a reputable
   reviewer who describes the test setup. Treated as `review-estimate`. The
   dataset rarely relies on this tier for v1.
5. **Maintainer estimate for generic baselines** — used only for `generic-*`
   records that aggregate platform/memory/cooling/network/accessory power
   conventions. Treated as `maintainer-estimate`. Confidence is capped at
   `low`. Methodology is recorded in the record's `notes` field and linked to
   this document.

## 2. Confidence rubric

`high`: The value matches the field's meaning in an independent measurement or
manufacturer maximum/guidance source. Examples: PBP / MTP for Intel CPUs;
TGP for NVIDIA GPUs; TBP for AMD GPUs.

`medium`: Strong adjacent evidence, or a manufacturer planning value used
transparently for a nearby concept. Examples: manufacturer TDP used for the
sustained column; review estimate with stated method.

`low`: Maintainer estimate, weakly isolated wall-derived value, incomplete
method, or uncertain mapping. Used for idle values that aggregate unspecified
states and for all `generic-*` baseline values.

Mechanical ceilings enforced by CI:

- `maintainer-estimate` and `measured-wall-derived` cannot exceed `low`.
- `manufacturer-tdp` cannot exceed `medium`.
- `high` requires `independent-measurement`, `manufacturer-maximum`, or
  `manufacturer-guidance` source types (or `manufacturer-tbp` with documented
  intent).

## 3. Component records

A `ComponentRecord` represents one component model or a clearly named generic
planning baseline. We do not create separate records for retailer listings of
the same model, nor for variants whose power does not differ materially from a
parent record. Records store field-level provenance, so the same component can
have different `sourceIds` for `idle`, `sustained`, and `transient` when the
evidence for each field comes from a different place.

The dataset never stores: prices, retailer URLs, affiliate links, tracking
parameters, availability, or product rankings. The v1 release target is at
least 100 records spanning GPUs, CPUs, platform/motherboard baselines, storage,
and memory/cooling/network/accessory baselines.

## 4. Generic baselines

Generic `generic-*` records exist to model the supporting infrastructure of a
build: motherboard platform power, memory DIMM power, storage, cooling, and
network. These are aggregated planning values, not a single-source measurement.
The `notes` field describes the methodology. The full set of generic
baselines is documented in this file, and the values are kept conservative
(low confidence) to make their uncertainty explicit.

Methodology for common generic baselines:

- **Platform baselines** combine chipset TDP, slot power, on-board audio,
  networking, and the typical accessory overhead. ATX/mATX/Mini-ITX baselines
  follow the ATX specification guidance for slot population, with a small
  uplift for lighting and storage controllers.
- **CPU cooler baselines** aggregate pump power (where applicable) plus the
  expected fan power for the radiator size.
- **Memory baselines** scale per module: UDIMM at 1.5-3.5 W typical, RDIMM at
  2-5 W typical, with transient peaks.
- **Storage baselines** reflect M.2 NVMe consumer power, SATA SSD idle/active,
  and HDD idle/active for 2.5" and 3.5" form factors. Enterprise U.2 NVMe
  carries a higher sustained budget.
- **Network baselines** aggregate a 1 GbE or 10 GbE PCIe NIC's typical
  load.
- **Case fan and PCIe add-in card baselines** scale per item and are intended
  to be added with explicit quantities.

## 5. Efficiency profiles

Efficiency profiles are generic planning curves, not PSU product records. They
are based on the 80 PLUS program load-point requirements for the matching
class (Bronze, Gold, Platinum) at the indicated input voltage. The actual
load points follow the 80 PLUS program convention (10/20/50/100%) with
intermediate planning points (30% and 80%) to give the curve enough shape for
linear interpolation. Values are biased conservatively to encourage adequate
PSU sizing.

Labels include the words "Generic" and "planning" or "conservative". They
must not claim product-specific performance. The fixed-percentage
`generic-fixed-90-percent` profile is documented as an advanced reference
override.

## 6. Source URLs

Source URLs are HTTPS, public, and free of affiliate, tracking, session, or
referral parameters. They are not storefronts. They point to the manufacturer
spec page, the 80 PLUS program, or a published standard. Each source records
its `accessedAt` and a `licenseOrUseNote`. The original structured arrangement
of `data/components.json`, `data/sources.json`, and
`data/efficiency-profiles.json` is released under CC BY 4.0; source facts and
source materials retain their respective terms.

## 7. Review and contribution

Every record carries a `reviewedAt` field. Substantive changes (new evidence,
new value, new source) require a Changeset and a regression test if they
affect a golden build. Record removals or stable ID changes are breaking
changes and require a major version bump.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution workflow.

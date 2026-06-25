# Security Override Registry

This document records explicitly accepted security findings for the
`psu-power-build-planner` project. Entries are time-bounded and require
maintainer approval per `todo/security-scan.md` INFRA-002.

Each entry must include:

- The CVE / advisory identifier
- The accepted version and the fixed version (if any)
- A justification grounded in the project's architecture or release schedule
- An owner and an expiration date
- A review date at which the entry is re-evaluated

When this file is empty, CI gates against `pnpm audit --audit-level=high`
without exception. When this file contains entries, those entries are
documented as accepted and the gate does not block on the listed advisories
(unless explicitly noted otherwise per entry).

## Active Overrides

### OVERRIDE-2026-06-24-01: js-yaml 3.x quadratic-complexity DoS (CVE-2026-53550)

- **Advisory:** [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) / CVE-2026-53550
- **Affected range:** `js-yaml <=4.1.1`
- **Installed version:** `js-yaml@3.14.2` (transitive via `@changesets/cli` → `@manypkg/get-packages` → `read-yaml-file`)
- **Fixed in:** `js-yaml >=4.2.0`
- **Severity:** moderate
- **Reachability:** dev-only, parsing changeset files in CI/release workflows. Never exposed to user input.

**Justification:** `@changesets/cli@2.31.0` is the latest stable release on the
2.x line and bundles `js-yaml@3.x`. The `3.0.0-next.x` pre-releases are the
only path to `js-yaml@4.x` via `@changesets/cli` and are not stable enough
to adopt in this release window. The vulnerability is not reachable in
production: the parser is used solely by changesets tooling against
in-repo changeset markdown, not against user-supplied input.

**Mitigations in place:**

- Changeset files are written by maintainers, never by users or external
  contributors during a release.
- The vulnerability requires a YAML document that exercises merge keys with
  repeated aliases; the project's changeset format does not.
- The dependency is in `devDependencies` only and is not published with the
  npm package.

**Owner:** `@pyralis-labs/maintainers`
**Expiration:** 2026-12-31
**Review date:** 2026-09-30
**Action on expiry:** Re-evaluate. If `@changesets/cli@3.x` is stable, perform
the major-version migration per `todo/security-scan.md` Appendix A.

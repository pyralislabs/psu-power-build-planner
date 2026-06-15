# Security Policy

The PSU Power Build Planner is intentionally small, offline, and
zero-runtime-dependency. That posture removes most of the usual supply-chain
attack surface, but the project still processes untrusted input: planner
JSON files, CLI flags, widget uploads, custom-element attributes, and
dataset contributions. Please report any weakness you find.

## Supported versions

| Version        | Supported |
| -------------- | --------- |
| Latest `0.1.x` | Yes       |
| Older releases | No        |

## Reporting a vulnerability

Please email **[security@pyralislabs.io](mailto:security@pyralislabs.io)** with:

- a description of the issue and its impact;
- a minimal reproducer (planner JSON, CLI command, widget steps, or dataset
  change);
- affected version and commit SHA, if known.

Do **not** open a public GitHub issue for an undisclosed vulnerability.
We aim to acknowledge new reports within three business days.

## What we will not do

- The CLI does not perform network access. Report any behaviour to the
  contrary as a bug.
- The widget does not use cookies, local storage, session storage,
  IndexedDB, third-party scripts, or remote rate/protein/price lookup.
  Report any behaviour to the contrary as a bug.
- The project does not run a backend, store telemetry, or recommend a PSU
  product. Do not propose a change that introduces any of these.

## Out of scope

- Theoretical DoS of the published widget or static pages against a
  third-party host (report to the host).
- Social engineering of maintainers.
- Automated scans that produce only stack traces from unrelated npm
  packages.

## Disclosure

We follow a coordinated disclosure model. We ask reporters to keep
details private until a fix is released and a CVE is requested, where
applicable.

# Contributing

Thanks for your interest in the PSU Power Build Planner. This project is a
zero-runtime-dependency TypeScript library, CLI, and static widget. Bug fixes,
documentation improvements, dataset additions, and accessibility changes are
all welcome. The bootstrap specification in [`bootstrap.md`](./bootstrap.md)
is the implementation source of truth; please read it before opening a
significant change.

## How to contribute

1. Fork the repository and create a topic branch.
2. Make narrowly scoped changes. Do not mix formula, dataset, and UI work.
3. Add or update tests with the change. Every bug fix needs a regression
   test. Every documented warning or exit code needs an assertion.
4. Run the full quality gate before pushing:
   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   ```
5. Add a Changeset with `pnpm changeset` for any user-visible change,
   dataset record, public API change, or new warning. The release process is
   driven by Changesets; PRs without a Changeset will not produce a release
   entry.
6. Open a pull request. CI must pass on Node 22 and the latest Node LTS.

## Areas of contribution

- **Dataset** — see [`data/CONTRIBUTING.md`](./data/CONTRIBUTING.md) for the
  evidence hierarchy, confidence rubric, and provenance rules. New component
  records or sources are highly valued.
- **Core calculations** — keep modules pure, deterministic, and side-effect
  free. Use fast-check for property tests of monotonicity and ordering.
- **CLI** — use Node built-ins only. Match the documented command, flag,
  exit code, and JSON envelope contracts in `bootstrap.md` §10.
- **Widget** — preserve accessibility (WCAG 2.2 AA), Shadow DOM isolation,
  and the zero-network constraint. Use native controls before custom
  interaction patterns.
- **Documentation** — README, `docs/`, and dataset `METHODOLOGY.md` should
  evolve with code. Do not add features described only in marketing copy.

## Coding standards

See [`docs/CODE_STANDARDS.md`](./docs/CODE_STANDARDS.md) for the full set.
Highlights:

- Strict TypeScript with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`.
- No runtime dependencies. The published `dependencies` field must stay
  empty.
- Validation at every public boundary. Return typed errors with stable
  codes; never throw strings.
- Public exports from `src/index.ts` only. Lower-level helpers are not
  re-exported.
- Do not commit `dist/`, `coverage/`, browser artifacts, or packed
  tarballs.

## Reporting security issues

Please do not open a public issue for an undisclosed vulnerability. Email
[security@pyralislabs.io](mailto:security@pyralislabs.io) and follow the
policy in [`SECURITY.md`](./SECURITY.md).

## License

By contributing, you agree that your contributions to the source code are
licensed under the MIT License, and that new dataset records (the original
structured arrangement) are released under CC BY 4.0. Source facts and
source materials you reference retain their respective terms.

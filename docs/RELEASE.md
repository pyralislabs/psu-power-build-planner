# Release Process

This document describes how the `psu-power-build-planner` package is versioned
and released. The project uses [Changesets](https://github.com/changesets/changesets)
and [SemVer](https://semver.org/) and is published to npm with provenance.

## Versioning rules

| Change                                                                                                                      | SemVer level |
| --------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Dataset additions or corrections                                                                                            | patch        |
| New optional API, new CLI flag, new optional planner field                                                                  | minor        |
| Formula meaning change, default policy change, breaking dataset or schema change, public API breakage, JSON envelope change | major        |

Stable dataset IDs, standard PSU capacities, efficiency curves, and warning
codes are not part of the API contract. Removing or renaming a stable ID is a
breaking change and requires a major bump.

## Workflow

1. Create a Changeset with `pnpm changeset`. Choose the appropriate SemVer
   level and write a short user-facing summary. Commit the file under
   `.changeset/`.
2. Open a pull request. CI must pass on Node 22 and the latest Node LTS.
3. After review and merge, the
   [Changesets action](https://github.com/changesets/action) opens a release
   PR that bumps `package.json`, `package-lock` (or `pnpm-lock.yaml`), and
   `CHANGELOG.md`. Reviewers verify the diff.
4. Merging the release PR publishes to npm with provenance. The
   `psu-power-build-planner` package becomes available on npm immediately.
5. The widget is rebuilt and deployed to GitHub Pages by the
   `deploy-pages.yml` workflow on `main` and on tags.

## Deprecation and correction

- Never overwrite an existing npm version. To correct a release, publish a new
  patch version with the fix and a Changeset that explains the correction.
- Mark deprecated fields in the public type with JSDoc `@deprecated`. Avoid
  silent removal.
- For a serious bug, the recommended procedure is:
  1. Open a GitHub issue documenting the bug and the user impact.
  2. Ship a patch with the fix and a regression test.
  3. Mention the correction in the next release's CHANGELOG.
- To remove a feature, ship a deprecation notice in a minor release and remove
  it in the next major release.

## Rollback

- For a widget or dataset regression, revert the offending commit and let the
  CI redeploy. The `deploy-pages.yml` workflow redeploys the Pages artifact on
  every `main` push.
- For an npm release regression, publish a new patch that fixes the issue. If
  the package is unusable, run `npm deprecate` on the bad version with a clear
  user-facing message and immediately publish a corrected version.

## Provenance and supply chain

- npm trusted publishing is enabled. Tokens are not stored in the repository
  or in CI secrets. The release workflow uses GitHub OIDC and npm provenance.
- The `dependencies` and `optionalDependencies` fields are empty. Verify with
  `pnpm check:runtime-deps` before publishing.
- Actions are pinned to immutable commit SHAs. Dependabot opens weekly
  version-bump PRs for development dependencies.

## Hotfix procedure

1. Branch from the affected release tag.
2. Apply the minimal fix with a regression test.
3. Run the full quality gate: `pnpm check`.
4. Add a Changeset explaining the hotfix.
5. Open a PR. The release workflow publishes a patch.

## Checklists

### Before cutting a release

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm validate:data`
- [ ] `pnpm test:coverage` (100% branch on core calculation, validation,
      recommendation, and warnings)
- [ ] `pnpm build`
- [ ] `pnpm check:runtime-deps`
- [ ] `pnpm verify:pack`
- [ ] Every dataset change has a Changeset and a regression test
- [ ] Every documented warning code has at least one positive and one
      negative test fixture
- [ ] Public API matches the documented surface in `bootstrap.md` §8

### After publishing

- [ ] Confirm the npm package has `provenance: true`
- [ ] Confirm the GitHub Pages deployment is live and the widget is
      accessible
- [ ] Smoke-test the widget with a representative build
- [ ] Verify that `npx psu-power-build-planner --help` works from a clean
      install
- [ ] Verify that the dataset lookup for at least one well-known component
      works
- [ ] Verify that the CLI human output shows assumptions and warnings

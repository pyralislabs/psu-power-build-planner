---
"psu-power-build-planner": patch
---

Security hardening and CI/test infra fixes (see `todo/security-scan.md` and `SECURITY_OVERRIDE.md`):

- Upgrade dev toolchain: Vitest 2.1.9 → 3.2.6 (resolves CVE-2026-47429 / GHSA-5xrq-8626-4rwp); Vite 5.4.21 → 6.4.3 (resolves CVE-2026-53571 / GHSA-fx2h-pf6j-xcff, CVE-2026-39365, CVE-2026-53632); `@vitest/coverage-v8` 2.1.9 → 3.2.6.
- `src/widget/app.ts`: replace `Math.random()` line-ID generator with `crypto.randomUUID()` (SEC-MED-004) and tighten the `el()` helper to accept `undefined` attribute values for the empty-state path of the component search list.
- `src/widget/widget.html`: convert the leading `/* … */` comment to `<!-- -->` so Chromium parses the page as intended; add an HTML comment explaining that `frame-ancestors *` in the meta CSP is browser-ignored and must be enforced via response headers (see `SECURITY.md` Threat Model).
- `.github/workflows/ci.yml`: drop `--prod` from `pnpm audit` so devDependencies are gated (INFRA-002); build the package before `pnpm test:coverage` so the CLI subprocess tests have `dist/cli/main.js` available.
- All GitHub Actions pinned by SHA with corrected commit SHAs for `pnpm/action-setup@v4.0.0`, `actions/upload-pages-artifact@v3.0.1`, `actions/deploy-pages@v4.0.5`, and `changesets/action@v1.5.3`.
- `.prettierignore`: add `.pnpm-store` so pnpm 10.x's content-addressable store does not pollute `pnpm format:check`.
- `scripts/preview-widget.mjs`: new helper that spawns `vite preview` with an absolute `--outDir`, replacing the broken `vite preview --root …` invocation in Vite 5/6. The `preview:widget` package script now points at this helper.
- `playwright.config.ts`: readiness URL points at `/widget.html` (the actual entry); add `testIgnore` for the Vitest-only `widget.test.ts`.
- `vitest.config.ts`: exclude `tests/widget/embed.test.ts` and `tests/widget/accessibility.test.ts` so Playwright tests are not collected by Vitest.
- `tests/widget/embed.test.ts`: new Playwright + axe-core smoke suite (loads widget, asserts WCAG 2.2 AA, asserts embed bundle is reachable).
- `tests/widget/widget.test.ts`: assert the new UUID-based line ID format.
- `SECURITY_OVERRIDE.md`: documented, time-bounded acceptance of the `js-yaml@3.x` (CVE-2026-53550) transitive dependency that ships with `@changesets/cli@2.x`.
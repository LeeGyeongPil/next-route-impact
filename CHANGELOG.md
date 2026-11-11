# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-12

### Added
- `next-route-impact` CLI: from changed files (`--git` or file arguments) to the URL patterns and APIs they touch,
  with the import path that explains each hit.
- App Router (route groups, dynamic and catch-all segments, parallel slots, intercepting routes, private folders,
  route handlers, metadata files) and Pages Router route models.
- Next.js 16 `proxy.ts` and the older `middleware.ts`, including `config.matcher` forms (string, array, object,
  negative lookahead).
- Import graph built with oxc-parser and oxc-resolver: tsconfig `paths` and `extends`, barrels with symbol
  precision, dynamic `import()` and `next/dynamic`, type-only imports excluded by default (`--include-types`).
- Uncertain, unresolved and parse-error reporting so that "not analysable" is never shown as "no impact".
- `--tests` selection from a URL-glob to test-glob mapping, `runAll` for config-level changes, `--fail-on-uncertain`.
- Table, `--json` (schemaVersion 1) and `--markdown` output; English and Korean messages (`--lang`, `ROUTE_IMPACT_LANG`).
- Programmatic `analyze()` API and a practice app in `examples/shop-app`.

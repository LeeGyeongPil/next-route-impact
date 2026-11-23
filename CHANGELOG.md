# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-23

### Added
- `pageExtensions` support: a literal array in `next.config.*` (read statically, never executed) or the new
  `pageExtensions` field of the config file (which wins) makes files such as `app/guide/page.mdx` route entries.
  Top-level `import`/`export ... from` lines of `.mdx`/`.md` files (outside code fences) join the import graph.
  A computed or shorthand `pageExtensions` value is not read; the report carries a note (set it in the config file instead).
  Dotted values such as `page.tsx` are ignored with a note. With `md` listed, a changed `page.md` is analysed despite the default `**/*.md` ignore, from the CLI and the API
  (an `ignore` list you set yourself wins, even one equal to the default).
  Without `pageExtensions` results are unchanged.

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

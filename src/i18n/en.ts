/** English message catalog. Every id must also exist in ko.ts with the same {placeholders}. */
export const en = {
  'help.text': `next-route-impact - find the URLs and APIs a code change touches

Usage:
  next-route-impact [options] [file|dir ...]

Options:
  --git                 Use the changed files from git (merge-base with --base, staged, unstaged, untracked)
  --base <ref>          Base ref for --git (default: origin/HEAD, origin/main, main, master)
  --root <dir>          Next.js app root (default: current directory)
  --config <path>       Config file (default: next-route-impact.config.json or package.json "nextRouteImpact")
  --json                Print JSON
  --markdown            Print Markdown (for pull request comments)
  --tests               Print the test files to run (needs "tests" in the config)
  --include-types       Follow type-only imports
  --fail-on-uncertain   Exit with code 3 when anything is uncertain or unresolved
  --lang <en|ko>        Output language (default: ROUTE_IMPACT_LANG, then LC_ALL, LC_MESSAGES, LANG)
  -h, --help            Show this help
  -v, --version         Show the version

Exit codes: 0 ok, 1 runtime error, 2 usage error, 3 uncertain items (with --fail-on-uncertain)`,

  'error.unknownOption': 'Unknown option {option}. Run with --help to see the available options.',
  'error.missingValue': 'Option {option} needs a value. Run with --help for usage.',
  'error.unexpectedValue': 'Option {option} does not take a value. Run with --help for usage.',
  'error.invalidLang': 'Unsupported language "{value}". Use --lang en or --lang ko.',
  'error.formatConflict': 'Choose one output format: --json and --markdown cannot be used together.',
  'error.noInput': 'Nothing to analyze. Pass --git, or list changed files: next-route-impact src/lib/format.ts',
  'error.rootNotFound': 'The app root "{root}" does not exist or is not a directory. Check --root.',
  'error.noRoutes': 'No app/ or pages/ directory found in "{root}" (also checked src/). Point --root at your Next.js app folder.',
  'error.notGitRepo': 'The folder "{root}" is not inside a git repository, so --git cannot list changes. Pass file paths instead.',
  'error.gitMissing': 'The git command was not found. Install git, or pass file paths instead of --git.',
  'error.baseNotFound': 'The base ref "{base}" does not exist. Fetch it first or choose another one with --base.',
  'error.noMergeBase': 'No common ancestor between "{base}" and HEAD. In CI the clone is probably shallow: use actions/checkout with fetch-depth: 0.',
  'error.gitFailed': 'Could not read the changes from git in "{root}". Run git status there to see what is wrong.',
  'error.configSyntax': 'The config file "{file}" is not valid JSON. Fix the syntax and try again.',
  'error.configShape': 'Invalid config in "{file}": the field "{field}" is not valid. See the "Config file" section of the README.',
  'error.configNotFound': 'The config file "{file}" does not exist. Check --config.',
  'error.testsNoMapping': 'The --tests option needs a "tests" mapping (URL glob to test glob) in the config file.',
  'error.fileNotFound': 'The file "{file}" does not exist. Check the path for typos. If the file was deleted, leave it out, or use --git to report deletions.',
  'error.unreadableDir': 'Cannot read the folder "{dir}" (permission denied?). Fix its permissions or run the tool as a user that can read the whole app.',
  'error.unexpected': 'Unexpected error: {detail}',

  'table.url': 'URL',
  'table.kind': 'KIND',
  'table.reason': 'REASON',
  'kind.page': 'page',
  'kind.api': 'api',
  'kind.metadata': 'metadata',
  'edge.reexport': 're-export',
  'edge.dynamic': 'dynamic',
  'edge.type': 'type',
  'expand.layout': 'layout wraps this route',
  'expand.template': 'template wraps this route',
  'expand.loading': 'loading file applies to this route',
  'expand.error': 'error file applies to this route',
  'expand.not-found': 'not-found file applies to this route',
  'expand.default': 'parallel slot default applies to this route',
  'expand.global-error': 'global-error applies to every page',
  'expand._app': '_app wraps every Pages Router page',
  'expand._document': '_document wraps every Pages Router page',
  'expand.proxy': 'proxy matcher covers this route',
  'expand.middleware': 'middleware matcher covers this route',
  'intercept.label': 'intercepting',

  'summary.routes': '{files} changed file(s) reach {count} route(s)',
  'summary.none': 'No routes are affected by {files} changed file(s).',
  'section.removed': 'Removed routes',
  'section.uncertain': 'Uncertain (check by hand)',
  'section.unresolved': 'Unresolved imports',
  'section.parseErrors': 'Files that could not be parsed',
  'section.notes': 'Notes',
  'reason.outside-graph': 'not part of the import graph (assets, config, scripts)',
  'reason.deleted': 'deleted, so its importers cannot be traced',
  'reason.matcher-not-static': 'matcher is not a static value, so every route is assumed to match',
  'reason.matcher-unsupported': 'matcher syntax is not supported, so every route is assumed to match',
  'unresolved.non-literal-dynamic-import': 'dynamic import with a computed path',
  'unresolved.not-found': 'import path not found',
  'parse.errors': '{count} syntax error(s)',
  'note.middleware-renamed': '{file} uses the old middleware name; Next.js 16 renamed it to proxy.ts.',

  'tests.heading': 'Test selection',
  'tests.runAll': 'Run every test, because of: {files}',
  'tests.files': 'Selected test files',
  'tests.unmapped': 'Routes with no test mapping',
  'tests.none': 'No test files selected.',
  'tests.runAllStderr': 'Run all tests: {files} changed (see runAllOn in the config).',

  'md.heading': 'Route impact',
  'md.table.url': 'URL',
  'md.table.kind': 'Kind',
  'md.table.changed': 'Changed file',
  'md.noRoutes': 'No routes are affected.',
  'md.detailsSummary': 'Why these routes are affected',
  'fail.uncertain': '{count} uncertain or unresolved item(s); exiting with code 3 (--fail-on-uncertain).',
} as const;

export type MsgId = keyof typeof en;

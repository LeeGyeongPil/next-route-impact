/** Public result types. All paths are POSIX-style and relative to the app root. */

export type ChangeStatus = 'modified' | 'added' | 'deleted' | 'renamed';

export interface ChangedFile {
  path: string;
  status: ChangeStatus;
  /** Previous path when status is "renamed". */
  oldPath?: string;
}

export type EdgeKind = 'static' | 'reexport' | 'dynamic' | 'type';
export type RouteKind = 'page' | 'api' | 'metadata';
export type RouterKind = 'app' | 'pages';

export interface AffectedRoute {
  kind: RouteKind;
  /** URL pattern, for example /products/[id]. */
  url: string;
  router: RouterKind;
  /** The route's own entry file (page.tsx, route.ts, pages/x.tsx ...). */
  file: string;
  /** True for intercepting routes such as feed/(.)photo/[id]. */
  intercept: boolean;
  /** Import path: first item is the changed file, last item is the entry file that was reached. */
  via: string[];
  /** Edge kind between consecutive via items (length = via.length - 1). */
  edges: EdgeKind[];
  /** Set when the route is reached through a wrapper (layout, _app, proxy ...) instead of directly. */
  expandedBy: string | null;
  /** The changed file that led here. */
  changed: string;
}

export interface RemovedRoute {
  kind: RouteKind;
  url: string;
  router: RouterKind;
  file: string;
}

export type UncertainReason = 'outside-graph' | 'deleted' | 'matcher-not-static' | 'matcher-unsupported';

export interface UncertainItem {
  file: string;
  reason: UncertainReason;
}

export type UnresolvedReason = 'non-literal-dynamic-import' | 'not-found';

export interface UnresolvedImport {
  file: string;
  specifier: string;
  reason: UnresolvedReason;
}

export interface ParseErrorItem {
  file: string;
  count: number;
  message: string;
}

/** A note is a catalog id plus parameters; the CLI renders it in the chosen language. */
export interface ReportNote {
  code: 'middleware-renamed';
  params: Record<string, string>;
}

export interface ImpactReport {
  schemaVersion: 1;
  changed: ChangedFile[];
  routes: AffectedRoute[];
  removedRoutes: RemovedRoute[];
  uncertain: UncertainItem[];
  unresolved: UnresolvedImport[];
  parseErrors: ParseErrorItem[];
  notes: ReportNote[];
}

export interface Config {
  /** URL glob -> test file globs. */
  tests: Record<string, string[]>;
  /** Changed files matching one of these globs recommend running every test. */
  runAllOn: string[];
  /** Changed files matching these globs are ignored. */
  ignore: string[];
  /** tsconfig path, relative to the app root. */
  tsconfig?: string;
}

export interface TestSelection {
  runAll: boolean;
  runAllReasons: Array<{ file: string; pattern: string }>;
  files: string[];
  unmappedRoutes: string[];
}

export interface AnalyzeOptions {
  /** App root (folder containing app/ or pages/, or src/ with them). */
  root: string;
  changed: ChangedFile[];
  /** Follow `import type` edges. Default false. */
  includeTypes?: boolean;
  /** Narrow barrel re-exports by imported names. Default true. */
  symbolPrecision?: boolean;
  config?: Partial<Config>;
}

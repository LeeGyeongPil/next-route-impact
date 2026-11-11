import path from 'node:path';
import { withDefaults } from './config.js';
import { isFile } from './fsutil.js';
import { buildGraph } from './graph.js';
import type { Graph, RevEdge } from './graph.js';
import { matchAny } from './glob.js';
import { matcherToRegExp, patternMatches, readMatcher } from './matcher.js';
import { loadProject } from './project.js';
import { classify, wrapperCovers } from './routes.js';
import type { Entry } from './routes.js';
import type {
  AffectedRoute,
  AnalyzeOptions,
  ChangedFile,
  EdgeKind,
  ImpactReport,
  RemovedRoute,
  UncertainItem,
} from './types.js';

type Leaf = Extract<Entry, { type: 'leaf' }>;
type Carried = Set<string> | null; // names of the file that are affected; null = everything

/**
 * Compute the routes touched by a set of changed files: walk the import graph backwards from each changed
 * file, stop at Next.js entry files, and expand wrappers (layouts, _app, proxy) to the routes they cover.
 */
export async function analyze(options: AnalyzeOptions): Promise<ImpactReport> {
  return analyzeSync(options);
}

export function analyzeSync(options: AnalyzeOptions): ImpactReport {
  const config = withDefaults(options.config);
  const layout = loadProject(options.root, config.tsconfig);
  const root = layout.root;
  const includeTypes = options.includeTypes ?? false;
  const symbolPrecision = options.symbolPrecision ?? true;

  const graph = buildGraph(layout, { includeTypes });
  const fileSet = new Set(graph.files);

  const entries = new Map<string, Entry>();
  for (const rel of graph.files) {
    const entry = classify(rel, layout);
    if (entry) entries.set(rel, entry);
  }
  // When several files serve one URL (main page, @slot pages, intercepting pages), the main page represents it.
  const leafRank = (leaf: Leaf): number => (leaf.dirSegs.some((segment) => segment.startsWith('@')) ? 2 : 0) + (leaf.intercept ? 1 : 0);
  const leaves = [...entries.values()]
    .filter((entry): entry is Leaf => entry.type === 'leaf')
    .sort((a, b) => leafRank(a) - leafRank(b));

  const notes: ImpactReport['notes'] = [];
  for (const entry of entries.values()) {
    if (entry.type === 'proxy' && entry.name === 'middleware') {
      notes.push({ code: 'middleware-renamed', params: { file: entry.file } });
    }
  }

  const routes = new Map<string, AffectedRoute>();
  const removedRoutes: RemovedRoute[] = [];
  const uncertain = new Map<string, UncertainItem>();
  const addUncertain = (item: UncertainItem): void => {
    uncertain.set(item.file + '\u0000' + item.reason, item);
  };

  const proxyCache = new Map<string, { patterns: RegExp[] | 'all' }>();
  const proxyScope = (entry: Extract<Entry, { type: 'proxy' }>): { patterns: RegExp[] | 'all' } => {
    const cached = proxyCache.get(entry.file);
    if (cached) return cached;
    let scope: { patterns: RegExp[] | 'all' };
    const info = readMatcher(path.join(root, entry.file));
    if (info.type === 'all') {
      scope = { patterns: 'all' };
    } else if (info.type === 'unknown') {
      addUncertain({ file: entry.file, reason: 'matcher-not-static' });
      scope = { patterns: 'all' };
    } else {
      try {
        scope = { patterns: info.sources.map(matcherToRegExp) };
      } catch {
        addUncertain({ file: entry.file, reason: 'matcher-unsupported' });
        scope = { patterns: 'all' };
      }
    }
    proxyCache.set(entry.file, scope);
    return scope;
  };

  const addRoute = (leaf: Leaf, changed: string, via: string[], edges: EdgeKind[], expandedBy: string | null): void => {
    const routeId = leaf.kind + ':' + leaf.url;
    if (routes.has(routeId)) return;
    routes.set(routeId, {
      kind: leaf.kind,
      url: leaf.url,
      router: leaf.router,
      file: leaf.file,
      intercept: leaf.intercept,
      via,
      edges,
      expandedBy,
      changed,
    });
  };

  /** Importer's affected names after following one edge backwards; undefined = the importer is not affected. */
  const follow = (current: string, carried: Carried, edge: RevEdge): Carried | undefined => {
    if (!symbolPrecision) return null;
    if (edge.kind === 'reexport' || (edge.kind === 'type' && edge.pairs !== null)) {
      if (edge.pairs === '*') {
        if (carried !== null) return carried.size > 0 ? carried : undefined;
        const own = graph.exportsOf.get(current);
        return own ? new Set([...own].filter((name) => name !== 'default')) : null;
      }
      const pairs = edge.pairs ?? [];
      const exported = new Set(
        pairs.filter(([imported]) => carried === null || imported === '*' || carried.has(imported)).map(([, name]) => name),
      );
      return exported.size > 0 ? exported : undefined;
    }
    const names = edge.names;
    const hit = carried === null || names === null || names.includes('*') || names.some((name) => carried.has(name));
    return hit ? null : undefined;
  };

  // Wrapper and proxy expansions are applied after all direct hits, so a direct import path wins over "wrapped by".
  const pending: Array<{ entry: Exclude<Entry, { type: 'leaf' }>; start: string; via: string[]; edges: EdgeKind[] }> = [];

  // Files the analysis actually touched (changed files and everything reached backwards from them).
  const touched = new Set<string>();

  const walk = (start: string): void => {
    const parent = new Map<string, { from: string; kind: EdgeKind } | null>([[start, null]]);
    const carriedBy = new Map<string, Carried>([[start, null]]);
    const handled = new Set<string>();
    const queue: string[] = [start];

    const pathTo = (file: string): { via: string[]; edges: EdgeKind[] } => {
      const via: string[] = [];
      const edges: EdgeKind[] = [];
      for (let cursor: string | undefined = file; cursor !== undefined; ) {
        via.unshift(cursor);
        const link: { from: string; kind: EdgeKind } | null | undefined = parent.get(cursor);
        if (link) edges.unshift(link.kind);
        cursor = link?.from;
      }
      return { via, edges };
    };

    while (queue.length > 0) {
      const current = queue.shift() as string;
      touched.add(current);
      if (!handled.has(current)) {
        handled.add(current);
        const entry = entries.get(current);
        if (entry) {
          const { via, edges } = pathTo(current);
          if (entry.type === 'leaf') {
            addRoute(entry, start, via, edges, null);
          } else {
            pending.push({ entry, start, via, edges });
          }
        }
      }
      const carried = carriedBy.get(current) as Carried;
      for (const edge of graph.rev.get(current) ?? []) {
        const next = follow(current, carried, edge);
        if (next === undefined) continue;
        if (!parent.has(edge.from)) {
          parent.set(edge.from, { from: current, kind: edge.kind });
          carriedBy.set(edge.from, next);
          queue.push(edge.from);
        } else {
          const existing = carriedBy.get(edge.from) as Carried;
          if (existing === null) continue;
          const merged: Carried = next === null ? null : new Set([...existing, ...next]);
          if (merged === null || merged.size > existing.size) {
            carriedBy.set(edge.from, merged);
            queue.push(edge.from);
          }
        }
      }
    }
  };

  const effective: ChangedFile[] = options.changed
    .map((change) => ({ ...change, path: normalize(change.path) }))
    .filter((change) => !matchAny(config.ignore, change.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const change of effective) {
    if (change.status === 'renamed' && change.oldPath) {
      const oldEntry = classify(normalize(change.oldPath), layout);
      const newEntry = classify(change.path, layout);
      if (oldEntry && oldEntry.type === 'leaf') {
        const sameRoute = newEntry && newEntry.type === 'leaf' && newEntry.kind === oldEntry.kind && newEntry.url === oldEntry.url;
        if (!sameRoute) removedRoutes.push({ kind: oldEntry.kind, url: oldEntry.url, router: oldEntry.router, file: oldEntry.file });
      }
    }
    if (change.status === 'deleted') {
      const entry = classify(change.path, layout);
      if (entry && entry.type === 'leaf') {
        removedRoutes.push({ kind: entry.kind, url: entry.url, router: entry.router, file: entry.file });
      } else {
        addUncertain({ file: change.path, reason: 'deleted' });
      }
      continue;
    }
    if (!isFile(path.join(root, change.path))) {
      addUncertain({ file: change.path, reason: 'deleted' });
      continue;
    }
    const known = fileSet.has(change.path) || graph.rev.has(change.path);
    if (known) walk(change.path);
    else addUncertain({ file: change.path, reason: 'outside-graph' });
    if (matchAny(config.runAllOn, change.path)) addUncertain({ file: change.path, reason: 'outside-graph' });
  }

  for (const { entry, start, via, edges } of pending) {
    if (entry.type === 'wrapper') {
      for (const leaf of leaves) if (wrapperCovers(entry, leaf)) addRoute(leaf, start, via, edges, entry.name);
    } else {
      const scope = proxyScope(entry);
      for (const leaf of leaves) {
        if (scope.patterns === 'all' || patternMatches(scope.patterns, leaf.url)) addRoute(leaf, start, via, edges, entry.name);
      }
    }
  }

  return {
    schemaVersion: 1,
    changed: effective,
    routes: [...routes.values()].sort(
      (a, b) => a.url.localeCompare(b.url) || a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file),
    ),
    removedRoutes: removedRoutes.sort((a, b) => a.url.localeCompare(b.url) || a.file.localeCompare(b.file)),
    uncertain: [...uncertain.values()].sort((a, b) => a.file.localeCompare(b.file) || a.reason.localeCompare(b.reason)),
    unresolved: sortUnresolved(graph, touched),
    parseErrors: [...graph.parseErrors].sort((a, b) => a.file.localeCompare(b.file)),
    notes,
  };
}

/** Unresolved imports matter where the analysis looked: in changed files and in files reached from them. */
function sortUnresolved(graph: Graph, touched: Set<string>): ImpactReport['unresolved'] {
  return graph.unresolved.filter((item) => touched.has(item.file)).sort((a, b) => a.file.localeCompare(b.file) || a.specifier.localeCompare(b.specifier));
}

/** "./a//b.ts" and "a\\b.ts" -> "a/b.ts". */
export function normalize(file: string): string {
  const posix = file.split('\\').join('/');
  return path.posix.normalize(posix).replace(/^\.\//, '');
}

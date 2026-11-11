import path from 'node:path';
import type { ProjectLayout } from './project.js';
import { isSourceFile } from './fsutil.js';
import type { RouteKind, RouterKind } from './types.js';

/** A file Next.js treats specially: a leaf route, a wrapper (layout ...) or the proxy/middleware file. */
export type Entry =
  | {
      type: 'leaf';
      kind: RouteKind;
      router: RouterKind;
      url: string;
      file: string;
      intercept: boolean;
      /** Folder segments below app/ (or pages/), including groups and @slots. */
      dirSegs: string[];
    }
  | {
      type: 'wrapper';
      router: RouterKind;
      /** layout, template, loading, error, not-found, default, global-error, _app, _document */
      name: string;
      file: string;
      /** Wrapped pages live below this folder path ("" = all). */
      scope: string;
    }
  | { type: 'proxy'; name: 'proxy' | 'middleware'; file: string };

const APP_WRAPPERS = new Set(['layout', 'template', 'loading', 'error', 'not-found', 'default', 'global-error']);

/** Metadata file name -> URL file name. */
const METADATA_FILES: Record<string, string> = {
  sitemap: 'sitemap.xml',
  robots: 'robots.txt',
  manifest: 'manifest.webmanifest',
  icon: 'icon',
  'apple-icon': 'apple-icon',
  'opengraph-image': 'opengraph-image',
  'twitter-image': 'twitter-image',
};

const GROUP = /^\((?!\.)[^)]+\)$/;
const INTERCEPT = /^((?:\(\.\.\))+|\(\.\)|\(\.\.\.\))(.+)$/;

/** App Router folder segments -> URL pattern. Groups, @slots vanish; (.) (..) (..)(..) (...) intercept. */
export function appSegmentsToUrl(segments: string[]): { url: string; intercept: boolean } {
  const parts: string[] = [];
  let intercept = false;
  for (const segment of segments) {
    if (GROUP.test(segment)) continue;
    if (segment.startsWith('@')) continue;
    const match = INTERCEPT.exec(segment);
    if (match) {
      intercept = true;
      const marker = match[1] as string;
      if (marker === '(...)') parts.length = 0;
      else if (marker !== '(.)') parts.length = Math.max(0, parts.length - marker.length / 4);
      parts.push(match[2] as string);
      continue;
    }
    parts.push(segment);
  }
  return { url: '/' + parts.join('/'), intercept };
}

function stripExtension(name: string): string {
  return name.slice(0, name.length - path.posix.extname(name).length);
}

function under(rel: string, dir: string): string[] | null {
  if (!rel.startsWith(dir + '/')) return null;
  return rel.slice(dir.length + 1).split('/');
}

/** Classify a root-relative path. Pure: does not touch the file system. */
export function classify(rel: string, layout: ProjectLayout): Entry | null {
  if (!isSourceFile(rel)) return null;

  if (layout.appDir !== null) {
    const parts = under(rel, layout.appDir);
    if (parts) {
      const fileName = parts.pop() as string;
      const name = stripExtension(fileName);
      if (parts.some((segment) => segment.startsWith('_'))) return null; // private folder
      if (name === 'page' || name === 'route') {
        const { url, intercept } = appSegmentsToUrl(parts);
        return { type: 'leaf', kind: name === 'page' ? 'page' : 'api', router: 'app', url, file: rel, intercept, dirSegs: parts };
      }
      const metadataName = METADATA_FILES[name];
      if (metadataName !== undefined) {
        const { url } = appSegmentsToUrl([...parts, metadataName]);
        return { type: 'leaf', kind: 'metadata', router: 'app', url, file: rel, intercept: false, dirSegs: parts };
      }
      if (APP_WRAPPERS.has(name)) {
        let scopeSegs = parts;
        if (name === 'default') {
          const slotAt = parts.map((segment) => segment.startsWith('@')).lastIndexOf(true);
          if (slotAt >= 0) scopeSegs = parts.slice(0, slotAt);
        }
        return { type: 'wrapper', router: 'app', name, file: rel, scope: scopeSegs.join('/') };
      }
      return null;
    }
  }

  if (layout.pagesDir !== null) {
    const parts = under(rel, layout.pagesDir);
    if (parts) {
      const last = stripExtension(parts.pop() as string);
      if (parts.length === 0 && (last === '_app' || last === '_document')) {
        return { type: 'wrapper', router: 'pages', name: last, file: rel, scope: '' };
      }
      if (last.startsWith('_') || parts.some((segment) => segment.startsWith('_'))) return null;
      const segments = last === 'index' ? parts : [...parts, last];
      const isApi = parts[0] === 'api';
      return {
        type: 'leaf',
        kind: isApi ? 'api' : 'page',
        router: 'pages',
        url: '/' + segments.join('/'),
        file: rel,
        intercept: false,
        dirSegs: parts,
      };
    }
  }

  // Next.js 16 renamed middleware.ts to proxy.ts; both names are still recognised.
  const dir = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel);
  const base = stripExtension(path.posix.basename(rel));
  if ((base === 'proxy' || base === 'middleware') && layout.proxyDirs.includes(dir)) {
    return { type: 'proxy', name: base, file: rel };
  }
  return null;
}

/** Does a wrapper's scope contain this leaf? (App Router layouts never wrap route handlers.) */
export function wrapperCovers(wrapper: Extract<Entry, { type: 'wrapper' }>, leaf: Extract<Entry, { type: 'leaf' }>): boolean {
  if (leaf.router !== wrapper.router) return false;
  if (leaf.kind !== 'page') return false;
  if (wrapper.router === 'pages') return true;
  const dir = leaf.dirSegs.join('/');
  return wrapper.scope === '' || dir === wrapper.scope || dir.startsWith(wrapper.scope + '/');
}

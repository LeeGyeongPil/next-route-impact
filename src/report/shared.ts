import { tr, trDynamic } from '../i18n/index.js';
import type { Lang } from '../i18n/index.js';
import type { AffectedRoute, EdgeKind, ImpactReport } from '../types.js';

/** Arrow between two files of an import path; non-static edges carry a localized label. */
export function arrow(lang: Lang, kind: EdgeKind): string {
  if (kind === 'static') return ' -> ';
  return ' -[' + tr(lang, ('edge.' + kind) as 'edge.reexport') + ']-> ';
}

/** "a.ts -> b.ts -> page.tsx" for one route, with the wrapper explanation when the route was expanded. */
export function reasonText(lang: Lang, route: AffectedRoute): string {
  let text = '';
  route.via.forEach((file, index) => {
    if (index > 0) text += arrow(lang, route.edges[index - 1] as EdgeKind);
    text += file;
  });
  if (route.expandedBy !== null) text += ' (' + trDynamic(lang, 'expand.' + route.expandedBy) + ')';
  return text;
}

export function kindText(lang: Lang, route: { kind: string; intercept?: boolean }): string {
  const base = trDynamic(lang, 'kind.' + route.kind);
  return route.intercept ? base + ', ' + tr(lang, 'intercept.label') : base;
}

export function noteText(lang: Lang, note: ImpactReport['notes'][number]): string {
  return trDynamic(lang, 'note.' + note.code, note.params);
}

/** Number of uncertain, unresolved and unparsable items (used by --fail-on-uncertain). */
export function uncertainCount(report: ImpactReport): number {
  return report.uncertain.length + report.unresolved.length + report.parseErrors.length;
}

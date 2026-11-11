import type { Lang } from '../i18n/index.js';
import type { ImpactReport, TestSelection } from '../types.js';
import { noteText } from './shared.js';

/**
 * JSON output. Keys and enum values are always English; only `notes[].message` follows the language.
 * schemaVersion changes when a field is removed or renamed.
 */
export function renderJson(report: ImpactReport, lang: Lang, selection?: TestSelection): string {
  const body: Record<string, unknown> = {
    schemaVersion: report.schemaVersion,
    changed: report.changed,
    routes: report.routes,
    removedRoutes: report.removedRoutes,
    uncertain: report.uncertain,
    unresolved: report.unresolved,
    parseErrors: report.parseErrors,
    notes: report.notes.map((note) => ({ code: note.code, message: noteText(lang, note) })),
  };
  if (selection) body.tests = selection;
  return JSON.stringify(body, null, 2) + '\n';
}

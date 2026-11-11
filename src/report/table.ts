import { tr, trDynamic } from '../i18n/index.js';
import type { Lang } from '../i18n/index.js';
import type { ImpactReport, TestSelection } from '../types.js';
import { kindText, noteText, reasonText } from './shared.js';

/** Terminal column width: Hangul and CJK characters take two columns. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60);
    width += wide ? 2 : 1;
  }
  return width;
}

function pad(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - displayWidth(text)));
}

/** Plain-text report for the terminal (default output format). */
export function renderTable(report: ImpactReport, lang: Lang): string {
  const lines: string[] = [];
  const files = report.changed.length;

  if (report.routes.length === 0) {
    lines.push(tr(lang, 'summary.none', { files }));
  } else {
    lines.push(tr(lang, 'summary.routes', { files, count: report.routes.length }));
    lines.push('');
    const rows = report.routes.map((route) => [route.url, kindText(lang, route), reasonText(lang, route)]);
    const head = [tr(lang, 'table.url'), tr(lang, 'table.kind'), tr(lang, 'table.reason')];
    const widths = [0, 1].map((column) => Math.max(...[head, ...rows].map((row) => displayWidth(row[column] as string))));
    const format = (row: string[]): string => (pad(row[0] as string, widths[0] as number) + '  ' + pad(row[1] as string, widths[1] as number) + '  ' + row[2]).trimEnd();
    lines.push(format(head));
    for (const row of rows) lines.push(format(row));
  }

  const section = (titleId: 'section.removed' | 'section.uncertain' | 'section.unresolved' | 'section.parseErrors' | 'section.notes', items: string[]): void => {
    if (items.length === 0) return;
    lines.push('', tr(lang, titleId) + ':');
    for (const item of items) lines.push('  ' + item);
  };
  section(
    'section.removed',
    report.removedRoutes.map((route) => route.url + '  (' + route.file + ')'),
  );
  section(
    'section.uncertain',
    report.uncertain.map((item) => item.file + ' - ' + trDynamic(lang, 'reason.' + item.reason)),
  );
  section(
    'section.unresolved',
    report.unresolved.map((item) => item.file + ': ' + item.specifier + ' - ' + trDynamic(lang, 'unresolved.' + item.reason)),
  );
  section(
    'section.parseErrors',
    report.parseErrors.map((item) => item.file + ' - ' + tr(lang, 'parse.errors', { count: item.count })),
  );
  section('section.notes', report.notes.map((note) => noteText(lang, note)));
  return lines.join('\n') + '\n';
}

/** Test selection as plain text (used with --tests in table mode): one path per line, nothing when runAll. */
export function renderTestFiles(selection: TestSelection): string {
  if (selection.runAll) return '';
  return selection.files.map((file) => file + '\n').join('');
}

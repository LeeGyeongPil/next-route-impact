import { tr, trDynamic } from '../i18n/index.js';
import type { Lang } from '../i18n/index.js';
import type { ImpactReport, TestSelection } from '../types.js';
import { kindText, noteText, reasonText } from './shared.js';

function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function code(text: string): string {
  return '`' + text.replace(/`/g, "'") + '`';
}

/** Markdown for a pull request comment: a table plus a collapsed "why" list. */
export function renderMarkdown(report: ImpactReport, lang: Lang, selection?: TestSelection): string {
  const lines: string[] = ['## ' + tr(lang, 'md.heading'), ''];

  if (report.routes.length === 0) {
    lines.push(tr(lang, 'md.noRoutes'), '');
  } else {
    lines.push(tr(lang, 'summary.routes', { files: report.changed.length, count: report.routes.length }), '');
    lines.push('| ' + tr(lang, 'md.table.url') + ' | ' + tr(lang, 'md.table.kind') + ' | ' + tr(lang, 'md.table.changed') + ' |');
    lines.push('|---|---|---|');
    for (const route of report.routes) {
      lines.push('| ' + cell(code(route.url)) + ' | ' + cell(kindText(lang, route)) + ' | ' + cell(code(route.changed)) + ' |');
    }
    lines.push('', '<details>', '<summary>' + tr(lang, 'md.detailsSummary') + '</summary>', '');
    for (const route of report.routes) lines.push('- ' + code(route.url) + ': ' + code(reasonText(lang, route)));
    lines.push('', '</details>', '');
  }

  const bullets = (titleId: 'section.removed' | 'section.uncertain' | 'section.unresolved' | 'section.parseErrors' | 'section.notes', items: string[]): void => {
    if (items.length === 0) return;
    lines.push('### ' + tr(lang, titleId), '');
    for (const item of items) lines.push('- ' + item);
    lines.push('');
  };
  bullets('section.removed', report.removedRoutes.map((route) => code(route.url) + ' (' + code(route.file) + ')'));
  bullets('section.uncertain', report.uncertain.map((item) => code(item.file) + ': ' + trDynamic(lang, 'reason.' + item.reason)));
  bullets(
    'section.unresolved',
    report.unresolved.map((item) => code(item.file) + ': ' + code(item.specifier) + ': ' + trDynamic(lang, 'unresolved.' + item.reason)),
  );
  bullets('section.parseErrors', report.parseErrors.map((item) => code(item.file) + ': ' + tr(lang, 'parse.errors', { count: item.count })));
  bullets('section.notes', report.notes.map((note) => noteText(lang, note)));

  if (selection) {
    lines.push('### ' + tr(lang, 'tests.heading'), '');
    if (selection.runAll) {
      lines.push(tr(lang, 'tests.runAll', { files: selection.runAllReasons.map((r) => code(r.file)).join(', ') }), '');
    } else if (selection.files.length === 0) {
      lines.push(tr(lang, 'tests.none'), '');
    } else {
      for (const file of selection.files) lines.push('- ' + code(file));
      lines.push('');
    }
    if (selection.unmappedRoutes.length > 0) {
      lines.push('**' + tr(lang, 'tests.unmapped') + '**', '');
      for (const url of selection.unmappedRoutes) lines.push('- ' + code(url));
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

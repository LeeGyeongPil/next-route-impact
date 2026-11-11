import { matchAny, matchGlob } from './glob.js';
import { walkFiles } from './fsutil.js';
import type { ChangedFile, Config, ImpactReport, TestSelection } from './types.js';

/**
 * Turn an impact report into the list of test files to run.
 *  - config.tests maps URL globs to test file globs; only files that exist are selected
 *  - a changed test file (one that matches any mapped test glob) is selected too
 *  - affected routes with no matching URL glob are listed as unmappedRoutes
 *  - a changed file that matches config.runAllOn recommends running every test (runAll)
 */
export function selectTests(report: ImpactReport, config: Config, root: string, changed: ChangedFile[] = report.changed): TestSelection {
  const files = new Set<string>();
  const unmapped = new Set<string>();
  const existing = walkFiles(root);
  const urlGlobs = Object.keys(config.tests);
  const allTestGlobs = Object.values(config.tests).flat();

  for (const route of report.routes) {
    const matches = urlGlobs.filter((urlGlob) => matchGlob(urlGlob, route.url));
    if (matches.length === 0) {
      unmapped.add(route.url);
      continue;
    }
    for (const urlGlob of matches) {
      for (const testGlob of config.tests[urlGlob] ?? []) {
        for (const file of existing) if (matchGlob(testGlob, file)) files.add(file);
      }
    }
  }

  const runAllReasons: TestSelection['runAllReasons'] = [];
  for (const change of changed) {
    const paths = change.oldPath ? [change.path, change.oldPath] : [change.path];
    for (const candidate of paths) {
      const pattern = matchAny(config.runAllOn, candidate);
      if (pattern !== undefined && !runAllReasons.some((reason) => reason.file === candidate)) {
        runAllReasons.push({ file: candidate, pattern });
      }
    }
    if (change.status !== 'deleted' && matchAny(allTestGlobs, change.path) !== undefined && existing.includes(change.path)) {
      files.add(change.path);
    }
  }

  return {
    runAll: runAllReasons.length > 0,
    runAllReasons,
    files: [...files].sort(),
    unmappedRoutes: [...unmapped].sort(),
  };
}

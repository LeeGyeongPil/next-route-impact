// AC-1: 15 table-driven cases on the practice app, with exact expected results.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadApi, runCli, shopApp } from './helpers.mjs';

const { analyze } = await loadApi();

const cases = [
  { name: 'util used by pages, a dynamic import and the Pages Router', changed: 'src/lib/format.ts',
    routes: ['page:/docs/[...slug]', 'page:/legacy', 'page:/products/[id]', 'page:/shop/[[...filters]]'] },
  { name: 'barrel: only the page that imports Card', changed: 'src/components/ui/Card.tsx', routes: ['page:/about'] },
  { name: 'barrel without symbol precision over-approximates', changed: 'src/components/ui/Card.tsx',
    options: { symbolPrecision: false }, routes: ['page:/', 'page:/about'] },
  { name: 'barrel star re-export reaches the importer of Button', changed: 'src/components/ui/Button.tsx', routes: ['page:/'] },
  { name: 'server module: route handlers and the middleware matcher', changed: 'src/lib/db.ts',
    routes: ['api:/api/ping', 'api:/api/accounts/[id]', 'page:/dashboard', 'page:/dashboard/settings'] },
  { name: 'layout reaches child pages but not route handlers', changed: 'src/app/dashboard/layout.tsx',
    routes: ['page:/dashboard', 'page:/dashboard/settings'] },
  { name: 'next/dynamic inside a parallel slot', changed: 'src/components/Chart.tsx', routes: ['page:/dashboard'] },
  { name: 'type-only import is ignored by default', changed: 'src/lib/theme.ts', routes: [] },
  { name: 'type-only import is followed with includeTypes', changed: 'src/lib/theme.ts',
    options: { includeTypes: true }, routes: ['page:/about'] },
  { name: 'route group layout', changed: 'src/app/(marketing)/layout.tsx', routes: ['page:/about'] },
  { name: 'private folder never becomes a route', changed: 'src/app/_private/helper.ts', routes: [] },
  { name: '_app wraps Pages Router pages only', changed: 'src/pages/_app.tsx', routes: ['page:/legacy'] },
  { name: 'intercepting route', changed: 'src/app/feed/(.)photo/[id]/page.tsx', routes: ['page:/feed/photo/[id]'], intercept: true },
  { name: 'route handler itself', changed: 'src/app/api/accounts/[id]/route.ts', routes: ['api:/api/accounts/[id]'] },
  { name: 'file that is not in the graph is uncertain', changed: 'src/lib/deleted.ts', routes: [],
    uncertain: [{ file: 'src/lib/deleted.ts', reason: 'deleted' }] },
];

test('the table has exactly 15 cases', () => {
  assert.equal(cases.length, 15);
});

for (const item of cases) {
  test('AC-1 case: ' + item.name, async () => {
    const report = await analyze({
      root: shopApp,
      changed: [{ path: item.changed, status: 'modified' }],
      ...(item.options ?? {}),
    });
    const got = report.routes.map((route) => route.kind + ':' + route.url).sort();
    assert.deepEqual(got, [...item.routes].sort());
    assert.deepEqual(report.uncertain, item.uncertain ?? []);
    for (const route of report.routes) {
      // The explanation starts at the changed file and ends at the entry file that was reached.
      assert.equal(route.via[0], item.changed);
      assert.equal(route.edges.length, route.via.length - 1);
      const last = route.via[route.via.length - 1];
      if (route.expandedBy === null) assert.equal(last, route.file);
      else assert.equal(path.posix.basename(last).replace(/\.\w+$/, ''), route.expandedBy);
      if (item.intercept) assert.equal(route.intercept, true);
    }
  });
}

test('layout and proxy hits are marked with expandedBy; direct imports are not', async () => {
  const report = await analyze({ root: shopApp, changed: [{ path: 'src/lib/db.ts', status: 'modified' }] });
  const byUrl = Object.fromEntries(report.routes.map((route) => [route.url, route]));
  assert.equal(byUrl['/api/ping'].expandedBy, null);
  assert.equal(byUrl['/api/accounts/[id]'].expandedBy, null);
  assert.equal(byUrl['/dashboard'].expandedBy, 'middleware');
});

test('a slot default and the root layout cover the right pages', async () => {
  const slot = await analyze({ root: shopApp, changed: [{ path: 'src/app/dashboard/@analytics/default.tsx', status: 'modified' }] });
  assert.deepEqual(slot.routes.map((r) => r.url), ['/dashboard', '/dashboard/settings']);
  const root = await analyze({ root: shopApp, changed: [{ path: 'src/app/layout.tsx', status: 'modified' }] });
  assert.ok(root.routes.every((route) => route.router === 'app' && route.kind === 'page'));
  assert.ok(root.routes.some((route) => route.url === '/products/[id]'));
  assert.ok(!root.routes.some((route) => route.url === '/legacy'));
});

// Round 2 regression (Q-8): the representative file of an expanded URL is the main page, not a parallel @slot page.
test('AC-4 layout expansion reports the main page of /dashboard, not its @analytics slot', () => {
  const result = runCli(['--root', shopApp, 'src/app/dashboard/layout.tsx', '--json']);
  const report = JSON.parse(result.stdout);
  const dashboard = report.routes.find((route) => route.url === '/dashboard');
  assert.ok(dashboard, '/dashboard is affected');
  assert.equal(dashboard.file, 'src/app/dashboard/page.tsx');
});

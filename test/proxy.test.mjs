// AC-2: proxy.ts (Next 16) and middleware.ts, every matcher shape.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAll, loadApi, makeTree } from './helpers.mjs';

const { analyze } = await loadApi();
after(cleanupAll);

const ROUTE_FILES = {
  'src/lib/shared.ts': 'export const shared = 1;\n',
  'src/app/page.tsx': 'export default function Home() { return null; }\n',
  'src/app/about/page.tsx': 'export default function About() { return null; }\n',
  'src/app/dashboard/page.tsx': 'export default function Dash() { return null; }\n',
  'src/app/dashboard/settings/page.tsx': 'export default function Settings() { return null; }\n',
  'src/app/api/ping/route.ts': 'export function GET() { return new Response("ok"); }\n',
};
const ALL = ['api:/api/ping', 'page:/', 'page:/about', 'page:/dashboard', 'page:/dashboard/settings'];

function proxySource(configLine) {
  return "import { shared } from './lib/shared';\nexport function proxy() { void shared; }\n" + configLine;
}

const variants = [
  { name: 'string matcher with :path* includes the folder itself', config: "export const config = { matcher: '/dashboard/:path*' };",
    expected: ['page:/dashboard', 'page:/dashboard/settings'] },
  { name: 'array matcher', config: "export const config = { matcher: ['/about', '/api/:path*'] };",
    expected: ['api:/api/ping', 'page:/about'] },
  { name: 'object matcher with source', config: "export const config = { matcher: [{ source: '/about' }] };",
    expected: ['page:/about'] },
  { name: 'default template with negative lookahead excludes /api', config: "export const config = { matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)' };",
    expected: ['page:/', 'page:/about', 'page:/dashboard', 'page:/dashboard/settings'] },
  { name: 'no config means every route, nothing uncertain', config: '', expected: ALL },
  { name: 'non-literal matcher means every route and an uncertain item', config: "const list = ['/x'];\nexport const config = { matcher: list };",
    expected: ALL, uncertain: [{ file: 'src/proxy.ts', reason: 'matcher-not-static' }] },
];

for (const variant of variants) {
  test('AC-2 matcher: ' + variant.name, async () => {
    const root = makeTree({ ...ROUTE_FILES, 'src/proxy.ts': proxySource(variant.config) });
    const report = await analyze({ root, changed: [{ path: 'src/lib/shared.ts', status: 'modified' }] });
    assert.deepEqual(report.routes.map((r) => r.kind + ':' + r.url).sort(), variant.expected);
    assert.deepEqual(report.uncertain, variant.uncertain ?? []);
    assert.deepEqual(report.notes, []);
    for (const route of report.routes) assert.equal(route.expandedBy, 'proxy');
  });
}

test('AC-2 the old middleware.ts name works and adds a rename note', async () => {
  const root = makeTree({
    ...ROUTE_FILES,
    'src/middleware.ts': proxySource("export const config = { matcher: '/about' };").replace('proxy()', 'middleware()'),
  });
  const report = await analyze({ root, changed: [{ path: 'src/lib/shared.ts', status: 'modified' }] });
  assert.deepEqual(report.routes.map((r) => r.url), ['/about']);
  assert.equal(report.routes[0].expandedBy, 'middleware');
  assert.deepEqual(report.notes, [{ code: 'middleware-renamed', params: { file: 'src/middleware.ts' } }]);
});

test('AC-2 proxy.ts at the project root next to a root-level app folder', async () => {
  const root = makeTree({
    'lib/shared.ts': 'export const shared = 1;\n',
    'app/page.tsx': 'export default function Home() { return null; }\n',
    'app/blog/[slug]/page.tsx': 'export default function Post() { return null; }\n',
    'proxy.ts': "import { shared } from './lib/shared';\nexport function proxy() { void shared; }\nexport const config = { matcher: '/blog/:slug*' };\n",
  });
  const report = await analyze({ root, changed: [{ path: 'lib/shared.ts', status: 'modified' }] });
  assert.deepEqual(report.routes.map((r) => r.url), ['/blog/[slug]']);
});

test('AC-2 editing proxy.ts itself reaches the routes in its matcher', async () => {
  const root = makeTree({ ...ROUTE_FILES, 'src/proxy.ts': proxySource("export const config = { matcher: '/about' };") });
  const report = await analyze({ root, changed: [{ path: 'src/proxy.ts', status: 'modified' }] });
  assert.deepEqual(report.routes.map((r) => r.url), ['/about']);
});

test('AC-2 a matcher with unsupported syntax assumes every route and says so', async () => {
  const root = makeTree({ ...ROUTE_FILES, 'src/proxy.ts': proxySource("export const config = { matcher: '/broken/(unclosed' };") });
  const report = await analyze({ root, changed: [{ path: 'src/lib/shared.ts', status: 'modified' }] });
  assert.equal(report.routes.length, ALL.length);
  assert.deepEqual(report.uncertain, [{ file: 'src/proxy.ts', reason: 'matcher-unsupported' }]);
});

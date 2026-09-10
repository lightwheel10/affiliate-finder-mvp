import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { LanguageProvider } from '../../src/contexts/LanguageContext';
import { BrandLocationProvider } from '../../src/contexts/BrandLocationContext';
import { DashboardPageSkeleton, DashboardRouteSkeleton } from '../../src/app/components/LoadingSkeletons';
import { en } from '../../src/dictionaries/en';

// Node's test runner isolates this file. Server rendering does not run effects;
// the fake client configuration keeps this regression test independent of accounts.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'loading-ui-test';

function renderDashboard(children: ReactNode) {
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: {} as never },
      createElement(LanguageProvider, null,
        createElement(BrandLocationProvider, null, children))),
  );
}

test('Saved shows a loading state before its account and affiliates are available, never a false empty result', async (context) => {
  context.mock.method(globalThis, 'fetch', () => { throw new Error('Loading UI must not make server-render requests'); });
  const { default: SavedPage } = await import('../../src/app/(dashboard)/saved/page');
  const html = renderDashboard(createElement(SavedPage));
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /No saved affiliates/i);
  assert.match(html, new RegExp(en.dashboard.saved.pageTitle));
});

test('the shared layout fallback follows the current route and never labels an unknown route as Find', () => {
  for (const [pathname, title] of [
    ['/saved', en.dashboard.saved.pageTitle],
    ['/settings', en.dashboard.settings.pageTitle],
    ['/brands', en.dashboard.settings.pageTitle],
    ['/operations/search-reconciliation', null],
  ]) {
    const html = renderDashboard(createElement(PathnameContext.Provider, { value: pathname }, createElement(DashboardRouteSkeleton)));
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, new RegExp(en.dashboard.find.pageTitle));
    if (title) assert.match(html, new RegExp(title));
    else assert.doesNotMatch(html, /grid-cols-12/);
  }
});

test('dashboard route fallbacks announce loading and do not expose placeholder buttons', () => {
  for (const page of ['find', 'discovered', 'saved', 'outreach', 'settings'] as const) {
    const html = renderDashboard(createElement(DashboardPageSkeleton, { page }));
    assert.match(html, /role="status"/);
    assert.match(html, new RegExp(en.dashboard[page].pageTitle));
    assert.doesNotMatch(html, /<button|<input|<a\s/);
    if (page === 'settings') assert.doesNotMatch(html, /grid-cols-12/);
  }
});

test('Settings loading keeps the header fixed and gives scrolling to the content region', () => {
  const html = renderDashboard(createElement(DashboardPageSkeleton, { page: 'settings' }));

  assert.match(html, /data-settings-page-header="true"[^>]*class="[^"]*h-16[^"]*shrink-0/);
  assert.match(html, /data-settings-scroll-region="true"[^>]*class="[^"]*min-h-0[^"]*flex-1[^"]*overflow-y-auto/);
  assert.doesNotMatch(html, /h-\[calc\(100vh-8rem\)\]/);
});

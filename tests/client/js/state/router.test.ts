import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// Router module test strategy
//
// The router module reads location.pathname at import time to set the initial
// $state, and tracks an `initialized` flag at module scope. To test different
// initial routes and to reset that flag between test groups we must use
// vi.resetModules() + a dynamic import for each describe block that needs a
// fresh module instance. Globals (location, navigation, window) are stubbed
// before each dynamic import so the module picks them up on load.
//////////////////////////////

/** Minimal NavigateEvent shape used by the navigate listener. */
interface FakeNavigateEvent {
  destination: { url: string };
  hashChange: boolean;
  downloadRequest: null | string;
  canIntercept: boolean;
  intercepted: boolean;
  interceptHandler: (() => void) | null;
  preventDefault: ReturnType<typeof vi.fn>;
  intercept: (opts: { handler: () => void }) => void;
}

/**
 * Builds a fake NavigateEvent for use in navigate listener tests.
 * @param {string} url - The destination URL string
 * @param {Partial<FakeNavigateEvent>} overrides - Optional field overrides
 * @return {FakeNavigateEvent} The constructed fake event
 */
function makeFakeNavigateEvent(
  url: string,
  overrides: Partial<FakeNavigateEvent> = {},
): FakeNavigateEvent {
  const event: FakeNavigateEvent = {
    destination: { url },
    hashChange: false,
    downloadRequest: null,
    canIntercept: true,
    intercepted: false,
    interceptHandler: null,
    preventDefault: vi.fn(),
    intercept(opts) {
      this.intercepted = true;
      this.interceptHandler = opts.handler;
    },
    ...overrides,
  };
  return event;
}

/**
 * Builds a minimal navigation global stub that captures 'navigate' listeners
 * and exposes helpers to fire them.
 * @return {{ addEventListener: ReturnType<typeof vi.fn>, navigate: ReturnType<typeof vi.fn>, fire: (e: FakeNavigateEvent) => void }} The stub and fire helper
 */
function makeNavigationStub() {
  const listeners: Array<(e: FakeNavigateEvent) => void> = [];
  const stub = {
    addEventListener: vi.fn(
      (type: string, cb: (e: FakeNavigateEvent) => void) => {
        if (type === 'navigate') listeners.push(cb);
      },
    ),
    navigate: vi.fn(),
    /** Fires the navigate event on all registered listeners. */
    fire(event: FakeNavigateEvent) {
      for (const l of listeners) l(event);
    },
  };
  return stub;
}

//////////////////////////////
// Route parsing via route export
//////////////////////////////

describe('route — initial route parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('parses the home route for /admin', async () => {
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', makeNavigationStub());
    const { nav } =
      await import('../../../../src/client/js/state/router.svelte');
    expect(nav.route).toEqual({ view: 'home' });
  });

  it('parses the home route for /admin/ (trailing slash)', async () => {
    vi.stubGlobal('location', { pathname: '/admin/' });
    vi.stubGlobal('navigation', makeNavigationStub());
    const { nav } =
      await import('../../../../src/client/js/state/router.svelte');
    expect(nav.route).toEqual({ view: 'home' });
  });

  it('parses the collection route for /admin/posts', async () => {
    vi.stubGlobal('location', { pathname: '/admin/posts' });
    vi.stubGlobal('navigation', makeNavigationStub());
    const { nav } =
      await import('../../../../src/client/js/state/router.svelte');
    expect(nav.route).toEqual({ view: 'collection', collection: 'posts' });
  });

  it('parses the file route for /admin/posts/hello-world', async () => {
    vi.stubGlobal('location', { pathname: '/admin/posts/hello-world' });
    vi.stubGlobal('navigation', makeNavigationStub());
    const { nav } =
      await import('../../../../src/client/js/state/router.svelte');
    expect(nav.route).toEqual({
      view: 'file',
      collection: 'posts',
      slug: 'hello-world',
    });
  });

  it('parses the draft route for /admin/posts/draft-abc123', async () => {
    vi.stubGlobal('location', { pathname: '/admin/posts/draft-abc123' });
    vi.stubGlobal('navigation', makeNavigationStub());
    const { nav } =
      await import('../../../../src/client/js/state/router.svelte');
    expect(nav.route).toEqual({
      view: 'draft',
      collection: 'posts',
      draftId: 'abc123',
    });
  });
});

//////////////////////////////
// adminPath()
//////////////////////////////

describe('adminPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns basePath when called with no segments', async () => {
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', makeNavigationStub());
    const { adminPath } =
      await import('../../../../src/client/js/state/router.svelte');
    expect(adminPath()).toBe('/admin');
  });

  it('joins segments under default /admin basePath', async () => {
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', makeNavigationStub());
    const { adminPath } =
      await import('../../../../src/client/js/state/router.svelte');
    expect(adminPath('posts')).toBe('/admin/posts');
    expect(adminPath('posts', 'hello-world')).toBe('/admin/posts/hello-world');
  });

  it('produces single-slash paths when basePath is /', async () => {
    vi.stubGlobal('location', { pathname: '/' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { adminPath, initRouter } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/');
    expect(adminPath('authors')).toBe('/authors');
    expect(adminPath('posts', 'my-post')).toBe('/posts/my-post');
    expect(adminPath('posts', 'draft-abc')).toBe('/posts/draft-abc');
  });

  it('joins segments under custom basePath', async () => {
    vi.stubGlobal('location', { pathname: '/cms' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { adminPath, initRouter } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/cms');
    expect(adminPath('posts')).toBe('/cms/posts');
    expect(adminPath('posts', 'hello')).toBe('/cms/posts/hello');
  });

  it('joins segments under nested basePath', async () => {
    vi.stubGlobal('location', { pathname: '/app/dashboard' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { adminPath, initRouter } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/app/dashboard');
    expect(adminPath('posts')).toBe('/app/dashboard/posts');
  });
});

//////////////////////////////
// Root basePath (/) — interception and parsing
//////////////////////////////

describe('initRouter with root basePath (/)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('parses home route for /', async () => {
    vi.stubGlobal('location', { pathname: '/' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/');
    expect(nav.route).toEqual({ view: 'home' });
  });

  it('parses collection route for /authors', async () => {
    vi.stubGlobal('location', { pathname: '/authors' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/');
    expect(nav.route).toEqual({ view: 'collection', collection: 'authors' });
  });

  it('intercepts navigations under root basePath', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      confirm: vi.fn(() => true),
    });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/');

    const event = makeFakeNavigateEvent('http://localhost/authors');
    navStub.fire(event);
    expect(event.intercepted).toBe(true);
    event.interceptHandler!();
    expect(nav.route).toEqual({ view: 'collection', collection: 'authors' });
  });

  it('adminPath returns / when basePath is root and no segments given', async () => {
    vi.stubGlobal('location', { pathname: '/' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, adminPath } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/');
    expect(adminPath()).toBe('/');
  });
});

//////////////////////////////
// Custom basePath route parsing
//////////////////////////////

describe('initRouter with custom basePath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('parses home route with custom basePath', async () => {
    vi.stubGlobal('location', { pathname: '/cms' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/cms');
    expect(nav.route).toEqual({ view: 'home' });
  });

  it('parses collection route with custom basePath', async () => {
    vi.stubGlobal('location', { pathname: '/cms/posts' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/cms');
    expect(nav.route).toEqual({ view: 'collection', collection: 'posts' });
  });

  it('parses file route with custom basePath', async () => {
    vi.stubGlobal('location', { pathname: '/cms/posts/hello-world' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/cms');
    expect(nav.route).toEqual({
      view: 'file',
      collection: 'posts',
      slug: 'hello-world',
    });
  });

  it('parses draft route with custom basePath', async () => {
    vi.stubGlobal('location', { pathname: '/cms/posts/draft-abc123' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/cms');
    expect(nav.route).toEqual({
      view: 'draft',
      collection: 'posts',
      draftId: 'abc123',
    });
  });

  it('intercepts navigations under custom basePath', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/cms' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      confirm: vi.fn(() => true),
    });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/cms');

    const event = makeFakeNavigateEvent('http://localhost/cms/posts');
    navStub.fire(event);
    expect(event.intercepted).toBe(true);
    event.interceptHandler!();
    expect(nav.route).toEqual({ view: 'collection', collection: 'posts' });
  });

  it('does not intercept navigations outside custom basePath', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/cms' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/cms');

    const event = makeFakeNavigateEvent('http://localhost/admin/posts');
    navStub.fire(event);
    expect(event.intercepted).toBe(false);
    expect(nav.route).toEqual({ view: 'home' });
  });

  it('handles nested basePath like /app/dashboard', async () => {
    vi.stubGlobal('location', { pathname: '/app/dashboard/posts' });
    vi.stubGlobal('navigation', makeNavigationStub());
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter('/app/dashboard');
    expect(nav.route).toEqual({ view: 'collection', collection: 'posts' });
  });
});

//////////////////////////////
// navigate()
//////////////////////////////

describe('navigate()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('calls navigation.navigate with the given path', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    const { navigate } =
      await import('../../../../src/client/js/state/router.svelte');
    navigate('/admin/posts');
    expect(navStub.navigate).toHaveBeenCalledWith('/admin/posts');
  });
});

//////////////////////////////
// initRouter — Navigation API listener registration
//////////////////////////////

describe('initRouter — navigate listener', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('intercepts /admin navigations and updates reactive route state', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      confirm: vi.fn(() => true),
    });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter();

    const event = makeFakeNavigateEvent('http://localhost/admin/posts');
    navStub.fire(event);
    // handler must have been called to update route
    expect(event.intercepted).toBe(true);
    event.interceptHandler!();
    expect(nav.route).toEqual({ view: 'collection', collection: 'posts' });
  });

  it('does not intercept navigations outside /admin', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter();

    const event = makeFakeNavigateEvent('http://localhost/other-page');
    navStub.fire(event);
    expect(event.intercepted).toBe(false);
    // route should remain at home
    expect(nav.route).toEqual({ view: 'home' });
  });

  it('does not intercept hash-change events', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter();

    const event = makeFakeNavigateEvent('http://localhost/admin#section', {
      hashChange: true,
    });
    navStub.fire(event);
    expect(event.intercepted).toBe(false);
  });

  it('does not intercept when canIntercept is false', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter();

    const event = makeFakeNavigateEvent('http://localhost/admin/posts', {
      canIntercept: false,
    });
    navStub.fire(event);
    expect(event.intercepted).toBe(false);
  });
});

//////////////////////////////
// initRouter — idempotence
//////////////////////////////

describe('initRouter — idempotent registration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('only registers one navigate listener even when called multiple times', async () => {
    const navStub = makeNavigationStub();
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter } =
      await import('../../../../src/client/js/state/router.svelte');

    initRouter();
    initRouter();
    initRouter();

    // addEventListener('navigate', ...) must have been called exactly once
    const navigateCalls = navStub.addEventListener.mock.calls.filter(
      ([type]: [string]) => type === 'navigate',
    );
    expect(navigateCalls).toHaveLength(1);
  });
});

//////////////////////////////
// registerDirtyChecker — navigation interception
//////////////////////////////

describe('registerDirtyChecker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('blocks navigation when dirty and user cancels confirm', async () => {
    const navStub = makeNavigationStub();
    const confirmSpy = vi.fn(() => false); // user clicks "Cancel"
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('confirm', confirmSpy);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, registerDirtyChecker, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter();
    registerDirtyChecker(() => true);

    const event = makeFakeNavigateEvent('http://localhost/admin/posts');
    navStub.fire(event);

    expect(confirmSpy).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.intercepted).toBe(false);
    // Route must NOT have changed
    expect(nav.route).toEqual({ view: 'home' });
  });

  it('allows navigation when dirty but user confirms', async () => {
    const navStub = makeNavigationStub();
    const confirmSpy = vi.fn(() => true); // user clicks "OK"
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('confirm', confirmSpy);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, registerDirtyChecker, nav } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter();
    registerDirtyChecker(() => true);

    const event = makeFakeNavigateEvent('http://localhost/admin/posts');
    navStub.fire(event);
    event.interceptHandler!();

    expect(event.intercepted).toBe(true);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(nav.route).toEqual({ view: 'collection', collection: 'posts' });
  });

  it('skips the confirm when the editor is not dirty', async () => {
    const navStub = makeNavigationStub();
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('location', { pathname: '/admin' });
    vi.stubGlobal('navigation', navStub);
    vi.stubGlobal('confirm', confirmSpy);
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    const { initRouter, registerDirtyChecker } =
      await import('../../../../src/client/js/state/router.svelte');
    initRouter();
    registerDirtyChecker(() => false);

    const event = makeFakeNavigateEvent('http://localhost/admin/posts');
    navStub.fire(event);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(event.intercepted).toBe(true);
  });
});

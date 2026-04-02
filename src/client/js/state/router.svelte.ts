/*
 * Parsed route state for the admin SPA.
 * Host applications configure the base path via initRouter() so the CMS
 * can live under any URL prefix, not just /admin.
 */
export type AdminRoute =
  | { view: 'home' }
  | { view: 'collection'; collection: string }
  | { view: 'file'; collection: string; slug: string }
  | { view: 'draft'; collection: string; draftId: string };

// Configurable base path for the admin SPA (e.g. '/admin', '/cms', '/dashboard').
// Set via initRouter() before the Navigation API listener is registered.
// Defaults to '/admin' for backwards compatibility.
let basePath = $state('/admin');

// Current route, reactive via Svelte 5 runes
let route = $state<AdminRoute>(parsePathname(location.pathname));

export const nav = {
  // Current parsed admin route.
  get route(): AdminRoute {
    return route;
  },
};

/**
 * Builds an absolute path under the configured basePath by joining segments.
 * Handles the root basePath case ('/') without producing double slashes.
 * @param {...string} segments - Path segments to append (e.g. 'authors', 'my-post')
 * @return {string} The joined path (e.g. '/admin/authors/my-post' or '/authors/my-post')
 */
export function adminPath(...segments: string[]): string {
  if (segments.length === 0) return basePath;
  const prefix = basePath === '/' ? '' : basePath;
  return prefix + '/' + segments.join('/');
}

/**
 * Checks whether a pathname falls under the configured basePath.
 * Matches the basePath exactly or as a prefix followed by '/'.
 * @param {string} pathname - The URL pathname to test
 * @return {boolean} True if the pathname is within the basePath
 */
function isUnderBasePath(pathname: string): boolean {
  // When basePath is '/', every absolute path is under it
  if (basePath === '/') return pathname.startsWith('/');
  return pathname === basePath || pathname.startsWith(basePath + '/');
}

/**
 * Parses a pathname into an AdminRoute by stripping the basePath prefix.
 * @param {string} pathname - The URL pathname to parse
 * @return {AdminRoute} The route corresponding to the given pathname
 */
function parsePathname(pathname: string): AdminRoute {
  /*
   * Strip the basePath prefix at a segment boundary, then split the remainder.
   * Must mirror isUnderBasePath's boundary check to avoid false matches
   * (e.g. basePath '/cms' should not match pathname '/cmsextra/posts').
   */
  const underBase = isUnderBasePath(pathname);
  const rest = underBase ? pathname.slice(basePath.length) : pathname;
  const segments = rest.split('/').filter(Boolean);
  /*
   * Draft URLs use a 2-segment pattern: {basePath}/{collection}/draft-{draftId}
   * This keeps the same URL depth as regular files so Astro static paths work.
   */
  if (segments.length >= 2 && segments[1].startsWith('draft-')) {
    return {
      view: 'draft',
      collection: segments[0],
      draftId: segments[1].slice('draft-'.length),
    };
  }
  if (segments.length >= 2) {
    return { view: 'file', collection: segments[0], slug: segments[1] };
  }
  if (segments.length === 1) {
    return { view: 'collection', collection: segments[0] };
  }
  return { view: 'home' };
}

/**
 * Navigates to a path within the admin SPA using the Navigation API.
 * @param {string} path - The path to navigate to (e.g., '/admin/posts')
 * @return {void}
 */
export function navigate(path: string): void {
  navigation.navigate(path);
}

// Callback to check if the editor has unsaved changes
let dirtyChecker: (() => boolean) | null = null;

/**
 * Registers a function that returns whether the editor has unsaved changes.
 * @param {() => boolean} checker - Function returning true if there are unsaved changes
 * @return {void}
 */
export function registerDirtyChecker(checker: () => boolean): void {
  dirtyChecker = checker;
}

// Guard against duplicate listener registration (e.g., HMR remount)
let initialized = false;

/**
 * Initializes the Navigation API listener, intercepting navigations under the
 * configured basePath and updating reactive route state.
 * Safe to call multiple times — registers the listener only once.
 * @param {string} [configuredBasePath] - The URL prefix for the admin SPA (e.g. '/admin', '/cms')
 * @return {void}
 */
export function initRouter(configuredBasePath?: string): void {
  if (configuredBasePath !== undefined) {
    // Normalize: strip trailing slashes but keep leading slash
    const trimmed = configuredBasePath.endsWith('/')
      ? configuredBasePath.slice(0, -1)
      : configuredBasePath;
    basePath = trimmed || '/';
    // Re-parse current pathname with the correct basePath
    route = parsePathname(location.pathname);
  }

  if (initialized) return;
  initialized = true;

  navigation.addEventListener('navigate', (event) => {
    const url = new URL(event.destination.url);

    // Only intercept navigations within the configured basePath
    if (!isUnderBasePath(url.pathname)) return;

    // Don't intercept downloads or hash-only changes
    if (event.hashChange || event.downloadRequest) return;

    if (!event.canIntercept) return;

    /*
     * Block navigation if editor has unsaved changes and user cancels.
     * This check must happen before event.intercept() — if it were inside the
     * handler, the URL would already be updated by the time the user cancels.
     */
    if (
      dirtyChecker?.() &&
      !confirm('You have unsaved changes. Leave without saving?')
    ) {
      event.preventDefault();
      return;
    }

    event.intercept({
      handler() {
        route = parsePathname(url.pathname);
      },
    });
  });

  window.addEventListener('beforeunload', (event) => {
    if (dirtyChecker?.()) {
      event.preventDefault();
    }
  });
}

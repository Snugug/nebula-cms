/**
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

/**
 * Returns the current base path for constructing admin URLs.
 * @return {string} The base path (e.g. '/admin')
 */
export function getBasePath(): string {
  return basePath;
}

/**
 * Escapes special regex characters in a string so it can be used as a literal pattern.
 * @param {string} str - The string to escape
 * @return {string} The escaped string safe for RegExp construction
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses a pathname into an AdminRoute by stripping the basePath prefix.
 * @param {string} pathname - The URL pathname to parse
 * @return {AdminRoute} The route corresponding to the given pathname
 */
function parsePathname(pathname: string): AdminRoute {
  const segments = pathname
    .replace(new RegExp(`^${escapeRegex(basePath)}\\/?`), '')
    .split('/')
    .filter(Boolean);
  // Draft URLs use a 2-segment pattern: {basePath}/{collection}/draft-{draftId}
  // This keeps the same URL depth as regular files so Astro static paths work
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
 * Returns the current admin route (reactive).
 * @return {AdminRoute} The current parsed admin route
 */
export function getRoute(): AdminRoute {
  return route;
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
    basePath = configuredBasePath.replace(/\/+$/, '') || '/';
    // Re-parse current pathname with the correct basePath
    route = parsePathname(location.pathname);
  }

  if (initialized) return;
  initialized = true;

  navigation.addEventListener('navigate', (event) => {
    const url = new URL(event.destination.url);

    // Only intercept navigations within the configured basePath
    if (!url.pathname.startsWith(basePath)) return;

    // Don't intercept downloads or hash-only changes
    if (event.hashChange || event.downloadRequest) return;

    if (!event.canIntercept) return;

    // Block navigation if editor has unsaved changes and user cancels.
    // This check must happen before event.intercept() — if it were inside the
    // handler, the URL would already be updated by the time the user cancels.
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

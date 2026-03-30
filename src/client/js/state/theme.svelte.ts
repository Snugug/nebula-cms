/*
 * Reactive theme state with localStorage persistence and system preference detection.
 * Manages a three-way preference (light / dark / auto) and resolves the effective
 * theme by combining user preference with the OS-level color scheme.
 */

// Tri-state preference: 'light', 'dark', or 'auto' (follow system)
type ThemePreference = 'light' | 'dark' | 'auto';

// Resolved theme applied to the DOM — always 'light' or 'dark'
type ResolvedTheme = 'light' | 'dark';

// Material Symbols icon name for each preference
type ThemeIcon = 'light_mode' | 'dark_mode' | 'brightness_auto';

// Human-readable label for each preference
type ThemeLabel = 'Light' | 'Dark' | 'Auto';

// localStorage key for persisting the user's preference
const STORAGE_KEY = 'nebula-theme';

//////////////////////////////
// Preference → UI mapping
//////////////////////////////

// Single source of truth for all preference-derived UI values.
// Adding a new preference requires a new entry here — TypeScript
// enforces exhaustiveness via the Record<ThemePreference, ...> type.
const THEME_MAP: Record<
  ThemePreference,
  { icon: ThemeIcon; label: ThemeLabel }
> = {
  light: { icon: 'light_mode', label: 'Light' },
  dark: { icon: 'dark_mode', label: 'Dark' },
  auto: { icon: 'brightness_auto', label: 'Auto' },
};

//////////////////////////////
// Module initialization
//////////////////////////////

// Read preference from localStorage at module init to avoid a flash of wrong theme.
// Safe because this module is only loaded client-side (client:only="svelte").
let stored: string | null = null;
try {
  if (typeof localStorage !== 'undefined') {
    stored = localStorage.getItem(STORAGE_KEY);
  }
} catch {
  // Storage access blocked (SecurityError, private browsing, etc.)
}

// Read system preference at module init so the first render has the correct
// resolved theme — deferring this to onMount would cause a flash for auto+dark users.
const mq =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

// The user's explicit preference
let preference = $state<ThemePreference>(
  stored === 'light' || stored === 'dark' || stored === 'auto'
    ? stored
    : 'auto',
);

// Whether the OS prefers dark mode — updated via matchMedia listener
let systemPrefersDark = $state(mq?.matches ?? false);

//////////////////////////////
// Derived state
//////////////////////////////

// Module-private $derived values — Svelte 5 prohibits exporting $derived
// directly from .svelte.ts modules, so they're exposed via a plain object
// with getter properties that forward the reactive reads.
const resolved: ResolvedTheme = $derived(
  preference === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : preference,
);

const ui = $derived(THEME_MAP[preference]);

// Reactive theme state. Consumers read properties directly: theme.resolved,
// theme.icon, theme.label. Each getter reads the underlying $derived, so
// Svelte tracks the dependency in any reactive context.
export const theme = {
  get resolved(): ResolvedTheme {
    return resolved;
  },
  get icon(): ThemeIcon {
    return ui.icon;
  },
  get label(): ThemeLabel {
    return ui.label;
  },
};

//////////////////////////////
// System preference tracking
//////////////////////////////

// Guard against duplicate listener registration (e.g. HMR remount)
let initialized = false;

/**
 * Starts listening to OS color scheme changes via matchMedia.
 * Preference and initial system state are already read at module init,
 * so this only needs to register the change listener. Call once on mount.
 * Safe to call multiple times — registers the listener only once.
 * @return {() => void} Cleanup function that removes the listener
 */
export function initTheme(): () => void {
  if (initialized) return () => {};
  initialized = true;

  /**
   * Updates the systemPrefersDark flag when the OS color scheme changes.
   * @param {MediaQueryListEvent} e - The change event from matchMedia
   * @return {void}
   */
  const handler = (e: MediaQueryListEvent): void => {
    systemPrefersDark = e.matches;
  };

  mq?.addEventListener('change', handler);

  return () => {
    mq?.removeEventListener('change', handler);
    initialized = false;
  };
}

//////////////////////////////
// Actions
//////////////////////////////

/**
 * Cycles the preference through auto -> light -> dark -> auto.
 * Persists the new value to localStorage.
 * @return {void}
 */
export function cycleTheme(): void {
  const next: ThemePreference =
    preference === 'auto' ? 'light' : preference === 'light' ? 'dark' : 'auto';
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Persistence failed (quota exceeded, storage disabled, etc.).
    // The in-memory preference is already updated, so the current
    // session works correctly — it just won't survive a page reload.
  }
}

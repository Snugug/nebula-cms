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

// Valid aria-checked values for a tri-state toggle
type AriaChecked = 'true' | 'false' | 'mixed';

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
  { icon: ThemeIcon; label: ThemeLabel; ariaChecked: AriaChecked }
> = {
  light: { icon: 'light_mode', label: 'Light', ariaChecked: 'true' },
  dark: { icon: 'dark_mode', label: 'Dark', ariaChecked: 'false' },
  auto: { icon: 'brightness_auto', label: 'Auto', ariaChecked: 'mixed' },
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

// Svelte 5 prohibits exporting $derived from .svelte.ts modules, so these
// are exposed via getter functions. The $derived runes are module-private
// and the functions simply forward the reactive read.

// The resolved theme combines preference with system detection
const resolved: ResolvedTheme = $derived(
  preference === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : preference,
);

// UI properties derived from the current preference
const ui = $derived(THEME_MAP[preference]);

/**
 * Returns the resolved theme for the DOM data-theme attribute.
 * @return {ResolvedTheme} Either 'light' or 'dark'
 */
export function theme(): ResolvedTheme {
  return resolved;
}

/**
 * Returns the Material Symbols icon name for the current preference.
 * @return {ThemeIcon} One of 'light_mode', 'dark_mode', or 'brightness_auto'
 */
export function themeIcon(): ThemeIcon {
  return ui.icon;
}

/**
 * Returns a human-readable label for the current preference.
 * @return {ThemeLabel} One of 'Light', 'Dark', or 'Auto'
 */
export function themeLabel(): ThemeLabel {
  return ui.label;
}

/**
 * Returns the aria-checked value for the toggle button.
 * @return {AriaChecked} One of 'true', 'false', or 'mixed'
 */
export function themeAriaChecked(): AriaChecked {
  return ui.ariaChecked;
}

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

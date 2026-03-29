/*
 * Reactive theme state with localStorage persistence and system preference detection.
 * Manages a three-way preference (light / dark / auto) and resolves the effective
 * theme by combining user preference with the OS-level color scheme.
 */

// Tri-state preference: 'light', 'dark', or 'auto' (follow system)
type ThemePreference = 'light' | 'dark' | 'auto';

// Resolved theme applied to the DOM — always 'light' or 'dark'
type ResolvedTheme = 'light' | 'dark';

// localStorage key for persisting the user's preference
const STORAGE_KEY = 'nebula-theme';

// Read preference from localStorage at module init to avoid a flash of wrong theme.
// Safe because this module is only loaded client-side (client:only="svelte").
const stored =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem(STORAGE_KEY)
    : null;

// The user's explicit preference
let preference = $state<ThemePreference>(
  stored === 'light' || stored === 'dark' || stored === 'auto'
    ? stored
    : 'auto',
);

// Whether the OS prefers dark mode — updated via matchMedia listener
let systemPrefersDark = $state(false);

// The resolved theme combines preference with system detection
const resolved: ResolvedTheme = $derived(
  preference === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : preference,
);

//////////////////////////////
// System preference tracking
//////////////////////////////

/**
 * Starts listening to OS color scheme changes via matchMedia.
 * Preference is already read from localStorage at module init, so this
 * only needs to set up the system preference listener. Call once on mount.
 * @return {void}
 */
export function initTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  systemPrefersDark = mq.matches;
  mq.addEventListener('change', (e) => {
    systemPrefersDark = e.matches;
  });
}

//////////////////////////////
// Public API
//////////////////////////////

/**
 * Returns the user's raw preference ('light', 'dark', or 'auto').
 * @return {ThemePreference} The stored preference
 */
export function getThemePreference(): ThemePreference {
  return preference;
}

/**
 * Returns the resolved theme that should be applied to the DOM.
 * When preference is 'auto', this reflects the OS setting.
 * @return {ResolvedTheme} Either 'light' or 'dark'
 */
export function getResolvedTheme(): ResolvedTheme {
  return resolved;
}

/**
 * Cycles the preference through auto -> light -> dark -> auto.
 * Persists the new value to localStorage.
 * @return {void}
 */
export function cycleTheme(): void {
  const next: ThemePreference =
    preference === 'auto' ? 'light' : preference === 'light' ? 'dark' : 'auto';
  preference = next;
  localStorage.setItem(STORAGE_KEY, next);
}

/**
 * Maps the current preference to the aria-checked value for the toggle button.
 * - 'light' -> 'true'
 * - 'dark' -> 'false'
 * - 'auto' -> 'mixed'
 * @return {'true' | 'false' | 'mixed'} The aria-checked attribute value
 */
export function getAriaChecked(): 'true' | 'false' | 'mixed' {
  if (preference === 'light') return 'true';
  if (preference === 'dark') return 'false';
  return 'mixed';
}

/**
 * Returns the Material Symbols icon name for the current preference.
 * @return {string} One of 'light_mode', 'dark_mode', or 'brightness_auto'
 */
export function getThemeIcon(): string {
  if (preference === 'light') return 'light_mode';
  if (preference === 'dark') return 'dark_mode';
  return 'brightness_auto';
}

/**
 * Returns a human-readable label for the current preference.
 * @return {string} Display text for the toggle button
 */
export function getThemeLabel(): string {
  if (preference === 'light') return 'Light';
  if (preference === 'dark') return 'Dark';
  return 'Auto';
}

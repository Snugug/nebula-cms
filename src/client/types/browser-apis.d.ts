/*
 * Type augmentations for browser APIs not fully covered by installed @types packages.
 * @types/dom-navigation augments Window but doesn't declare the global variable.
 * Interest Invokers API has no @types package at all.
 */

/*
 * Interest Invokers API — no @types package exists for this spec.
 * See: https://open-ui.org/components/interest-invokers.explainer/
 * The import is required to make this a module file so that the declare module
 * below is treated as an augmentation rather than a new module declaration.
 */
import 'svelte/elements';

declare global {
  /*
   * Navigation API — @types/dom-navigation provides the Navigation class and
   * augments Window, but omits the global variable declaration that lets code
   * use bare `navigation` (like bare `document` or `location`).
   */
  var navigation: Navigation;
}

declare module 'svelte/elements' {
  // Extends all HTML elements with the interestfor attribute
  interface HTMLAttributes<T> {
    interestfor?: string;
  }
}

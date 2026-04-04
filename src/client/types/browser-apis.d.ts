/*
 * Type augmentations for browser APIs not fully covered by installed @types packages.
 * The side-effect import makes this a module file so `declare global` adds to the
 * global scope and `declare module` augments (rather than redeclares) the target.
 */

import 'svelte/elements';

/*
//////////////////////////////
// Navigation API
//////////////////////////////
*/

/*
 * @types/dom-navigation provides the Navigation class and augments Window,
 * but omits the global variable declaration that lets code use bare
 * `navigation` (like bare `document` or `location`).
 */
declare global {
  var navigation: Navigation;
}

/*
//////////////////////////////
// Interest Invokers API
//////////////////////////////
*/

/*
 * No @types package exists for this spec.
 * See: https://open-ui.org/components/interest-invokers.explainer/
 */
declare module 'svelte/elements' {
  // Extends all HTML elements with the interestfor attribute
  interface HTMLAttributes<T> {
    interestfor?: string;
  }
}

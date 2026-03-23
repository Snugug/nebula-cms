/**
 * Ambient type declaration for the `virtual:collections` virtual module
 * injected by the nebula-cms Vite plugin at build time. Consumers reference
 * this via `/// <reference types="nebula-cms/virtual" />` in their env.d.ts.
 */
declare module 'virtual:collections' {
  /** Map of collection names to their `/collections/<name>.schema.json` public URLs */
  const collections: Record<string, string>;
  export default collections;
}

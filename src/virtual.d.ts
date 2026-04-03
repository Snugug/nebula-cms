/**
 * Ambient type declarations for virtual modules injected by the nebula-cms
 * Vite plugin. Consumers reference these via `/// <reference types="nebula-cms/virtual" />`
 * in their env.d.ts.
 */
declare module 'virtual:nebula/config' {
  // CMS configuration: basePath is the URL prefix for the admin SPA,
  // collectionsPath is the URL prefix for schema files
  const config: {
    basePath: string;
    collectionsPath: string;
  };
  export default config;
}

declare module 'virtual:nebula/collections' {
  // Map of collection names to their schema.json public URLs
  const collections: Record<string, string>;
  export default collections;
}

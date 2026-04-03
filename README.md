# Nebula CMS

A streamlined, Git-based Content Management System built specifically for [Astro](https://astro.build/). Nebula CMS provides a beautiful, unified editing interface for your Markdown, MDX, JSON, YAML, TOML, and Markdoc files, driven directly by your existing Astro [Content Collections](https://docs.astro.build/en/guides/content-collections/).

## Features

- **Painless Integration**: Plugs perfectly into Astro as a standard integration.
- **Git-Backed**: Modifications are made directly to the files in your repository. No external databases required.
- **Zero-Config Schemas**: Reads directly from your Astro Content Collections schemas via Zod.
- **Modern UI**: Svelte-powered dashboard to seamlessly manage entries, relational fields, and deeply nested object structures.

## Requirements, Installation, Setup

Nebula CMS requires the following peer dependencies:

- `astro` 6.1.0 or higher
- `@astrojs/svelte` 8.0.0 or higher
- `svelte` 5.0.0 or higher

Install the package via your preferred package manager:

```bash
npm install nebula-cms
# or
pnpm add nebula-cms
# or
yarn add nebula-cms
```

Once installed, make sure you include both Svelte and Nebula in your Astro config:

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import nebulaCMS from 'nebula-cms';

export default defineConfig({
  integrations: [svelte(), nebulaCMS()],
});
```

Then import the Nebula component into the path you want to use for the CMS:

```astro
---
import NebulaCMS from 'nebula-cms/client';
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nebula CMS</title>
  </head>
  <body>
    <NebulaCMS client:only="svelte" />
  </body>
</html>
```

Nebula assumes that your path is `/admin`. If you want to change it, in your Astro config, pass the `basePath` option to the integration:

```js
export default defineConfig({
  integrations: [svelte(), nebulaCMS({ basePath: '/cms' })],
});
```

## Defining Content Models

Unlike an external CMS where you have to duplicate your schema configuration, Nebula reads the exact same schemas you're already building in your [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/).

For even more control, new in Astro 6, you can make use of Zod's `meta()` method to configure how collections and fields are displayed inside Nebula.

### Field Meta

Adding `.meta()` to individual fields lets you provide UI-specific hints:

- **`title`** _(string)_: A human-readable display name for the field
- **`description`** _(string)_: A short description explaining what the field is for.

### Content Collection Meta

Adding `.meta()` to your base object schema lets you provide UI-specific hints to the CMS:

- **`title`** _(string)_: A human-readable display name for the collection (e.g., `'Blog Posts'`).
- **`description`** _(string)_: A short description explaining what the collection is for.
- **`files`** _(array of strings)_: The file extensions supported by this collection (e.g., `['md']`, `['json']`, `['md', 'mdx']`). This ensures Nebula CMS reads and writes the correct formats. Including `md`, `mdx`, or `markdoc` in this array will enable the rich text editor for those collections.

### Example Schema

```typescript
// src/content.config.ts
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
  schema: z
    .object({
      title: z.string(),
      date: z.date().meta({
        description: 'Published date for the post',
      }),
      draft: z.boolean().optional(),
      author: reference('authors'),
    })
    .meta({
      title: 'Posts',
      description: 'Blog posts',
      files: ['md'],
    }),
});

export const collections = { posts };
```

## Accessing the CMS

Once your integration is configured and your collections are defined, start your Astro development server and navigate to the page you integrated Nebula to. You'll be presented with two options: either using the File System Access API to work with your files locally, or connecting to a GitHub repository with a Personal Access Token to manage your content remotely.

While working locally, Nebula will automatically manage soft (SPA) navigations and includes middleware to ensure that all relevant pages are captured and redirected to the main URL. The path you configured will work for static or dynamic configurations, but you may need to configure your hosting provider to provide the same functionality if you export as a static site.

## Drafts

Nebula will let you create drafts of new pieces of content or changes to existing content. It stores these in IndexedDB in your browser and not included in your source files.

import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

//////////////////////////////
// Content collection definitions for the playground.
//
// These exercise a range of schema shapes: flat fields, cross-collection references, nested objects, and deeply nested arrays of objects.
//////////////////////////////

// Simple flat schema with a cross-collection reference
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
  schema: z
    .object({
      title: z.string(),
      date: z.date(),
      draft: z.boolean().optional(),
      author: reference('authors'),
    })
    .meta({
      title: 'Posts',
      description: 'Blog posts',
      files: ['md'],
    }),
});

// Nested object — social has optional string fields
const authors = defineCollection({
  loader: glob({ base: './src/content/authors', pattern: '**/*.json' }),
  schema: z
    .object({
      name: z.string(),
      bio: z.string(),
      social: z.object({
        twitter: z.string().optional(),
        github: z.string().optional(),
        website: z.string().optional(),
      }),
    })
    .meta({
      title: 'Authors',
      description: 'Those who write',
      files: ['json'],
    }),
});

// Array of nested objects, each containing a nested array
const products = defineCollection({
  loader: glob({ base: './src/content/products', pattern: '**/*.json' }),
  schema: z
    .object({
      name: z.string(),
      price: z.number(),
      variants: z.array(
        z.object({
          sku: z.string(),
          color: z.string(),
          sizes: z.array(z.string()),
        }),
      ),
    })
    .meta({
      title: 'Products',
      description: 'Things to buy',
      files: ['json'],
    }),
});

// Deep nesting: object with array, array of objects with nested arrays of objects
const courses = defineCollection({
  loader: glob({ base: './src/content/courses', pattern: '**/*.json' }),
  schema: z
    .object({
      title: z.string(),
      instructor: z.object({
        name: z.string(),
        credentials: z.array(
          z.object({
            institution: z.string(),
            year: z.number(),
          }),
        ),
      }),
      modules: z.array(
        z.object({
          title: z.string(),
          lessons: z.array(
            z.object({
              title: z.string(),
              duration: z.number(),
              resources: z.array(
                z.object({
                  type: z.string(),
                  url: z.string(),
                }),
              ),
            }),
          ),
        }),
      ),
    })
    .meta({
      title: 'Courses',
      description: 'Things to learn',
      files: ['json'],
    }),
});

// How-to guides authored in MDX
const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '**/*.mdx' }),
  schema: z
    .object({
      title: z.string(),
      order: z.number(),
    })
    .meta({
      title: 'Guides',
      description: 'How-to guides in MDX',
      files: ['mdx'],
    }),
});

// Cooking recipes authored in Markdoc
const recipes = defineCollection({
  loader: glob({
    base: './src/content/recipes',
    pattern: '**/*.{mdoc,markdoc}',
  }),
  schema: z
    .object({
      title: z.string(),
      servings: z.number(),
    })
    .meta({
      title: 'Recipes',
      description: 'Cooking recipes in Markdoc',
      files: ['markdoc'],
    }),
});

// Site configuration stored as YAML
const settings = defineCollection({
  loader: glob({ base: './src/content/settings', pattern: '**/*.{yml,yaml}' }),
  schema: z
    .object({
      siteName: z.string(),
      maxPosts: z.number(),
    })
    .meta({
      title: 'Settings',
      description: 'Site configuration in YAML',
      files: ['yaml'],
    }),
});

// Build configuration stored as TOML
const config = defineCollection({
  loader: glob({ base: './src/content/config', pattern: '**/*.toml' }),
  schema: z
    .object({
      name: z.string(),
      debug: z.boolean(),
    })
    .meta({
      title: 'Config',
      description: 'Build configuration in TOML',
      files: ['toml'],
    }),
});

// Documentation pages supporting both MD and MDX
const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: z
    .object({
      title: z.string(),
      category: z.string(),
    })
    .meta({
      title: 'Documentation',
      description: 'Docs in MD and MDX',
      files: ['md', 'mdx'],
    }),
});

export const collections = {
  posts,
  authors,
  products,
  courses,
  guides,
  recipes,
  settings,
  config,
  docs,
};

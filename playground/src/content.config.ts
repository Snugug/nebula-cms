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
  schema: z.object({
    title: z.string(),
    date: z.date(),
    draft: z.boolean().optional(),
    author: reference('authors'),
  }),
});

// Nested object — social has optional string fields
const authors = defineCollection({
  loader: glob({ base: './src/content/authors', pattern: '**/*.json' }),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    social: z.object({
      twitter: z.string().optional(),
      github: z.string().optional(),
      website: z.string().optional(),
    }),
  }),
});

// Array of nested objects, each containing a nested array
const products = defineCollection({
  loader: glob({ base: './src/content/products', pattern: '**/*.json' }),
  schema: z.object({
    name: z.string(),
    price: z.number(),
    variants: z.array(
      z.object({
        sku: z.string(),
        color: z.string(),
        sizes: z.array(z.string()),
      }),
    ),
  }),
});

// Deep nesting: object with array, array of objects with nested arrays of objects
const courses = defineCollection({
  loader: glob({ base: './src/content/courses', pattern: '**/*.json' }),
  schema: z.object({
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
  }),
});

export const collections = { posts, authors, products, courses };

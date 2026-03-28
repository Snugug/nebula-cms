import { describe, it, expect } from 'vitest';
import {
  getExtensionsForSchema,
  hasBodyEditor,
  getFileCategory,
  getDataFormat,
  stripExtension,
  getDefaultExtension,
} from '../../../../src/client/js/utils/file-types';

//////////////////////////////
// getExtensionsForSchema
//////////////////////////////

describe('getExtensionsForSchema', () => {
  it('returns all extensions for a single type identifier', () => {
    expect(getExtensionsForSchema({ files: ['md'] })).toEqual([
      '.md',
      '.markdown',
    ]);
  });

  it('returns extensions for multiple type identifiers combined', () => {
    expect(getExtensionsForSchema({ files: ['md', 'json'] })).toEqual([
      '.md',
      '.markdown',
      '.json',
    ]);
  });

  it('returns extensions for all frontmatter types', () => {
    expect(getExtensionsForSchema({ files: ['md', 'mdx', 'markdoc'] })).toEqual(
      ['.md', '.markdown', '.mdx', '.mdoc', '.markdoc'],
    );
  });

  it('returns extensions for all data types', () => {
    expect(getExtensionsForSchema({ files: ['json', 'yaml', 'toml'] })).toEqual(
      ['.json', '.yml', '.yaml', '.toml'],
    );
  });

  it('returns an empty array when files is empty', () => {
    expect(getExtensionsForSchema({ files: [] })).toEqual([]);
  });

  it('skips unknown type identifiers without throwing', () => {
    expect(getExtensionsForSchema({ files: ['md', 'unknown-type'] })).toEqual([
      '.md',
      '.markdown',
    ]);
  });

  it('returns an empty array when files property is missing', () => {
    expect(getExtensionsForSchema({})).toEqual([]);
  });
});

//////////////////////////////
// hasBodyEditor
//////////////////////////////

describe('hasBodyEditor', () => {
  it('returns true for .md files', () => {
    expect(hasBodyEditor('post.md')).toBe(true);
  });

  it('returns true for .markdown files', () => {
    expect(hasBodyEditor('post.markdown')).toBe(true);
  });

  it('returns true for .mdx files', () => {
    expect(hasBodyEditor('component.mdx')).toBe(true);
  });

  it('returns true for .mdoc files', () => {
    expect(hasBodyEditor('doc.mdoc')).toBe(true);
  });

  it('returns true for .markdoc files', () => {
    expect(hasBodyEditor('doc.markdoc')).toBe(true);
  });

  it('returns false for .json files', () => {
    expect(hasBodyEditor('data.json')).toBe(false);
  });

  it('returns false for .yml files', () => {
    expect(hasBodyEditor('config.yml')).toBe(false);
  });

  it('returns false for .yaml files', () => {
    expect(hasBodyEditor('config.yaml')).toBe(false);
  });

  it('returns false for .toml files', () => {
    expect(hasBodyEditor('config.toml')).toBe(false);
  });

  it('returns false for unrecognised extensions', () => {
    expect(hasBodyEditor('file.txt')).toBe(false);
  });
});

//////////////////////////////
// getFileCategory
//////////////////////////////

describe('getFileCategory', () => {
  it('returns frontmatter for .md files', () => {
    expect(getFileCategory('post.md')).toBe('frontmatter');
  });

  it('returns frontmatter for .markdown files', () => {
    expect(getFileCategory('post.markdown')).toBe('frontmatter');
  });

  it('returns frontmatter for .mdx files', () => {
    expect(getFileCategory('component.mdx')).toBe('frontmatter');
  });

  it('returns frontmatter for .mdoc files', () => {
    expect(getFileCategory('doc.mdoc')).toBe('frontmatter');
  });

  it('returns frontmatter for .markdoc files', () => {
    expect(getFileCategory('doc.markdoc')).toBe('frontmatter');
  });

  it('returns data for .json files', () => {
    expect(getFileCategory('data.json')).toBe('data');
  });

  it('returns data for .yml files', () => {
    expect(getFileCategory('config.yml')).toBe('data');
  });

  it('returns data for .yaml files', () => {
    expect(getFileCategory('config.yaml')).toBe('data');
  });

  it('returns data for .toml files', () => {
    expect(getFileCategory('config.toml')).toBe('data');
  });

  it('returns null for unrecognised extensions', () => {
    expect(getFileCategory('file.txt')).toBe(null);
  });
});

//////////////////////////////
// getDataFormat
//////////////////////////////

describe('getDataFormat', () => {
  it('returns json for .json files', () => {
    expect(getDataFormat('data.json')).toBe('json');
  });

  it('returns yaml for .yml files', () => {
    expect(getDataFormat('config.yml')).toBe('yaml');
  });

  it('returns yaml for .yaml files', () => {
    expect(getDataFormat('config.yaml')).toBe('yaml');
  });

  it('returns toml for .toml files', () => {
    expect(getDataFormat('config.toml')).toBe('toml');
  });

  it('returns null for frontmatter files', () => {
    expect(getDataFormat('post.md')).toBe(null);
  });

  it('returns null for .mdx files', () => {
    expect(getDataFormat('component.mdx')).toBe(null);
  });

  it('returns null for unrecognised extensions', () => {
    expect(getDataFormat('file.txt')).toBe(null);
  });
});

//////////////////////////////
// stripExtension
//////////////////////////////

describe('stripExtension', () => {
  it('strips .md extension', () => {
    expect(stripExtension('my-post.md')).toBe('my-post');
  });

  it('strips .markdown extension', () => {
    expect(stripExtension('my-post.markdown')).toBe('my-post');
  });

  it('strips .mdx extension', () => {
    expect(stripExtension('component.mdx')).toBe('component');
  });

  it('strips .mdoc extension', () => {
    expect(stripExtension('doc.mdoc')).toBe('doc');
  });

  it('strips .markdoc extension', () => {
    expect(stripExtension('doc.markdoc')).toBe('doc');
  });

  it('strips .json extension', () => {
    expect(stripExtension('data.json')).toBe('data');
  });

  it('strips .yml extension', () => {
    expect(stripExtension('config.yml')).toBe('config');
  });

  it('strips .yaml extension', () => {
    expect(stripExtension('config.yaml')).toBe('config');
  });

  it('strips .toml extension', () => {
    expect(stripExtension('config.toml')).toBe('config');
  });

  it('returns filename unchanged for unrecognised extensions', () => {
    expect(stripExtension('file.txt')).toBe('file.txt');
  });

  it('only strips the last known extension in a double-extension filename', () => {
    // Filenames with multiple dots: strip only the recognised trailing extension
    expect(stripExtension('my.post.md')).toBe('my.post');
  });
});

//////////////////////////////
// getDefaultExtension
//////////////////////////////

describe('getDefaultExtension', () => {
  it('returns .md as the default extension for md', () => {
    expect(getDefaultExtension('md')).toBe('.md');
  });

  it('returns .mdx as the default extension for mdx', () => {
    expect(getDefaultExtension('mdx')).toBe('.mdx');
  });

  it('returns .mdoc as the default extension for markdoc', () => {
    expect(getDefaultExtension('markdoc')).toBe('.mdoc');
  });

  it('returns .json as the default extension for json', () => {
    expect(getDefaultExtension('json')).toBe('.json');
  });

  it('returns .yml as the default extension for yaml', () => {
    expect(getDefaultExtension('yaml')).toBe('.yml');
  });

  it('returns .toml as the default extension for toml', () => {
    expect(getDefaultExtension('toml')).toBe('.toml');
  });

  it('returns null for unknown type identifiers', () => {
    expect(getDefaultExtension('unknown')).toBe(null);
  });
});

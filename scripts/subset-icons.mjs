/*
 * Fetches a subsetted Material Symbols Outlined woff2 font from Google Fonts
 * and inlines it as base64 in a self-contained CSS file. Run this script
 * whenever the icon set changes to regenerate src/client/css/icons.css.
 *
 * Usage: node scripts/subset-icons.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

//////////////////////////////
// Icon set definition
//////////////////////////////

// Icons used across the admin UI — keep sorted alphabetically.
const ICON_NAMES = [
  'add',
  'arrow_downward',
  'arrow_upward',
  'brightness_auto',
  'chevron_right',
  'close',
  'dark_mode',
  'drag_indicator',
  'hourglass_arrow_down',
  'hourglass_arrow_up',
  'info',
  'light_mode',
  'logout',
  'sort_by_alpha',
];

//////////////////////////////
// Path resolution
//////////////////////////////

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Absolute path where the generated CSS will be written.
const OUTPUT_PATH = join(__dirname, '../src/client/css/icons.css');

//////////////////////////////
// Font fetch helpers
//////////////////////////////

/**
 * Builds the Google Fonts CSS2 API URL for the subsetted icon font.
 * @param {string[]} names - Sorted array of icon ligature names
 * @return {string} The fully-formed Google Fonts API URL
 */
function buildFontsURL(names) {
  const joined = names.sort().join(',');
  return `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=${joined}&display=block`;
}

/**
 * Fetches the Google Fonts CSS stylesheet for the icon subset.
 * @param {string} url - The Google Fonts API URL to fetch
 * @return {Promise<string>} The CSS text returned by Google Fonts
 */
async function fetchFontCSS(url) {
  // Spoof a modern browser UA — Google Fonts returns woff2 for modern UAs.
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Google Fonts API returned ${res.status}: ${res.statusText}`,
    );
  }

  return res.text();
}

/**
 * Extracts the woff2 font binary URL from the Google Fonts CSS response.
 * Google Fonts returns unquoted urls in the form: url(https://fonts.gstatic.com/...)
 * The URL does not end in .woff2 — it is a signed CDN path — so we match on
 * the format hint that follows it instead.
 * @param {string} css - The CSS text returned by Google Fonts
 * @return {string} The absolute woff2 URL
 */
function extractWoff2URL(css) {
  // Match unquoted url(...) followed by format('woff2')
  const match = css.match(/url\((https:\/\/[^)]+)\)\s+format\('woff2'\)/);
  if (!match) {
    throw new Error('Could not find woff2 URL in Google Fonts CSS response');
  }
  return match[1];
}

/**
 * Downloads the woff2 binary and returns it as a base64-encoded string.
 * @param {string} url - The absolute URL to the woff2 font file
 * @return {Promise<string>} Base64-encoded woff2 binary data
 */
async function fetchWoff2AsBase64(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `Font binary fetch returned ${res.status}: ${res.statusText}`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

//////////////////////////////
// CSS generation
//////////////////////////////

/**
 * Generates the full icons.css content with an inlined base64 woff2 font.
 * @param {string} base64Font - The base64-encoded woff2 font data
 * @return {string} Complete CSS file content
 */
function generateCSS(base64Font) {
  return `/* Material Symbols Outlined, Subsetted 
 * Icons: ${ICON_NAMES.sort().join(', ')}
 */

@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('data:font/woff2;base64,${base64Font}') format('woff2');
}

.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 1.5rem;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'liga';
}
`;
}

//////////////////////////////
// Entry point
//////////////////////////////

const fontsURL = buildFontsURL(ICON_NAMES);
console.log(`Fetching icon subset CSS from Google Fonts...`);
console.log(`URL: ${fontsURL}`);

const fontCSS = await fetchFontCSS(fontsURL);
const woff2URL = extractWoff2URL(fontCSS);
console.log(`Found woff2 URL: ${woff2URL}`);

console.log(`Downloading woff2 binary...`);
const base64Font = await fetchWoff2AsBase64(woff2URL);
console.log(`Base64-encoded font: ${base64Font.length} characters`);

const css = generateCSS(base64Font);
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, css, 'utf8');
console.log(`Written to: ${OUTPUT_PATH}`);

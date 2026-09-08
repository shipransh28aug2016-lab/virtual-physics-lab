#!/usr/bin/env node
/**
 * Inlines the Vite build into one self-contained HTML file that runs from
 * `file://` with no server and no network: every stylesheet and every module
 * is embedded, and the app falls back to a hash router off the file protocol.
 *
 *   npm run build && node scripts/portable.mjs
 */
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist-portable');
const OUT_DIR = join(ROOT, 'portable');
const OUT = join(OUT_DIR, 'virtual-physics-lab.html');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(DIST))) {
  console.error('✗ dist-portable/ is missing — run `npm run build:portable`.');
  process.exit(1);
}

let html = await readFile(join(DIST, 'index.html'), 'utf8');
const assets = join(DIST, 'assets');
const files = (await exists(assets)) ? await readdir(assets) : [];

const read = (f) => readFile(join(assets, f), 'utf8');

// Inline every stylesheet.
//
// Every replacement below passes a FUNCTION rather than a string. A string
// replacement interprets `$&`, `$\``, `$'` and `$1`-`$99` as patterns, and a
// minified bundle routinely contains `$&&` — a variable named `$` followed by a
// logical and. That would splice the matched text into the middle of the code
// and produce a file that parses as HTML but not as JavaScript.
for (const css of files.filter((f) => f.endsWith('.css'))) {
  const body = await read(css);
  html = html.replace(new RegExp(`<link[^>]+href="[^"]*${css}"[^>]*>`), () => `<style>${body}</style>`);
}

// The portable build emits a single module, so it can be inlined verbatim —
// no chunk loader, no fetch, nothing for `file://` to fail on.
const chunks = files.filter((f) => f.endsWith('.js'));
if (chunks.length !== 1) {
  console.error(`✗ expected one bundle in ${DIST}/assets, found ${chunks.length}.`);
  console.error('  Build with VPL_PORTABLE=1 so dynamic imports are inlined.');
  process.exit(1);
}

const bundle = await read(chunks[0]);
const inlined = bundle.replace(/<\/script>/gi, '<\\/script>');
html = html.replace(/<script[^>]+src="[^"]*"[^>]*><\/script>/g, '');
html = html.replace('</body>', () => `<script type="module">${inlined}</script>\n</body>`);

// The bundle must survive the splice byte for byte. This is the check that
// catches a `$`-pattern corruption immediately instead of shipping a file that
// looks fine and throws SyntaxError on open.
if (!html.includes(inlined)) {
  console.error('✗ the bundle was altered while being inlined — the HTML would not parse as JavaScript.');
  process.exit(1);
}

// System fonts only: a web font would need the network.
html = html.replace(/<link[^>]+fonts\.[^>]+>/g, '');

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
if (/<script[^>]+src=|<link[^>]+href="(?!data:)/.test(html)) {
  console.error('✗ the portable file still references an external asset.');
  process.exitCode = 1;
}
console.log(`✓ portable/virtual-physics-lab.html · ${kb} kB · fully inlined`);

#!/usr/bin/env node
/**
 * Splits the `meta` object out of every simulator into its own tiny
 * `<slug>.meta.ts`, so the catalogue can list 46 experiments without loading a
 * single line of simulator code. Idempotent: running it twice changes nothing.
 *
 *   node scripts/gen-catalogue.mjs [--check]
 *
 * With --check it only reports what would change and exits non-zero if
 * anything is out of date — the form to use in CI.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src/simulations/experiments');
const CHECK = process.argv.includes('--check');

const HEADER = [
  '// GENERATED FILE — do not edit by hand.',
  '// Regenerate with: node scripts/gen-catalogue.mjs',
  "import type { ExperimentMeta } from '@/experiments/registry';",
  ''
].join('\n');

const FIELDS = [
  'id', 'slug', 'title', 'shortTitle', 'aim', 'unit',
  'chapter', 'kind', 'difficulty', 'practicalNo'
];

/** Pulls the literal value of `key` out of a TypeScript object source. */
function readField(src, key) {
  const m = src.match(new RegExp(`(?:^|[\\s,{])${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`));
  return m ? m[2].replace(/\\(['"`])/g, '$1') : null;
}

function readTags(src) {
  const m = src.match(/tags\s*:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((x) => x[2]);
}

const quote = (s) => JSON.stringify(s);

function render(meta) {
  const lines = FIELDS.filter((f) => meta[f] != null).map((f) => `  ${f}: ${quote(meta[f])}`);
  lines.push(`  tags: ${JSON.stringify(meta.tags)}`);
  return `${HEADER}\nexport const meta: ExperimentMeta = {\n${lines.join(',\n')}\n};\n`;
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.meta.ts'));
let changed = 0;

for (const file of files) {
  const path = join(DIR, file);
  const current = await readFile(path, 'utf8');
  const meta = {};
  for (const f of FIELDS) meta[f] = readField(current, f);
  meta.tags = readTags(current);

  if (!meta.slug || !meta.title) {
    console.error(`✗ ${file}: could not read a slug and a title`);
    process.exitCode = 1;
    continue;
  }
  const next = render(meta);
  if (next === current) continue;
  changed += 1;
  if (CHECK) {
    console.error(`✗ ${file} is not in generated form`);
  } else {
    await writeFile(path, next, 'utf8');
    console.log(`· rewrote ${file}`);
  }
}

console.log(`${files.length} meta files · ${changed} ${CHECK ? 'out of date' : 'rewritten'}`);
if (CHECK && changed > 0) process.exitCode = 1;

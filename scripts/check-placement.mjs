#!/usr/bin/env node
/**
 * Real-browser audit. Mounts every experiment route in Chromium and asserts
 * what a screenshot would otherwise have to be eyeballed for:
 *
 *   · the apparatus fills its panel (no letterboxing, no overflow)
 *   · no on-apparatus handle covers a label or leaves the drawing
 *   · every handle is reachable by keyboard and announces a value
 *   · the graph draws a real series and no reading shows NaN
 *   · frames stay smooth while a control is swept
 *
 *   node scripts/check-placement.mjs            # audits dist/ over http
 *   node scripts/check-placement.mjs --portable # audits the single file over file://
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTABLE = process.argv.includes('--portable');
const PORT = 4319;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function serve(root) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, 'index.html');
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

/** The catalogue, read straight off the meta files so the audit cannot drift. */
async function catalogue() {
  const { readdir } = await import('node:fs/promises');
  const dir = join(ROOT, 'src/simulations/experiments');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.meta.ts'));
  const out = [];
  for (const f of files.sort()) {
    const src = await readFile(join(dir, f), 'utf8');
    const title = src.match(/title:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/);
    out.push({
      slug: f.replace('.meta.ts', ''),
      title: title ? title[2].replace(/\\(['"`])/g, '$1') : null
    });
  }
  return out;
}

const defects = [];
const note = (slug, msg) => defects.push(`${slug}: ${msg}`);

const server = PORTABLE ? null : await serve(join(ROOT, 'dist'));
// CI images ship a pinned Chromium; use it rather than downloading another.
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  ...((await stat(executablePath).catch(() => null)) ? { executablePath } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const base = PORTABLE
  ? `${pathToFileURL(join(ROOT, 'portable/virtual-physics-lab.html')).href}#`
  : `http://localhost:${PORT}`;

const list = await catalogue();
let audited = 0;
let overlaps = 0;

for (const { slug, title } of list) {
  // Off file:// the URL differs only in its hash, and a same-document goto
  // leaves the previous route mounted; reload so each experiment is measured
  // on a clean page. (In-app link navigation is checked separately below.)
  await page.goto(`${base}/simulators/physics/${slug}`, { waitUntil: 'networkidle' });
  if (PORTABLE) await page.reload({ waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('svg.svg-lab', { timeout: 10_000 });
    if (title) {
      await page.waitForFunction(
        (want) => document.querySelector('.sim-head-main h1')?.textContent?.trim() === want,
        title,
        { timeout: 10_000 }
      );
    }
    await page.waitForTimeout(120);
  } catch {
    note(slug, 'the apparatus never rendered');
    continue;
  }

  const report = await page.evaluate(() => {
    const svg = document.querySelector('svg.svg-lab');
    const panel = svg?.closest('.viewport-stage') ?? svg?.parentElement;
    const sBox = svg.getBoundingClientRect();
    const pBox = panel.getBoundingClientRect();

    // What can genuinely hide a label is the painted glyph and its value
    // plate — not the invisible hit-rect or the full length of a drag rail.
    const controls = [...document.querySelectorAll('.stage-ctl')];
    const handles = controls.flatMap((c) => [
      ...c.querySelectorAll('.knob-body, .drag-handle, .switch-track, .segment-cell, .stage-ctl-value')
    ]);
    const labels = [...svg.querySelectorAll('text')].filter(
      (t) => !t.closest('.stage-ctl') && t.textContent.trim().length > 0
    );

    const overlapping = [];
    for (const h of handles) {
      const a = h.getBoundingClientRect();
      if (a.width === 0 || a.height === 0) continue;
      const owner = h.closest('.stage-ctl');
      for (const l of labels) {
        if (owner && owner.contains(l)) continue; // a control's own caption
        const b = l.getBoundingClientRect();
        if (b.width === 0) continue;
        const hit = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
        if (hit) {
          overlapping.push(
            `${owner?.getAttribute('aria-label') ?? 'handle'} covers "${l.textContent.trim().slice(0, 28)}"`
          );
        }
      }
    }

    const outside = handles
      .filter((h) => {
        const a = h.getBoundingClientRect();
        return a.width > 0 && (a.left < sBox.left - 2 || a.right > sBox.right + 2 || a.top < sBox.top - 2 || a.bottom > sBox.bottom + 2);
      })
      .map((h) => h.closest('.stage-ctl')?.getAttribute('aria-label') ?? 'handle');

    const unnamed = controls.filter((h) => !h.getAttribute('aria-label')).length;
    // A radiogroup delegates focus to its radios (roving tabindex), so the
    // focusable element is the widget itself, not always the group.
    const focusables = [
      ...document.querySelectorAll('[role="slider"], [role="switch"], [role="radio"][aria-checked="true"]')
    ];
    // Native controls are focusable without a tabindex; SVG groups are not.
    const NATIVE = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
    const unfocusable = focusables.filter(
      (h) => h.getAttribute('tabindex') !== '0' && !NATIVE.has(h.tagName)
    ).length;
    const sliders = [...document.querySelectorAll('.stage-ctl[role="slider"]')];
    const valueless = sliders.filter((h) => h.getAttribute('aria-valuenow') === null).length;

    return {
      fill: pBox.width > 0 ? Math.min(sBox.width / pBox.width, 1) : 0,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      handles: handles.length,
      overlapping,
      outside,
      unnamed,
      unfocusable,
      valueless,
      series: document.querySelectorAll('path.chart-series').length,
      readouts: document.querySelectorAll('.readout').length,
      nan: /NaN|Infinity/.test(document.body.innerText)
    };
  });

  if (report.fill < 0.999) note(slug, `the apparatus fills only ${(report.fill * 100).toFixed(1)}% of its panel`);
  if (report.overflowX) note(slug, 'the page scrolls horizontally at 1440 px');
  if (report.series === 0) note(slug, 'the graph drew no series');
  if (report.readouts === 0) note(slug, 'no measurements are shown');
  if (report.nan) note(slug, 'a NaN or Infinity reached the page');
  if (report.unnamed) note(slug, `${report.unnamed} on-apparatus handles have no accessible name`);
  if (report.unfocusable) note(slug, `${report.unfocusable} handles are not keyboard reachable`);
  if (report.valueless) note(slug, `${report.valueless} sliders announce no value`);
  for (const o of report.overlapping) {
    overlaps += 1;
    note(slug, o);
  }
  for (const o of report.outside) note(slug, `${o} sits outside the drawing`);

  // Sweep the first on-apparatus slider with the keyboard and watch the frames.
  const fps = await page.evaluate(async () => {
    const handle = document.querySelector('.stage-ctl[role="slider"]');
    if (!handle) return null;
    handle.focus();
    let frames = 0;
    const t0 = performance.now();
    const count = () => {
      frames += 1;
      if (performance.now() - t0 < 1000) requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    for (let i = 0; i < 40; i += 1) {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((r) => setTimeout(r, 12));
    }
    await new Promise((r) => setTimeout(r, 1000 - (performance.now() - t0)));
    return frames;
  });
  if (fps !== null && fps < 30) note(slug, `only ${fps} fps while sweeping a control`);

  // Narrow viewport: the layout must not overflow on a phone either.
  await page.setViewportSize({ width: 360, height: 780 });
  const narrow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  if (narrow) note(slug, 'the page scrolls horizontally at 360 px');
  await page.setViewportSize({ width: 1440, height: 900 });

  audited += 1;
}

// Routing has to work by clicking too, not only by loading a URL: a keyless
// route would reconcile into the previous page and keep its apparatus.
if (list.length > 1) {
  await page.goto(`${base}/simulators/physics/${list[0].slug}`, { waitUntil: 'networkidle' });
  if (PORTABLE) await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('svg.svg-lab');
  // The first link in that nav goes back to the unit index; take a sibling
  // experiment instead, which is the navigation a student actually makes.
  const link = page
    .locator('nav[aria-label="More experiments in this unit"] a[href*="/simulators/physics/"]')
    .first();
  if ((await link.count()) > 0) {
    await link.click();
    try {
      await page.waitForFunction(
        (from) => document.querySelector('.sim-head-main h1')?.textContent?.trim() !== from,
        list[0].title,
        { timeout: 10_000 }
      );
      await page.waitForSelector('svg.svg-lab', { timeout: 10_000 });
    } catch {
      note('routing', 'clicking through to another experiment did not swap the page');
    }
  } else {
    note('routing', 'no in-unit navigation links were rendered');
  }
}

await browser.close();
server?.close();

console.log(`${audited}/${list.length} audited · ${defects.length} defects · ${overlaps} overlaps · ${PORTABLE ? 'file://' : 'http'}`);
for (const d of defects) console.error(`  ✗ ${d}`);
process.exitCode = defects.length > 0 ? 1 : 0;

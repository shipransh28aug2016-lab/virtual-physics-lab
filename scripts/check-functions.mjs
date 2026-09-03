#!/usr/bin/env node
/**
 * Functional audit of the shipped single-file laboratory.
 *
 * `check-placement.mjs` proves every apparatus is drawn correctly. This one
 * proves the lab actually *works*: that a control moves the model, that the
 * graph and the readings follow it, that a trial can be recorded and cleared,
 * that the notebook survives a reload, that the language switch and the
 * favourites persist, and that search and the education tabs respond.
 *
 *   node scripts/check-functions.mjs             # audits index.html over file://
 *   node scripts/check-functions.mjs --dev URL   # audits a running dev server
 */
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stat } from 'node:fs/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const devIndex = process.argv.indexOf('--dev');
const DEV = devIndex !== -1 ? process.argv[devIndex + 1] : null;
const FILE = !DEV;
const base = DEV ?? `${pathToFileURL(join(ROOT, 'index.html')).href}#`;

const failures = [];
const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    results.push(`  ✗ ${name} — ${e.message}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  ...((await stat(executablePath).catch(() => null)) ? { executablePath } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 160)));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
});

/** Navigates to a route, reloading when the hash router needs a fresh document. */
async function go(route) {
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  if (FILE) await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(150);
}

await check('the file opens and mounts the application', async () => {
  await go('/');
  await page.waitForSelector('.hero', { timeout: 15_000 });
  const boot = await page.$('#boot');
  assert(!boot, 'the boot placeholder was never replaced');
  return 'home page rendered';
});

await check('the catalogue lists every experiment', async () => {
  await go('/simulators');
  await page.waitForSelector('.exp-card');
  const n = await page.locator('.exp-card').count();
  assert(n >= 46, `only ${n} experiments listed`);
  return `${n} experiments`;
});

await check('search narrows the catalogue', async () => {
  await page.fill('input[type="search"]', 'sonometer');
  await page.waitForTimeout(250);
  const n = await page.locator('.exp-card').count();
  assert(n >= 1 && n <= 5, `search returned ${n} cards`);
  const text = await page.locator('.exp-card').first().innerText();
  assert(/sonometer/i.test(text), 'the first result is not the sonometer');
  await page.fill('input[type="search"]', '');
  return `${n} result(s)`;
});

await check('the practical sections carry the CBSE lists', async () => {
  await go('/practicals/section-a');
  await page.waitForSelector('.exp-card');
  const a = await page.locator('.exp-card').count();
  await go('/practicals/section-b');
  await page.waitForSelector('.exp-card');
  const b = await page.locator('.exp-card').count();
  assert(a === 6, `Section A lists ${a} experiments, expected 6`);
  assert(b >= 9, `Section B lists ${b} experiments, expected at least 9`);
  return `Section A ${a}, Section B ${b}`;
});

await check('an apparatus renders with live instruments', async () => {
  await go('/simulators/physics/ohms-law');
  await page.waitForSelector('svg.svg-lab', { timeout: 15_000 });
  const state = await page.evaluate(() => ({
    handles: document.querySelectorAll('.stage-ctl[role="slider"]').length,
    readouts: document.querySelectorAll('.readout').length,
    series: document.querySelectorAll('path.chart-series').length
  }));
  assert(state.handles > 0, 'no on-apparatus controls');
  assert(state.readouts > 0, 'no measurements');
  assert(state.series > 0, 'the graph drew no series');
  return `${state.handles} handles, ${state.readouts} readings, ${state.series} series`;
});

await check('moving a control recomputes the model', async () => {
  const before = await page.locator('.readout-cell').first().innerText();
  const handle = page.locator('.stage-ctl[role="slider"]').first();
  await handle.focus();
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  const after = await page.locator('.readout-cell').first().innerText();
  assert(before !== after, 'the reading did not change when the control moved');
  return `${before.replace(/\s+/g, ' ')} → ${after.replace(/\s+/g, ' ')}`;
});

await check('the graph follows the model', async () => {
  // A straight line through the origin keeps the same path under auto-scaling,
  // so what has to move is the operating point, the axis and the marker.
  const snapshot = () =>
    page.evaluate(() => {
      const live = document.querySelector('circle[stroke="#25d0ee"]');
      return {
        live: live ? `${live.getAttribute('cx')},${live.getAttribute('cy')}` : null,
        ticks: [...document.querySelectorAll('.chart-tick')].map((t) => t.textContent).join('|'),
        marker: document.querySelector('.chart-marker-label')?.textContent ?? null
      };
    });

  const before = await snapshot();
  const load = page.locator('.stage-ctl[role="slider"]').nth(2);
  await load.focus();
  for (let i = 0; i < 20; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const after = await snapshot();

  assert(before.live && after.live, 'the graph shows no operating point');
  assert(before.live !== after.live, 'the operating point did not move');
  assert(before.ticks !== after.ticks, 'the axis did not rescale');
  assert(before.marker !== after.marker, 'the marker label did not update');
  return 'operating point, axis and marker all tracked';
});

await check('a curved series is re-plotted from the model', async () => {
  await go('/simulators/physics/single-slit-diffraction');
  await page.waitForSelector('svg.svg-lab', { timeout: 15_000 });
  const before = await page.locator('path.chart-series').first().getAttribute('d');
  const slit = page.locator('.stage-ctl[role="slider"]').nth(1);
  await slit.focus();
  for (let i = 0; i < 25; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const after = await page.locator('path.chart-series').first().getAttribute('d');
  assert(before !== after, 'the diffraction curve did not change shape');
  return 'sinc² curve redrawn';
});

await check('a keyboard user can operate the apparatus', async () => {
  const info = await page.evaluate(() => {
    const h = document.querySelector('.stage-ctl[role="slider"]');
    return {
      label: h?.getAttribute('aria-label'),
      now: h?.getAttribute('aria-valuenow'),
      text: h?.getAttribute('aria-valuetext')
    };
  });
  assert(info.label, 'a handle has no accessible name');
  assert(info.now !== null, 'a handle announces no value');
  assert(info.text, 'a handle announces no readable value');
  return info.label.slice(0, 40);
});

await check('the notebook records a trial and computes derived columns', async () => {
  await page.click('button:has-text("Record reading")');
  await page.waitForSelector('table.notebook-table');
  const rows = await page.locator('table.notebook-table tbody tr').count();
  assert(rows === 1, `expected one row, found ${rows}`);
  const body = await page.locator('table.notebook-table').innerText();
  assert(!/NaN/.test(body), 'the observation table contains NaN');
  return `${rows} trial recorded`;
});

await check('the notebook survives a reload', async () => {
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('svg.svg-lab', { timeout: 15_000 });
  const rows = await page.locator('table.notebook-table tbody tr').count();
  assert(rows >= 1, 'the recorded trial was lost on reload');
  return 'persisted';
});

await check('the notebook clears', async () => {
  await page.click('button:has-text("Clear")');
  await page.waitForTimeout(200);
  const table = await page.locator('table.notebook-table').count();
  assert(table === 0, 'the table survived Clear');
  return 'cleared';
});

await check('the education tabs switch', async () => {
  await page.click('button[role="tab"]:has-text("Formulae")');
  await page.waitForTimeout(150);
  const formulae = await page.locator('.formula-list li').count();
  assert(formulae > 0, 'the formulae tab is empty');
  await page.click('button[role="tab"]:has-text("Viva")');
  await page.waitForTimeout(150);
  const viva = await page.locator('.viva-list dt').count();
  assert(viva > 0, 'the viva tab is empty');
  return `${formulae} formulae, ${viva} viva questions`;
});

await check('Reset apparatus restores the defaults', async () => {
  await go('/simulators/physics/ohms-law');
  await page.waitForSelector('svg.svg-lab', { timeout: 15_000 });
  const reset = page.locator('button:has-text("Reset apparatus")');
  assert((await reset.count()) > 0, 'there is no reset control');
  assert(await reset.isDisabled(), 'reset is offered before anything has been changed');

  const handle = page.locator('.stage-ctl[role="slider"]').first();
  const start = await handle.getAttribute('aria-valuenow');
  await handle.focus();
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  assert(await reset.isEnabled(), 'reset stayed disabled after a control moved');

  await reset.click();
  await page.waitForTimeout(250);
  const back = await handle.getAttribute('aria-valuenow');
  assert(back === start, `the control read ${back} after reset, expected ${start}`);
  assert(await reset.isDisabled(), 'reset stayed enabled after restoring the defaults');
  return `returned to ${start}`;
});

await check('the language switch reaches the apparatus', async () => {
  await go('/simulators');
  await page.waitForSelector('.exp-card');
  const english = await page.locator('.exp-card').first().innerText();
  await page.click('button[aria-label="Switch to Hindi"]');
  await page.waitForTimeout(300);
  const hindi = await page.locator('.exp-card').first().innerText();
  assert(hindi !== english, 'the catalogue did not change language');
  assert(/[ऀ-ॿ]/.test(hindi), 'no Devanagari appeared');
  await page.click('button[aria-label="अंग्रेज़ी में देखें"]');
  await page.waitForTimeout(300);
  return 'English ⇄ Devanagari';
});

await check('favourites persist across a reload', async () => {
  await go('/simulators');
  await page.waitForSelector('.exp-card');
  const star = page.locator('.exp-card-fav').first();
  await star.click();
  await page.waitForTimeout(200);
  assert((await star.getAttribute('aria-pressed')) === 'true', 'the star did not turn on');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.exp-card');
  const again = await page.locator('.exp-card-fav').first().getAttribute('aria-pressed');
  assert(again === 'true', 'the favourite was lost on reload');
  await page.locator('.exp-card-fav').first().click();
  return 'stored in this browser';
});

await check('the unit pages describe the curriculum', async () => {
  await go('/class-12');
  await page.waitForSelector('.unit-card');
  const cards = await page.locator('.unit-card').count();
  const text = await page.locator('.unit-grid').innerText();
  assert(cards >= 9, `only ${cards} units listed`);
  assert(/marks/.test(text), 'no mark weighting is shown');
  return `${cards} units with weighting`;
});

await check('an unknown route lands somewhere useful', async () => {
  await go('/simulators/physics/not-a-real-experiment');
  const body = await page.locator('body').innerText();
  assert(/No apparatus on this bench|not exist/i.test(body), 'no not-found page');
  return 'not-found page shown';
});

await check('nothing logged an error along the way', async () => {
  assert(consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
  return 'clean console';
});

await browser.close();

console.log(`\nFunctional audit · ${FILE ? 'index.html over file://' : DEV}`);
for (const line of results) console.log(line);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
process.exitCode = failures.length > 0 ? 1 : 0;

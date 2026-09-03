import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');
const SHIPPED = ['index.html', 'portable/virtual-physics-lab.html'];

/**
 * `index.html` at the repo root is the deliverable: the file a student opens
 * straight off disk, with no server, no network and no build step. It once
 * regressed into a bare Vite template whose only script pointed at
 * `/src/main.tsx`, which resolves to nothing on a filesystem — a blank screen.
 * These checks fail the build rather than let that ship again.
 */
describe('the shipped single-file lab', () => {
  it.each(SHIPPED)('%s exists and is a whole application', (rel) => {
    const path = join(ROOT, rel);
    expect(existsSync(path), `${rel} is missing — run npm run build:portable`).toBe(true);
    // The bundle is several hundred kB; a template is one or two.
    expect(statSync(path).size, `${rel} is too small to contain the lab`).toBeGreaterThan(300_000);
  });

  it.each(SHIPPED)('%s references nothing outside itself', (rel) => {
    const html = readFileSync(join(ROOT, rel), 'utf8');

    // A src= on a script, or an href= that is not a data: URI, would be fetched
    // at open time — and from file:// that fetch fails silently.
    const externalScript = html.match(/<script[^>]+\ssrc=["'][^"']+["']/i);
    expect(externalScript?.[0] ?? null, `${rel} loads an external script`).toBeNull();

    const externalLink = html.match(/<link[^>]+href=["'](?!data:)[^"']+["']/i);
    expect(externalLink?.[0] ?? null, `${rel} loads an external stylesheet or font`).toBeNull();

    expect(html, `${rel} still points at the TypeScript entry`).not.toMatch(/main\.tsx|entry\.ts/);
    expect(html, `${rel} has an absolute asset path`).not.toMatch(/(?:src|href)=["']\/assets\//);
  });

  it.each(SHIPPED)('%s carries the mount point, the styles and the bundle', (rel) => {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    expect(html, `${rel} has no mount point`).toContain('id="root"');
    expect(html, `${rel} has no module script`).toMatch(/<script type="module">/);
    // The design tokens must travel with it, or the lab opens unstyled.
    expect(html, `${rel} carries no stylesheet`).toMatch(/<style>[\s\S]*--primary:/);
    // A few load-bearing class names the audit and the app both depend on.
    for (const marker of ['svg-lab', 'stage-ctl', 'chart-series', 'viewport-stage']) {
      expect(html, `${rel} is missing "${marker}"`).toContain(marker);
    }
  });

  it.each(SHIPPED)('%s tells a reader with JavaScript off what happened', (rel) => {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    expect(html).toContain('<noscript>');
  });

  it('keeps the Vite template out of the shipped path', () => {
    const template = join(ROOT, 'app/index.html');
    expect(existsSync(template), 'app/index.html is the build template and must exist').toBe(true);
    // Building must never overwrite the template it was built from.
    expect(statSync(template).size).toBeLessThan(10_000);
    expect(readFileSync(template, 'utf8')).toContain('./entry.ts');
  });

  it('ships the same bytes to both locations', () => {
    const [a, b] = SHIPPED.map((rel) => readFileSync(join(ROOT, rel), 'utf8'));
    expect(a).toBe(b);
  });
});

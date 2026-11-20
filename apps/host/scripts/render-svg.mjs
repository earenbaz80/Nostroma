/**
 * Render SVG files to PNG with the Playwright Chromium.
 *
 *   node scripts/render-svg.mjs <jobs.json>
 *
 * The jobs file is a list of { "svg", "png", "width", "height" }: the SVG is
 * read here and placed at exactly that pixel size, then captured with a
 * transparent background. Reading and placing the markup avoids file://
 * altogether, which matters for a snap-packaged browser that cannot see /tmp.
 * One browser renders the whole list, so a batch pays the launch cost once.
 *
 * Called by apps/host/scripts/prepare-brand-lockups.py --png-chromium. It exits
 * 2 with a message when there is no browser, so the caller can report a skip.
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findChromium } from './browser.mjs';

const [, , jobsPath] = process.argv;
if (!jobsPath) {
  console.error('usage: node scripts/render-svg.mjs <jobs.json>');
  process.exit(2);
}

const executablePath = findChromium();
if (!executablePath) {
  console.error('no Chromium found. Set STRATA_CHROME, or install Chrome, Edge, Chromium or Brave.');
  process.exit(2);
}

const jobs = JSON.parse(readFileSync(jobsPath, 'utf8'));
const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();

for (const { svg, png, width, height } of jobs) {
  const source = readFileSync(resolve(svg)).toString('base64');
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0;background:transparent}` +
      `img{display:block}</style>` +
      `<img src="data:image/svg+xml;base64,${source}" style="width:${width}px;height:${height}px">`,
  );
  await page.screenshot({ path: resolve(png), omitBackground: true });
}

await browser.close();

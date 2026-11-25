#!/usr/bin/env node
/**
 * The installer's pictures, drawn from the app's own design: the light surface and ink colours of the app (src/styles tokens), the
 * brand lockup and mark files, and the app's own face, Exo 2, for the words (baked into the pictures, because NSIS cannot
 * use a web font).
 *
 *   node apps/desktop/scripts/make-installer-images.mjs [--out <folder>] [--preview <folder>]
 *
 * Writes sidebar.bmp (164x314, the welcome and finish pages) and header.bmp (150x57, the other pages) as 24-bit BMPs, and with
 * --preview the same as PNGs at 3x.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const here = dirname(fileURLToPath(import.meta.url));
const host = resolve(here, '../../host');
const out = resolve(args.out ?? join(here, '../src-tauri/nsis'));
mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(join(host, 'node_modules/playwright-core/index.mjs')).href).catch(() => import('playwright-core'));
const CHROME = process.env.CHROME ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync);
// the face the app sets, one variable file for both weights the pictures use
const font = pathToFileURL(join(host, 'public/fonts/Exo2-Variable.woff2')).href;
const lockup = readFileSync(join(host, 'public/brand/nostroma-lockup-light.svg'), 'utf8');
const mark = readFileSync(join(host, 'public/brand/nostroma-mark-light.svg'), 'utf8');

// the app's light tokens, from src/styles/nostroma-crt.css: amber paper under amber ink
const SURFACE = '#fbf4e3', PAPER = '#f3e8d2', INK = '#2b1e0a', MUTED = '#6b5228', ACCENT = '#8f5200', LINE = '#d7c39b';
const css = `@font-face{font-family:UI;font-weight:400 900;src:url(${font})}
*{box-sizing:border-box}body{margin:0;font-family:UI,'Segoe UI',sans-serif;color:${INK};background:${SURFACE}}`;

const pages = {
  sidebar: { w: 164, h: 314, html: `<div style="width:164px;height:314px;padding:22px 18px;display:flex;flex-direction:column;background:linear-gradient(180deg,${SURFACE} 0%,${PAPER} 100%);border-right:1px solid ${LINE}">
    <div style="height:26px">${lockup.replace('<svg', '<svg style="height:26px;width:auto;display:block"')}</div>
    <div style="margin-top:auto">
      <div style="font-weight:700;font-size:22px;line-height:1.12;letter-spacing:-.01em">State of<br>the art.<br>At home.</div>
      <div style="margin-top:10px;font-weight:500;font-size:11px;line-height:1.5;letter-spacing:-.01em;color:${MUTED}">AI on your own computer.<br>Private. Fast. Easy.</div>
      <div style="margin-top:16px;height:3px;width:34px;background:${ACCENT}"></div>
    </div></div>` },
  header: { w: 150, h: 57, html: `<div style="width:150px;height:57px;display:flex;align-items:center;justify-content:flex-end;padding-right:12px;background:${SURFACE}">${lockup.replace('<svg', '<svg style="height:22px;width:auto;display:block"')}</div>` },
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const work = join(tmpdir(), 'nostroma-installer-images'); mkdirSync(work, { recursive: true });
for (const [name, page] of Object.entries(pages)) {
  for (const scale of [1, 3]) {
    const file = join(work, `${name}.html`);
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${page.html}</body>`);
    const tab = await browser.newPage({ viewport: { width: page.w, height: page.h }, deviceScaleFactor: scale });
    await tab.goto(pathToFileURL(file).href);
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(200);
    const png = join(work, `${name}@${scale}.png`);
    await tab.screenshot({ path: png, clip: { x: 0, y: 0, width: page.w, height: page.h } });
    await tab.close();
    if (scale === 3 && args.preview) { mkdirSync(resolve(args.preview), { recursive: true }); writeFileSync(join(resolve(args.preview), `${name}.png`), readFileSync(png)); }
  }
}
await browser.close();
// 24-bit BMP, the format NSIS wants: render at 3x, shrink with a good filter
const py = `import sys\nfrom PIL import Image\nfor name in ('sidebar','header'):\n    im = Image.open(sys.argv[1] + '/' + name + '@3.png').convert('RGB')\n    w, h = im.width // 3, im.height // 3\n    im.resize((w, h), Image.LANCZOS).save(sys.argv[2] + '/' + name + '.bmp', 'BMP')\n`;
// `python` is the name on Windows and on macOS with python.org builds; a Linux distribution usually ships
// only `python3`, so fall back to it when the first name does not exist at all.
const bmp = (bin) => spawnSync(bin, ['-c', py, work, out], { encoding: 'utf8' });
let done = bmp('python');
if (done.error?.code === 'ENOENT') done = bmp('python3');
if (done.error) { console.error(`cannot run python: ${done.error.message}`); process.exit(1); }
if (done.status !== 0) { console.error(done.stderr); process.exit(1); }
console.log('wrote', join(out, 'sidebar.bmp'), join(out, 'header.bmp'));

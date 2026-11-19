#!/usr/bin/env node
/**
 * The app and installer icon: the N monogram of apps/host/public/favicon.svg, on the CRT tile, in the amber of the theme.
 * The same relative geometry is used at every size, so the drawing in the tab, the window and the installers is one mark.
 * At 32 px and below the mark keeps a little less margin, which is what keeps the N readable there.
 *
 *   node apps/desktop/scripts/make-icons.mjs [--out <folder>]    writes icon-<size>.png, icon.png (512), icon.ico and icon.icns
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const here = dirname(fileURLToPath(import.meta.url));
const host = resolve(here, '../../host');
const out = resolve(args.out ?? join(here, '../src-tauri/icons'));
mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(join(host, 'node_modules/playwright-core/index.mjs')).href).catch(() => import('playwright-core'));
const CHROME = process.env.CHROME ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/snap/bin/brave'].find(existsSync);

const TILE = '#0b0803', BAR = '#ffb000', DIAGONAL = '#ffe7c2';

/** The mark on a square tile. The bars and the diagonal are the units of favicon.svg (a 48-unit box). */
function svg(size) {
  const pad = size <= 32 ? 10 : 12;
  const off = size * pad / 100, k = size * (1 - 2 * pad / 100) / 48;
  const at = (x, y) => `${(off + x * k).toFixed(2)},${(off + y * k).toFixed(2)}`;
  const bars = [[4, 6], [34, 6]].map(([x, y]) => `<rect x="${(off + x * k).toFixed(2)}" y="${(off + y * k).toFixed(2)}" width="${(10 * k).toFixed(2)}" height="${(36 * k).toFixed(2)}" fill="${BAR}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${TILE}"/>${bars}` +
    `<polygon points="${at(14, 6)} ${at(22, 6)} ${at(34, 42)} ${at(26, 42)}" fill="${DIAGONAL}"/></svg>`;
}

const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512, 1024];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const png = {};
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">${svg(size)}</body>`);
  png[size] = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  writeFileSync(join(out, `icon-${size}.png`), png[size]);
}
await browser.close();

// The .ico: one PNG image per size (16-256), the sizes Windows asks for at 100-250% scaling.
const ICO = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(ICO.length, 4);
let offset = 6 + 16 * ICO.length;
const entries = [], blobs = [];
for (const size of ICO) {
  const data = png[size], e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0); e.writeUInt8(size === 256 ? 0 : size, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
  offset += data.length; entries.push(e); blobs.push(data);
}
writeFileSync(join(out, 'icon.ico'), Buffer.concat([head, ...entries, ...blobs]));

// The .icns: PNG images in the retina slots macOS asks for (16@2x up to 512@2x).
const ICNS = [['ic11', 32], ['ic12', 64], ['ic07', 128], ['ic13', 256], ['ic08', 256], ['ic14', 512], ['ic09', 512], ['ic10', 1024]];
const body = ICNS.map(([type, size]) => {
  const t = Buffer.from(type, 'ascii'), len = Buffer.alloc(4);
  len.writeUInt32BE(8 + png[size].length, 0);
  return Buffer.concat([t, len, png[size]]);
});
const icnsHead = Buffer.alloc(8); icnsHead.write('icns', 0, 'ascii');
icnsHead.writeUInt32BE(8 + body.reduce((n, b) => n + b.length, 0), 4);
writeFileSync(join(out, 'icon.icns'), Buffer.concat([icnsHead, ...body]));

writeFileSync(join(out, 'icon.png'), png[512]);
console.log('icons in', out, ICO.join(','));

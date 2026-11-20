/**
 * Render the committed lockup SVGs with Chromium and compare them with the PNGs
 * that apps/host/scripts/prepare-brand-lockups.py writes.
 *
 *   npm run brand:png-vs-svg                 (in apps/host)
 *   node scripts/brand-png-check.mjs [--max-channel 32] [--max-share 0.02]
 *
 * The PNGs come from Pillow drawing the same outlines, which is a second
 * implementation of the picture. This check renders the SVG that is committed,
 * at the PNG's own size, and diffs the two, so a PNG that stopped matching the
 * picture fails here instead of shipping.
 *
 * Chromium comes from scripts/browser.mjs: STRATA_CHROME, a cached Playwright
 * build, or an installed Chrome, Edge, Chromium or Brave. With no browser the
 * check prints a skip line and exits 0, so the asset workflow never depends on
 * one.
 *
 * The two renderers are not expected to agree pixel for pixel: Pillow fills
 * polygons without antialiasing and lands the edges on slightly different
 * subpixels than Chromium does. A pixel of the SVG render counts as different
 * only when no pixel within one step of it in the PNG is closer than
 * --max-channel, and the check fails when more than --max-share of the pixels
 * are that far off. That catches a missing mark, a changed colour or a
 * different word while ignoring edge antialiasing.
 */
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findChromium } from './browser.mjs';

const BRAND = resolve('public/brand');
const PREFIX = 'strata-lockup-';

function options(argv) {
  const parsed = { maxChannel: 64, maxShare: 0.01 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--max-channel') parsed.maxChannel = Number(argv[++index]);
    else if (flag === '--max-share') parsed.maxShare = Number(argv[++index]);
    else if (flag === '--help' || flag === '-h') parsed.help = true;
    else {
      console.error(`Unknown option: ${flag}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(parsed.maxChannel) || !Number.isFinite(parsed.maxShare)) {
    console.error('--max-channel and --max-share need numbers.');
    process.exit(2);
  }
  return parsed;
}

/** Width and height from a PNG's IHDR chunk, without a decoder. */
function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(12) !== 0x49484452) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const USAGE = `usage: node scripts/brand-png-check.mjs [--max-channel 64] [--max-share 0.01]

  --max-channel  how far one channel may differ before a pixel counts (0-255)
  --max-share    what share of pixels may differ before the check fails (0-1)

A pixel is forgiven when a neighbour within one step is closer than
--max-channel, so edge antialiasing does not count as a difference.`;

const { maxChannel, maxShare, help } = options(process.argv.slice(2));
if (help) {
  console.log(USAGE);
  process.exit(0);
}

const pairs = [];
const withoutPng = [];
for (const name of readdirSync(BRAND).sort()) {
  if (!name.startsWith(PREFIX) || !name.endsWith('.svg')) continue;
  const svg = join(BRAND, name);
  const png = join(BRAND, name.replace(/\.svg$/, '.png'));
  if (existsSync(png)) pairs.push({ name, svg, png });
  else withoutPng.push(name);
}

for (const name of withoutPng) {
  console.log(`skip: ${name} has no PNG beside it; run the Python script with --png first`);
}
if (!pairs.length) {
  console.log('skip: no lockup PNGs to compare; the SVG check still covers the pictures');
  process.exit(0);
}

const executablePath = findChromium();
if (!executablePath) {
  console.log('skip: no Chromium found, so the PNGs were not compared with their SVGs.');
  console.log('      Set STRATA_CHROME, or install Chrome, Edge, Chromium or Brave.');
  process.exit(0);
}

const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1'],
});

const shot = await browser.newPage();
const differ = await browser.newPage();
let failures = 0;

for (const { name, svg, png } of pairs) {
  const pngBuffer = readFileSync(png);
  const size = pngSize(pngBuffer);
  if (!size) {
    console.log(`${name}: FAIL, the PNG header could not be read`);
    failures += 1;
    continue;
  }

  const source = readFileSync(svg).toString('base64');
  await shot.setViewportSize({ width: size.width, height: size.height });
  await shot.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">` +
      `<img src="data:image/svg+xml;base64,${source}" ` +
      `style="display:block;width:${size.width}px;height:${size.height}px">` +
      `</body></html>`,
  );
  const rendered = await shot.screenshot({ omitBackground: true });

  const left = `data:image/png;base64,${rendered.toString('base64')}`;
  const right = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  const result = await differ.evaluate(
    async ({ left, right, maxChannel }) => {
      const load = async (url) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return {
          width: canvas.width,
          height: canvas.height,
          data: context.getImageData(0, 0, canvas.width, canvas.height).data,
        };
      };
      const a = await load(left);
      const b = await load(right);
      if (a.width !== b.width || a.height !== b.height) {
        return { sizeMismatch: [a.width, a.height, b.width, b.height] };
      }
      const { width, height } = a;
      const channelGap = (x, y) => {
        const index = (y * width + x) * 4;
        // a pixel that is transparent in both is the same pixel, hidden colour aside
        if (a.data[index + 3] === 0 && b.data[index + 3] === 0) return 0;
        return Math.max(
          Math.abs(a.data[index] - b.data[index]),
          Math.abs(a.data[index + 1] - b.data[index + 1]),
          Math.abs(a.data[index + 2] - b.data[index + 2]),
          Math.abs(a.data[index + 3] - b.data[index + 3]),
        );
      };

      let over = 0;
      let max = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let best = 255;
          for (let dy = -1; dy <= 1; dy += 1) {
            const near = y + dy;
            if (near < 0 || near >= height) continue;
            for (let dx = -1; dx <= 1; dx += 1) {
              const side = x + dx;
              if (side < 0 || side >= width) continue;
              const gap = channelGap(side, near);
              if (gap < best) best = gap;
            }
          }
          if (best > max) max = best;
          if (best > maxChannel) over += 1;
        }
      }
      return { over, max, total: a.width * a.height };
    },
    { left, right, maxChannel },
  );

  if (result.sizeMismatch) {
    const [aw, ah, bw, bh] = result.sizeMismatch;
    console.log(`${name}: FAIL, the SVG renders ${aw}x${ah} but the PNG is ${bw}x${bh}`);
    failures += 1;
    continue;
  }

  const share = result.total ? result.over / result.total : 0;
  const ok = share <= maxShare;
  if (!ok) failures += 1;
  console.log(
    `${name}: ${size.width}x${size.height}, largest channel difference ${result.max}, ` +
      `${(share * 100).toFixed(2)}% of pixels past ${maxChannel} (limit ${(maxShare * 100).toFixed(2)}%) ` +
      `- ${ok ? 'ok' : 'FAIL'}`,
  );
}

await browser.close();
process.exit(failures ? 1 : 0);

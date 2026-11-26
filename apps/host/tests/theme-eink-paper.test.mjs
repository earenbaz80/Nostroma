import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* The skin's promise, as CSS: e-ink is paper. No scanline or vignette, no pane
   of glass, no map under the page. Each of those is a token the rest of the app
   reads, so a refactor that puts a value back here brings the texture back
   everywhere at once and nothing else in the suite would notice.

   Written against the sheet rather than the browser: these are token
   declarations, and a headless pass would need a browser for three values. */

const read = relative => readFileSync(fileURLToPath(new URL(`../src/${relative}`, import.meta.url)), 'utf8');

/** The declarations of the one block whose selector is exactly `selector`. */
function declarations(css, selector) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const match = text.match(pattern);
  assert.ok(match, `no block for ${selector}`);
  const out = new Map();
  for (const [, name, value] of match[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name, value.replace(/\s+/g, ' ').trim());
  }
  return out;
}

const EINK = "[data-skin='eink']";
const crt = read('styles/nostroma-crt.css');
const eink = declarations(crt, EINK);

test('the E-ink block exists and owns the skin tokens', () => {
  assert.ok(eink.size > 10, `expected the palette block, got ${eink.size} declarations`);
  assert.equal(eink.get('st-bg'), '#f4f4ef');
});

test('E-ink turns the CRT texture off instead of tinting it', () => {
  /* body::after paints a repeating scanline from --st-crt-line and a falloff
     from --st-crt-vignette. Transparent is what switches both off for this skin;
     a colour of any alpha, however faint, puts the phosphor back on paper. */
  assert.equal(eink.get('st-crt-line'), 'transparent');
  assert.equal(eink.get('st-crt-vignette'), 'transparent');
});

test('the sidebar is paper, not a pane of glass', () => {
  /* liquid.css gives .nav a 68% tint of --st-surface over a backdrop blur. The
     app's own "opaque" switch flattens the page behind it but leaves this token
     alone, so the skin has to name the surface itself. */
  assert.equal(eink.get('st-nav-material'), 'var(--st-surface)');
});

test('the materials that blur and tint elsewhere are flat here', () => {
  for (const blur of ['st-material-thin', 'st-material-regular', 'st-material-thick']) {
    assert.equal(eink.get(blur), 'none', `${blur} still blurs`);
  }
  assert.equal(eink.get('st-material-tint'), 'var(--st-surface)');
  assert.equal(eink.get('st-material-tint-strong'), 'var(--st-surface)');
  assert.equal(eink.get('st-specular'), 'transparent');
});

test('no map is drawn under the page', () => {
  /* body paints --st-map-image behind a veil mixed from --st-bg, so both have to
     go: the image to none and the veil to transparent. */
  assert.equal(eink.get('st-map-image'), 'none');
  assert.equal(eink.get('st-map-veil'), 'transparent');
});

test('the skin loads after the sheets it overrides, and nothing later re-declares these tokens', () => {
  /* Equal-specificity root blocks are won by import order: liquid.css sets the
     translucent sidebar and the map at :root, and nostroma-crt.css has to come
     after it. Moving this sheet up, or adding a later sheet that re-declares the
     same tokens, would undo every assertion above without changing any of them. */
  const main = read('main.tsx');
  const imported = [...main.matchAll(/import\s+'\.\/styles\/([\w./-]+\.css)'/g)].map(m => m[1]);
  const skin = imported.indexOf('nostroma-crt.css');
  const liquid = imported.indexOf('liquid.css');
  assert.ok(skin >= 0 && liquid >= 0, 'both sheets are imported from main.tsx');
  assert.ok(skin > liquid, `nostroma-crt.css must load after liquid.css, got ${liquid} and ${skin}`);

  for (const after of imported.slice(skin + 1)) {
    const sheet = read(`styles/${after}`);
    for (const token of ['st-crt-line', 'st-crt-vignette', 'st-nav-material', 'st-map-image', 'st-map-veil', 'st-material-thin', 'st-material-tint']) {
      assert.ok(!new RegExp(`--${token}\\s*:`).test(sheet), `${after} loads after nostroma-crt.css and re-declares --${token}`);
    }
  }
});

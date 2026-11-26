import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/* store.ts reads these at module load and applyPrefs writes them on <html>. */
let systemDark = false;
const root = {
  dataset: {},
  lang: '',
  style: {
    setProperty() {},
    removeProperty() {},
  },
};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en', languages: ['en'] }, configurable: true });
globalThis.matchMedia = () => ({
  matches: systemDark,
  addEventListener() {},
  removeEventListener() {},
});
globalThis.document = {
  documentElement: root,
  querySelector: () => ({ setAttribute() {} }),
};

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/store.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  loader: { '.json': 'json' },
});
const store = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('themeScheme maps system, light, dark and every skin to the right base', () => {
  assert.equal(store.themeScheme('system', false), 'light');
  assert.equal(store.themeScheme('system', true), 'dark');
  assert.equal(store.themeScheme('light', true), 'light');
  assert.equal(store.themeScheme('dark', false), 'dark');
  for (const skin of ['matrix', 'solarized', 'commander']) {
    assert.equal(store.themeScheme(skin, false), 'dark', `${skin} rides on the dark CRT`);
  }
  /* E-ink is printed on paper, so it takes the light base whoever the OS is. */
  assert.equal(store.themeScheme('eink', false), 'light');
  assert.equal(store.themeScheme('eink', true), 'light');
});

test('themeSkin returns the four skins and null for the base themes', () => {
  for (const skin of ['matrix', 'solarized', 'commander', 'eink']) assert.equal(store.themeSkin(skin), skin);
  for (const base of ['system', 'light', 'dark']) assert.equal(store.themeSkin(base), null);
});

test('setTheme writes data-theme and removes data-skin when leaving a skin', () => {
  store.setTheme('matrix');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.skin, 'matrix');

  store.setTheme('solarized');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.skin, 'solarized');

  store.setTheme('commander');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.dataset.skin, 'commander');

  store.setTheme('eink');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.dataset.skin, 'eink');

  store.setTheme('light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal('skin' in root.dataset, false);

  store.setTheme('dark');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal('skin' in root.dataset, false);
});

test('system follows the OS and never leaves a skin behind', () => {
  store.setTheme('solarized');
  assert.equal(root.dataset.skin, 'solarized');

  systemDark = false;
  store.setTheme('system');
  assert.equal(root.dataset.theme, 'light');
  assert.equal('skin' in root.dataset, false);

  systemDark = true;
  store.setTheme('system');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal('skin' in root.dataset, false);
});

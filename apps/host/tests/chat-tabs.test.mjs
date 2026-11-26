// The chats open in the header are tabs: a chat opens when it is chosen, the
// newest sits in front, and closing a tab closes the tab, not the chat.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

/* The store reads the browser for its saved preferences; it is loaded here the
   same way it is under the page. */
globalThis.window ??= globalThis;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.document ??= { documentElement: { dataset: {} }, addEventListener() {}, removeEventListener() {} };
const memory = new Map();
globalThis.localStorage ??= { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => memory.delete(k), key: () => null };
globalThis.navigator ??= { language: 'en' };

const root = resolve(import.meta.dirname, '..');
const bundle = await build({
  stdin: { contents: "import { getState, openTab, closeTab } from './src/lib/store.ts';\nexport { getState, openTab, closeTab };", resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
});
const dir = mkdtempSync(join(tmpdir(), 'nostroma-tabs-'));
const file = join(dir, 'tabs.cjs');
writeFileSync(file, bundle.outputFiles[0].text);
const { getState, openTab, closeTab } = createRequire(import.meta.url)(file);
const tabs = () => getState().tabs;

test('a chosen chat opens a tab, newest in front, and choosing it again brings it forward', () => {
  openTab('s_a');
  openTab('s_b');
  assert.deepEqual(tabs().slice(0, 2), ['s_b', 's_a'], 'the newest chat is in front');
  openTab('s_a');
  assert.deepEqual(tabs().slice(0, 2), ['s_a', 's_b'], 'an open chat moves to the front, it is not opened twice');
  assert.equal(new Set(tabs()).size, tabs().length, 'no chat has two tabs');
});

test('closing a tab removes only that tab, and the chat stays in the list', () => {
  openTab('s_c');
  closeTab('s_b');
  assert.ok(!tabs().includes('s_b'));
  assert.ok(tabs().includes('s_c'));
  assert.equal(tabs().filter(id => id === 's_c').length, 1, 'the other tabs are untouched');
});

test('the open tabs are remembered for the next start, apart from the chat files', () => {
  assert.equal(JSON.parse(memory.get('nostroma.tabs.v1')).includes('s_c'), true);
  assert.equal(JSON.parse(memory.get('nostroma.tabs.v1')).includes('s_b'), false);
});

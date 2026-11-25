/**
 * The five defaults the app applies (P0-5): the conversation context, the request slots, the KV format, the
 * resource profile and the graphics memory the Work profile keeps free.
 *
 * They are pinned twice on purpose. shared/app-defaults.mjs is what the app reads; docs/DETAILS.md states the
 * same figures for people. A default that changes without its row in that table fails here, and so does a row
 * that no longer describes what the app does (the slot counts and the reserve are computed, not copied).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONTEXT, DEFAULT_KV, DEFAULT_PROFILE, DEFAULT_RESERVE_MIB, DEFAULT_SLOTS } from '../shared/app-defaults.mjs';
import { estimateSlots, reserveMibFor } from '../shared/memory-budget.mjs';

const read = url => readFileSync(new URL(url, import.meta.url), 'utf8');
const docs = read('../../../docs/DETAILS.md');
const start = docs.indexOf('## Defaults the app applies');
assert.ok(start >= 0, 'docs/DETAILS.md has the "Defaults the app applies" section');
const next = docs.indexOf('\n## ', start + 3);
const section = docs.slice(start, next < 0 ? undefined : next);
const row = label => {
  const line = section.split('\n').find(text => text.startsWith(`| ${label} |`));
  assert.ok(line, `the table has the ${label} row`);
  return line;
};

test('the context is 128K in the app and in the table', () => {
  assert.equal(DEFAULT_CONTEXT, 131072);
  assert.match(row('Conversation context'), /128K \(131,072 tokens\)/);
});

test('the slots aim for 4, and the table says how many fit at the 128K default and at 32K', () => {
  assert.equal(DEFAULT_SLOTS, 4);
  assert.match(row('Requests at once'), /4, or fewer that fit/);
  const at = (context, gb) => estimateSlots({ context, cards: [{ vram_gb: gb }], requested: DEFAULT_SLOTS, mtp: true }).slots;
  const sizes = [12, 32, 48, 64, 72, 96];
  assert.deepEqual(sizes.map(gb => at(DEFAULT_CONTEXT, gb)), [1, 1, 2, 3, 3, 4], 'at the app default (128K)');
  assert.deepEqual([12, 16, 20, 24, 32].map(gb => at(32768, gb)), [1, 1, 2, 3, 4], 'at 32K');
  for (const words of ['1 on 12 to 32 GB', '2 on 48 GB', '3 on 64 to 72 GB', '4 from 96 GB',
    '1 on 12 to 16 GB', '2 on 20 GB', '3 on 24 GB', '4 from 32 GB']) assert.ok(row('Requests at once').includes(words), words);
});

test('the KV format is int8 in the app and in the table', () => {
  assert.equal(DEFAULT_KV, 'int8');
  assert.match(row('Conversation memory (KV)'), /`int8`/);
});

test('the resource profile is Work in the app and in the table', () => {
  assert.equal(DEFAULT_PROFILE, 'work');
  assert.match(row('Computer use (resource profile)'), /\| Work \|/);
});

test('the reserve the Work profile keeps free is the one the table states, card by card', () => {
  const card = (gb, display = true) => [{ index: 0, vram_gb: gb, drives_display: display }];
  assert.equal(DEFAULT_RESERVE_MIB.display, 1536);
  assert.equal(DEFAULT_RESERVE_MIB.pictures, 2048);
  assert.equal(DEFAULT_RESERVE_MIB.large, 1024);
  assert.equal(DEFAULT_RESERVE_MIB.headless, 512);
  assert.equal(DEFAULT_RESERVE_MIB.headlessPictures, 700);
  assert.equal(reserveMibFor(card(12), 'no', 'work'), 1536, 'a 12 GB card that drives a display');
  assert.equal(reserveMibFor(card(16), 'no', 'work'), 1536, '16 GB or less');
  assert.equal(reserveMibFor(card(12), 'gpu', 'work'), 2048, 'the same card reading pictures');
  assert.equal(reserveMibFor(card(24), 'no', 'work'), 4915, 'a fifth of 24 GB');
  assert.equal(reserveMibFor(card(24, false), 'no', 'work'), 512, 'a card that drives no display');
  assert.equal(reserveMibFor(card(24, false), 'gpu', 'work'), 700, '... reading pictures');
  assert.equal(reserveMibFor(card(24), 'no', 'performance'), 1024, 'Full performance: the safety floor above 16 GB');
  const reserve = row('Graphics memory kept free (Work)');
  for (const words of ['1,536 MiB', '2,048 MiB', 'a fifth of a card above 16 GB', '4,915 MiB on 24 GB', '512 MiB', '700 MiB']) assert.ok(reserve.includes(words), words);
});

test('the estimator opens at the same 128K, and the slots comment no longer promises 4', () => {
  const experience = read('../src/lib/experience.ts');
  assert.match(experience, /import \{ DEFAULT_CONTEXT \} from '\.\.\/\.\.\/shared\/app-defaults\.mjs'/);
  assert.match(experience, /context: DEFAULT_CONTEXT/);
  assert.match(experience, /context = DEFAULT_CONTEXT/);
  assert.match(experience, /RECOMMENDED_CONTEXT_TOKENS = DEFAULT_CONTEXT/);
  assert.doesNotMatch(experience, /\b32768\b/, 'no 32K default is left in the estimator');
  const parallel = read('../server/native-parallel.mjs');
  assert.match(parallel, /aims for 4 request slots/, '4 is the aim, not what every model loads with');
  assert.match(parallel, /4 slots at 128K/, 'the comment sizes the slots at the context the app opens with');
  assert.doesNotMatch(parallel, /a model loads with/, 'the old sentence that promised 4 slots is gone');
});

test('the app reads these constants instead of its own copies', () => {
  const models = read('../src/components/NativeModels.tsx');
  assert.match(models, /useKept\('models\.kv', DEFAULT_KV\)/);
  assert.match(models, /useKept<'work' \| 'performance'>\('models\.profile', DEFAULT_PROFILE\)/);
  const context = read('../src/lib/default-context.ts');
  assert.match(context, /export \{ DEFAULT_CONTEXT \}/);
  const control = read('../server/native-control.mjs');
  assert.match(control, /import \{ DEFAULT_CONTEXT, DEFAULT_KV, DEFAULT_PROFILE \} from '\.\.\/shared\/app-defaults\.mjs'/);
  assert.doesNotMatch(control, /\|\|32768/, 'the host budget falls back to the app default, not to 32K');
});

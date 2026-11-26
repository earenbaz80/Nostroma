// Nono is the assistant beside the composer: two eyes whose expression says what
// the chat is doing, and a tip on click. A wrong mood would speak for the app
// while it is idle or hide a failed reply.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

/* Nono reads the store for the chat and the project; the store watches the theme
   at import time, so the browser globals it expects exist here too. */
globalThis.window ??= globalThis;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.document ??= { documentElement: { dataset: {} }, addEventListener() {}, removeEventListener() {} };
const memory = new Map();
globalThis.localStorage ??= { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => memory.delete(k) };
globalThis.navigator ??= { language: 'en' };

const root = resolve(import.meta.dirname, '..');
const entry = [
  "import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';",
  "import { Nono, gaze, eyeShift, idleGlance, nextBlinkDelay, blinkPattern, projectAnchor, trackTimeout, gazePriority, scheduleLater } from './src/components/Nono.tsx';",
  "import { ChatToolbar } from './src/components/ChatToolbar.tsx';",
  "export const page = (props) => renderToStaticMarkup(React.createElement(Nono, props));",
  "export const toolbar = () => renderToStaticMarkup(React.createElement(ChatToolbar, { session: null, items: [], selected: null, onSelect() {}, onClose() {}, onCloseTab() {}, inline: false, expanded: false, onExpand() {} }));",
  "export const look = gaze;",
  "export const shift = eyeShift;",
  "export const glance = idleGlance;",
  "export const blink = nextBlinkDelay;",
  "export const doubleBlink = blinkPattern;",
  "export const anchor = projectAnchor;",
  "export const track = trackTimeout;",
  "export const schedule = scheduleLater;",
  "export const priority = gazePriority;",
].join('\n');
/* The toolbar pulls in the whole chat chrome. Only the header button matters
   here, so its neighbours are stubbed; ChatToolbar itself is the real one. */
const stubs = new Map([
  ['./ui', 'export const Icon = () => null; export const IconBtn = () => null; export const Select = () => null;'],
  ['./Brand', 'export const Brand = () => null;'],
  ['./ChatModelPicker', 'export const ChatModelPicker = () => null;'],
  ['./ArtifactPanel', 'export const ArtifactTabs = () => null;'],
  ['./FloatingMenu', 'export const FloatingMenu = () => null;'],
  ['./Popover', 'export const Popover = () => null;'],
  ['./SubagentRow', 'export const SubagentRow = () => null;'],
  ['../app/SamplingDrawer', 'export const SamplingDrawer = () => null;'],
  ['../lib/session-log', 'export const downloadSessionLog = () => {};'],
  ['../lib/agents', 'export const runningAgents = () => 0;'],
  ['../lib/session-title', 'export const sessionTitle = () => "Test chat";'],
]);
const bundle = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /.*/ }, args => stubs.has(args.path) ? { path: args.path, namespace: 'test-stub' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'test-stub' }, args => ({ contents: stubs.get(args.path) }));
  } }],
});
const dir = mkdtempSync(join(tmpdir(), 'nostroma-nono-'));
const file = join(dir, 'nono.cjs');
writeFileSync(file, bundle.outputFiles[0].text);
const { page, toolbar, look, shift, glance, blink, doubleBlink, anchor, track, schedule, priority } = createRequire(import.meta.url)(file);

test('idle Nono has two eyes and no tip open', () => {
  const html = page({});
  assert.match(html, /data-mood="idle"/);
  assert.equal((html.match(/class="nono__eye"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /nono__pupil/, 'the eyes are solid rectangles, with no pupils');
  assert.doesNotMatch(html, /nono__tip/);
  assert.match(html, /aria-label="Nono, the assistant"/);
});

test('the eyes look towards the pointer, up to the edge of their sockets', () => {
  assert.deepEqual(look(0, 0), { x: 0, y: 0 });
  assert.deepEqual(look(200, 0), { x: 3, y: 0 });
  assert.deepEqual(look(0, -200), { x: 0, y: -5 });
  const diagonal = look(30, 40);
  assert.ok(diagonal.x > 0 && diagonal.y > 0);
  assert.ok(Math.abs(diagonal.x) <= 3 && Math.abs(diagonal.y) <= 5);
});

test('the eye is its own pupil: the look becomes a travel up, down and to either side', () => {
  assert.deepEqual(shift(0, 0), { x: 0, y: 0 });
  assert.deepEqual(shift(3, 0), { x: 5.2, y: 0 }, 'looking right reaches the edge of the eye\'s place, over half its own width');
  assert.deepEqual(shift(-3, 0), { x: -5.2, y: 0 });
  assert.deepEqual(shift(0, 5), { x: 0, y: 6.4 }, 'looking down travels a little further than sideways');
  assert.deepEqual(shift(0, -5), { x: 0, y: -6.4 });
  assert.deepEqual(shift(3, 5, 0.5), { x: 2.6, y: 3.2 }, 'a lighter look takes half the travel');
  assert.deepEqual(shift(9, -9), { x: 5.2, y: -6.4 }, 'a look beyond the edge is held at it');
  const diagonal = shift(look(30, 40).x, look(30, 40).y);
  assert.ok(diagonal.x > 0 && diagonal.y > 0 && Math.abs(diagonal.x) <= 5.2 && Math.abs(diagonal.y) <= 6.4);
});

test('an idle glance goes up, down and to both sides, and never to the very edge', () => {
  const draws = Array.from({ length: 64 }, (_, i) => glance(() => (i % 8) / 8 + 0.01));
  assert.ok(draws.some(g => g.y < 0), 'some glances go up');
  assert.ok(draws.some(g => g.y > 0), 'some go down');
  assert.ok(draws.some(g => g.x > 0), 'some go right');
  assert.ok(draws.some(g => g.x < 0), 'some go left');
  assert.ok(draws.every(g => Math.abs(g.x) <= 5 && Math.abs(g.y) <= 6.2), 'a glance stays inside the eye\'s place');
  const reach = [glance(() => 0.01), glance(() => 0.99)].map(g => Math.hypot(g.x, g.y / 1.24));
  assert.notEqual(reach[0], reach[1], 'each glance is drawn again, not a fixed pattern');
});

test('the gaze priority is typing, a new message, the project, then the pointer', () => {
  assert.equal(priority({ typing: true, message: true, project: true, pointer: true }), 'typing');
  assert.equal(priority({ typing: false, message: true, project: true, pointer: true }), 'message');
  assert.equal(priority({ typing: false, message: false, project: true, pointer: true }), 'project');
  assert.equal(priority({ typing: false, message: false, project: false, pointer: true }), 'pointer');
  assert.equal(priority({ typing: false, message: false, project: false, pointer: false }), null);
});

test('the real chat header button carries the class Nono uses to find it', () => {
  const html = toolbar();
  assert.match(html, /<header[^>]*class="chat-toolbar"/);
  assert.match(html, /<button[^>]*class="chat-workbench-toggle"/);
  assert.equal((html.match(/class="chat-workbench-toggle"/g) ?? []).length, 1);
});

test('the project gaze uses the active row, and the Workbench button when the sidebar is collapsed', () => {
  const row = { className: 'ws__row is-active' };
  const workbench = { className: 'chat-workbench-toggle' };
  assert.equal(anchor({ querySelector: (selector) => selector === '.ws__row.is-active' ? row : null }), row);
  const asked = [];
  const collapsed = { querySelector: (selector) => { asked.push(selector); return selector === '.chat-workbench-toggle' ? workbench : null; } };
  assert.equal(anchor(collapsed), workbench);
  assert.deepEqual(asked, ['.ws__row.is-active', '.chat-workbench-toggle']);
  assert.ok(!asked.some(selector => selector.includes('aria-label')), 'the fallback does not depend on the interface language');
});

test('a timer leaves the set when it fires, so it does not grow for the whole session', () => {
  const timers = new Set();
  let fire;
  const id = track(timers, () => {}, 10, (fn) => { fire = fn; return 7; });
  assert.equal(id, 7);
  assert.deepEqual([...timers], [7]);
  fire();
  assert.equal(timers.size, 0);
});

test('a live scheduled callback runs and can schedule its follow-up', () => {
  const timers = new Set();
  const queue = [];
  let live = true, state = 0, nextId = 0;
  const set = (fn, ms) => { queue.push({ fn, ms }); return ++nextId; };
  const later = (fn, ms) => schedule(() => live, timers, fn, ms, set);
  later(() => { state += 1; later(() => { state += 1; }, 10); }, 100);
  assert.equal(queue.length, 1);
  assert.deepEqual([...timers], [1]);
  queue.shift().fn();
  assert.equal(state, 1);
  assert.equal(queue.length, 1, 'the live callback scheduled its follow-up');
  assert.deepEqual([...timers], [2]);
});

test('a callback already queued when Nono unmounts does not update state or schedule another timer', () => {
  const timers = new Set();
  const queue = [];
  let live = true, state = 0, nextId = 0;
  const set = (fn, ms) => { queue.push({ fn, ms }); return ++nextId; };
  const later = (fn, ms) => schedule(() => live, timers, fn, ms, set);
  later(() => { state += 1; later(() => { state += 1; }, 10); }, 100);
  assert.equal(queue.length, 1);
  assert.deepEqual([...timers], [1]);

  /* The timer has fired and its callback is in the event loop; React has already
     run the cleanup. Clearing the timer cannot take that callback back. */
  const queued = queue.shift();
  live = false;
  timers.clear();
  queued.fn();

  assert.equal(state, 0, 'the queued callback did not update state');
  assert.equal(queue.length, 0, 'the queued callback did not schedule another timer');
  assert.equal(timers.size, 0);
  assert.equal(later(() => { state += 1; }, 10), 0, 'nothing new is scheduled after cleanup');
  assert.equal(queue.length, 0);
});

test('the blink waits between 3 and 7.5 seconds, and is not a metronome', () => {
  assert.equal(blink(() => 0), 3000);
  assert.equal(blink(() => 0.5), 5250);
  assert.equal(blink(() => 1), 7500);
  assert.notEqual(blink(() => 0.1), blink(() => 0.2));
});

test('a double blink draws its own two lids and pause each time', () => {
  const low = doubleBlink(() => 0);
  const high = doubleBlink(() => 0.999);
  assert.deepEqual(low, { first: 80, gap: 110, second: 90 });
  assert.ok(high.first <= 150 && high.gap <= 230 && high.second <= 150);
  assert.ok(high.first > low.first && high.gap > low.gap, 'the pause and the lids vary, not only the arrival');
  assert.notDeepEqual(doubleBlink(() => 0.2), doubleBlink(() => 0.7));
});

test('a streaming reply narrows the eyes', () => {
  assert.match(page({ streaming: true }), /data-mood="thinking"/);
});

test('a failed reply wins over a mood, and turns the eyes to the danger colour', () => {
  assert.match(page({ problem: true, streaming: true }), /data-mood="oops"/);
});

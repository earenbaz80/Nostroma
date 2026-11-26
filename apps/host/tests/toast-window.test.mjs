/**
 * A notice that carries an action and its own duration (the archive/undo one, 9 s) has to be held by the pointer and by
 * focus like every other notice, and has to come back with its own window when it is let go — not with the 5.2 s an
 * ordinary notice stands. This was checked by hand in a browser before (point at the notice, wait past 9 s, move away);
 * these keep the clock's behaviour from being lost again without a browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

/* The store reads the page it runs in at import: these are the pieces it asks for and nothing else. */
globalThis.window ??= globalThis;
globalThis.document ??= {
  addEventListener() {}, removeEventListener() {}, hasFocus: () => true, visibilityState: 'visible',
  documentElement: { dataset: {}, style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} } },
};
const memory = new Map();
globalThis.localStorage ??= {
  get length() { return memory.size; }, key: (i) => [...memory.keys()][i] ?? null,
  getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, String(v)); }, removeItem: (k) => memory.delete(k),
};
globalThis.navigator ??= { language: 'en' };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

/* The host client is not what this test is about: a stub that never answers keeps the store from reaching for one. */
const mockClient = {
  name: 'mock-client',
  setup(b) {
    b.onResolve({ filter: /\/client$/ }, () => ({ path: 'mock-client', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
      loader: 'js',
      contents: `
        export class ApiError extends Error {}
        export const api = { get: async () => ({}), post: async () => ({}), put: async () => ({}), patch: async () => ({}), del: async () => ({}), delete: async () => ({}) };
        export function onEvent() { return () => {}; }
        export async function streamPost() {}`,
    }));
  },
};

/* One module graph for the store and the component that draws the notices, so the test and the UI share one copy of the
   store: pushToast here is the same function the notice's handlers reach. */
const bundle = await build({
  stdin: { contents: "export * from './src/lib/store';\nexport { Toasts } from './src/components/ui';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', jsx: 'automatic',
  alias: { react: here('./helpers/react-stub.mjs'), 'react/jsx-runtime': here('./helpers/jsx-runtime-stub.mjs') },
  loader: { '.json': 'json' }, plugins: [mockClient],
});
const store = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

/** The notice is on screen and not on its way out. */
const shown = (id) => store.useStore((s) => s.toasts.some((t) => t.id === id && !t.leaving));
/** The element the window draws for that notice, with the handlers the browser would call. */
const drawn = (id) => {
  const tree = store.Toasts();
  const nodes = tree?.props?.children;
  const notice = [].concat(nodes ?? []).find((node) => node && String(node.props?.className).includes('st-toast') && node.key === id);
  assert.ok(notice, `the window draws the notice ${id}`);
  return notice.props;
};
const undo = { label: 'Undo', run() {} };

test('a notice with its own duration is held by the pointer and focus, and resumes with its own window', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const id = store.pushToast('info', 'Chat archived', 'Nueva conversación', undo, 9000);
  assert.equal(shown(id), true, 'shown at once');

  // The pointer over it, and the keyboard on it, is the same hold (ui.tsx calls holdToast for onMouseEnter and onFocusCapture).
  store.holdToast(id);
  t.mock.timers.tick(60000);
  assert.equal(shown(id), true, 'held: well past its 9 s it is still there to be read');

  // Let go, it gets its own window again: 5.2 s would have taken an ordinary notice away.
  store.releaseToast(id);
  t.mock.timers.tick(5300);
  assert.equal(shown(id), true, 'still there after the 5.2 s an ordinary notice stands');
  t.mock.timers.tick(3700);
  assert.equal(shown(id), false, 'gone at its own 9 s');
  t.mock.timers.tick(400);

  // The clock it shares with every other notice is untouched: 5.2 s, and no window at all when it carries an action.
  const plain = store.pushToast('info', 'Model loaded');
  t.mock.timers.tick(5100);
  assert.equal(shown(plain), true, 'an ordinary notice still stands its 5.2 s');
  t.mock.timers.tick(200);
  assert.equal(shown(plain), false, 'gone at 5.2 s');
  t.mock.timers.tick(400);

  const waiting = store.pushToast('error', 'Some chats could not be saved', undefined, undo);
  store.holdToast(waiting);
  store.releaseToast(waiting);
  t.mock.timers.tick(60000);
  assert.equal(shown(waiting), true, 'a notice with an action and no window of its own waits for the reader');
});

/** Every element below a node of the stub tree, depth first: the browser's view of what the notice contains. */
const walk = (node, out = []) => {
  for (const child of [].concat(node?.props?.children ?? [])) {
    if (!child || typeof child !== 'object') continue;
    if (child.type) out.push(child);
    walk(child, out);
  }
  return out;
};

test('the live region is in the page before a notice lands, and the undo is a button the keyboard can reach', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // The notices of the tests above are still on screen (one of them waits for the reader): empty the stack first.
  for (const { id } of store.useStore((s) => s.toasts)) store.dismissToast(id);
  t.mock.timers.tick(400);

  // App.tsx mounts <Toasts /> once, so the region exists with nothing to say; a region inserted together with its text is
  // not announced by several screen readers, and the undo would then be silent.
  const empty = store.Toasts();
  assert.ok(empty, 'the region is drawn with nothing in it');
  assert.equal(empty.props['aria-live'], 'polite');
  assert.equal(empty.props['aria-relevant'], 'additions', 'a notice leaving is not a change of what was already read');
  assert.deepEqual(walk(empty), [], 'and it holds nothing');

  let ran = 0;
  const id = store.pushToast('info', 'Chat archived', 'Nueva conversación', { label: 'Undo', run() { ran++; } }, 9000);
  const region = store.Toasts();
  assert.equal(region.props['aria-live'], 'polite', 'the text lands in the region that was already there');
  const buttons = walk(region).filter((node) => node.type === 'button');
  assert.equal(buttons.length, 2, 'the notice offers its action and a way to close it');
  // The action is the plain button; the other one is the icon button that closes the notice.
  const undoButton = buttons.find((node) => !String(node.props.className).includes('st-btn--icon'));
  assert.ok(undoButton, 'the undo is a button, so Tab reaches it');
  assert.equal(typeof undoButton.props.children, 'string');
  assert.ok(undoButton.props.children.trim(), 'with a name to read');
  undoButton.props.onClick();
  assert.equal(ran, 1, 'and it is wired to the undo');
  assert.ok(buttons.some((node) => String(node.props.className).includes('st-btn--icon') && typeof node.props['aria-label'] === 'string' && node.props['aria-label'].trim()), 'the close button has a name');
  const notice = [].concat(region.props.children).find((node) => node?.key === id);
  assert.equal(typeof notice.props.onFocusCapture, 'function', 'and the notice it sits in stops its clock on focus');
  assert.equal(typeof notice.props.onBlurCapture, 'function', 'and lets it run again on blur');
});

test('the stack cap never drops a notice being read, nor one whose action is the only way back', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const { id } of store.useStore((s) => s.toasts)) store.dismissToast(id);
  t.mock.timers.tick(400);

  // Four notices, the oldest held by the pointer: it is the one being read, so it stays.
  const held = store.pushToast('info', 'Model loaded', 'held');
  store.holdToast(held);
  store.pushToast('info', 'Model loaded', 'second');
  store.pushToast('info', 'Model loaded', 'third');
  store.pushToast('info', 'Model loaded', 'fourth');
  assert.equal(shown(held), true, 'the held notice survives the cap');
  store.releaseToast(held);

  // The unsaved-chats notice carries the only copy action; the cap must not take it away either.
  const save = store.pushToast('error', 'Some chats could not be saved', undefined, undo);
  store.pushToast('info', 'Model loaded', 'fifth');
  store.pushToast('info', 'Model loaded', 'sixth');
  store.pushToast('info', 'Model loaded', 'seventh');
  assert.equal(shown(save), true, 'the notice with an action survives the cap');

  // An ordinary notice nobody is reading still gives way, so the stack does not grow without end.
  for (const { id } of store.useStore((s) => s.toasts)) store.dismissToast(id);
  t.mock.timers.tick(400);
  const old = store.pushToast('info', 'Model loaded', 'oldest');
  store.pushToast('info', 'Model loaded', 'b');
  store.pushToast('info', 'Model loaded', 'c');
  store.pushToast('info', 'Model loaded', 'd');
  assert.equal(shown(old), false, 'the oldest unheld, actionless notice still collapses');
  for (const { id } of store.useStore((s) => s.toasts)) store.dismissToast(id);
  t.mock.timers.tick(400);
});

test('the notice the window draws holds and resumes through its own pointer and keyboard handlers', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  // The pointer over the notice: ui.tsx's onMouseEnter, on the element App.tsx mounts.
  const id = store.pushToast('info', 'Chat archived', 'Nueva conversación', undo, 9000);
  drawn(id).onMouseEnter();
  t.mock.timers.tick(60000);
  assert.equal(shown(id), true, 'the pointer holds it');
  drawn(id).onMouseLeave();
  t.mock.timers.tick(5300);
  assert.equal(shown(id), true, 'let go, it still has more than the ordinary 5.2 s to run');
  t.mock.timers.tick(3700);
  assert.equal(shown(id), false, 'and it goes at its own 9 s');
  t.mock.timers.tick(400);

  // The keyboard on it: ui.tsx's onFocusCapture, then onBlurCapture.
  const second = store.pushToast('info', 'Chat archived', 'Nueva conversación', undo, 9000);
  drawn(second).onFocusCapture();
  t.mock.timers.tick(60000);
  assert.equal(shown(second), true, 'focus holds it');
  drawn(second).onBlurCapture();
  t.mock.timers.tick(9000);
  assert.equal(shown(second), false, 'and it goes at its own 9 s once the keyboard leaves');
});

test('a long notice gets the time its text needs, and a finger on it holds it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const { id } of store.useStore((s) => s.toasts)) store.dismissToast(id);
  t.mock.timers.tick(400);

  const title = 'Nostroma could not use its port';
  const body = 'Port 5199 is used by another program, so Nostroma started on port 5200. Chats and settings saved on port 5199 are not shown until Nostroma can use it again. Close the other program and restart Nostroma.';
  const window = store.toastWindowMs(title, body);
  assert.ok(window > 5200, 'the reading time of this text is longer than the 5.2 s floor');

  const id = store.pushToast('warn', title, body);
  t.mock.timers.tick(5200);
  assert.equal(shown(id), true, 'a long notice is not taken away at the 5.2 s a short one stands');
  t.mock.timers.tick(window - 5200 - 1);
  assert.equal(shown(id), true, 'still there one millisecond before its own window');
  t.mock.timers.tick(1);
  assert.equal(shown(id), false, 'and gone at the window its text needs');
  t.mock.timers.tick(400);

  // A finger on it is the hold the pointer and the keyboard already have (ui.tsx's onTouchStart/onTouchEnd).
  const second = store.pushToast('info', 'Model loaded', body);
  const notice = drawn(second);
  assert.equal(typeof notice.onTouchStart, 'function', 'the notice stops its clock under a finger');
  assert.equal(typeof notice.onTouchEnd, 'function', 'and lets it run again when the finger lifts');
  notice.onTouchStart();
  t.mock.timers.tick(60000);
  assert.equal(shown(second), true, 'held while the finger is on it');
  notice.onTouchEnd();
  t.mock.timers.tick(store.toastWindowMs('Model loaded', body) - 1);
  assert.equal(shown(second), true, 'let go, it gets its own window again');
  t.mock.timers.tick(1);
  assert.equal(shown(second), false, 'gone at that window');
});

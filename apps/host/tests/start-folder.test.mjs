/**
 * The start screen's "Open a folder" promises the Workbench reads and runs inside
 * that folder. Adding the folder to the sidebar list is not that promise: the
 * files panel and the chats follow `activeWorkspace`. So the verb adds and
 * activates, and this pins it:
 *  - `addWorkspaceAndActivate` leaves the new folder as the active workspace and
 *    reloads the file list for it;
 *  - plain `addWorkspace` keeps the current workspace, so the sidebar's add
 *    button (and the Workbench's) do not change where the app is working;
 *  - a folder the host refuses changes nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

globalThis.window ??= globalThis;
globalThis.document ??= { addEventListener() {}, querySelector: () => null, hasFocus: () => true, visibilityState: 'visible', documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} }, classList: { toggle() {}, add() {}, remove() {} } } };
const memory = new Map();
globalThis.localStorage = {
  get length() { return memory.size; }, key: (i) => [...memory.keys()][i] ?? null,
  getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); }, removeItem: (k) => memory.delete(k),
};
globalThis.navigator ??= { language: 'en' };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.fetch = async () => { throw new Error('offline'); };

const calls = { posts: [], gets: [] };
globalThis.__calls = calls;
globalThis.__failPost = false;
const mockClient = {
  name: 'mock-client',
  setup(b) {
    b.onResolve({ filter: /\/client$/ }, () => ({ path: 'mock-client', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
      loader: 'js',
      contents: `
        export class ApiError extends Error { constructor(m, status) { super(m); this.status = status; } }
        let n = 0;
        export const api = {
          get: async (path) => { globalThis.__calls.gets.push(path); return { path: '/tmp/proyecto', entries: [] }; },
          post: async (path, body) => {
            globalThis.__calls.posts.push({ path, body });
            if (globalThis.__failPost) throw new Error('That folder is already in your workspaces.');
            return { id: 'ws_' + (++n), name: String(body.path).split('/').pop(), path: body.path };
          },
          put: async () => ({}), patch: async () => ({}), del: async () => ({}), delete: async () => ({}),
        };
        export function onEvent() { return () => {}; }
        export async function streamPost() {}
      `,
    }));
  },
};
const result = await build({
  entryPoints: [here('../src/lib/store.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  alias: { react: here('./helpers/react-stub.mjs') }, loader: { '.json': 'json' }, plugins: [mockClient],
});
const store = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const tick = () => new Promise((r) => setTimeout(r, 10));

test('opening a folder from the start screen leaves it as the active workspace', async () => {
  const first = await store.addWorkspace('/tmp/taller');
  assert.equal(first?.id, 'ws_1');
  assert.equal(store.getState().activeWorkspace, null, 'adding alone does not choose a workspace');
  store.setActiveWorkspace(first.id);
  await tick();
  calls.gets.length = 0;

  const opened = await store.addWorkspaceAndActivate('/tmp/proyecto');

  assert.equal(opened?.id, 'ws_2');
  assert.deepEqual(store.getState().workspaces.map((w) => w.id), ['ws_1', 'ws_2']);
  assert.equal(store.getState().activeWorkspace, 'ws_2', 'the folder just opened is where the app works');
  assert.equal(calls.posts.at(-1).body.path, '/tmp/proyecto');
  await tick();
  assert.ok(calls.gets.some((url) => url === '/api/workspace?root=ws_2'), 'the file list reloads for the new workspace');
});

test('adding from the sidebar keeps the workspace the person was already in', async () => {
  const active = store.getState().activeWorkspace;
  const added = await store.addWorkspace('/tmp/otro');

  assert.equal(added?.id, 'ws_3');
  assert.equal(store.getState().activeWorkspace, active);
});

test('opening a folder that is already in the list makes it active without adding it again', async () => {
  const posts = calls.posts.length;
  const opened = await store.addWorkspaceAndActivate('/tmp/taller/');

  assert.equal(opened?.id, 'ws_1');
  assert.equal(store.getState().activeWorkspace, 'ws_1');
  assert.equal(store.getState().workspaces.length, 3);
  assert.equal(calls.posts.length, posts, 'no duplicate folder is posted');
});

test('a folder the host refuses leaves the active workspace alone', async () => {
  globalThis.__failPost = true;
  const active = store.getState().activeWorkspace;
  const failed = await store.addWorkspaceAndActivate('/tmp/repetido');
  globalThis.__failPost = false;

  assert.equal(failed, null);
  assert.equal(store.getState().activeWorkspace, active);
  assert.equal(store.getState().workspaces.length, 3);
});

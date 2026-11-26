import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const { outputFiles } = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/router.ts',import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs' });
const browserWindow = { location: { hash: '#/chat/a' }, matchMedia: () => ({ matches: false }) };
let transitions = 0;
const documentStub = { documentElement: { dataset: {} }, startViewTransition: () => { transitions++; return { ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: Promise.resolve() }; } };
const module = { exports: {} };
new Function('require', 'module', 'exports', 'window', 'document', outputFiles[0].text)(createRequire(import.meta.url), module, module.exports, browserWindow, documentStub);
const router = module.exports;

test('Settings retains the page, chat id and existing query, and reopening is idempotent', () => {
  const opened = router.settingsHref('#/chat/chat-a?preview=project-brief');
  assert.equal(opened, '#/chat/chat-a?preview=project-brief&settings=1');
  assert.equal(router.settingsHref(opened), opened);
  assert.equal(router.settingsHref('#/tuning'), '#/tuning?settings=1');
  const location = router.parseLocation(opened);
  assert.equal(location.route, 'chat');
  assert.equal(location.param, 'chat-a');
  assert.equal(location.query.get('preview'), 'project-brief');
});

test('a Settings bookmark opens over chat; closing restores only the background URL', () => {
  const bookmark = router.parseLocation('#/settings');
  assert.equal(bookmark.route, 'chat');
  assert.equal(bookmark.query.get('settings'), '1');
  browserWindow.location.hash = '#/chat/chat-a?preview=project-brief&settings=1';
  router.closeSettings();
  assert.equal(browserWindow.location.hash, '#/chat/chat-a?preview=project-brief');
  browserWindow.location.hash = '#/monitor';
  router.navigate('settings');
  assert.equal(browserWindow.location.hash, '#/monitor?settings=1');
  router.closeSettings();
  assert.equal(browserWindow.location.hash, '#/monitor');
});


test('a retired Serving bookmark opens Settings on the Server section, not Chat', () => {
  const retired = router.parseLocation('#/serving');
  assert.equal(retired.route, 'chat');
  assert.equal(retired.query.get('settings'), '1');
  assert.equal(retired.settingsSection, 'Server');
  // Only the retired route names a section: an ordinary page opens Settings where the person left it.
  assert.equal(router.parseLocation('#/monitor').settingsSection, undefined);
  assert.equal(router.parseLocation('#/chat/chat-a?settings=1').settingsSection, undefined);
});

test('the app applies the section a retired route names when Settings opens', () => {
  const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /const settingsSection = location\.settingsSection;/);
  assert.match(app, /if \(settingsSection\) setSettingsSection\(settingsSection as Parameters<typeof setSettingsSection>\[0\]\);/);
});

test('Settings opens and closes immediately without snapshotting the background page', () => {
  browserWindow.location.hash = '#/chat/a';
  router.navigate('settings');
  assert.equal(browserWindow.location.hash, '#/chat/a?settings=1');
  router.closeSettings();
  assert.equal(browserWindow.location.hash, '#/chat/a');
  assert.equal(transitions, 0);
  router.navigate('models');
  assert.equal(transitions, 1, 'ordinary screen navigation still uses its view transition');
});

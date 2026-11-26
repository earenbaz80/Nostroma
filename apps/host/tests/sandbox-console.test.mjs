// The bridge must run before the page's own scripts, or the first log line of a
// page that throws is lost; and only its own shape may fill the strip.
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const built = await build({
  stdin: { contents: "export * from './src/lib/sandbox-console';", resolveDir: root },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const { withSandboxConsole, isSandboxLog } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);

test('the bridge lands in the head, ahead of the page\'s own scripts', () => {
  const page = '<!doctype html><html><head><title>t</title><script>console.log(1)</script></head><body></body></html>';
  const out = withSandboxConsole(page);
  const bridge = out.indexOf('nostroma-sandbox');
  assert.ok(bridge > 0);
  assert.ok(bridge < out.indexOf('console.log(1)'), 'the page script ran before the bridge');
  assert.ok(bridge < out.indexOf('<title>'), 'the bridge goes in at the top of the head');
});

test('a page with no head still gets the bridge before its scripts', () => {
  const out = withSandboxConsole('<!doctype html><html><body><script>console.log(1)</script></body></html>');
  assert.ok(out.indexOf('nostroma-sandbox') < out.indexOf('console.log(1)'));
  assert.ok(out.startsWith('<!doctype html>'), 'injecting before the doctype would put the page in quirks mode');
});

test('a bare fragment is wrapped after the bridge, not before it', () => {
  const out = withSandboxConsole('<h1>hi</h1><script>console.log(1)</script>');
  assert.ok(out.indexOf('nostroma-sandbox') < out.indexOf('<h1>'));
});

test('only a well-formed report from the bridge is accepted', () => {
  assert.equal(isSandboxLog({ source: 'nostroma-sandbox', level: 'error', text: 'boom' }), true);
  assert.equal(isSandboxLog({ source: 'other', level: 'error', text: 'boom' }), false);
  assert.equal(isSandboxLog({ source: 'nostroma-sandbox', level: 'debug', text: 'boom' }), false);
  assert.equal(isSandboxLog({ source: 'nostroma-sandbox', level: 'log', text: 42 }), false);
  assert.equal(isSandboxLog(null), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ stdin: { contents: "export * from './src/lib/chat-options';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node' });
const { outgoingMessage } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);

test('Mission sends a plain message as a goal', () => {
  assert.equal(outgoingMessage('build the garden', 'build the garden', true), '/goal build the garden');
});

test('a typed command keeps the mode out of its way', () => {
  assert.equal(outgoingMessage('/plan the garden', '/plan the garden', true), '/plan the garden');
  assert.equal(outgoingMessage('/compact', '/compact', true), '/compact');
});

test('every other mode sends exactly what was written, quotes included', () => {
  assert.equal(outgoingMessage('build the garden', '> quoted\n\nbuild the garden', false), '> quoted\n\nbuild the garden');
  assert.equal(outgoingMessage('build the garden', 'build the garden', false), 'build the garden');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheHints } from '../server/cache-hints.mjs';

/** A Claude Code turn: marks on the system, on a tool and on the last message. */
const marked = {
  system: [{ type: 'text', text: 'You are Claude Code.', cache_control: { type: 'ephemeral' } }],
  tools: [{ name: 'Read', input_schema: { type: 'object' }, cache_control: { type: 'ephemeral', ttl: '1h' } }],
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'First question.' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'First answer.' }] },
    { role: 'user', content: [{ type: 'text', text: 'Fix the failing test.', cache_control: { type: 'ephemeral' } }] },
  ],
};

test('the marks are counted where the client put them', () => {
  assert.deepEqual(cacheHints(marked), {
    marks: 3,
    byBlock: { system: 1, messages: 1, tools: 1 },
    lastMarkedMessage: 2,
    atLastMessage: true,
    ttl: ['1h'],
  });
});

test('a mark on an earlier message is not on the last one', () => {
  const body = structuredClone(marked);
  body.messages[2].content[0].cache_control = undefined;
  body.messages[0].content[0].cache_control = { type: 'ephemeral' };
  const hints = cacheHints(body);
  assert.equal(hints.marks, 3);
  assert.equal(hints.lastMarkedMessage, 0);
  assert.equal(hints.atLastMessage, false);
});

test('a request with no marks, or a body of another shape, has no summary', () => {
  assert.equal(cacheHints({ messages: [{ role: 'user', content: 'hi' }] }), null);
  assert.equal(cacheHints({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hi', cache_control: null }] }] }), null);
  assert.equal(cacheHints({}), null);
  assert.equal(cacheHints(null), null);
  assert.equal(cacheHints({ system: 'a plain string', messages: 'not a list' }), null);
});

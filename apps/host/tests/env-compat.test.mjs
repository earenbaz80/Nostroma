// The settings use one prefix, NOSTROMA_*: the host reads it, writes it, and passes the environment to a child unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';

import { envVar, hasEnvVar, setEnvVars, childEnv } from '../server/env-compat.mjs';

test('the NOSTROMA_ name is read, and an unset one is not', () => {
  const had = 'NOSTROMA_ADAPT_FETCH' in process.env;
  const saved = process.env.NOSTROMA_ADAPT_FETCH;
  try {
    process.env.NOSTROMA_ADAPT_FETCH = '8';
    assert.equal(envVar('ADAPT_FETCH'), '8');
    assert.equal(hasEnvVar('ADAPT_FETCH'), true);
    delete process.env.NOSTROMA_ADAPT_FETCH;
    assert.equal(envVar('ADAPT_FETCH'), undefined);
    assert.equal(hasEnvVar('ADAPT_FETCH'), false);
  } finally {
    if (had) process.env.NOSTROMA_ADAPT_FETCH = saved; else delete process.env.NOSTROMA_ADAPT_FETCH;
  }
});

test('one value is set under the NOSTROMA_ name', () => {
  assert.deepEqual(setEnvVars({}, { ADAPT_FETCH: '8' }), { NOSTROMA_ADAPT_FETCH: '8' });
});

test('a child gets a copy of the environment', () => {
  const source = { NOSTROMA_ADAPT_FETCH: '8', PATH: '/bin' };
  assert.deepEqual(childEnv(source), source);
  assert.notEqual(childEnv(source), source);
  assert.deepEqual(childEnv({ PATH: '/bin' }), { PATH: '/bin' });
});

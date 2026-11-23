// The settings moved from STRATA_* to NOSTROMA_*: the new name is read, the old one still works, and a child (the
// engine, which reads only the old name) must never see a value the host ignores.
import test from 'node:test';
import assert from 'node:assert/strict';

import { envVar, hasEnvVar, setEnvVars, childEnv, aliasOldNames } from '../server/env-compat.mjs';

test('the new name wins, and the old one is still read on its own', () => {
  const had = { new: 'NOSTROMA_ADAPT_FETCH' in process.env, old: 'STRATA_ADAPT_FETCH' in process.env };
  const saved = { new: process.env.NOSTROMA_ADAPT_FETCH, old: process.env.STRATA_ADAPT_FETCH };
  try {
    process.env.NOSTROMA_ADAPT_FETCH = '8';
    process.env.STRATA_ADAPT_FETCH = '2';
    assert.equal(envVar('ADAPT_FETCH'), '8');
    delete process.env.NOSTROMA_ADAPT_FETCH;
    assert.equal(envVar('ADAPT_FETCH'), '2');
    assert.equal(hasEnvVar('ADAPT_FETCH'), true);
    delete process.env.STRATA_ADAPT_FETCH;
    assert.equal(envVar('ADAPT_FETCH'), undefined);
    assert.equal(hasEnvVar('ADAPT_FETCH'), false);
  } finally {
    if (had.new) process.env.NOSTROMA_ADAPT_FETCH = saved.new; else delete process.env.NOSTROMA_ADAPT_FETCH;
    if (had.old) process.env.STRATA_ADAPT_FETCH = saved.old; else delete process.env.STRATA_ADAPT_FETCH;
  }
});

test('one value goes under both names for a child', () => {
  assert.deepEqual(setEnvVars({}, { ADAPT_FETCH: '8' }), { NOSTROMA_ADAPT_FETCH: '8', STRATA_ADAPT_FETCH: '8' });
});

test('a child gets both spellings, and the new name wins in both', () => {
  assert.equal(childEnv({ NOSTROMA_ADAPT_FETCH: '8' }).STRATA_ADAPT_FETCH, '8');
  assert.equal(childEnv({ STRATA_ADAPT_FETCH: '8' }).NOSTROMA_ADAPT_FETCH, '8');
  const both = childEnv({ NOSTROMA_ADAPT_FETCH: '8', STRATA_ADAPT_FETCH: '2' });
  assert.equal(both.NOSTROMA_ADAPT_FETCH, '8');
  assert.equal(both.STRATA_ADAPT_FETCH, '8');
  assert.deepEqual(childEnv({ PATH: '/bin' }), { PATH: '/bin' });
});

test('the host fills in the missing name once at startup', () => {
  const env = { NOSTROMA_TUNE_DIR: '/t' };
  aliasOldNames(env);
  assert.equal(env.STRATA_TUNE_DIR, '/t');
  const before = { ...env };
  aliasOldNames(env);
  assert.deepEqual(env, before);
});

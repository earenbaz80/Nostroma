import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise(done => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => done(port)); });
});

test('the GitHub routes say what is saved, refuse an empty token, and refuse anything that is not a repository', async t => {
  const home = mkdtempSync(join(tmpdir(), 'nostroma-github-'));
  const port = await freePort();
  const host = spawn(process.execPath, ['server/index.mjs'], {
    cwd,
    env: { ...process.env, NOSTROMA_HOME: home, NOSTROMA_WORKSPACE: home, NOSTROMA_REAL_ENGINE: '0', NOSTROMA_PORT: String(port), NOSTROMA_BIND: '127.0.0.1' },
    stdio: 'ignore',
  });
  t.after(() => { try { host.kill(); } catch { /* already gone */ } rmSync(home, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try { ready = (await call('GET', '/api/github')).status === 200; } catch { await pause(100); }
  }
  assert.ok(ready, 'the host started');

  assert.deepEqual((await call('GET', '/api/github')).body, { connected: false, login: '' }, 'no token is the starting point');

  const empty = await call('POST', '/api/github', { token: '   ' });
  assert.equal(empty.status, 400);
  assert.match(empty.body.error, /Paste a GitHub token/);

  for (const repo of ['', 'Nostroma', 'https://gitlab.com/a/b', '../outside', 'owner/name/extra']) {
    const answer = await call('POST', '/api/workspaces/github', { repo });
    assert.equal(answer.status, 400, JSON.stringify(repo));
    assert.match(answer.body.error, /owner\/name/, JSON.stringify(repo));
  }

  const cleared = await call('DELETE', '/api/github');
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body, { connected: false, login: '' });
});

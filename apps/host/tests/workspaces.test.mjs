/**
 * The first workspace is never the app's own folder, and any workspace can be renamed (a display name; the path stays).
 * A real host process with a scratch user profile; no NOSTROMA_WORKSPACE, started inside the host folder like the installed app.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const HOST_DIR = resolve(import.meta.dirname, '..');
const freePort = () => new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function start(t, { user, home }) {
  const port = await freePort();
  /* The scratch folders may sit inside the checkout; git is told not to look above
     them, so "this folder is not a repository yet" is what the test means by it. */
  const env = { ...process.env, NOSTROMA_HOME: home, NOSTROMA_PORT: String(port), USERPROFILE: user, HOME: user, NOSTROMA_REAL_ENGINE: '0', NOSTROMA_COMPONENTS_DIR: join(home, 'components'), GIT_CEILING_DIRECTORIES: join(home, '..') };
  delete env.NOSTROMA_WORKSPACE;
  const child = spawn(process.execPath, [join(HOST_DIR, 'server', 'index.mjs')], { cwd: HOST_DIR, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let log = ''; child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  t.after(async () => {
    if (child.exitCode !== null) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); else child.kill('SIGTERM');
    await new Promise(r => child.once('exit', r));
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/workspaces`)).ok) break; } catch { /* not up yet */ }
    if (child.exitCode !== null) throw new Error(`the host exited: ${log.slice(-400)}`);
    await sleep(200);
  }
  // The chats routes answer only the app's own pages, so they carry the client header every page sends.
  const headers = { 'content-type': 'application/json', 'x-nostroma-client': 'workspaces-test' };
  const call = async (method, path, body) => { const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
  return { call };
}

const scratch = () => { const dir = mkdtempSync(join(tmpdir(), 'nostroma-ws-')); const user = join(dir, 'user'); const home = join(dir, 'home'); mkdirSync(user, { recursive: true }); mkdirSync(home, { recursive: true }); return { dir, user, home }; };

test('item 6: with nothing chosen the first workspace is Documents\\Nostroma, never the app folder', async t => {
  const s = scratch(); t.after(() => rmSync(s.dir, { recursive: true, force: true }));
  const host = await start(t, s);
  const { body } = await host.call('GET', '/api/workspaces');
  const first = body.workspaces[0];
  assert.equal(first.id, 'root');
  assert.equal(resolve(first.path), join(s.user, 'Documents', 'Nostroma', 'Workspace'));
  assert.equal(first.name, 'Nostroma');
  assert.ok(existsSync(first.path), 'the folder is created');
  assert.notEqual(resolve(first.path), HOST_DIR);
});

test('item 6: a saved first workspace that is the app folder moves to the default; its chats follow through an alias', async t => {
  const s = scratch(); t.after(() => rmSync(s.dir, { recursive: true, force: true }));
  mkdirSync(join(s.home, 'data'), { recursive: true });
  writeFileSync(join(s.home, 'data', 'workspaces.json'), JSON.stringify([{ id: 'root', name: 'host', path: HOST_DIR }, { id: 'ws_a', name: 'Mine', path: s.user }]));
  const host = await start(t, s);
  const { body } = await host.call('GET', '/api/workspaces');
  assert.equal(resolve(body.workspaces[0].path), join(s.user, 'Documents', 'Nostroma', 'Workspace'));
  assert.equal(body.workspaces[0].name, 'Nostroma');
  assert.deepEqual(body.workspaces[0].aliases, [HOST_DIR]);
  assert.equal(body.workspaces[1].path, s.user, 'a folder the person added is left alone');
});

test('item 6: renaming changes the display name only', async t => {
  const s = scratch(); t.after(() => rmSync(s.dir, { recursive: true, force: true }));
  const host = await start(t, s);
  const before = (await host.call('GET', '/api/workspaces')).body.workspaces[0];
  const done = await host.call('PATCH', '/api/workspaces/root', { name: '  My projects  ' });
  assert.equal(done.status, 200);
  assert.equal(done.body.name, 'My projects'); assert.equal(done.body.path, before.path);
  assert.equal((await host.call('GET', '/api/workspaces')).body.workspaces[0].name, 'My projects', 'it is saved');
  assert.equal((await host.call('PATCH', '/api/workspaces/root', { name: '   ' })).status, 400);
  assert.equal((await host.call('PATCH', '/api/workspaces/nope', { name: 'x' })).status, 404);
});

test('item 6: a workspace takes a colour and can be archived; anything else is refused', async t => {
  const s = scratch(); t.after(() => rmSync(s.dir, { recursive: true, force: true }));
  const host = await start(t, s);
  const painted = await host.call('PATCH', '/api/workspaces/root', { color: '#4C7FE0', archived: true });
  assert.equal(painted.status, 200);
  assert.equal(painted.body.color, '#4c7fe0');
  assert.equal(painted.body.archived, true);
  assert.equal(painted.body.name, 'Nostroma', 'a colour and the flag leave the name alone');
  const listed = (await host.call('GET', '/api/workspaces')).body.workspaces[0];
  assert.equal(listed.color, '#4c7fe0');
  assert.equal(listed.archived, true, 'both are saved');
  const renamed = await host.call('PATCH', '/api/workspaces/root', { name: 'Mine' });
  assert.equal(renamed.body.name, 'Mine');
  assert.equal(renamed.body.color, '#4c7fe0', 'a rename keeps the colour');
  assert.equal((await host.call('PATCH', '/api/workspaces/root', { color: 'red' })).status, 400);
  const cleared = await host.call('PATCH', '/api/workspaces/root', { color: null, archived: false });
  assert.equal(cleared.status, 200);
  assert.equal('color' in cleared.body, false, 'no colour means none, not an empty one');
  assert.equal('archived' in cleared.body, false);
  assert.equal((await host.call('GET', '/api/workspaces')).body.workspaces[0].color, undefined, 'clearing is saved too');
});

test('item 6: sharing writes the project chats into one file, and Git can be linked to the folder', async t => {
  const s = scratch(); t.after(() => rmSync(s.dir, { recursive: true, force: true }));
  const host = await start(t, s);
  const workspacePath = (await host.call('GET', '/api/workspaces')).body.workspaces[0].path;
  const now = new Date().toISOString();
  const session = {
    id: 's_share1', title: 'Share me', createdAt: now, updatedAt: now, workspace: workspacePath,
    messages: [
      { id: 'm1', role: 'user', content: 'Hola' },
      { id: 'm2', role: 'assistant', content: 'Buenas' },
    ],
  };
  assert.equal((await host.call('PUT', '/api/chats/s_share1', session)).status, 200, 'the chat is saved');
  const shared = await host.call('POST', '/api/workspaces/root/share', {});
  assert.equal(shared.status, 200);
  assert.equal(shared.body.chats, 1, 'the project finds its own chat');
  const text = readFileSync(shared.body.path, 'utf8');
  assert.match(text, /## Share me/);
  assert.match(text, /\*\*You\*\*/);
  assert.match(text, /\*\*Nostroma\*\*/);
  assert.match(text, /Hola/);

  if (spawnSync('git', ['--version'], { windowsHide: true }).status !== 0) {
    t.diagnostic('git is not installed here: the repository half of this test was not run');
    return;
  }
  const before = (await host.call('GET', '/api/workspaces/root/git')).body;
  assert.equal(before.repo, false, 'the folder starts outside git');
  const linked = await host.call('POST', '/api/workspaces/root/git', { remote: 'octo/demo' });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.remote, 'https://github.com/octo/demo.git');
  const state = (await host.call('GET', '/api/workspaces/root/git')).body;
  assert.equal(state.repo, true);
  assert.equal(state.remote, 'https://github.com/octo/demo.git');
  const moved = await host.call('POST', '/api/workspaces/root/git', { remote: 'https://gitlab.com/octo/other.git' });
  assert.equal(moved.status, 200);
  assert.equal((await host.call('GET', '/api/workspaces/root/git')).body.remote, 'https://gitlab.com/octo/other.git', 'a second address replaces the first');
    assert.equal((await host.call('POST', '/api/workspaces/root/git', { remote: '' })).status, 400);
});

test('item 6: the live view follows the page being worked on in the project', async t => {
  const s = scratch(); t.after(() => rmSync(s.dir, { recursive: true, force: true }));
  const host = await start(t, s);
  const folder = (await host.call('GET', '/api/workspaces')).body.workspaces[0].path;
  const empty = await host.call('GET', '/api/workspace/source?root=root');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.path, null, 'a folder with no page says so instead of inventing one');
  writeFileSync(join(folder, 'app.html'), '<h1>app</h1>');
  const first = await host.call('GET', '/api/workspace/source?root=root');
  assert.equal(first.body.path, 'app.html', 'the page that is there is the one followed');
  assert.ok(first.body.mtimeMs > 0, 'the page carries its stamp');
  writeFileSync(join(folder, 'index.html'), '<h1>main</h1>');
  const main = await host.call('GET', '/api/workspace/source?root=root');
  assert.equal(main.body.path, 'index.html', 'index.html wins over a newer page');
  const before = main.body.mtimeMs;
  await sleep(25);
  writeFileSync(join(folder, 'index.html'), '<h1>main, changed</h1>');
  const changed = await host.call('GET', '/api/workspace/source?root=root');
  assert.ok(changed.body.mtimeMs > before, 'the stamp moves when the page is written again');
  rmSync(join(folder, 'index.html'));
  const fallback = await host.call('GET', '/api/workspace/source?root=root');
  assert.equal(fallback.body.path, 'app.html', 'without it the newest page is followed instead');
});

test('item 6: the general audit answers with the checks it ran, and does not change anything', async t => {
  const s = scratch(); t.after(() => rmSync(s.dir, { recursive: true, force: true }));
  const host = await start(t, s);
  const audit = await host.call('GET', '/api/audit');
  assert.equal(audit.status, 200);
  const ids = audit.body.checks.map(one => one.id);
  for (const id of ['data', 'space-data', 'space-models', 'engine', 'model', 'workspaces', 'chats', 'git', 'gpus']) assert.ok(ids.includes(id), `the audit covers ${id}`);
  const statuses = ['ok', 'warn', 'fail', 'unknown'];
  assert.ok(audit.body.checks.every(one => statuses.includes(one.status) && typeof one.detail === 'string'), 'every check says what it found');
  assert.equal(audit.body.checks.find(one => one.id === 'data').status, 'ok', 'the profile folder can be written');
  assert.equal(audit.body.checks.find(one => one.id === 'workspaces').status, 'ok', 'the project folder exists');
  assert.equal(statuses.reduce((total, one) => total + audit.body.counts[one], 0), audit.body.checks.length);

  // Opened from a chat, the audit is the audit of that chat's project: its folder
  // and its git state come first, and a folder that is gone is a failure.
  assert.ok(!ids.includes('project'), 'with no project the audit has no project rows');
  const project = (await host.call('GET', '/api/workspaces')).body.workspaces[0].path;
  const scoped = await host.call('GET', `/api/audit?project=${encodeURIComponent(project)}`);
  assert.equal(scoped.status, 200);
  assert.equal(scoped.body.checks[0].id, 'project', 'the project is the first thing looked at');
  assert.equal(scoped.body.checks[0].status, 'ok', 'the project folder is there');
  assert.equal(scoped.body.checks[0].detail, project, 'the row names the folder it looked at');
  const versions = scoped.body.checks.find(one => one.id === 'project-git');
  assert.ok(versions, 'the project says whether git keeps its versions');
  assert.ok(['ok', 'warn', 'unknown'].includes(versions.status), 'and answers with a status the page knows');
  const gone = await host.call('GET', `/api/audit?project=${encodeURIComponent(join(s.dir, 'not-there'))}`);
  assert.equal(gone.body.checks.find(one => one.id === 'project').status, 'fail', 'a folder that is gone is a failure');
});

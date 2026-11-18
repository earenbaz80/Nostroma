/**
 * DNS rebinding on the app's own port (hostAllowed in server/util.mjs, the rules of serve/server.py `host_allowed`).
 *
 * A page of another site whose name its DNS points at 127.0.0.1 reaches this app as the same origin, and could then call
 * /api/* (chats, files, engine control). Its requests carry that site's name in `Host`, so they get 403; an IP (IPv4, IPv6,
 * IPv4-mapped), `localhost`, `*.localhost`, this PC's own names (when the app listens beyond this PC) and whatever
 * STRATA_ALLOWED_HOSTS lists pass (an exact name, `.example.com` for the names below it, or `*`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, hostname as machineName } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { hostAllowed, hostName, isIpAddress } from '../server/util.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const delay = ms => new Promise(r => setTimeout(r, ms));
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }

/** The real app host, with a temporary home of its own. `extraEnv` overrides any setting, STRATA_ALLOWED_HOSTS included. */
async function startHost(extraEnv = {}) {
  const home = await mkdtemp(join(tmpdir(), 'strata-host-rebinding-'));
  const port = await freePort();
  const env = {
    ...process.env, STRATA_HOME: home, STRATA_MODELS_DIR: join(home, 'models'), STRATA_PORT: String(port),
    STRATA_SHARE_PORT: String(await freePort()), STRATA_TUNNEL_PORT: String(await freePort()), STRATA_REAL_ENGINE: '1',
    STRATA_SETTINGS_FILE: join(home, 'app-settings.json'), STRATA_COMPONENTS_DIR: join(home, 'components'),
    LOCALAPPDATA: join(home, 'Local'), APPDATA: join(home, 'Roaming'), XDG_DATA_HOME: join(home, 'xdg-data'),
    XDG_STATE_HOME: join(home, 'xdg-state'), XDG_CONFIG_HOME: join(home, 'xdg-config'),
    STRATA_ALLOWED_HOSTS: '',
    ...extraEnv,
  };
  const host = spawn(process.execPath, ['server/index.mjs'], { cwd: root, stdio: 'ignore', env });
  const exit = new Promise(r => host.once('exit', (code, signal) => r({ code, signal })));
  let up = false;
  for (let i = 0; i < 150 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch { await delay(100); } }
  assert.ok(up, 'host started');
  return { host, port, done: async () => { host.kill('SIGKILL'); await exit; await rm(home, { recursive: true, force: true }).catch(() => {}); } };
}

/** One GET of the health endpoint on its own socket, so the Host is exactly the bytes given; `Connection: close` ends the read. */
function ask(port, host) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    let data = '';
    socket.setTimeout(5000, () => socket.destroy());
    socket.on('connect', () => socket.write(`GET /api/health HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`));
    socket.on('data', chunk => { data += chunk; });
    socket.on('close', () => resolve(data));
    socket.on('error', e => (data ? resolve(data) : reject(e)));
  });
}
const status = response => Number(/^HTTP\/1\.[01] (\d{3})/.exec(response)?.[1] ?? 0);

test('hostName and isIpAddress read the name out of a Host header', () => {
  assert.equal(hostName('Example.COM'), 'example.com');
  assert.equal(hostName('mypc.local:8791'), 'mypc.local');
  assert.equal(hostName('127.0.0.1:8791'), '127.0.0.1');
  assert.equal(hostName('[::1]:8791'), '::1');
  assert.equal(hostName('[::1]'), '::1');
  assert.equal(hostName('[::ffff:127.0.0.1]:8791'), '::ffff:127.0.0.1');
  assert.equal(hostName('mypc.local.'), 'mypc.local', 'the root dot of a fully qualified name');
  assert.equal(hostName(''), '');
  assert.equal(hostName(undefined), '');
  assert.equal(hostName('[::1'), '');
  for (const ip of ['127.0.0.1', '10.0.0.5', '::1', 'fe80::1', '::ffff:127.0.0.1']) assert.equal(isIpAddress(ip), true, ip);
  for (const name of ['localhost', 'example.com', 'a.b', '', '999.1.1.1', '127.1']) {
    assert.equal(isIpAddress(name), false, `${JSON.stringify(name)} is not an address net.isIP accepts`);
  }
});

test('hostAllowed: an IP, localhost, *.localhost, a listed name and no Host pass; another site does not', () => {
  const names = ['mypc', 'mypc.local', 'host.docker.internal'];
  for (const host of ['127.0.0.1', '127.0.0.1:8791', 'localhost:8791', 'LOCALHOST', 'foo.localhost:8791',
                      '[::1]:8791', '[::ffff:127.0.0.1]:8791', '192.168.1.20:8791', undefined, '']) {
    assert.equal(hostAllowed(host, names), true, String(host));
  }
  for (const host of ['mypc', 'mypc:8791', 'MYPC.local', 'host.docker.internal:8791', 'mypc.']) {
    assert.equal(hostAllowed(host, names), true, host);
  }
  for (const host of ['evil.example', 'evil.example:8791', 'mypc.evil.example', '127.0.0.1.evil.example', 'evil.localhost.example']) {
    assert.equal(hostAllowed(host, names), false, host);
  }
  assert.equal(hostAllowed('evil.example', []), false, 'nothing is listed: a name is refused');
  // the forms STRATA_ALLOWED_HOSTS takes in the engine (docs/DETAILS.md): a leading dot covers the names below, "*" any name
  for (const host of ['example.com', 'a.example.com', 'deep.a.example.com']) assert.equal(hostAllowed(host, ['.example.com']), true, host);
  assert.equal(hostAllowed('example.com.evil.example', ['.example.com']), false);
  assert.equal(hostAllowed('evil.example', ['*']), true);
});

test('the app port answers its own names and refuses another site\'s (#DNS rebinding)', async t => {
  const h = await startHost();
  t.after(h.done);
  const own = [`127.0.0.1:${h.port}`, `localhost:${h.port}`, `app.localhost:${h.port}`, '127.0.0.1',
               `[::1]:${h.port}`, `[::ffff:127.0.0.1]:${h.port}`, '192.168.0.10:8791'];
  for (const host of own) assert.equal(status(await ask(h.port, host)), 200, `Host ${host}`);

  const denied = await ask(h.port, 'evil.example');
  assert.equal(status(denied), 403, denied.slice(0, 120));
  assert.match(denied, /answers only to its own addresses/);
  assert.ok(denied.length < 1000, 'the 403 is bounded');
  assert.equal(status(await ask(h.port, `evil.example:${h.port}`)), 403);

  const pc = machineName().toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(pc)) {
    assert.equal(status(await ask(h.port, `${pc}:${h.port}`)), 403, 'a loopback-only app is not reached by its PC name');
  }
  assert.equal((await fetch(`http://127.0.0.1:${h.port}/api/health`)).status, 200, 'still serving after the refusals');
});

test('listening beyond this PC: the PC\'s own name is answered, another site is not', async t => {
  const h = await startHost({ STRATA_BIND: '0.0.0.0' });
  t.after(h.done);
  const pc = machineName().toLowerCase();
  assert.equal(status(await ask(h.port, `${pc}:${h.port}`)), 200, `Host ${pc}`);
  assert.equal(status(await ask(h.port, `${pc}.local:${h.port}`)), 200);
  assert.equal(status(await ask(h.port, 'evil.example')), 403);
  assert.equal((await fetch(`http://127.0.0.1:${h.port}/api/health`)).status, 200);
});

test('STRATA_ALLOWED_HOSTS adds the name a proxy in front of the app sends', async t => {
  const h = await startHost({ STRATA_ALLOWED_HOSTS: 'proxy.example, other.example, .corp.example' });
  t.after(h.done);
  assert.equal(status(await ask(h.port, 'proxy.example')), 200);
  assert.equal(status(await ask(h.port, 'other.example:443')), 200);
  assert.equal(status(await ask(h.port, 'dev.corp.example:8791')), 200, 'a leading dot covers the names below it');
  assert.equal(status(await ask(h.port, 'evil.example')), 403, 'the rest is still refused');
  assert.equal(status(await ask(h.port, 'proxy.example.evil.example')), 403, 'and a name is never matched by a suffix');
});

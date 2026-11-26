/** Where the background pictures live: `wallpapers/` in a checkout, `<NOSTROMA_HOME>/wallpapers` in the packaged app
 *  (server/wallpaper-folder.mjs). The packaged app's install folder is read-only on Linux and macOS, so an upload must
 *  never be pointed at it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canWrite, wallpaperFolder } from '../server/wallpaper-folder.mjs';

const root = join(import.meta.dirname, '..');
const CHECKOUT = join(root, '..', '..', 'wallpapers');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a checkout lists wallpapers/ beside apps/, the packaged app its own home', async () => {
  const home = await mkdtemp(join(tmpdir(), 'nostroma-wallpaper-folder-'));
  try {
    assert.equal(wallpaperFolder({ packaged: true, checkout: CHECKOUT, home }), join(home, 'wallpapers'),
      'packaged: the per-user home, whatever the checkout holds');
    assert.equal(wallpaperFolder({ packaged: false, checkout: CHECKOUT, home }), CHECKOUT,
      'a source checkout: wallpapers/ at the project root, where a person drops a picture');
  }
  finally { await rm(home, { recursive: true, force: true }); }
});

test('a checkout folder that cannot be written falls back to the home instead of failing the upload', async () => {
  const work = await mkdtemp(join(tmpdir(), 'nostroma-wallpaper-readonly-'));
  try {
    const blocker = join(work, 'wallpapers');                       // a file where the folder would go: it cannot be made
    await writeFile(blocker, 'not a folder');
    const home = join(work, 'home');
    await mkdir(home, { recursive: true });
    assert.equal(canWrite(blocker), false);
    assert.equal(wallpaperFolder({ packaged: false, checkout: blocker, home }), join(home, 'wallpapers'));
    assert.equal(canWrite(join(home, 'pictures')), true, 'a folder that can be made is written to, and the probe is removed');
    assert.deepEqual(await readdir(join(home, 'pictures')), [], 'the probe leaves nothing behind');
  }
  finally { await rm(work, { recursive: true, force: true }); }
});

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function startHost(extraEnv) {
  const home = await mkdtemp(join(tmpdir(), 'nostroma-wallpaper-host-'));
  const port = await freePort();
  const host = spawn(process.execPath, ['server/index.mjs'], {
    cwd: root, stdio: 'ignore',
    env: { ...process.env, NOSTROMA_HOME: home, NOSTROMA_MODELS_DIR: join(home, 'models'), NOSTROMA_PORT: String(port),
      NOSTROMA_NO_ACQUIRE: '1', NOSTROMA_NO_BUNDLED_ENGINE: '1', ...extraEnv },
  });
  let up = false;
  for (let i = 0; i < 200 && !up; i++) {
    try { up = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; }
    catch { await delay(100); }
  }
  assert.ok(up, 'the host answers');
  return { host, home, base: `http://127.0.0.1:${port}` };
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000100ffabce36890000000049454e44ae426082', 'hex');

test('packaged, an uploaded picture is written under NOSTROMA_HOME/wallpapers, never beside the install', async () => {
  const checkoutBefore = await readdir(CHECKOUT).catch(() => []);
  const { host, home, base } = await startHost({ NOSTROMA_PACKAGED: '1' });
  try {
    const saved = await fetch(`${base}/api/appearance/wallpapers?name=prueba-empaquetada.png`, {
      method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG,
    });
    assert.equal(saved.status, 201, await saved.clone().text());
    assert.equal((await saved.json()).name, 'prueba-empaquetada.png');
    assert.ok(existsSync(join(home, 'wallpapers', 'prueba-empaquetada.png')), 'written under the per-user home');
    assert.deepEqual(await readdir(CHECKOUT).catch(() => []), checkoutBefore, 'the checkout folder is not touched');
    const listed = await (await fetch(`${base}/api/appearance/wallpapers`)).json();
    assert.deepEqual(listed.wallpapers.map(item => item.name), ['prueba-empaquetada.png'], 'and the page lists it from there');
    const served = await fetch(`${base}${listed.wallpapers[0].url}`);
    assert.equal(served.status, 200);
    assert.equal((await served.arrayBuffer()).byteLength, PNG.length, 'and serves the same bytes');
  }
  finally {
    host.kill();
    await rm(home, { recursive: true, force: true });
  }
});

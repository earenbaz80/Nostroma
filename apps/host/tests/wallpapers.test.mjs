import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  WALLPAPER_MAX_BYTES,
  listWallpapers,
  safeWallpaperName,
  saveWallpaper,
  wallpaperFile,
  wallpaperType,
} from '../server/wallpapers.mjs';

function folder() {
  const made = mkdtempSync(join(tmpdir(), 'nostroma-wallpapers-'));
  return { made, clean: () => rmSync(made, { recursive: true, force: true }) };
}

test('only picture types the browser draws are listed or served', () => {
  assert.equal(wallpaperType('photo.JPG'), 'image/jpeg');
  assert.equal(wallpaperType('photo.webp'), 'image/webp');
  assert.equal(wallpaperType('notes.txt'), null);
  assert.equal(wallpaperType('drawing.svg'), null);
  const names = ['../../Mi foto?.PNG', 'C:\\Users\\me\\fondo.jpeg', '.hidden.png', 'readme.txt'];
  assert.equal(safeWallpaperName(names[0]), 'Mi foto-.png');
  assert.equal(safeWallpaperName(names[1]), 'fondo.jpeg');
  assert.equal(safeWallpaperName(names[2]), 'hidden.png');
  assert.equal(safeWallpaperName(names[3]), null);
});

test('a requested wallpaper name cannot leave its folder', () => {
  const dir = folder();
  try {
    writeFileSync(join(dir.made, 'fondo.png'), Buffer.from('png'));
    assert.equal(wallpaperFile(dir.made, 'fondo.png'), join(dir.made, 'fondo.png'));
    for (const name of ['../fondo.png', '..\\fondo.png', 'sub/fondo.png', '.hidden.png', 'notes.txt', '']) {
      assert.equal(wallpaperFile(dir.made, name), null, name);
    }
  }
  finally { dir.clean(); }
});

test('the folder lists pictures only, sorted, with an encoded URL', () => {
  const dir = folder();
  try {
    writeFileSync(join(dir.made, 'b photo.png'), Buffer.from('png'));
    writeFileSync(join(dir.made, 'a.jpg'), Buffer.from('jpg'));
    writeFileSync(join(dir.made, 'notes.txt'), Buffer.from('text'));
    writeFileSync(join(dir.made, '.hidden.png'), Buffer.from('png'));
    mkdirSync(join(dir.made, 'folder.png'));
    const listed = listWallpapers(dir.made);
    assert.deepEqual(listed.map(item => item.name), ['a.jpg', 'b photo.png']);
    assert.equal(listed[1].url, '/api/appearance/wallpapers/b%20photo.png');
    assert.equal(listed[0].bytes, 3);
  }
  finally { dir.clean(); }
  assert.deepEqual(listWallpapers(join(tmpdir(), 'nostroma-does-not-exist')), []);
});

test('an uploaded picture is stored once and a second one keeps both', () => {
  const dir = folder();
  try {
    const saved = saveWallpaper(dir.made, { body: Buffer.from('one'), contentType: 'image/png', name: '../fondo.png' });
    assert.equal(saved.name, 'fondo.png');
    assert.equal(readFileSync(join(dir.made, 'fondo.png'), 'utf8'), 'one');
    const second = saveWallpaper(dir.made, { body: Buffer.from('two'), contentType: 'image/png', name: '../fondo.png' });
    assert.equal(second.name, 'fondo-2.png');
    assert.equal(readFileSync(join(dir.made, 'fondo-2.png'), 'utf8'), 'two');
  }
  finally { dir.clean(); }
});

test('an empty, oversized or non-picture upload is refused', () => {
  const dir = folder();
  try {
    assert.throws(() => saveWallpaper(dir.made, { body: Buffer.alloc(0), contentType: 'image/png', name: 'a.png' }), /empty/);
    assert.throws(() => saveWallpaper(dir.made, { body: Buffer.alloc(WALLPAPER_MAX_BYTES + 1), contentType: 'image/png', name: 'a.png' }), /25 MB/);
    assert.throws(() => saveWallpaper(dir.made, { body: Buffer.from('x'), contentType: 'text/plain', name: 'a.png' }), /PNG, JPEG/);
    assert.throws(() => saveWallpaper(dir.made, { body: Buffer.from('x'), contentType: 'image/png', name: 'a.svg' }), /PNG, JPEG/);
  }
  finally { dir.clean(); }
});

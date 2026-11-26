/** Settings > Appearance > Background: the pictures in wallpapers/ are read again every time the menu opens (lib/wallpaper-list.ts). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundled = await build({
  stdin: { contents: "export * from './src/lib/wallpaper-list';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.json': 'json' },
});
const { readWallpapers, wallpaperChoices, nextWallpaper } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('the folder is read again on every call, so a picture added with the app open shows up without a reload', async () => {
  const folder = [{ name: 'wale.jpg', url: '/api/appearance/wallpapers/wale.jpg', bytes: 1 }];
  const calls = [];
  const get = async (path) => { calls.push(path); return { wallpapers: folder.slice() }; };
  assert.deepEqual(await readWallpapers(get), folder);
  folder.push({ name: 'dropped-in.jpg', url: '/api/appearance/wallpapers/dropped-in.jpg', bytes: 2 });   // put in wallpapers/ while the app is open
  assert.deepEqual((await readWallpapers(get)).map(item => item.name), ['wale.jpg', 'dropped-in.jpg'],
    'the second read sees the picture added since the first: nothing is cached between reads');
  folder.length = 0;                                                                                  // and deleted again
  assert.deepEqual(await readWallpapers(get), [], 'a picture removed from the folder stops being offered');
  assert.deepEqual(calls, ['/api/appearance/wallpapers', '/api/appearance/wallpapers', '/api/appearance/wallpapers'],
    'one request per read, the same endpoint');
});

test('a host answer without a list is an empty list, not a crash', async () => {
  for (const answer of [{}, { wallpapers: null }, { wallpapers: 'x' }])
    assert.deepEqual(await readWallpapers(async () => answer), [], JSON.stringify(answer));
});

test('opening the menu is what reads it again: the setting and the Select are wired for it', async () => {
  const ui = await readFile(new URL('../src/components/ui.tsx', import.meta.url), 'utf8');
  const setting = await readFile(new URL('../src/components/WallpaperSetting.tsx', import.meta.url), 'utf8');
  assert.match(ui, /onOpen\?: \(\) => void/, 'Select takes an open callback');
  assert.match(ui, /setOpen\(true\);\s*onOpen\?\.\(\);/, 'and calls it when the menu opens, once per open');
  assert.match(setting, /onOpen=\{\(\) => \{ void load\(\); \}\}/, 'the background menu reads the folder again when it opens');
  assert.match(setting, /useEffect\(\(\) => \{ void load\(\); \}, \[load\]\)/, 'the list is still read at mount, so the preview is right before the first open');
  assert.match(setting, /window\.addEventListener\('focus', again\)/, 'and again when the window comes back to the front, for a picture dropped into the folder meanwhile');
  assert.match(setting, /readWallpapers\(/, 'every read goes through the reader that caches nothing');
});

test('the strip shows the app background first and then every picture in the folder, and the arrows walk all of it', async () => {
  const items = [
    { name: 'a.jpg', url: '/api/appearance/wallpapers/a.jpg' },
    { name: 'b.png', url: '/api/appearance/wallpapers/b.png' },
  ];
  const choices = wallpaperChoices(items, 'Default background');
  assert.deepEqual(choices.map(choice => choice.value), ['default', 'a.jpg', 'b.png'], 'the app background first, then the folder as listed');
  assert.equal(choices[0].url, null, 'the app background has no picture to show');
  assert.equal(choices[1].url, '/api/appearance/wallpapers/a.jpg');
  assert.equal(nextWallpaper(choices, 'default', 1), 'a.jpg');
  assert.equal(nextWallpaper(choices, 'b.png', 1), 'default', 'past the last one it starts again');
  assert.equal(nextWallpaper(choices, 'default', -1), 'b.png', 'and before the first one it goes to the last');
  assert.equal(nextWallpaper(choices, 'gone.jpg', 1), 'default', 'a picture deleted from the folder starts the walk at the beginning');
  assert.equal(nextWallpaper(choices, 'gone.jpg', -1), 'b.png', 'or at the end, going back');
  assert.equal(nextWallpaper([choices[0]], 'default', 1), null, 'one entry: nothing to move to, so nothing is applied');
});

test('the setting draws that strip: arrows, one thumbnail per entry, and the applied one marked', async () => {
  const setting = await readFile(new URL('../src/components/WallpaperSetting.tsx', import.meta.url), 'utf8');
  assert.match(setting, /className="wallpaper-setting__strip"[^>]*ref=\{strip\}/, 'the strip is there, with the scroll container ref');
  assert.match(setting, /choices\.map\(choice => <button[^>]*className="wallpaper-thumb"[^>]*data-active=\{choice\.value === current/, 'one thumbnail per entry, the applied one marked');
  assert.match(setting, /onClick=\{\(\) => setWallpaper\(choice\.value\)\}/, 'picking a thumbnail applies it');
  assert.match(setting, /wallpaper-setting__step--back" name="chevron" title=\{tr\('Previous background'\)\}/, 'an arrow back');
  assert.match(setting, /wallpaper-setting__step--next" name="chevron" title=\{tr\('Next background'\)\}/, 'an arrow forward');
  assert.match(setting, /scrollIntoView\(\{ block: 'nearest', inline: 'center' \}\)/, 'the applied one is scrolled into view');
  const css = await readFile(new URL('../src/styles/liquid.css', import.meta.url), 'utf8');
  assert.match(css, /\.wallpaper-setting__strip \{[^}]*overflow-x: auto/, 'the strip scrolls sideways');
  assert.match(css, /\.wallpaper-thumb \{[^}]*flex: 0 0 104px/, 'the thumbnails keep their width while it scrolls');
});

/**
 * The guards of the make-*-locales.py scripts: a new English string whose text already lives in another English set (en.json included) must stop the
 * script with its message and leave every catalog as it was. The same sentence under two ids is how s1150/fx157 and s3273/fxpr1 drifted apart.
 *
 * Each script writes src/locales, so every case runs in a copy of the English sets: the real catalogs are never a target. One duplicate (a text taken
 * from en.json) is appended to the script's own list right before its guard, and the run must end in the guard, not in a traceback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const scripts = resolve(import.meta.dirname, '..', 'scripts');
const catalogs = resolve(import.meta.dirname, '..', 'src', 'locales');
const english = JSON.parse(readFileSync(join(catalogs, 'en.json'), 'utf8'));
const names = readdirSync(scripts).filter(file => /^make-[a-z0-9]+-locales\.py$/.test(file)).sort();

function python() {
  for (const exe of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    const r = spawnSync(exe, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return exe;
  }
  return null;
}
const py = python();

/** The script's own English file, by the `<name>-en.json` its guard reads: texts it already carries are its own and never stop it. */
function ownTexts(file) {
  const source = readFileSync(join(scripts, file), 'utf8');
  const name = /([a-z0-9]+)-en\.json"/.exec(source)?.[1];
  assert.ok(name, `${file}: the guard reads its own English file`);
  const path = join(catalogs, `${name}-en.json`);
  return new Set(Object.values(JSON.parse(readFileSync(path, 'utf8'))));
}

/** A text that really lives in en.json and is not one the script already carries. */
function duplicate(file) {
  const own = ownTexts(file);
  const text = Object.values(english).find(value => typeof value === 'string' && value.trim() && !own.has(value));
  assert.ok(text, `${file}: en.json has a text this script does not carry`);
  return text;
}

/** Inserts the duplicate right before the guard call, in the list that call reads. */
function withDuplicate(source, text) {
  const literal = JSON.stringify(text);
  const calls = [
    ['only_once(entry["en"] for entry in S)', `S.append(dict.fromkeys(("en", "zh", "ja", "de", "es", "ru", "pt", "ko", "fr"), ${literal}))`],
    ['only_once(EN)', `EN.append(${literal})`],
    ['only_once(KEYS)', `KEYS.append(${literal})`],
    ['plan = ids(EN)', `EN.append(${literal})`],
  ];
  for (const [call, line] of calls) {
    const at = source.indexOf(`\n${call}`);
    if (at < 0) continue;
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    return source.slice(0, at + 1) + line + eol + source.slice(at + 1);
  }
  throw new Error('the guard call was not found');
}

function snapshot(dir) {
  return Object.fromEntries(readdirSync(dir).sort().map(file => [file, createHash('sha256').update(readFileSync(join(dir, file))).digest('hex')]));
}

for (const file of names) {
  test(`${file}: a text that already lives in en.json stops the guard and writes nothing`, { skip: !py && 'no python here' }, () => {
    const root = mkdtempSync(join(tmpdir(), 'nostroma-locales-'));
    try {
      const host = join(root, 'apps', 'host');
      const copies = join(host, 'src', 'locales');
      mkdirSync(copies, { recursive: true });
      mkdirSync(join(host, 'scripts'), { recursive: true });
      for (const catalog of readdirSync(catalogs).filter(name => name === 'en.json' || name.endsWith('-en.json'))) {
        copyFileSync(join(catalogs, catalog), join(copies, catalog));
      }
      const text = duplicate(file);
      writeFileSync(join(host, 'scripts', file), withDuplicate(readFileSync(join(scripts, file), 'utf8'), text), 'utf8');
      const before = snapshot(copies);

      const r = spawnSync(py, [join('scripts', file)], { cwd: host, encoding: 'utf8' });

      assert.equal(r.status, 1, `the guard stops the run: ${r.stderr}`);
      assert.doesNotMatch(r.stderr, /Traceback/, 'the guard stops it, not a mistake in the test');
      assert.match(r.stderr, /already lives in [a-z0-9-]+\.json:/, 'the message names where the text already lives');
      assert.match(r.stderr, /already lives in en\.json:s\d+/, 'and it is the text this test took from en.json');
      assert.ok(r.stderr.includes(text), 'the message names the duplicate text');
      assert.match(r.stderr, /One id per text/);
      assert.deepEqual(snapshot(copies), before, 'no catalog changed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

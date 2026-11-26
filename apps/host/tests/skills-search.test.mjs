/** Skills: a search finds the REA recommendation, and the list translates built-in copy while a description the person wrote stays as written. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
/* discover-catalog.ts imports the REA instructions with Vite's `?raw`, which esbuild does not read by itself. */
const raw = {
  name: 'raw',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, args => ({ path: join(args.resolveDir, args.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, args => ({ contents: `export default ${JSON.stringify(readFileSync(args.path, 'utf8'))};`, loader: 'js' }));
  },
};
const built = await build({
  stdin: {
    contents: "export { skillRows, skillName, skillDescription } from './src/lib/skill-list'; export { setTranslationLanguage, translationsReady } from './src/lib/i18n';",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.json': 'json' }, plugins: [raw], logLevel: 'silent',
});
const dir = mkdtempSync(join(tmpdir(), 'nostroma-skills-search-'));
writeFileSync(join(dir, 'skills.mjs'), built.outputFiles[0].text);
const { skillRows, skillDescription, setTranslationLanguage, translationsReady } = await import(pathToFileURL(join(dir, 'skills.mjs')).href);
rmSync(dir, { recursive: true, force: true });

const skill = over => ({ id: 'my-skill', name: 'A skill', description: 'Something I wrote', source: 'added', enabled: true, triggers: [], sizeKb: 1, useCount: 0, lastUsedAt: null, onlyIn: null, ...over });
const CODE_REVIEW = 'Reviews a file or diff for correctness first, style second, and reports findings with line numbers.';
const CODE_REVIEW_DE = 'Prüft eine Datei oder einen Diff zuerst auf Korrektheit, dann auf Stil und meldet Befunde mit Zeilennummern.';
const names = rows => rows.visibleRecommended.map(s => s.name);

test("searching 'REA' finds the recommendation", () => {
  assert.deepEqual(names(skillRows([], 'REA')), ['REA']);
  assert.deepEqual(names(skillRows([], 'rea')), ['REA'], 'the search ignores case');
  assert.deepEqual(names(skillRows([], '  rea ')), ['REA'], 'spaces around the search are ignored');
  assert.equal(skillRows([], 'no such skill').visibleRecommended.length, 0, 'another word does not show it');
  assert.equal(skillRows([], '').searching, false, 'an empty box is not a search');
  // Once it is installed, it is listed with the person's skills and not offered again.
  const installed = skillRows([skill({ id: 'my-rea', name: 'REA' })], 'REA');
  assert.deepEqual(installed.visibleRecommended, []);
  assert.deepEqual(installed.visible.map(s => s.name), ['REA']);
});

test('a known description is translated; one the person wrote stays exactly as written', async () => {
  await setTranslationLanguage('de');
  await translationsReady();
  const builtIn = skill({ id: 'code-review', name: 'Code review', description: CODE_REVIEW, source: 'bundled' });
  assert.equal(skillDescription(builtIn), CODE_REVIEW_DE, 'a built-in description follows the language');
  assert.deepEqual(skillRows([builtIn], 'Zeilennummern').visible.map(s => s.name), ['Code review'], 'the search reads the translated words');
  const mine = skill({ description: 'Turn my Monday notes into five lines for the Berlin team.' });
  assert.equal(skillDescription(mine), 'Turn my Monday notes into five lines for the Berlin team.', 'a description the person wrote is left alone');
  // Known interface copy is translated even on a skill the person added.
  assert.equal(skillDescription(skill({ description: CODE_REVIEW })), CODE_REVIEW_DE);
  await setTranslationLanguage('en');
  assert.equal(skillDescription(builtIn), CODE_REVIEW, 'English is the text itself');
  assert.equal(skillDescription(mine), 'Turn my Monday notes into five lines for the Berlin team.');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';

const languages = ['en', 'zh', 'ja', 'de', 'es', 'ru', 'pt', 'ko', 'fr'];
const read = async name => JSON.parse(await readFile(`src/locales/${name}.json`, 'utf8'));
const built = await build({ stdin: { contents: "export * from './src/lib/i18n';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.json': 'json' } });
const { tr, setTranslationLanguage, loadCatalog } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
for (const l of ['zh', 'ja', 'de', 'es', 'ru', 'pt', 'ko', 'fr']) await loadCatalog(l);  // the non-English catalogs load on first use (src/lib/i18n.ts loadCatalog); load them before the first tr()

test('every tr("...") literal and every command hint has a key in the English catalog, so no language is stuck in English (#3479)', async () => {
  const brand = (t) => String(t).replace(/\bNostroma\b/g, 'Nostroma');   // the catalogues keep upstream's wording; i18n.ts swaps it on the way out
  const known = new Set();
  for (const name of ['en', 'tune-en', 'tools-en', 'fix-en', 'gh-en', 'ui-en', 'engine-en', 'pick-en', 'df2-en', 'upd-en', 'r3-en', 'pic-en', 'gui-en', 'sav-en', 'workbench-en', 'chat-en']) for (const v of Object.values(await read(name))) { known.add(String(v)); known.add(brand(v)); }
  const missing = [];
  /* What tr() receives may be an expression and not a literal: a conditional,
     a fallback, a lookup in a constant table, or each value of a mapped
     constant array. Reading only literals left the UI half translated while
     this test was green, so the walk follows those shapes too. */
  const gapsIn = (path, source) => {
    const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    /* Only declarations at the top of the file: a parameter or a local named
       `option` must not be read as the module's `option`. */
    const consts = new Map();
    for (const statement of sf.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.initializer) consts.set(declaration.name.text, declaration.initializer);
    }
    const unwrap = e => { while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || (ts.isSatisfiesExpression?.(e) ?? false))) e = e.expression; return e; };
    const wordsOf = (e, seen = new Set()) => {
      e = unwrap(e);
      if (!e) return [];
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text.trim()];
      if (ts.isConditionalExpression(e)) return [...wordsOf(e.whenTrue, seen), ...wordsOf(e.whenFalse, seen)];
      if (ts.isBinaryExpression(e) && ['||', '??'].includes(e.operatorToken.getText(sf))) return [...wordsOf(e.left, seen), ...wordsOf(e.right, seen)];
      if (ts.isIdentifier(e)) {
        // `efforts.map(option => tr(option))`: the words belong to the array.
        let owner = e;
        while (owner && !ts.isArrowFunction(owner) && !ts.isFunctionExpression(owner) && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
        if (owner && owner.parameters?.some(p => ts.isIdentifier(p.name) && p.name.text === e.text) && ts.isCallExpression(owner.parent) && ts.isPropertyAccessExpression(owner.parent.expression) && owner.parent.expression.name.text === 'map')
          return wordsOf(owner.parent.expression.expression, seen);
        const init = consts.get(e.text);
        if (!init || seen.has(e.text)) return [];
        seen.add(e.text);
        return wordsOf(init, seen);
      }
      if (ts.isPropertyAccessExpression(e)) {
        const base = unwrap(consts.get(e.expression.getText(sf)));
        const property = base && ts.isObjectLiteralExpression(base) ? base.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(sf) === e.name.text) : null;
        return property && ts.isPropertyAssignment(property) ? wordsOf(property.initializer, seen) : [];
      }
      if (ts.isObjectLiteralExpression(e)) return e.properties.flatMap(p => ts.isPropertyAssignment(p) ? wordsOf(p.initializer, seen) : []);
      if (ts.isArrayLiteralExpression(e)) return e.elements.flatMap(x => wordsOf(x, seen));
      if (ts.isElementAccessExpression(e)) return wordsOf(e.expression, seen);
      return [];
    };
    /* A single token is copy only when it reads like a label: ids, URLs, paths
       and model names (`Qwen-Image-2.1-Turbo`) are values, not sentences. */
    const copy = text => {
      const t = String(text).trim();
      if (!t || !/[a-zA-Z]{2}/.test(t)) return false;
      if (/\s/.test(t)) return !/^(https?:\/\/|[A-Za-z]:\\|\/)/.test(t);
      if (/[0-9_\\/:]/.test(t)) return false;
      return !/^[A-Za-z0-9.]+-[A-Za-z0-9.-]+$/.test(t);
    };
    const found = [];
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.getText(sf) === 'tr' && node.arguments[0]) {
        for (const text of wordsOf(node.arguments[0])) if (copy(text) && !known.has(text)) found.push(`${path}: ${text}`);
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'hint' && ts.isStringLiteral(node.initializer) && !path.endsWith('chat-showcase.ts')) {
        const text = node.initializer.text.trim();
        if (text && !known.has(text)) found.push(`${path}: hint ${text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
  };
  // The walk must keep seeing these shapes: a change that reads literals only fails here first.
  const probe = gapsIn('probe.tsx', [
    "const LABELS = { a: 'Alpha bound', b: 'Beta bound' };",
    "const MODES = ['manual words', 'plan words'];",
    "const FALLBACK = 'Fallback words';",
    "tr(cond ? 'One branch' : 'Other branch');",
    "tr(LABELS[id]);",
    "tr(FALLBACK || 'Other fallback');",
    "tr(MODES.map(mode => tr(mode)));",
  ].join('\n'));
  assert.deepEqual(probe.map(line => line.replace('probe.tsx: ', '')).sort(), ['Alpha bound', 'Beta bound', 'Fallback words', 'One branch', 'Other branch', 'Other fallback', 'manual words', 'plan words'].sort());
  const scan = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'locales') await scan(path); continue; }
      if (!/\.tsx?$/.test(path)) continue;
      missing.push(...gapsIn(path, await readFile(path, 'utf8')));
    }
  };
  await scan('src');
  assert.deepEqual(missing, []);
});

test('the fix catalogs have the same keys and placeholders in all nine languages', async () => {
  const en = await read('fix-en');
  for (const language of languages) {
    const catalog = await read(`fix-${language}`);
    assert.deepEqual(Object.keys(catalog), Object.keys(en), language);
    for (const [id, text] of Object.entries(catalog)) assert.deepEqual((text.match(/\{\d+\}/g) ?? []).sort(), (en[id].match(/\{\d+\}/g) ?? []).sort(), `${language} ${id}`);
  }
});

test('every sentence the general audit can say has a key in every catalog (#4803)', async () => {
  const { AUDIT_KEYS } = await import('../server/audit-details.mjs');
  assert.ok(AUDIT_KEYS.length >= 10, 'the audit keeps its sentences in one list');
  const english = Object.values(await read('fix-en'));
  for (const key of AUDIT_KEYS) assert.ok(english.includes(key), `fix-en has no key for: ${key}`);
  // The route may only say what the list declares: a new sentence without a key fails here, not in a Spanish dialog.
  const route = await readFile('server/index.mjs', 'utf8');
  const used = [...route.matchAll(/auditLine\(\s*'([^']+)'/g)].map(match => match[1]);
  assert.ok(used.length >= 10, 'the audit builds its lines through auditLine');
  assert.deepEqual(used.filter(key => !AUDIT_KEYS.includes(key)), []);
  for (const language of languages.slice(1)) {
    setTranslationLanguage(language);
    for (const key of AUDIT_KEYS) {
      const values = Array((key.match(/\{\d+\}/g) ?? []).length).fill('X');
      assert.notEqual(tr(key, values), key, `${language}: ${key}`);
    }
  }
  setTranslationLanguage('en');
});

test('every word the general audit dialog shows resolves to a key all nine catalogs have (#4803)', async () => {
  const { AUDIT_KEYS } = await import('../server/audit-details.mjs');
  /* i18n.ts merges the catalogs in this order and settles each English text on the
     last id it was given, so a duplicate id in a later file hides the translated
     one: that is how the audit's "Engine" and "Model" came out in English. */
  const sources = ['en', 'tune', 'tools', 'fix', 'gh', 'ui', 'engine', 'pick', 'df2', 'upd', 'r3', 'pic', 'gui', 'sav', 'net', 'workbench', 'chat'];
  const fileOf = (name, language) => (name === 'en' ? language : `${name}-${language}`);
  const catalogOf = async language => {
    const parts = await Promise.all(sources.map(async name => {
      try { return await read(fileOf(name, language)); } catch { return {}; }
    }));
    return Object.assign({}, ...parts);
  };
  const english = await catalogOf('en');
  const idOf = new Map();
  for (const [id, text] of Object.entries(english)) idOf.set(text, id);
  const words = [
    ...AUDIT_KEYS,
    'General audit', 'Close', 'Check again', 'Checking…', 'Everything checked out.',
    'Nothing broken; {0} to watch.', '{0} need attention; {1} to watch.',
    'Nostroma looks at this computer and this profile. Nothing is changed and nothing is sent.',
    'Nostroma looks at this project, this computer and this profile. Nothing is changed and nothing is sent.',
    'Checked {0}', 'The audit could not run: {0}',
    'Project folder', 'Project changes',
    'Profile folder', 'Free space for the profile', 'Free space for models', 'Engine', 'Model',
    'Projects', 'Chats', 'git', 'Graphics card',
  ];
  for (const word of words) {
    const id = idOf.get(word);
    assert.ok(id, `the English catalogs have no id for: ${word}`);
    for (const language of languages.slice(1)) {
      const catalog = await catalogOf(language);
      assert.notEqual(catalog[id], undefined, `${language}: "${word}" falls back to English (${id} missing)`);
    }
  }
});

test('the /plan, /research and /new hints and the four "Open ..." hints are translated (#3479, #3825)', () => {
  for (const language of ['zh', 'ru']) {
    setTranslationLanguage(language);
    for (const hint of ['Have the assistant write a plan first; nothing runs until you approve it', 'Search the web, read the pages and answer with sources', 'Start a new conversation; keep this one'])
      assert.notEqual(tr(hint), hint, `${language}: ${hint}`);
    for (const label of ['Model settings', 'Serving', 'Models', 'Skills']) {
      const hint = tr(`Open ${label}`);
      assert.notEqual(hint, `Open ${label}`, `${language}: ${label} template`);
      assert.ok(!hint.includes(label), `${language}: the label is translated too: ${hint}`);
    }
  }
  setTranslationLanguage('zh');
  assert.equal(tr('Open Skills'), '打开 技能');
  setTranslationLanguage('en');
  assert.equal(tr('Open Skills'), 'Open Skills');
});

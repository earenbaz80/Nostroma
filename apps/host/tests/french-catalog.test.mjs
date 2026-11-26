import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { findChromium } from '../scripts/browser.mjs';

// French (#3970): the catalogs are complete (the generic language tests cover keys and placeholders); these tests cover
// what is specific to French: spacing before ? ! : ;, apostrophes, short labels staying short, and the picker entry.
// The last test takes the short-label rule to what actually breaks — pixels — for all nine languages, measured in the
// app's own face (11-2026).
const names = [['en', 'fr'], ['fix-en', 'fix-fr'], ['tune-en', 'tune-fr'], ['tools-en', 'tools-fr']];
const read = async name => JSON.parse(await readFile(`src/locales/${name}.json`, 'utf8'));
const compiled = await build({ stdin: { contents: "export * from './src/lib/i18n';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', loader: { '.json': 'json' } });
const { tr, setTranslationLanguage, localeTag, currentLanguage, LANGUAGES, validLanguage, loadCatalog } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
for (const l of ['zh', 'ja', 'de', 'es', 'ru', 'pt', 'ko', 'fr']) await loadCatalog(l);  // the non-English catalogs load on first use (src/lib/i18n.ts loadCatalog); load them before the first tr()

test('French is in the language picker under its own name', () => {
  const entry = LANGUAGES.find(item => item.value === 'fr');
  assert.equal(entry?.label, 'Français');
  assert.ok(validLanguage('fr'));
  assert.equal(LANGUAGES.length, 9);
  setTranslationLanguage('fr');
  assert.equal(currentLanguage(), 'fr');
  assert.equal(localeTag(), 'fr');
  assert.equal(tr('Settings'), 'Paramètres');
  assert.equal(tr('Cancel'), 'Annuler');
  assert.equal(tr('Open {0}', ['Modèles']).includes('{'), false);
  assert.equal(tr('unrecognized user content Ω'), 'unrecognized user content Ω');
  setTranslationLanguage('en');
});

test('French text keeps the French typography: a no-break space before ? ! : ; and a typographic apostrophe', async () => {
  const bad = [];
  for (const [englishName, frenchName] of names) {
    const english = await read(englishName), french = await read(frenchName);
    for (const [id, text] of Object.entries(french)) {
      if (text === english[id]) continue; // kept as is: names, file names, class names
      if (/[A-Za-zÀ-ÿ\)\]\d%] [?!;:]/.test(text) && !/https?:|\d:\d/.test(text)) bad.push(`${id}: ordinary space before punctuation: ${text}`);
      if (/[A-Za-zÀ-ÿ\)\]\d%][?!;]/.test(text)) bad.push(`${id}: no space before ? ! or ;: ${text}`);
      if (/[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ{]/.test(text)) bad.push(`${id}: straight apostrophe: ${text}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('short labels stay short in French (buttons, tabs, chips)', async () => {
  const english = await read('en'), french = await read('fr');
  const long = [];
  for (const [id, text] of Object.entries(english)) {
    if (text.length > 10 || french[id] === text || /\{\d+\}/.test(text)) continue;
    // a label of up to 10 letters may take up to 3 times the room, and never more than 36 characters
    if (french[id].length > Math.max(18, text.length * 3.2) || french[id].length > 36) long.push(`${id}: ${text} -> ${french[id]} (${french[id].length})`);
  }
  assert.deepEqual(long, []);
});

/**
 * Each string as the window draws it: the app's own stylesheet in Chromium, so the @font-face files and the --st-font
 * stack are the ones the product ships, at the 13px/600 a sidebar row, a menu item and a chip set a label in.
 */
async function measureWidths(shown) {
  const root = resolve(import.meta.dirname, '..');
  const css = await readFile(join(root, 'src/styles/nostroma-crt.css'), 'utf8');
  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.route('**/fonts/*', async (route) => {
      const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/fonts/')[1] ?? '');
      try {
        await route.fulfill({ path: join(root, 'public/fonts', name), contentType: 'font/woff2' });
      } catch {
        await route.fulfill({ status: 404, body: '' });
      }
    });
    await page.setContent(`<base href="http://nostroma.test/"><style>${css}</style>`);
    return await page.evaluate(async ({ shown }) => {
      const stack = getComputedStyle(document.documentElement).getPropertyValue('--st-font').trim();
      await document.fonts.load('600 13px "IBM Plex Mono"', 'A');
      await document.fonts.ready;
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `600 13px ${stack}`;
      const widths = {};
      for (const [lang, rows] of Object.entries(shown)) widths[lang] = rows.map((row) => ({ ...row, px: ctx.measureText(row.text).width }));
      return { widths, loaded: document.fonts.check('600 13px "IBM Plex Mono"') };
    }, { shown });
  } finally {
    await browser.close();
  }
}

test('a short label fits its box in every language, measured in the app\'s own face', { skip: !findChromium() && 'no Chromium here' }, async () => {
  // The French rule above counts characters ("short labels stay short"); what breaks a sidebar row, a menu item or a
  // chip is pixels, and a translation can read short in letters and still be long on screen. So the widths are measured
  // over the strings the window actually shows, in every language, in the face it draws them with.
  const english = await read('en');
  const ids = Object.keys(english).filter((id) => english[id].trim() && english[id].length <= 10 && !/\{\d+\}/.test(english[id]));
  const languages = ['en', 'de', 'fr', 'es', 'pt', 'ru', 'zh', 'ja', 'ko'];
  // Recorded 25-11-2026 from the widest label each language ships — en "(optional)" 80, de "Aktuelle Geschwindigkeit"
  // 192, fr "Objectif de l’installation" 208, es "Configuración sin procesar" 208, pt "De segunda a sexta-feira" 192,
  // ru "Установлена последняя версия" 203, zh "两处都能使用。" 91, ja "セットアップを実行" 117, ko "둘 다 사용할 수
  // 있습니다." 160 — plus about one character (8.32px in this face). Every one of them stays inside the 240px a 280px
  // menu row leaves for its text beside the icon. A translation that needs more has to be shortened, or the ceiling
  // raised here on purpose, after checking where that label is drawn.
  const CEILING = { en: 88, de: 200, fr: 216, es: 216, pt: 200, ru: 211, zh: 99, ja: 125, ko: 168 };
  const shown = {};
  for (const lang of languages) {
    setTranslationLanguage(lang);
    shown[lang] = ids.map((id) => ({ id, english: english[id], text: tr(english[id]) }));
  }
  setTranslationLanguage('en');
  const measured = await measureWidths(shown);
  assert.ok(measured.loaded, 'the app face did not load, so these are a system font\'s widths, not the app\'s');
  const over = [];
  for (const lang of languages) {
    for (const row of measured.widths[lang]) {
      if (row.text === row.english) continue; // kept as is: names, file names, keys
      if (row.px > CEILING[lang]) over.push(`${lang} ${row.id}: "${row.text}" ${row.px.toFixed(1)}px > ${CEILING[lang]}px`);
    }
  }
  assert.deepEqual(over, []);
});

test('no French string is still English by accident: at most 5% of the main catalog is left unchanged', async () => {
  const english = await read('en'), french = await read('fr');
  const same = Object.keys(english).filter(id => english[id] === french[id]);
  assert.ok(same.length < Object.keys(english).length * 0.05, `${same.length} unchanged`);
  // every unchanged string has no real words in it, or is a name that is spelled the same in French
  const words = same.filter(id => english[id].split(/\s+/).length >= 4 && /\s(the|your|you|is|are|this|that|with|from|and)\s/i.test(english[id]) && !/^[-/\\]/.test(english[id]));
  assert.deepEqual(words.map(id => `${id}: ${english[id]}`), []);
});

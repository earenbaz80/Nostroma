/**
 * English is the key of every translated string: two ids that carry the same text are one sentence written twice, and only one of them can answer. This
 * file holds the whole inventory of that today, and checks it against the catalogues on every run.
 *
 * How the ids resolve (src/lib/i18n.ts):
 *  - `english = {...en, ...tune-en, ...tools-en, ...fix-en, ...gh-en, ...ui-en, ...engine-en, ...pick-en, ...df2-en, ...upd-en, ...r3-en, ...pic-en,
 *    ...gui-en, ...sav-en, ...net-en, ...workbench-en, ...chat-en}`: a later set wins the value of a repeated id, and an id keeps the place it first took.
 *  - `ids = new Map(entries.flatMap(([id, value]) => [[decode(value), id], [decode(brandName(value)), id]]))`: a later entry overwrites an earlier one, so
 *    for a text carried twice, the id from the set merged LAST is the one `tr()` looks up. `ids` below repeats that build to keep the claim verifiable.
 *  - `tr()` reads `catalogs[language][id] ?? english[id]`. The workbench and chat sets exist in English and Spanish only (workbench-<lang>.json and
 *    chat-<lang>.json are not in the other catalog-<lang>.ts files), so where a workbench or chat id wins, the other seven languages show the English
 *    text: fifteen texts × seven languages = 105 lookups.
 *  - Two of the texts have slots, and the two ways of asking read different ids. With a value, `tr('Only in {0}', [x])`, which is how the screens call
 *    them, the exact id answers: the winner. A string that already carries the value, `tr('Only in 3 files')`, has no exact id and goes through the
 *    `{0}` patterns, sorted by specificity with a stable sort, where the EARLIER id answers. The last test pins both.
 *
 * Each line of INVENTORY is [text, ids in merge order, winning id, the translation the losing id carries per language (null: that language has no entry),
 * and, only for a text with slots, the id a string that already carries the value lands on].
 * A text that appears with a second id and is not here fails the first test: give the text one id, or, when the two sets must keep their own words, add
 * its line with the id the spread order lets win.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const read = async file => JSON.parse(await readFile(new URL(`../src/locales/${file}`, import.meta.url), 'utf8'));

/* The English sets, read from i18n.ts's own imports so a set added there is covered the day it lands; the order is the spread order. */
const i18n = await readFile(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8');
const files = [...i18n.matchAll(/from '\.\.\/locales\/([a-z0-9-]+\.json)'/g)].map(m => m[1]);
const english = {};
for (const file of files) Object.assign(english, await read(file));

/* src/lib/i18n.ts's decode and brandName, so the keys the inventory groups on are the keys `ids` holds. */
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
const decode = text => String(text).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, key) => key[0] === '#'
    ? String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10))
    : entities[key] ?? whole);
const BRAND = /(?<![\/\\])\bNostroma\b(?!\s*[\/\\])/g;
const brandName = text => String(text).replace(BRAND, 'Nostroma');

const LANGUAGES = ['zh', 'ja', 'de', 'fr', 'es', 'ru', 'pt', 'ko'];

const INVENTORY = [
    ['Add folder', ['s0057', 'wb38'], 'wb38', { zh: '添加文件夹', ja: 'フォルダーを追加', de: 'Ordner hinzufügen', fr: 'Ajouter un dossier', es: 'Añadir carpeta', ru: 'Добавить папку', pt: 'Adicionar pasta', ko: '폴더 추가' }],
    ['Adding…', ['s0070', 'wb39'], 'wb39', { zh: '正在添加…', ja: '追加中…', de: 'Wird hinzugefügt…', fr: 'Ajout…', es: 'Añadiendo…', ru: 'Добавление…', pt: 'Adicionando…', ko: '추가 중…' }],
    ['Back', ['s0138', 'wb18'], 'wb18', { zh: '返回', ja: '戻る', de: 'Zurück', fr: 'Retour', es: 'Volver', ru: 'Назад', pt: 'Voltar', ko: '뒤로' }],
    ['Command', ['s2776', 'wb17'], 'wb17', { zh: '命令', ja: 'コマンド', de: 'Befehl', fr: 'Commande', es: 'Comando', ru: 'Команда', pt: 'Comando', ko: '명령' }],
    ['Context', ['s0371', 'chat27'], 'chat27', { zh: '上下文', ja: 'コンテキスト', de: 'Kontext', fr: 'Contexte', es: 'Contexto', ru: 'Контекст', pt: 'Contexto', ko: '컨텍스트' }],
    ['Folder path', ['s3149', 'wb29'], 'wb29', { zh: '文件夹路径', ja: 'フォルダーのパス', de: 'Ordnerpfad', fr: 'Chemin du dossier', es: 'Ruta de la carpeta', ru: 'Путь к папке', pt: 'Caminho da pasta', ko: '폴더 경로' }],
    ['GPU', ['s0764', 'chat28'], 'chat28', { zh: 'GPU', ja: 'GPU', de: 'GPU', fr: 'GPU', es: 'GPU', ru: 'GPU', pt: 'GPU', ko: 'GPU' }],
    ['Go', ['s0808', 'wb22'], 'wb22', { zh: '前往', ja: '移動', de: 'Los', fr: 'Aller', es: 'Ir', ru: 'Перейти', pt: 'Ir', ko: '이동' }],
    ['Idle', ['s0833', 'chat40'], 'chat40', { zh: '空闲', ja: '待機中', de: 'Leerlauf', fr: 'Inactif', es: 'Inactivo', ru: 'Ожидание', pt: 'Ocioso', ko: '유휴 상태' }],
    ['Loading…', ['s0967', 'wb34'], 'wb34', { zh: '正在加载…', ja: '読み込み中…', de: 'Wird geladen…', fr: 'Chargement…', es: 'Cargando…', ru: 'Загрузка…', pt: 'Carregando…', ko: '불러오는 중…' }],
    ['Not reported', ['s1194', 'chat39'], 'chat39', { zh: '未报告', ja: '報告なし', de: 'Nicht gemeldet', fr: 'Non communiqué', es: 'Sin datos', ru: 'Нет данных', pt: 'Não informado', ko: '보고되지 않음' }],
    ['Only in {0}', ['s1216', 'chat10'], 'chat10', { zh: '仅在 {0} 中', ja: '{0}のみ', de: 'Nur in {0}', fr: 'Seulement dans {0}', es: 'Solo en {0}', ru: 'Только в {0}', pt: 'Somente em {0}', ko: '{0}에서만' }, 's1216'],
    ['Running…', ['s1527', 'wb16'], 'wb16', { zh: '正在运行…', ja: '実行中…', de: 'Läuft…', fr: 'En cours…', es: 'Ejecutando…', ru: 'Выполнение…', pt: 'Executando…', ko: '실행 중…' }],
    ['State', ['s1727', 'chat26'], 'chat26', { zh: '状态', ja: '状態', de: 'Zustand', fr: 'État', es: 'Estado', ru: 'Состояние', pt: 'Estado', ko: '상태' }],
    ['Working folder', ['gf05', 'wb12'], 'wb12', { zh: '工作文件夹', ja: '作業フォルダー', de: 'Arbeitsordner', fr: 'Dossier de travail', es: 'Carpeta de trabajo', ru: 'Рабочая папка', pt: 'Pasta de trabalho', ko: '작업 폴더' }],
    ['{0} free', ['s8344', 'vp12'], 'vp12', { zh: '可用 {0}', ja: '空き {0}', de: '{0} frei', fr: '{0} libres', es: '{0} libres', ru: 'свободно {0}', pt: '{0} livres', ko: '{0} 여유' }, 's8344'],
].map(([text, ids, winner, loses, formattedUses]) => ({ text, ids, winner, loses, formattedUses }));

/** Every English text the merged catalogues carry under more than one id, with its ids in the order the spread puts them, and the id that wins. */
function duplicates() {
    const byText = new Map();
    for (const id of Object.keys(english)) {
        const text = decode(english[id]);
        if (typeof text !== 'string' || !text) continue;
        byText.set(text, [...(byText.get(text) ?? []), id]);
    }
    return [...byText].filter(([, ids]) => ids.length > 1)
        .map(([text, ids]) => ({ text, ids, winner: ids[ids.length - 1] }))
        .sort((a, b) => a.text < b.text ? -1 : a.text > b.text ? 1 : 0);
}

/** The ids map i18n.ts builds: the last id carrying a text (or its brand spelling) is the one `tr()` finds. */
function index() {
    const ids = new Map();
    for (const [id, value] of Object.entries(english)) {
        ids.set(decode(value), id);
        ids.set(decode(brandName(value)), id);
    }
    return ids;
}

/** The catalogue each language reads: its own file list, from catalog-<lang>.ts. */
const catalogs = {};
for (const language of LANGUAGES) {
    const source = await readFile(new URL(`../src/lib/catalog-${language}.ts`, import.meta.url), 'utf8');
    const merged = {};
    for (const file of [...source.matchAll(/from '\.\.\/locales\/([a-z0-9-]+\.json)'/g)].map(m => m[1])) Object.assign(merged, await read(file));
    catalogs[language] = merged;
}

test('the texts carried by two ids are exactly the inventory, with the id the spread order lets win', () => {
    const found = duplicates();
    const added = found.filter(group => !INVENTORY.some(line => line.text === group.text));
    const gone = INVENTORY.filter(line => !found.some(group => group.text === line.text));
    assert.deepEqual(added, [], 'a new repetition: one English text, one id. `ids` is a Map keyed by the text, so the later id silently takes the other one\'s place; give the text a single id, or add its line to INVENTORY with the id the spread order lets win and the translation the other id loses');
    assert.deepEqual(gone, [], 'this text no longer has two ids, so its line in INVENTORY must go: the inventory stays the whole truth');
    assert.deepEqual(
        found.map(group => ({ text: group.text, ids: group.ids, winner: group.winner })),
        INVENTORY.map(line => ({ text: line.text, ids: line.ids, winner: line.winner })),
        'the ids of one of these texts, their merge order, or the id that wins has changed (a set moved in i18n.ts\'s imports, or an id was renamed)'
    );
    const ids = index();
    for (const { text, winner } of found) assert.equal(ids.get(text), winner, `${JSON.stringify(text)} resolves to ${winner} through its plain spelling`);
});

test('the translation the losing id carries per language is the one recorded, and it is unreachable', () => {
    const found = new Map(duplicates().map(group => [group.text, group]));
    for (const line of INVENTORY) {
        const group = found.get(line.text);
        assert.equal(group.ids.length, 2, `${JSON.stringify(line.text)}: the inventory models one losing id per text`);
        const loser = group.ids[0];
        for (const language of LANGUAGES) {
            const carried = catalogs[language][loser];
            assert.equal(
                carried === undefined ? null : carried,
                line.loses[language],
                `${language}:${loser} carries ${JSON.stringify(carried)} for ${JSON.stringify(line.text)}; if the translation changed, update INVENTORY (the losing id is ${loser}, the winner ${line.winner})`
            );
        }
    }
});

test('tr() answers with the winning id, and falls back to English where that id has no translation', async () => {
    const compiled = await build({
        stdin: { contents: "export * from './src/lib/i18n';", resolveDir: process.cwd() },
        bundle: true, write: false, platform: 'node', format: 'esm',
    });
    const i18nModule = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    for (const language of LANGUAGES) await i18nModule.loadCatalog(language);
    const fallbacks = [];
    for (const line of INVENTORY) {
        for (const language of LANGUAGES) {
            i18nModule.setTranslationLanguage(language);
            const translated = catalogs[language][line.winner];
            const expected = translated ?? english[line.winner];
            assert.equal(i18nModule.tr(line.text), expected, `${language}:${line.text} answers the winning id ${line.winner}`);
            if (translated === undefined) fallbacks.push(`${language}:${line.winner}`);
        }
    }
    i18nModule.setTranslationLanguage('en');
    /* Fifteen texts whose winning id is a workbench or chat id (that set exists in English and Spanish only), in the seven languages without it. */
    assert.equal(fallbacks.length, 105, `the winning id has no entry in these languages, so the English text shows: ${fallbacks.join(', ')}`);
});

test('the two texts with slots: a value answers the winner, a string that already carries one answers the earlier id', async () => {
    const compiled = await build({
        stdin: { contents: "export * from './src/lib/i18n';", resolveDir: process.cwd() },
        bundle: true, write: false, platform: 'node', format: 'esm',
    });
    const i18nModule = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    for (const language of LANGUAGES) await i18nModule.loadCatalog(language);
    const slotted = INVENTORY.filter(line => line.formattedUses);
    assert.deepEqual(slotted.map(line => line.text), ['Only in {0}', '{0} free'], 'only these two texts have slots and a second id');
    for (const line of slotted) {
        const sample = 'X7';
        const filled = line.text.replace('{0}', sample);
        for (const language of LANGUAGES) {
            i18nModule.setTranslationLanguage(language);
            const winnerTemplate = catalogs[language][line.winner] ?? english[line.winner];
            assert.equal(i18nModule.tr(line.text, [sample]), winnerTemplate.replace('{0}', sample), `${language}:${line.text} with a value answers ${line.winner}, the winner of the exact lookup`);
            const earlierTemplate = catalogs[language][line.formattedUses] ?? english[line.formattedUses];
            assert.equal(i18nModule.tr(filled), earlierTemplate.replace('{0}', sample), `${language}:${filled} has no exact id, so the patterns answer ${line.formattedUses}`);
        }
    }
    i18nModule.setTranslationLanguage('en');
});

test('the pairs that were unified once stay unified: one variant for Archive and for Picture reader', () => {
    for (const id of ['s1150', 's3273']) assert.equal(english[id], undefined, `${id} was dropped; its text lives under one id only`);
    for (const [text, survivors] of [['Picture reader', ['fxpr1']], ['No model is loaded.', ['fx157']]]) {
        const ids = Object.keys(english).filter(id => english[id] === text);
        assert.deepEqual(ids, survivors, `"${text}" is carried by one id only`);
    }
    assert.ok(files.includes('fix-en.json'), 'the fix set is part of the merged catalogue');
});

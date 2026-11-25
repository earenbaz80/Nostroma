/**
 * English is the key of every translated string: two ids that carry the same text are one sentence written twice, and the second id is dead weight that
 * drifts from the first (that is how "Archive" and "Picture reader" ended up as s1150/fx157 and s3273/fxpr1 before they were unified). This test reads the
 * catalogues `src/lib/i18n.ts` merges into English and fails when a text another id already carries appears under a second id, and also when a pair below
 * has been unified and the list was not trimmed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/* The English sets, read from i18n.ts's own imports so a set added there is covered the day it lands. */
const i18n = await readFile(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8');
const files = [...i18n.matchAll(/from '\.\.\/locales\/([a-z0-9-]+\.json)'/g)].map(m => m[1]);
const english = {};
for (const file of files) Object.assign(english, JSON.parse(await readFile(new URL(`../src/locales/${file}`, import.meta.url), 'utf8')));

/**
 * The pairs that are already like this, kept on purpose: each id belongs to a different set (the main interface against the Workbench, the chat's own
 * options, the version list, the folder dialog) and the two are maintained by different screens, so unifying them would move one screen's words into
 * another's file. A text that is not here with exactly these ids is a new duplicate and fails.
 */
const SHARED = {
    'Add folder': ['s0057', 'wb38'],
    'Adding…': ['s0070', 'wb39'],
    'Back': ['s0138', 'wb18'],
    'Command': ['s2776', 'wb17'],
    'Context': ['chat27', 's0371'],
    'Folder path': ['s3149', 'wb29'],
    'GPU': ['chat28', 's0764'],
    'Go': ['s0808', 'wb22'],
    'Idle': ['chat40', 's0833'],
    'Loading…': ['s0967', 'wb34'],
    'Not reported': ['chat39', 's1194'],
    'Only in {0}': ['chat10', 's1216'],
    'Running…': ['s1527', 'wb16'],
    'State': ['chat26', 's1727'],
    'Working folder': ['gf05', 'wb12'],
    '{0} free': ['s8344', 'vp12'],
};

/** Every text carried by more than one id, with its ids sorted, by text. Two texts that differ by a space the screen needs (" · {0} RAM" against "· {0} RAM") are not the same text and do not count. */
function duplicates() {
    const byText = new Map();
    for (const [id, text] of Object.entries(english)) {
        if (typeof text !== 'string' || !text) continue;
        byText.set(text, [...(byText.get(text) ?? []), id]);
    }
    return [...byText].filter(([, ids]) => ids.length > 1).map(([text, ids]) => [text, ids.sort()]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

test('no two English ids carry the same text in the merged catalogues', () => {
    const expected = Object.entries(SHARED).map(([text, ids]) => [text, [...ids].sort()]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    const found = duplicates();
    const extra = found.filter(([text]) => !(text in SHARED));
    const stale = expected.filter(([text]) => !found.some(([other]) => other === text));
    assert.deepEqual(extra, [], 'a second id for a text that already has one: one variant per text, so the two cannot drift apart');
    assert.deepEqual(stale, [], 'this pair is no longer shared, so its line in SHARED must go: the list stays the whole truth');
    assert.deepEqual(found, expected);
});

test('the pairs that were unified once stay unified: one variant for Archive and for Picture reader', () => {
    const texts = new Map(Object.entries(english).filter(([, text]) => typeof text === 'string').map(([id, text]) => [id, text]));
    for (const id of ['s1150', 's3273']) assert.equal(texts.get(id), undefined, `${id} was dropped; its text lives under one id only`);
    for (const [text, survivors] of [['Picture reader', ['fxpr1']], ['No model is loaded.', ['fx157']]]) {
        const ids = Object.keys(english).filter(id => english[id] === text);
        assert.deepEqual(ids, survivors, `"${text}" is carried by one id only`);
    }
    assert.ok(files.includes('fix-en.json'), 'the fix set is part of the merged catalogue');
});

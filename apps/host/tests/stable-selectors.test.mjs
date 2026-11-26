import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const read = file => readFile(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), 'utf8');

test('the weekly task schedule uses its data-weekly hook, not a translated aria-label', async () => {
  const editor = await read('components/TaskEditor.tsx');
  const css = await read('styles/annotation-fixes.css');
  assert.match(editor, /<div className="task-schedule" data-weekly=\{editor\.frequency === 'weekly' \|\| undefined\}>/);
  assert.match(css, /\.task-editor-panel \.task-schedule\[data-weekly\]/);
  assert.doesNotMatch(css, /\[aria-label='Day of week'\]/);
});

test('the usage period group uses its class, not a translated aria-label', async () => {
  const dashboard = await read('components/UsageDashboard.tsx');
  const css = await read('styles/annotation-fixes.css');
  assert.match(dashboard, /<div className="usage-period" role="group" aria-label=\{tr\("Usage period"\)\}>/);
  assert.match(css, /\.usage-card__toolbar > \.usage-period/);
  assert.doesNotMatch(css, /\[aria-label='Usage period'\]/);
});

test('the rewind button uses its class, not a translated aria-label', async () => {
  const chat = await read('screens/Chat.tsx');
  const ui = await read('components/ui.tsx');
  const css = await read('styles/annotation-fixes.css');
  assert.match(chat, /<IconBtn name="refresh" title=\{tr\("Rewind to here"\)\} className="st-msg__rewind"/);
  assert.match(ui, /className=\{cx\('st-btn st-btn--icon', active && 'is-on', className\)\}/);
  assert.match(css, /\.st-msg--user \.st-msg__rewind \.st-icon/);
  assert.doesNotMatch(css, /\[aria-label='Rewind to here'\]/);
});

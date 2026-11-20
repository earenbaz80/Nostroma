import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/* The lockup SVGs draw "ostroma" because the mark beside the name is the N. Brand.tsx sets the
   same word as text, so the two can drift: they did once, when the pictures said "ostroma" and
   the header still said "Nostroma". This keeps the script and the component on one word. */
test('the wordmark in Brand.tsx is the word the lockup script draws', () => {
  const drawn = read('scripts/prepare-brand-lockups.py').match(/^WORD = "([^"]+)"$/m)?.[1];
  const shown = read('src/components/Brand.tsx').match(/className="brand__word"[^>]*>([^<]+)</)?.[1];
  assert.ok(drawn, 'the lockup script has no WORD constant');
  assert.equal(shown, drawn);
  assert.equal(shown, 'ostroma');
});

/* The picture is only the N: the name a screen reader hears is still the whole product name. */
test('the spoken name is still Nostroma', () => {
  assert.match(read('src/components/Brand.tsx'), /aria-label=\{decorative \? undefined : 'Nostroma'\}/);
});

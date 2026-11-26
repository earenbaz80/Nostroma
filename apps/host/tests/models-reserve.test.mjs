/** The Models page budget: the reserve the person asked for, else the default of the profile they are on (not a number the app wrote for another profile). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nativeFixture } from './helpers/native-fixture.mjs';
import { defaultReserves } from '../shared/memory-budget.mjs';

const configPath = (f, id = 'iq2_xs') => join(f.repo, `nostroma-${id}.json`);
const model = f => f.control.state().installed.models.find(m => m.model === 'iq2_xs');
/** What native-resources.resourceSettings writes: a reserve of the person's has no `ui_reserve_applied`; the app's own has it. */
const writeReserve = (f, reserve, applied) => {
  const path = configPath(f), config = JSON.parse(readFileSync(path, 'utf8'));
  config.vram_reserve_mib = reserve;
  if (applied === undefined) delete config.ui_reserve_applied; else config.ui_reserve_applied = applied;
  writeFileSync(path, JSON.stringify(config));
};

test('the page gets the person’s reserve, and nothing when the app wrote it', async () => {
  const f = nativeFixture();
  try {
    await f.control.refresh(true);
    assert.equal(model(f).reserveMib, null, 'a model nobody chose a reserve for has none of its own');
    // The app's own default for this 24 GB card, written when it started the model on "Leave room for my work".
    writeReserve(f, 4915, 4915);
    await f.control.refresh(true);
    assert.equal(model(f).reserveMib, null, 'a number the app wrote is not the person’s choice');
    // A reserve chosen in the model's settings is the person's, and 0 is a choice too.
    writeReserve(f, 2048);
    await f.control.refresh(true);
    assert.equal(model(f).reserveMib, 2048);
    writeReserve(f, 0);
    await f.control.refresh(true);
    assert.equal(model(f).reserveMib, 0);
  } finally { await f.cleanup(); }
});

test('the Expert field shows the reserve the person asked for, never the one the app wrote for its own profile', async () => {
  const f = nativeFixture();
  try {
    await f.control.refresh(true);
    const shown = () => f.control.settings('iq2_xs').values.vram_reserve_mib;
    assert.equal(shown(), null, 'nothing asked: an empty field, not a number');
    writeReserve(f, 4915, 4915);            // what a load writes on "Leave room for my work" for this 24 GB card
    assert.equal(shown(), null, 'the app’s own number is not a choice');
    // setup writes 700 for the picture reader into "args", with no note that it did
    const setup = JSON.parse(readFileSync(configPath(f), 'utf8'));
    setup.args = [...setup.args, '--vram-reserve-mib', '700'];
    delete setup.vram_reserve_mib; delete setup.ui_reserve_applied;
    writeFileSync(configPath(f), JSON.stringify(setup));
    assert.equal(shown(), null, 'setup’s 700 is not a choice either');
    writeReserve(f, 2048);
    assert.equal(shown(), 2048, 'a reserve chosen in the settings is shown');
    writeReserve(f, 0);
    assert.equal(shown(), 0, 'and 0 is a choice too');
  } finally { await f.cleanup(); }
});

test('saving another setting never turns the app’s own reserve into the person’s', async () => {
  const f = nativeFixture();
  try {
    await f.control.refresh(true);
    writeReserve(f, 4915, 4915);
    const values = f.control.settings('iq2_xs').values;
    assert.equal(values.vram_reserve_mib, null);
    f.control.save('iq2_xs', { values: { ...values, parallel: 2 } });
    const after = JSON.parse(readFileSync(configPath(f), 'utf8'));
    assert.equal(after.vram_reserve_mib, 4915, 'the app’s value stays the app’s, and is not cleared by an empty field');
    assert.equal(after.ui_reserve_applied, 4915);
    assert.equal(after.user_args, undefined, 'no user flag was made from it');
    assert.equal(after.parallel, 2, 'the setting the person did change is saved');
    assert.equal(f.control.settings('iq2_xs').values.vram_reserve_mib, null);
  } finally { await f.cleanup(); }
});

test('without one, the page uses the default of the profile it is on', () => {
  const card = [{ index: 0, vram_gb: 24 }];
  // More than 16 GB: "Leave room for my work" keeps a fifth of the card, Full performance the safety floor. A reserve the app
  // wrote for one profile must not follow the person to the other, which is what the page now avoids by asking for the default.
  assert.deepEqual(defaultReserves({ gpu: [0] }, { gpus: card }, 0), { work: 4915, performance: 1024 });
  const source = readFileSync(new URL('../src/components/NativeModels.tsx', import.meta.url), 'utf8');
  assert.match(source, /const budgetReserve = installed\?\.reserveMib \?\? defaultReserves\([^;]+\[resourceProfile\];/, 'the budget reads the person’s reserve, else the default of the current profile');
});

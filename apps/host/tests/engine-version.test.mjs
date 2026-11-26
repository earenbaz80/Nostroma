import test from 'node:test';
import assert from 'node:assert/strict';
import { shownEngineVersion } from '../src/lib/engine-version.ts';
import { engineRefusal, markEngine } from '../server/engine-version.mjs';
import { nativeFixture, finishJob } from './helpers/native-fixture.mjs';

test('About never shows the host placeholder engine version while the real one is still being read', () => {
  assert.equal(shownEngineVersion({ available: false }, 'nostroma-engine 0.1.0'), undefined);
  assert.equal(shownEngineVersion(null, 'nostroma-engine 0.1.0'), undefined);
  assert.equal(shownEngineVersion({ available: true, installed: { engine: { version: '0.1.48' } } }, 'nostroma-engine 0.1.0'), '0.1.48');
  assert.equal(shownEngineVersion({ available: true, installed: { engine: null } }, 'nostroma-engine 0.1.0'), undefined);
  assert.equal(shownEngineVersion({ available: false }, 'nostroma-engine 0.1.51'), 'nostroma-engine 0.1.51');
});

/* The catalog names the first engine that reads a model's files (engine_min). An older engine would start the download and
   fail on the files, so the host refuses the install or the load first. The install names the version by its model name
   (GuidedSetup and NativeModels send `model: version.model`); the load names it by its id. */
const catalog = () => ({ families: [{ family: 'gyro', sizes: [
  { id: 'gyro-s', model: 'Gyro-S', engine_min: '0.1.45.1' },
  { id: 'iq3_s', model: 'IQ3_S' },
] }] });
const marked = (version, source = null) => markEngine(catalog(), { version, source });
const refused = (c, modelId, engine, family) => engineRefusal(c, modelId, engine, family);

test('an install is refused by the model name it sends, and a load by the size id', () => {
  const old = marked('0.1.45');
  const engine = { version: '0.1.45' };
  assert.match(refused(old, 'Gyro-S', engine) ?? '', /Gyro-S needs engine 0\.1\.45\.1 or newer, and this one is 0\.1\.45\. Update the engine in Settings/, 'the install path (the model name)');
  assert.match(refused(old, 'gyro-s', engine) ?? '', /needs engine 0\.1\.45\.1 or newer/, 'the load path (the size id)');
  assert.equal(refused(old, 'IQ3_S', engine), null, 'a model that names no engine is never refused');
  assert.equal(refused(marked('0.1.46'), 'Gyro-S', { version: '0.1.46' }), null, 'a new enough engine reads the files');
  assert.equal(refused(marked(null), 'Gyro-S', { version: null }), null, 'no engine yet: the install fetches one, it is not refused');
  assert.equal(refused(null, 'Gyro-S', engine), null, 'no catalog: nothing to refuse');
});

test('two families that share a model name are judged in the family that was asked for', () => {
  const shared = () => ({ families: [
    { family: 'swift', sizes: [{ id: 'swift-iq3_s', model: 'IQ3_S', engine_min: '0.1.60' }] },
    { family: 'qwen', sizes: [{ id: 'qwen-iq3_s', model: 'IQ3_S' }] },
  ] });
  const old = markEngine(shared(), { version: '0.1.55' });
  const engine = { version: '0.1.55' };
  assert.match(refused(old, 'IQ3_S', engine, 'swift') ?? '', /IQ3_S needs engine 0\.1\.60/, 'the swift IQ3_S needs a newer engine');
  assert.equal(refused(old, 'IQ3_S', engine, 'qwen'), null, 'the qwen IQ3_S runs on this engine');
  assert.equal(refused(old, 'swift-iq3_s', engine, 'qwen'), null, 'a load is looked for in the family it names too');
});

test('operation() passes the family, so a shared model name is not refused for another family\'s files', async () => {
  const f = nativeFixture({
    engineStatus: { version: '0.1.55', source: null },
    catalog: { families: [
      { family: 'swift', title: 'Qwen3.8 Swift', about: 'x', images: false, sizes: [{ id: 'swift-iq3_s', model: 'IQ3_S', engine_min: '0.1.60', download_gb: 70, ram_needed_gb: 50, about: 'x', on_this_pc: 'fits', installed: false }] },
      { family: 'qwen', title: 'Qwen3.8-Flash-Next', about: 'x', images: false, sizes: [{ id: 'qwen-iq3_s', model: 'IQ3_S', download_gb: 70, ram_needed_gb: 50, about: 'x', on_this_pc: 'fits', installed: false }] },
    ], contexts: [32768], recommendation: { family: 'qwen', model: 'IQ3_S' } },
  });
  try {
    await f.control.refresh(true);
    assert.throws(() => f.control.operation('install', { family: 'swift', model: 'IQ3_S' }), /needs a newer engine: IQ3_S needs engine 0\.1\.60 or newer/, 'swift: refused before the download starts');
    const job = f.control.operation('install', { family: 'qwen', model: 'IQ3_S' });
    assert.equal(job.state, 'running', 'qwen: the same name, files this engine reads');
    const done = await finishJob(f.control, job.id);
    assert.equal(done.state, 'done', done.error);
  } finally { await f.cleanup(); }
});

test('an engine built from this checkout is never called too old', () => {
  const local = { version: '0.1.40', source: 'local' };
  assert.equal(refused(marked('0.1.40', 'local'), 'Gyro-S', local), null);
  assert.equal(refused(marked('0.1.40', 'local'), 'gyro-s', local), null);
});

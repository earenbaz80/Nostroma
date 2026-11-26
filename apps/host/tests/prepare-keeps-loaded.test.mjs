/** A Prepare (install) and the models that are loaded in memory (P0-3): it never stops one the person asked to keep, it
 *  leaves loaded a model that fits beside the new one, and when it must stop one it says the memory freed and the time to
 *  load it again BEFORE the model leaves memory. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nativeFixture } from './helpers/native-fixture.mjs';

const waitJob = async (control, id) => {
  for (let n = 0; n < 1500; n++) {
    const job = control.state().jobs.find(j => j.id === id);
    if (job.state !== 'running') return job;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('Fixture operation timed out');
};
/* The words the job publishes before it stops anything: the model is still in memory, so the sentence is in the present. */
const SENTENCE = /^Stopping .+ to make room and freeing \d+\.\d GB of memory\. It takes about .+ to load it again\.$/;
/** 64 GB of RAM and one 24 GB card: iq2_xs and iq3_s do not fit together (their experts alone are 48 and 62 GB). */
const tight = () => ({ ram_gb: 64, gpus: [{ index: 0, name: 'NVIDIA RTX 4090', vram_gb: 24 }] });
const load = async (f, model) => {
  const job = await waitJob(f.control, f.control.operation('load', { model, gpus: [0] }).id);
  assert.equal(job.state, 'done', job.error);
};
const keepLoaded = (f, model) => {
  const path = join(f.repo, `nostroma-${model}.json`);
  writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), keep_loaded: true }, null, 2));
};

test('a Prepare stops a loaded model only when the new one does not fit beside it, and says it before the stop', async () => {
  const f = nativeFixture({ stopDelayMs: 250 });
  try {
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const installing = f.control.operation('install', { model: 'iq3_s', family: 'qwen' });
    let said = null;
    for (let n = 0; n < 200 && !said; n++) {
      const job = f.control.state().jobs.find(j => j.id === installing.id);
      if (SENTENCE.test(job.summary) && f.control.state().instances.length === 1) said = job.summary;
      else await new Promise(r => setTimeout(r, 5));
    }
    assert.ok(said, 'the job said what it would free while the model was still in memory');

    const done = await waitJob(f.control, installing.id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(f.control.state().instances.length, 0, 'the model was stopped for the room');
    const freed = /freeing ([\d.]+) GB/.exec(said)?.[1];
    assert.ok(freed, 'the note carried the memory it was freeing');
    assert.match(done.summary, new RegExp(`^Stopped .+ to make room and freed ${freed.replace('.', '\\.')} GB of memory\\.`),
      'the finished job says the same stop in the past, with the same figures');
    assert.match(done.summary, /prepared|ready/i, 'and still ends with what the Prepare itself did');
  } finally {
    await f.cleanup();
  }
});

test('a Prepare the plan refuses on disk space leaves the loaded model loaded', async () => {
  const f = nativeFixture({ installPlan: { disk_short: 'Not enough free disk space: 12 GB are needed and 3 GB are free.' } });
  try {
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen' }).id);
    assert.equal(done.state, 'error');
    assert.match(done.error, /Not enough free disk space/);
    assert.equal(f.control.state().instances.length, 1, 'nothing was stopped: the Prepare never started');
    assert.doesNotMatch(done.summary, /^Stopped /, 'no stop was announced, because none happened');
  } finally {
    await f.cleanup();
  }
});

test('the memory a stop announces is the one the Load measured, not a second accounting', async () => {
  const f = nativeFixture({ stopDelayMs: 250 });
  try {
    f.setHardware(tight());
    await f.control.refresh(true);
    const loaded = await waitJob(f.control, f.control.operation('load', { model: 'iq2_xs', gpus: [0] }).id);
    assert.equal(loaded.state, 'done', loaded.error);
    const measured = loaded.progress?.preflight?.totalGb;
    assert.ok(Number.isFinite(measured), 'the Load measured its budget');

    const installing = f.control.operation('install', { model: 'iq3_s', family: 'qwen' });
    let freed = null;
    for (let n = 0; n < 400 && freed === null; n++) {
      const job = f.control.state().jobs.find(j => j.id === installing.id);
      const match = /free(?:d|ing) ([\d.]+) GB of memory/.exec(job.summary ?? '');
      if (match) freed = Number(match[1]);
      else await new Promise(r => setTimeout(r, 5));
    }
    assert.equal(freed, Number(measured.toFixed(1)), 'the stop says exactly the figure the Load showed');
    await waitJob(f.control, installing.id);
  } finally {
    await f.cleanup();
  }
});

test('switching models that do not fit says the memory freed and the time before stopping them', async () => {
  const f = nativeFixture({ stopDelayMs: 250 });
  try {
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const loading = f.control.operation('load', { model: 'iq3_s', gpus: [0] });
    let said = null;
    for (let n = 0; n < 200 && !said; n++) {
      const job = f.control.state().jobs.find(j => j.id === loading.id);
      if (SENTENCE.test(job.summary) && f.control.state().instances.length === 1) said = job.summary;
      else await new Promise(r => setTimeout(r, 5));
    }
    assert.ok(said, 'the job said what it was freeing while the model was still in memory');

    const done = await waitJob(f.control, loading.id);
    assert.equal(done.state, 'done', done.error);
    assert.match(done.summary, /^Stopped .+ to make room and freed \d+\.\d GB of memory\. It takes about .+ to load it again\. /,
      'the finished job keeps the stop it made');
    assert.match(done.summary, /is ready\.$/, 'and still ends with the load it finished');
    assert.deepEqual(f.control.state().instances.map(i => i.model), ['iq3_s'], 'the previous model is gone, the new one serves');
  } finally {
    await f.cleanup();
  }
});

test('switching to a model that fits beside the loaded one stops nothing', async () => {
  const f = nativeFixture();
  try {
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('load', { model: 'iq3_s', gpus: [0] }).id);
    assert.equal(done.state, 'done', done.error);
    assert.deepEqual(f.control.state().instances.map(i => i.model).sort(), ['iq2_xs', 'iq3_s'], 'both stay: the new one fits beside the loaded one');
    assert.doesNotMatch(done.summary, /^Stopp(ed|ing) /, 'nothing stopped, so nothing is announced');
  } finally {
    await f.cleanup();
  }
});

test('a model set to stay in memory keeps serving when another one is loaded', async () => {
  const f = nativeFixture();
  try {
    keepLoaded(f, 'iq2_xs');
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('load', { model: 'iq3_s', gpus: [0] }).id);
    assert.equal(done.state, 'done', done.error);
    assert.doesNotMatch(done.summary, /^Stopped /, 'nothing was stopped, so nothing is announced');
    assert.deepEqual(f.control.state().instances.map(i => i.model).sort(), ['iq2_xs', 'iq3_s'], 'both serve');
  } finally {
    await f.cleanup();
  }
});

test('a Prepare that rewrites a file the loaded model has open stops it even when the memory fits', async () => {
  const f = nativeFixture();
  try {
    /* Both configs name the same picture reader, the one file setup writes for this family: the loaded engine has it
       open, so preparing the other size rewrites it under the running model even though both fit in memory. */
    const reader = join(f.directory, 'models', 'mmproj-Qwen3.8-Flash-Next-BF16.gguf');
    for (const model of ['iq2_xs', 'iq3_s']) {
      const path = join(f.repo, `nostroma-${model}.json`);
      writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), vision: { gpu: 0, mmproj: reader } }, null, 2));
    }
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const planned = await f.control.plan({ model: 'iq3_s', family: 'qwen' });
    assert.match(planned.eviction.question, /^Preparing this model rewrites a file .+ has open\. Stopping it frees .+ Continue\?$/,
      'the plan says the file is the reason, not the memory');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen' }).id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(f.control.state().instances.length, 0, 'the model was stopped: its reader is rewritten');
    assert.match(done.summary, /^Stopped .+ to replace a file it has open and freed \d+\.\d GB of memory\./,
      'and the finished job says why it stopped');
  } finally {
    await f.cleanup();
  }
});

test('a stop that fails is never said as done', async () => {
  const f = nativeFixture({ stopError: 'The engine did not stop.' });
  try {
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('load', { model: 'iq3_s', gpus: [0] }).id);
    assert.equal(done.state, 'error');
    assert.match(done.error, /The engine did not stop\./);
    assert.doesNotMatch(done.summary, /^Stopped /, 'the job never claims the model stopped');
    assert.match(done.summary, /The engine did not stop\./, 'it says what went wrong instead');
    assert.deepEqual(f.control.state().instances.map(i => i.model), ['iq2_xs'], 'the model is still loaded');
  } finally {
    await f.cleanup();
  }
});

test('a Prepare plan says what it would stop before the download starts, and stops nothing itself', async () => {
  const f = nativeFixture();
  try {
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const planned = await f.control.plan({ model: 'iq3_s', family: 'qwen' });
    assert.match(planned.eviction.question,
      /^Preparing this model needs the memory of .+\. Stopping it frees \d+\.\d GB of memory, and loading it again takes about .+\. Continue\?$/);
    assert.equal(f.control.state().instances.length, 1, 'the plan stopped nothing: the model is still loaded');
  } finally {
    await f.cleanup();
  }
});

test('a loaded model that fits beside the new one stays loaded, and no stop is announced', async () => {
  const f = nativeFixture();
  try {
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen' }).id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(f.control.state().instances.length, 1, 'the loaded model was not stopped: the new one fits beside it');
    assert.doesNotMatch(done.summary, /^Stopped /, 'nothing to announce');
  } finally {
    await f.cleanup();
  }
});

test('an idle unload of zero is not a request to keep the model: only the explicit mark is', async () => {
  const f = nativeFixture();
  try {
    const path = join(f.repo, 'nostroma-iq2_xs.json');
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), idle_unload_s: 0 }, null, 2));
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen' }).id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(f.control.state().instances.length, 0, 'it was stopped for the room: zero idle unload does not protect it');
    assert.match(done.summary, /^Stopped .+ to make room/);
  } finally {
    await f.cleanup();
  }
});

test('a Prepare never stops a model the person set to stay in memory, and refuses when it needs the room', async () => {
  const f = nativeFixture();
  try {
    keepLoaded(f, 'iq2_xs');
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const label = f.control.state().instances[0].label;
    const planned = await f.control.plan({ model: 'iq3_s', family: 'qwen' });
    assert.match(planned.eviction.refusal, /is set to stay in memory, so preparing files did not stop it\./);
    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen' }).id);
    assert.equal(done.state, 'error');
    assert.ok(done.error.startsWith(`${label} is set to stay in memory, so preparing files did not stop it.`), done.error);
    assert.match(done.error, /Unload it in Models, or set “Unload after idle seconds” above zero, then try again\.$/);
    assert.equal(f.control.state().instances.length, 1, 'the model the person asked to keep is still loaded');
  } finally {
    await f.cleanup();
  }
});

test('a model the person asked to keep stays loaded when the new one fits beside it, and the Prepare goes on', async () => {
  const f = nativeFixture();
  try {
    keepLoaded(f, 'iq2_xs');
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen' }).id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(f.control.state().instances.length, 1, 'no reason to stop it: both models fit');
    assert.doesNotMatch(done.summary, /^Stopped /);
  } finally {
    await f.cleanup();
  }
});

test('with Run multiple models on, a Prepare stops nothing when the models fit together', async () => {
  const f = nativeFixture();
  try {
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen', multiple: true }).id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(f.control.state().instances.length, 1);
  } finally {
    await f.cleanup();
  }
});

test('with Run multiple models on and no room, the Prepare refuses instead of stopping them', async () => {
  const f = nativeFixture();
  try {
    f.setHardware(tight());
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq3_s', family: 'qwen', multiple: true }).id);
    assert.equal(done.state, 'error');
    assert.match(done.error, /is set to stay in memory, so preparing files did not stop it\./);
    assert.equal(f.control.state().instances.length, 1);
  } finally {
    await f.cleanup();
  }
});

test('the model whose files are being prepared always stops, even when the room would allow both', async () => {
  const f = nativeFixture();
  try {
    await f.control.refresh(true);
    await load(f, 'iq2_xs');

    const done = await waitJob(f.control, f.control.operation('install', { model: 'iq2_xs', family: 'qwen' }).id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(f.control.state().instances.length, 0, 'its own files are being rewritten');
    assert.match(done.summary, /^Stopped .+ to replace its engine and freed \d+\.\d GB of memory\. It takes about .+ to load it again\./,
      'the same model prepared again stops for its own engine, not "to make room"');
    assert.doesNotMatch(done.summary, /to make room/, 'its own files are rewritten: this is not a lack of memory');
  } finally {
    await f.cleanup();
  }
});

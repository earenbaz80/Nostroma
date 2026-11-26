/** What a Prepare does with loaded models (server/native-eviction.mjs, P0-3). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { aboutText, evictionPlan, evictionQuestion, evictionSentence, installPlan, keptRefusal, keepsLoaded, openFiles, sharedWritePlan, stopWhy, stoppingSentence } from '../server/native-eviction.mjs';

test('a model is kept only when the person set the explicit mark, never from the idle unload', () => {
  assert.equal(keepsLoaded({ keep_loaded: true }), true, 'the mark the settings row writes');
  assert.equal(keepsLoaded({ keep_loaded: false }), false, 'the mark off is not a request');
  assert.equal(keepsLoaded({ keep_loaded: 'true' }), false, 'a text value is not the boolean the app writes');
  assert.equal(keepsLoaded({ keep_loaded: null }), false, 'an empty mark is not a request');
  assert.equal(keepsLoaded({ idle_unload_s: 0 }), false, 'an idle unload of zero says "do not unload me for being idle", not "never touch me"');
  assert.equal(keepsLoaded({ idle_unload_s: '0' }), false, 'the same for a number written as text');
  assert.equal(keepsLoaded({}), false, 'a model that never set it can be stopped');
  assert.equal(keepsLoaded(null), false, 'no config: not kept');
});

test('a Prepare leaves a kept model alone and stops the others, and Run multiple models protects all of them', () => {
  const one = { id: 'a', label: 'Qwen iq2_xs', model: 'iq2_xs' }, two = { id: 'b', label: 'Qwen iq3_s', model: 'iq3_s' };
  const kept = new Set([two.id]);
  assert.deepEqual(evictionPlan({ instances: [one, two], keeps: i => kept.has(i.id) }), { kept: [two], evict: [one] });
  assert.deepEqual(evictionPlan({ instances: [one, two], multiple: true }), { kept: [one, two], evict: [] }, 'the others were asked to stay loaded');
  assert.deepEqual(evictionPlan({ instances: [] }), { kept: [], evict: [] }, 'nothing loaded: nothing to decide');
});

test('a Prepare evicts only what does not fit beside the new model, and always the model whose files it rewrites', () => {
  const a = { id: 'a', model: 'iq2_xs' }, b = { id: 'b', model: 'iq3_xxs' };
  const none = { writing: [], keptWriting: [] };
  assert.deepEqual(installPlan({ instances: [a, b], target: 'iq3_s', fits: true }), { kept: [], evict: [], fits: true, ...none }, 'both fit: nothing stops');
  assert.deepEqual(installPlan({ instances: [a, b], target: 'iq3_s', fits: false }), { kept: [], evict: [a, b], fits: false, ...none }, 'no room: the others stop');
  const kept = new Set([a.id]);
  assert.deepEqual(installPlan({ instances: [a, b], target: 'iq3_s', fits: false, keeps: i => kept.has(i.id) }), { kept: [a], evict: [b], fits: false, ...none });
  assert.deepEqual(installPlan({ instances: [a], target: 'iq2_xs', fits: true }), { kept: [], evict: [a], fits: false, ...none }, 'the model being prepared stops even when it would fit: its files are open');
  assert.deepEqual(installPlan({ instances: [], target: 'iq3_s' }), { kept: [], evict: [], fits: true, ...none });
});

test('the question before a Prepare stops a loaded model names it, the memory freed and the time to load it again', () => {
  assert.equal(evictionQuestion([{ label: 'Qwen iq2_xs', gb: 46.52, seconds: 225 }]),
    'Preparing this model needs the memory of Qwen iq2_xs. Stopping it frees 46.5 GB of memory, and loading it again takes about 4 minutes. Continue?');
  assert.equal(evictionQuestion([{ label: 'Qwen iq2_xs', gb: 46.52, seconds: 225 }, { label: 'Qwen iq3_s', gb: 61.48, seconds: 300 }]),
    'Preparing this model needs the memory of Qwen iq2_xs and Qwen iq3_s. Stopping them frees 108.0 GB of memory, and loading them again takes about 5 minutes. Continue?',
    'several models: their names, the memory together and the slowest one to load');
  assert.equal(evictionQuestion([{ label: 'Qwen iq2_xs', gb: null, seconds: null }]),
    'Preparing this model needs the memory of Qwen iq2_xs. Stopping it frees its memory. Continue?',
    'a config the app cannot read still asks, without inventing a figure');
  assert.equal(evictionQuestion([]), null, 'nothing loaded: no question');
});

test('a model prepared again stops to replace its own engine, never because of a lack of memory', () => {
  const loaded = { id: 'a', model: 'iq2_xs', label: 'Qwen iq2_xs' };
  assert.equal(stopWhy(loaded, { target: 'iq2_xs', writing: [loaded] }), 'again',
    'the same model: its engine is what the preparation replaces, whatever the memory says');
  assert.equal(stopWhy(loaded, { target: 'iq3_s', writing: [loaded] }), 'files', 'another model that rewrites a file it has open');
  assert.equal(stopWhy(loaded, { target: 'iq3_s' }), 'memory');
  const again = evictionQuestion([{ label: 'Qwen iq2_xs', gb: 46.52, seconds: 225, why: 'again' }]);
  assert.equal(again,
    'Preparing this model replaces the engine of Qwen iq2_xs. Stopping it frees 46.5 GB of memory, and loading it again takes about 4 minutes. Continue?');
  assert.doesNotMatch(again, /memory of/, 'the same model stops for its own files, not for a lack of memory');
});

test('each model stopped says its own reason: a file it has open is never said to lack memory', () => {
  assert.equal(evictionQuestion([
    { label: 'Qwen iq2_xs', gb: 46.52, seconds: 225, why: 'files' },
    { label: 'Qwen iq3_s', gb: 61.48, seconds: 300, why: 'memory' }]),
    'Preparing this model rewrites a file Qwen iq2_xs has open, and needs the memory of Qwen iq3_s. Stopping them frees 108.0 GB of memory, and loading them again takes about 5 minutes. Continue?',
    'a mixed stop names both reasons, in the order that reads');
  const mixed = evictionQuestion([
    { label: 'Qwen iq2_xs', gb: 3, seconds: 30, why: 'files' },
    { label: 'Qwen iq3_s', gb: 4, seconds: 60 }], 'memory');
  assert.match(mixed, /rewrites a file Qwen iq2_xs has open, and needs the memory of Qwen iq3_s/, 'a cost without a reason takes the one passed');
  assert.doesNotMatch(mixed, /memory of Qwen iq2_xs/, 'the file-stopped model is never said to lack memory');
  assert.equal(evictionQuestion([
    { label: 'Qwen iq2_xs', gb: 3, seconds: 30, why: 'again' },
    { label: 'Qwen iq3_s', gb: 4, seconds: 60, why: 'memory' }]),
    'Preparing this model replaces the engine of Qwen iq2_xs, and needs the memory of Qwen iq3_s. Stopping them frees 7.0 GB of memory, and loading them again takes about a minute. Continue?',
    'a reinstall beside another model names the replaced engine first');
});

test('the words of a stop carry the memory freed and the time to load it again', () => {
  assert.equal(evictionSentence({ label: 'Qwen iq2_xs', gb: 46.52, seconds: 225 }),
    'Stopped Qwen iq2_xs to make room and freed 46.5 GB of memory. It takes about 4 minutes to load it again.');
  assert.equal(evictionSentence({ label: 'Qwen iq2_xs', gb: 3, seconds: 30 }),
    'Stopped Qwen iq2_xs to make room and freed 3.0 GB of memory. It takes about 30 seconds to load it again.');
  assert.equal(evictionSentence({ label: 'Qwen iq2_xs', gb: null, seconds: null }),
    'Stopped Qwen iq2_xs to make room and freed its memory. It loads again when you start it.',
    'a config the app cannot read still says what happened, without inventing a figure');
});

test('a model whose config names a reader or a draft layer is the one a rewrite of those files stops', () => {
  const loaded = { id: 'a', label: 'Qwen iq2_xs', family: 'qwen', config: { vision: { mmproj: 'E:\\data\\models\\mmproj-Qwen.gguf' }, args: ['--mtp', 'E:\\data\\mtp\\rt'] } };
  const other = { id: 'b', label: 'Other', family: 'other', config: { args: ['--max-context', '131072'] } };
  assert.deepEqual(openFiles(loaded.config), { reader: 'E:\\data\\models\\mmproj-Qwen.gguf', draft: 'E:\\data\\mtp\\rt' });
  assert.deepEqual(openFiles(other.config), { reader: null, draft: null }, 'a config that names neither says nothing');
  assert.deepEqual(sharedWritePlan({ instances: [loaded, other], target: { reader: true, draft: true, folder: 'e:/DATA' } }).map(i => i.id), ['a'],
    'the same folder, and only the model that names the files');
  assert.deepEqual(sharedWritePlan({ instances: [loaded], target: { draft: true, folder: 'E:\\elsewhere' } }), [], 'another folder shares nothing');
  assert.deepEqual(sharedWritePlan({ instances: [loaded], target: { files: ['e:\\DATA\\models\\MMPROJ-Qwen.gguf'] } }).map(i => i.id), ['a'],
    'the target config names the same reader, whatever its case or slashes');
  assert.deepEqual(sharedWritePlan({ instances: [loaded], target: { reader: true } }).map(i => i.id), ['a'], 'the reader is rewritten');
  assert.deepEqual(sharedWritePlan({ instances: [loaded], target: { reader: true, families: ['other'] } }), [], 'another family writes another reader');
  assert.deepEqual(sharedWritePlan({ instances: [loaded], target: { reader: true, families: ['qwen'] } }).map(i => i.id), ['a']);
});

test('a Prepare stops the models whose files it rewrites even when the memory fits; a kept one is refused, not stopped', () => {
  const a = { id: 'a', model: 'iq2_xs', label: 'Qwen iq2_xs' };
  const b = { id: 'b', model: 'iq1_m', label: 'Qwen iq1_m' };
  const plan = installPlan({ instances: [a, b], target: 'iq3_s', fits: true, shared: [a] });
  assert.deepEqual(plan.evict.map(i => i.id), ['a'], 'the file, not the memory, is why it stops');
  assert.equal(plan.fits, false, 'the caller still sees that something had to stop');
  assert.deepEqual(plan.keptWriting, []);
  const kept = installPlan({ instances: [a], target: 'iq3_s', multiple: true, fits: true, shared: [a] });
  assert.deepEqual(kept.evict, [], 'a model the person asked to keep is never stopped');
  assert.deepEqual(kept.keptWriting.map(i => i.id), ['a'], 'the caller refuses it instead');
});

test('the words before a stop are in the present: the model is still in memory', () => {
  assert.equal(stoppingSentence({ label: 'Qwen iq2_xs', gb: 46.52, seconds: 225 }),
    'Stopping Qwen iq2_xs to make room and freeing 46.5 GB of memory. It takes about 4 minutes to load it again.');
  assert.equal(stoppingSentence({ label: 'Qwen iq2_xs', gb: 3, seconds: 30 }),
    'Stopping Qwen iq2_xs to make room and freeing 3.0 GB of memory. It takes about 30 seconds to load it again.');
  assert.equal(stoppingSentence({ label: 'Qwen iq2_xs', gb: null, seconds: null }),
    'Stopping Qwen iq2_xs to make room and freeing its memory. It loads again when you start it.',
    'a config the app cannot read still says what is under way, without inventing a figure');
  assert.doesNotMatch(stoppingSentence({ label: 'Qwen iq2_xs', gb: 3, seconds: 30 }), /^Stopped /,
    'nothing is said in the past before the unload');
});

test('a stop made for a file the engine has open says that, not "to make room"', () => {
  assert.equal(stoppingSentence({ label: 'Qwen iq2_xs', gb: 46.52, seconds: 225, why: 'files' }),
    'Stopping Qwen iq2_xs to replace a file it has open and freeing 46.5 GB of memory. It takes about 4 minutes to load it again.');
  assert.equal(evictionSentence({ label: 'Qwen iq2_xs', gb: 3, seconds: 30, why: 'files' }),
    'Stopped Qwen iq2_xs to replace a file it has open and freed 3.0 GB of memory. It takes about 30 seconds to load it again.');
  assert.equal(evictionQuestion([{ label: 'Qwen iq2_xs', gb: 3, seconds: 30 }], 'files'),
    'Preparing this model rewrites a file Qwen iq2_xs has open. Stopping it frees 3.0 GB of memory, and loading it again takes about 30 seconds. Continue?');
  assert.equal(stoppingSentence({ label: 'Qwen iq2_xs', gb: 3, seconds: 30, why: 'again' }),
    'Stopping Qwen iq2_xs to replace its engine and freeing 3.0 GB of memory. It takes about 30 seconds to load it again.',
    'the same model loaded again says why it stops');
});

test('a time is said in the unit a person would use, and never as a made-up number', () => {
  assert.equal(aboutText(44), '44 seconds');
  assert.equal(aboutText(60), 'a minute');
  assert.equal(aboutText(75), 'a minute');
  assert.equal(aboutText(90), '2 minutes', 'rounded to the nearest minute');
  assert.equal(aboutText(225), '4 minutes');
  assert.equal(aboutText(0), null);
  assert.equal(aboutText(null), null);
});

test('a kept model that blocked the Prepare is named, with the two ways forward', () => {
  assert.equal(keptRefusal(['Qwen iq2_xs']),
    'Qwen iq2_xs is set to stay in memory, so preparing files did not stop it. Unload it in Models, or set “Unload after idle seconds” above zero, then try again.');
  assert.match(keptRefusal(['Qwen iq2_xs', 'Qwen iq3_s']), /^Qwen iq2_xs and Qwen iq3_s are set to stay in memory, so preparing files did not stop them\. Unload them in Models/);
  assert.match(keptRefusal(['a', 'b', 'c']), /^a, b and c are set to stay in memory/);
});

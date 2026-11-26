/** One accounting for the fit card, the request slots and the reserve (shared/memory-budget.mjs). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultReserves, estimateSlots, fitsAlongside, heldMemoryGb, memoryBudget, sessionGb, sessionGib } from '../shared/memory-budget.mjs';
import { slotGb } from '../server/native-parallel.mjs';

const root = resolve(import.meta.dirname, '..');
const model = { experts_gb: 77, memory_gb: 78 };
const hardware = { ram_gb: 64, vram_gb: 12 };

test('one context figure feeds the fit and the request slots', () => {
  assert.equal(slotGb({ context: 32768, kv: 'int8' }), sessionGb(32768, 'int8'));
  const one = memoryBudget({ model, hardware, context: 32768, kv: 'int8', slots: 1, drafter: 'mtp', reserveMib: 0 });
  assert.equal(one.contextPerSlotGb, sessionGib(32768, 'int8'));
  assert.equal(one.contextGb, one.contextPerSlotGb);
  const four = memoryBudget({ model, hardware, context: 32768, kv: 'int8', slots: 4, drafter: 'mtp', reserveMib: 0 });
  assert.equal(four.contextGb, one.contextPerSlotGb * 4, 'every slot keeps its own context');
  assert.ok(four.spillGb > one.spillGb, 'four sessions leave less room for the experts');
});

test('the budget counts the drafter, the picture reader and the reserve, and the rest spills', () => {
  const base = memoryBudget({ model, hardware, context: 32768, kv: 'int8', slots: 1, drafter: 'mtp', vision: 'no', reserveMib: 0 });
  const vision = memoryBudget({ model, hardware, context: 32768, kv: 'int8', slots: 1, drafter: 'mtp', vision: 'gpu', reserveMib: 0 });
  const reserve = memoryBudget({ model, hardware, context: 32768, kv: 'int8', slots: 1, drafter: 'mtp', vision: 'no', reserveMib: 2048 });
  assert.equal(vision.visionWhere, 'gpu');
  assert.equal(vision.visionGb, 1.5);
  assert.ok(vision.spillGb > base.spillGb, 'the GPU reader takes room from the experts');
  assert.equal(reserve.reserveGb, 2);
  assert.ok(reserve.spillGb > base.spillGb, 'the reserve takes room from the experts');
  assert.equal(base.weightsGb, 78);
  assert.equal(base.expertsGb, 77);
});

test('the default reserve is the same rule the host applies', () => {
  const card = (vram_gb, extra = {}) => ({ index: 0, vram_gb, ...extra });
  assert.deepEqual(defaultReserves({ gpu: [0] }, { gpus: [card(12)] }), { work: 1536, performance: 1536 });
  assert.deepEqual(defaultReserves({ gpu: [0] }, { gpus: [card(24)] }), { work: 4915, performance: 1024 });
  assert.deepEqual(defaultReserves({ gpu: [0], vision: { gpu: true } }, { gpus: [card(12)] }), { work: 2048, performance: 2048 });
});

test('a loaded model holds the total its own budget gave it, and an unmeasurable PC gives no figure', () => {
  const one = memoryBudget({ model, hardware, context: 32768, kv: 'int8', slots: 1, drafter: 'mtp', reserveMib: 0 });
  assert.equal(heldMemoryGb({ model, hardware, context: 32768, kv: 'int8', slots: 1, drafter: 'mtp', reserveMib: 0 }), one.totalGb,
    'the same total the Models page shows for that Load');
  assert.equal(heldMemoryGb({ model, hardware: null }), null, 'no RAM figure: no number to give');
});

test('a Prepare fits beside the loaded models only while their memory plus its budget is left (P0-3)', () => {
  // 64 GB of RAM and a 24 GB card: the big model holds 78 GiB (24 of the card and 54 of RAM), 88 in all.
  const card24 = { ram_gb: 64, vram_gb: 24 };
  const start = { context: 32768, kv: 'int8', slots: 1, drafter: 'mtp', reserveMib: 0 };
  const held = heldMemoryGb({ model, hardware: card24, ...start });
  const small = { experts_gb: 3, memory_gb: 4 };                                  // a 9.4 GiB budget
  assert.equal(fitsAlongside({ model: small, hardware: card24, ...start, held: [] }), true, 'nothing loaded: nothing to share');
  assert.equal(fitsAlongside({ model: small, hardware: card24, ...start, held: [held] }), true, '78 + 9.4 of 88 GiB');
  assert.equal(fitsAlongside({ model, hardware: card24, ...start, held: [held] }), false, '78 + 78 do not fit in 88');
  assert.equal(fitsAlongside({ model: small, hardware: card24, ...start, held: [held, held] }), false, 'two loaded models count together');
  assert.equal(fitsAlongside({ model: small, hardware: card24, ...start, held: [null] }), false, 'a config the app cannot read is not zero');
  assert.equal(fitsAlongside({ model: small, hardware: { vram_gb: 24 }, ...start, held: [held] }), false, 'a PC with no RAM figure proves nothing');
});

test('the slot estimate uses the same session cost and the same policy', () => {
  const cards = [{ index: 0, vram_gb: 12 }];
  assert.deepEqual(estimateSlots({ context: 32768, kv: 'int8', cards, requested: 4 }).slots, 1);
  assert.deepEqual(estimateSlots({ context: 32768, kv: 'int8', cards: [{ index: 0, vram_gb: 32 }], requested: 4 }).slots, 4);
});

test('the Models page shows weights, context, slots, drafter, pictures, reserve and spill', () => {
  const page = readFileSync(resolve(root, 'src/components/NativeModels.tsx'), 'utf8');
  assert.match(page, /memoryBudget\(\{ model: selectedSize/);
  // The context row counts the KV cache and the request state, so it says so: the warning and the format line show the cache alone.
  for (const label of ['Model files', 'Context and state', 'Concurrent requests', 'Drafting', 'Read pictures', 'Room for other apps', 'SSD'])
    assert.match(page, new RegExp(`tr\\("${label}"\\)`), label);
  assert.match(page, /budget\.spillGb\.toFixed\(1\)/);
  assert.match(page, /budget\.reserveGb\.toFixed\(1\)/);
});

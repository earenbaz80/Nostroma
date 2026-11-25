/** One accounting for the fit card, the request slots and the reserve (shared/memory-budget.mjs). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultReserves, estimateSlots, memoryBudget, sessionGb, sessionGib } from '../shared/memory-budget.mjs';
import { slotGb } from '../server/native-parallel.mjs';

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

test('the slot estimate uses the same session cost and the same policy', () => {
  const cards = [{ index: 0, vram_gb: 12 }];
  assert.deepEqual(estimateSlots({ context: 32768, kv: 'int8', cards, requested: 4 }).slots, 1);
  assert.deepEqual(estimateSlots({ context: 32768, kv: 'int8', cards: [{ index: 0, vram_gb: 32 }], requested: 4 }).slots, 4);
});


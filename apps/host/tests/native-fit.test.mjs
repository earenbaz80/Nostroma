/** Items 10 and 11: what a version needs of RAM + VRAM (without the n-gram table) and how much would be read from the SSD. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTs } from './helpers/load-ts.mjs';

const { fitOn, versionFit, versionPlacement, FIT_SPILL_GB, cacheGb, memoryNeeded, RECOMMENDED, VERSION_GROUPS, groupOpen, recommendedVersions, PICK_NOTE, OTHER_NOTE, MTP_VRAM_GB } = await loadTs(new URL('../src/lib/native-fit.ts', import.meta.url));

const swift = { ram_needed_gb: 48, experts_gb: 35.5 };
const gyroS = { ram_needed_gb: 27.6, experts_gb: 25.8, mem_total: true };
const q4 = { ram_needed_gb: 48, experts_gb: 77 };

test('the memory a version needs is RAM + VRAM without the n-gram table', () => {
  assert.equal(memoryNeeded(swift), 36.5, 'experts plus about 1 GB for the dense part');
  assert.equal(memoryNeeded(gyroS), 27.6, 'Gyro states its total');
  assert.equal(memoryNeeded({ ...swift, memory_gb: 36.5 }), 36.5, 'the catalog figure wins when it is sent');
});

test('a PC with room reads nothing from the SSD', () => {
  const f = fitOn(swift, { ram_gb: 64, vram_gb: 12 });
  assert.equal(f.known, true); assert.equal(f.spillGb, 0);
  assert.ok(f.vramUseGb > 0 && f.vramUseGb <= 12 && f.ramUseGb > 0 && f.ramUseGb <= 54);
});

test('a PC without room reads the rest from the SSD, and the amount is real', () => {
  const f = fitOn(q4, { ram_gb: 64, vram_gb: 12 });          // 77 GB of experts: 6 on the card (the draft layer takes 1.08 GB), 54 in RAM, 17.1 from the SSD
  assert.equal(f.spillGb, 17.4);
  assert.equal(fitOn(q4, { ram_gb: 64, vram_gb: 12 }, false).spillGb, 16.4, 'with the draft layer off the card holds 1 GB more');
  assert.equal(fitOn(q4, { ram_gb: 192, vram_gb: 24 }).spillGb, 0);
  assert.ok(fitOn(gyroS, { ram_gb: 16, vram_gb: 8 }).spillGb > 10, 'a small PC spills a lot');
});

test('the verdict is fitOn\'s plan and its spill, with the figure the row prints (#P0-4)', () => {
  const hw = { ram_gb: 64, vram_gb: 12 };
  assert.equal(FIT_SPILL_GB, 0.5);
  assert.deepEqual(versionPlacement({ download_gb: 36.5, memory_gb: 36.5 }, hw), { state: 'fits', spillGb: 0 });
  const big = versionPlacement({ download_gb: 111, memory_gb: 78 }, hw);
  assert.equal(big.state, 'ssd');
  assert.equal(Math.round(big.spillGb * 10) / 10, 17.4, 'the figure the row says comes from the SSD');
  assert.deepEqual(versionPlacement({ download_gb: 1, memory_gb: 40 }, null), { state: 'unknown', spillGb: 0 }, 'no hardware, no claim');
  // The files alone would pass the old comparison (70 GB in 76 GB), and the plan still spills: the verdict follows the plan.
  const filesFitMemory = { download_gb: 70, memory_gb: 70 };
  assert.ok(memoryNeeded(filesFitMemory) <= 64 + 12);
  assert.ok(fitOn(filesFitMemory, hw).spillGb > FIT_SPILL_GB);
  assert.equal(versionFit(filesFitMemory, hw), 'ssd');
  // The row prints fit_gb (the pack without the lookup table): that is the figure measured.
  assert.equal(versionFit({ download_gb: 78, memory_gb: 78, fit_gb: 36.5 }, hw), 'fits');
  // The person's context is part of the plan, as fitOn takes it.
  const near = { download_gb: 60, memory_gb: 60 };
  assert.equal(versionFit(near, hw), 'fits', '59 GB of experts fit in 54 GB of RAM plus what the card keeps free');
  assert.equal(versionFit(near, hw, { context: 131072 }), 'ssd', 'the 128K the person chose pushes it over');
});

test('unknown hardware gives no verdict instead of a made-up one', () => {
  const f = fitOn(swift, null);
  assert.equal(f.known, false); assert.equal(f.spillGb, 0); assert.equal(f.memoryGb, 36.5);
  assert.equal(fitOn(swift, { ram_gb: 0 }).known, false);
});

test('Recommended is the fixed four, in the owner\'s order; the groups are Swift, GSQ-RCO, NVFP4, Gyro (Unsloth for the rest)', () => {
  assert.deepEqual(RECOMMENDED.map(r => `${r.family}:${r.model}`), ['gyro:Gyro-S', 'swift:IQ2_XS', 'qwen:IQ3_S', 'unsloth:UD-Q4_K_XL']);
  assert.deepEqual(VERSION_GROUPS.map(g => g.title), ['Swift models', 'GSQ-RCO models', 'NVFP4 models', 'Gyro models', 'Unsloth models']);
  assert.ok(RECOMMENDED.every(r => r.note.length > 0 && r.note.length < 40), 'one short note each');
});

test('the group of the running version can be collapsed (Gyro-M running, the Gyro group stayed open)', () => {
  let opened = {};
  assert.equal(groupOpen(opened, 'gyro', true), true, 'it starts open: it holds the selected version');
  assert.equal(groupOpen(opened, 'swift', false), false, 'the others start closed');
  opened = { ...opened, gyro: !groupOpen(opened, 'gyro', true) };   // the person clicks the Gyro header
  assert.equal(groupOpen(opened, 'gyro', true), false, 'one click closes it');
  opened = { ...opened, gyro: !groupOpen(opened, 'gyro', true) };
  assert.equal(groupOpen(opened, 'gyro', true), true, 'and one more opens it again');
});

test('the draft layer (MTP) counts about 1 GB of the card', () => {
  assert.equal(MTP_VRAM_GB, 1.08);   // the engine's measured 1,082 MiB (nostroma_control/drafting.py DRAFTER_MIB)
  const on = fitOn(swift, { ram_gb: 40, vram_gb: 12 }), off = fitOn(swift, { ram_gb: 40, vram_gb: 12 }, false);
  assert.equal(Math.round((on.vramUseGb - off.vramUseGb) * 10) / 10, 0, 'the card is full either way here; the experts it cannot hold move to RAM');
  assert.ok(Math.abs((on.ramUseGb - off.ramUseGb) - 1.08) <= 0.11, 'the draft layer moves about 1.08 GB to RAM');
  assert.equal(fitOn(swift, { ram_gb: 40, vram_gb: 0 }).vramUseGb, 0, 'no card, no draft layer on it');
});

const v = (sourceFamily, model) => ({ sourceFamily, model, id: sourceFamily + '-' + model });
const all = [v('qwen', 'Q2_0'), v('gyro', 'Gyro-S'), v('gyro', 'Gyro-M'), v('swift', 'IQ2_XS'), v('qwen', 'IQ3_XXS'), v('qwen', 'IQ3_S'), v('unsloth', 'UD-Q4_K_XL')];

test('the page shows the own pick of the engine for this PC first (the same one nostroma launch prints), per memory tier', () => {
  const names = rows => rows.map(x => x.v.model + (x.r.note === PICK_NOTE ? '*' : x.r.note === OTHER_NOTE ? '+' : ''));
  assert.deepEqual(names(recommendedVersions(all)), ['Gyro-S', 'IQ2_XS', 'IQ3_S', 'UD-Q4_K_XL'], 'no pick: the fixed list');
  const t40 = { family: 'swift', model: 'IQ2_XS', why: '40 GB tier: Swift 1.5 IQ2_XS; Gyro-M (35 GB) is the other choice there' };
  assert.deepEqual(names(recommendedVersions(all, t40)), ['IQ2_XS*', 'Gyro-M+', 'Gyro-S', 'IQ3_S', 'UD-Q4_K_XL']);
  assert.deepEqual(names(recommendedVersions(all, { family: 'swift', model: 'IQ2_XS', why: 'the 40 GB tier' })), ['IQ2_XS*', 'Gyro-S', 'IQ3_S', 'UD-Q4_K_XL'], 'no Gyro-M when the engine does not name it (Intel, Mac)');
  assert.deepEqual(names(recommendedVersions(all, { family: 'qwen', model: 'IQ3_XXS', why: '48 GB tier' })), ['IQ3_XXS*', 'Gyro-S', 'IQ2_XS', 'IQ3_S', 'UD-Q4_K_XL']);
  assert.deepEqual(names(recommendedVersions(all, { family: 'qwen', model: 'IQ3_S', why: '64 GB tier' })), ['IQ3_S*', 'Gyro-S', 'IQ2_XS', 'UD-Q4_K_XL']);
  assert.deepEqual(names(recommendedVersions(all, { family: null, model: null })), ['Gyro-S', 'IQ2_XS', 'IQ3_S', 'UD-Q4_K_XL']);
});

test('the tiers of the engine are 40 GB Swift IQ2_XS, 48 GB IQ3_XXS, 64 GB IQ3_S in both Python places the page and nostroma launch read', async () => {
  for (const file of ['../../../setup.py', '../../../tools/nostroma_mcp.py']) {
    const text = await readFile(new URL(file, import.meta.url), 'utf8');
    const m = /^MEMORY_TIERS\s*=\s*(.*)$/m.exec(text);
    assert.ok(m, file);
    assert.deepEqual([...m[1].matchAll(/\(([\d.]+),\s*"(\w+)",\s*"(\w+)"\)/g)].map(x => [Number(x[1]), x[2], x[3]]), [[62, 'qwen', 'IQ3_S'], [46, 'qwen', 'IQ3_XXS'], [38, 'swift', 'IQ2_XS']], file);
  }
});

test('the conversation context and cache format move the estimate (#3832)', () => {
  const pc = { ram_gb: 64, vram_gb: 16 };
  const base = fitOn(swift, pc);
  assert.deepEqual(fitOn(swift, pc, true, { context: 32768, kv: 'int8' }), base, 'the default context is what the fixed figure already held');
  const big = fitOn(swift, pc, true, { context: 524288, kv: 'int8' });
  assert.ok(big.vramUseGb >= base.vramUseGb && big.ramUseGb > base.ramUseGb, 'a bigger cache takes graphics memory from the experts, which then sit in RAM');
  assert.ok(fitOn(swift, pc, true, { context: 524288, kv: 'q4_0' }).ramUseGb < big.ramUseGb, 'a smaller cache format leaves more room');
  assert.ok(Math.abs(cacheGb(524288, 'int8') * 1024 - 7361) < 25, 'the 512K Int8 cache is the 7361 MiB the engine reports');
  const tight = fitOn(q4, pc, true, { context: 524288, kv: 'int8' });
  assert.ok(tight.spillGb > fitOn(q4, pc).spillGb, 'what no longer fits is read from the SSD and the card says so');
});

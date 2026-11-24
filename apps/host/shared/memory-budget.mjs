/**
 * The one memory accounting of the app, the host and the engine options.
 *
 * Everything that asks "does this fit?" reads its numbers here: the fit label and the This computer card
 * (`src/lib/native-fit.ts`), the request-slot choice (`server/native-parallel.mjs`) and the reserve
 * (`server/native-resources.mjs`). The figures are RAM + VRAM together, without the n-gram table (it stays on
 * the SSD and is read when needed).
 *
 * Units: the `*Gb` values are GiB (2**30), as the catalog and the engine report them, except `sessionGb`,
 * which keeps the measured GB (1e9) of the batch-slot formula for compatibility with the Terminal.
 */

export const DENSE_GB = 5;
export const SYSTEM_ROOM_GB = 10;
export const DENSE_EXTRA_GB = 1;

/** The conversation cache of Flash-Next: 13 attention layers, bytes per token per layer by cache format, 5.4% over
 *  the bare cache (nostroma_control/vram_fit.py KV_BYTES, KV_MEASURED_FACTOR; setup.py UD_FIT_KV_BYTES). */
const KV_BYTES = { fp16: 2112, int8: 1056, q4_0: 576, k8v4: 816 };
const KV_LAYERS = 13, KV_FACTOR = 1.054;
export const BASE_CONTEXT = 32768;

/** The draft layer (MTP) takes about 1.08 GB of graphics memory (1082 MiB: the layer 840 + draft head 213 + the rest);
 *  DFlash2 alone takes 0.89 GB, and with the converted pack 0.72 GB (nostroma_control/drafting.py DRAFTER_MIB). */
export const MTP_VRAM_GB = 1.08;
export const DFLASH2_VRAM_GB = 0.89;
export const DFLASH2_SELQ4_VRAM_GB = 0.72;
export const DRAFTER_VRAM_GB = { mtp: MTP_VRAM_GB, dflash2: DFLASH2_VRAM_GB, dflash2_selq4: DFLASH2_SELQ4_VRAM_GB, off: 0 };

/** The GPU picture reader's whole need at the default image limit (nostroma_control/reader_room.py READER_NEEDS_MIB). */
export const VISION_GPU_MIB = 1536;
/** The CPU reader's footprint in RAM (nostroma_control/vision_reader.py: about 1,050-1,179 MB). */
export const VISION_CPU_RAM_GB = 1.1;
/** The card room from which the reader runs on the graphics card by default (docs/DETAILS.md, Images). */
export const VISION_GPU_FROM_GB = 24;

/** Several requests at once: the default and the share of the solo expert cache their sessions may take. */
export const DEFAULT_SLOTS = 4;
export const PARALLEL_POLICY = 'fit';
export const CACHE_LOSS_SHARE = 0.2;
export const FIRST_CARD_OTHER_GB = 6.9;
export const NEXT_CARD_OTHER_GB = 2.0;
export const BATCH_MTP_POLICY = 'auto';
export const BATCH_MTP_MIN_VRAM_GB = 24;
export const BATCH_MTP_DRAFTER_GB = 0.25;
export const BATCH_MTP_MARGIN_GB = 2;

/** The engine's own default reserve, and the one setup writes for pictures read on the GPU: neither is a choice of the person. */
export const ENGINE_DEFAULT_RESERVE_MIB = 700;
/** A card that drives no display needs little beside the engine; the engine keeps the last few hundred MiB for allocations. */
export const COMPUTE_ONLY_RESERVE_MIB = 512;

const round1 = n => Math.round(n * 10) / 10;
const wholeMib = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.trunc(Number(v)) : null;

/** RAM + VRAM the version needs (the n-gram table not counted). */
export function memoryNeeded(v) {
  if (typeof v?.memory_gb === 'number' && Number.isFinite(v.memory_gb)) return v.memory_gb;
  if (v?.mem_total && typeof v.ram_needed_gb === 'number') return v.ram_needed_gb;
  return round1((v?.experts_gb ?? v?.ram_needed_gb ?? 0) + DENSE_EXTRA_GB);
}

/** One conversation's KV cache at `context` tokens, in GiB. */
export function cacheGb(context, kv = 'int8') {
  return (121 + context * KV_LAYERS * (KV_BYTES[String(kv).toLowerCase()] ?? KV_BYTES.int8) * KV_FACTOR / 2 ** 20) / 1024;
}

/** Qwen3.6-35B-A3B's own cache rule (nostroma_control/own_path_fit.py), in GiB. */
export function ownPathCacheGb(fit, context) { return context * fit.bytes_per_token / 2 ** 30; }
export function ownPathFits(fit, vramGb, context) { return fit.fixed_gb + ownPathCacheGb(fit, context) <= vramGb; }
export function contextCacheGb(context, kv = 'int8', fit) { return fit ? ownPathCacheGb(fit, context) : cacheGb(context, kv); }

/** One request slot's whole session, in GB (1e9): the KV cache plus the recurrent state and work buffers.
 *  Measured 0.92 GiB at 32K on the 0.1.45 engine (docs/BATCHING.md); Qwen3.6's own path is 45 KB per token. */
export function sessionGb(context, kv = 'int8', family = 'flash', fit = null) {
  const ctx = Number(context) > 0 ? Number(context) : BASE_CONTEXT;
  if (fit || family === 'q36') return (fit ? ownPathCacheGb(fit, ctx) * 2 ** 30 : ctx * 45_000) / 1e9 + 0.07;
  return (ctx * 12 * (kv === 'q4_0' ? 1150 : 2100)) / 1e9 + 0.17;
}

/** The same in GiB, the unit the rest of the budget uses. */
export const sessionGib = (context, kv, family, fit) => sessionGb(context, kv, family, fit) * 1e9 / 2 ** 30;

export const drafterGb = name => DRAFTER_VRAM_GB[name] ?? 0;

/** The picture reader's memory: on the card (VRAM) or on the processor (RAM). `vision` is no | cpu | gpu | yes. */
export function visionMemory(vision = 'no', cards = []) {
  if (!vision || vision === 'no') return { vramGb: 0, ramGb: 0, where: 'off' };
  const room = Math.max(0, ...cards.map(c => Number(c?.vram_gb) || 0));
  const gpu = vision === 'gpu' || (vision === 'yes' && room >= VISION_GPU_FROM_GB);
  return gpu ? { vramGb: VISION_GPU_MIB / 1024, ramGb: 0, where: 'gpu' } : { vramGb: 0, ramGb: VISION_CPU_RAM_GB, where: 'cpu' };
}

/** True when the probe says this card drives no display: only compute runs on it. Unknown counts as a display card. */
const computeOnly = g => g?.drives_display === false;

/**
 * The reserve the app keeps free on the placed cards: [work, performance], in MiB.
 * A card that drives a display (or is not known to be headless) gets no less than 1536 MiB on a card of 16 GB
 * or less, 1024 above, 2048 with pictures; "work" also keeps a fifth of the card. A headless card keeps 512 MiB
 * (700 with pictures). A shared-memory chip uses the reserve setup wrote, or the floor, never a fifth of the RAM.
 */
export function defaultReserves(config = {}, hardware = null, baselineReserve = 0) {
  const placement = Array.isArray(config.gpu) ? config.gpu : [config.gpu ?? 0];
  const placed = (hardware?.gpus ?? []).filter(g => placement.includes(g.index));
  const gpuMemory = placed.map(g => g.vram_gb).filter(n => Number.isFinite(n) && n > 0);
  const headless = placed.length > 0 && placed.every(computeOnly);
  const pictures = config.vision ? (typeof config.vision === 'object' ? Boolean(config.vision.gpu) : true) : false;
  const floor = headless ? (pictures ? ENGINE_DEFAULT_RESERVE_MIB : COMPUTE_ONLY_RESERVE_MIB)
    : gpuMemory.length && Math.min(...gpuMemory) > 16 ? 1024 : 1536;
  const safety = headless ? floor : Math.max(pictures ? 2048 : floor, baselineReserve);
  const shared = placed.length > 0 && placed.some(g => g.uma === true || g.unified === true);
  if (shared) {
    const own = baselineReserve > 0 ? baselineReserve
      : placement.length === 1 && placed.length === 1 && wholeMib(placed[0].setup_reserve_mib) > 0
        ? wholeMib(placed[0].setup_reserve_mib) : null;
    if (own !== null) return { work: own, performance: own };
  }
  const fifth = gpuMemory.length ? Math.floor(Math.min(...gpuMemory) * 1024 * .2) : 0;
  const cap = gpuMemory.length && Math.min(...gpuMemory) <= 16 ? 1536 : Infinity;
  return { work: gpuMemory.length && !headless && !shared ? Math.max(safety, Math.min(fifth, cap)) : safety, performance: safety };
}

/** The reserve for one profile, from a card list (the screen and the host use this). */
export function reserveMibFor(cards = [], vision = 'no', profile = 'work', baselineReserveMib = 0) {
  const gpus = cards.map((c, i) => ({ index: c.index ?? i, vram_gb: Number(c.vram_gb) || 0, drives_display: c.drives_display, uma: c.uma, unified: c.unified, setup_reserve_mib: c.setup_reserve_mib }));
  const pictures = vision && vision !== 'no';
  return defaultReserves({ gpu: gpus.map(g => g.index), vision: pictures ? { gpu: vision === 'gpu' || vision === 'yes' } : undefined }, { gpus }, baselineReserveMib)[profile];
}

/**
 * The full memory budget of one start.
 *
 * `slots` multiplies the conversation cache (each slot keeps its own context). `drafter`, `vision` and
 * `reserveMib` are the other claims on the card. The experts go first to the graphics memory, then to RAM
 * beyond the system room, and whatever is left is `spillGb` (read from the SSD).
 */
export function memoryBudget({
  model = {}, hardware = null, cards = null, context = BASE_CONTEXT, kv = 'int8', slots = 1,
  drafter = null, mtp = true, vision = 'no', reserveMib = null, profile = 'work', family = 'flash',
  contextFit = null, baselineReserveMib = 0,
} = {}) {
  const modelFit = contextFit ?? model?.context_fit ?? null;
  const count = Math.max(1, Math.min(1024, Math.trunc(Number(slots) || 1)));
  const weightsGb = memoryNeeded(model);
  const expertsGb = Math.max(0, weightsGb - DENSE_EXTRA_GB);
  const perSlotGb = sessionGib(context, kv, family, modelFit);
  const contextGb = perSlotGb * count;
  const drafterVramGb = drafter !== null ? drafterGb(drafter) : mtp ? MTP_VRAM_GB : 0;
  const cardsList = cards ?? hardware?.cards ?? (hardware?.gpus ?? []);
  const visionUse = visionMemory(vision, cardsList);
  const reserve = reserveMib !== null ? Number(reserveMib) / 1024
    : reserveMibFor(cardsList, vision, profile, baselineReserveMib) / 1024;
  const vram = Math.max(0, Number(hardware?.vram_gb) || 0);
  const ram = Number(hardware?.ram_gb);
  const denseGb = Math.max(0, DENSE_GB - cacheGb(BASE_CONTEXT, kv)) + contextGb;
  if (!Number.isFinite(ram) || ram <= 0) {
    return { weightsGb, denseGb, expertsGb, contextPerSlotGb: perSlotGb, contextGb, slots: count,
      drafterGb: drafterVramGb, visionGb: visionUse.vramGb, visionRamGb: visionUse.ramGb, visionWhere: visionUse.where,
      reserveGb: reserve, systemRoomGb: SYSTEM_ROOM_GB, vramUseGb: 0, ramUseGb: 0, spillGb: 0, totalGb: 0, known: false };
  }
  const usableVram = Math.max(0, vram - reserve - visionUse.vramGb);
  const onGpu = Math.max(0, Math.min(expertsGb, usableVram - denseGb - (vram > 0 ? drafterVramGb : 0)));
  const ramRoom = Math.max(0, ram - SYSTEM_ROOM_GB - visionUse.ramGb);
  const spillGb = Math.max(0, expertsGb - onGpu - ramRoom);
  const inRam = Math.max(0, expertsGb - onGpu - spillGb);
  const vramUseGb = vram > 0 ? Math.min(vram, denseGb + drafterVramGb + visionUse.vramGb + onGpu) : 0;
  const ramUseGb = inRam + DENSE_EXTRA_GB * (vram > 0 ? 0 : 1) + visionUse.ramGb;
  return { weightsGb, denseGb, expertsGb, contextPerSlotGb: perSlotGb, contextGb, slots: count,
    drafterGb: drafterVramGb, visionGb: visionUse.vramGb, visionRamGb: visionUse.ramGb, visionWhere: visionUse.where,
    reserveGb: reserve, systemRoomGb: SYSTEM_ROOM_GB, vramUseGb: round1(vramUseGb), ramUseGb: round1(ramUseGb),
    spillGb: round1(spillGb), totalGb: round1(vramUseGb + ramUseGb), known: true };
}

/** How many request slots the default aims for, with the measured session cost. Used by the host and the screen. */
export function estimateSlots({ context = BASE_CONTEXT, kv = 'int8', family = 'flash', contextFit = null, cards = [], requested = DEFAULT_SLOTS, mtp = true } = {}) {
  const slot = sessionGb(context, kv, family, contextFit);
  if (!cards.length) return { slots: PARALLEL_POLICY === 'fixed' ? requested : 1, slotGb: slot, soloCacheGb: 0 };
  const total = cards.reduce((n, c) => n + (Number(c?.vram_gb) || 0), 0);
  const soloCache = Math.max(0, total - (FIRST_CARD_OTHER_GB - (mtp ? 0 : MTP_VRAM_GB)) - NEXT_CARD_OTHER_GB * (cards.length - 1));
  let slots = requested;
  if (PARALLEL_POLICY === 'fit') while (slots > 1 && slots * slot > CACHE_LOSS_SHARE * soloCache) slots -= 1;
  return { slots, slotGb: slot, soloCacheGb: soloCache };
}

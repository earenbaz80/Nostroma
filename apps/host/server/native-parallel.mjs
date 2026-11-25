/**
 * Several requests at once (the engine's batch slots) for the installed app.
 *
 * The app is for people who run a chat, a helper agent and a second chat side by side, so it aims for 4 request slots
 * instead of making them queue; a card that cannot hold 4 at the app's 128K context gets fewer. Two engine facts
 * decide how far that can go:
 *
 *   - Every slot keeps its OWN conversation state in graphics memory at the model's full context
 *     (docs/BATCHING.md, "What a slot costs"): the context is per slot, so 4 slots at 128K cost 4 times one slot
 *     (docs/DETAILS.md, "Defaults the app applies": 1 on 12 to 32 GB, 2 on 48 GB, 3 on 64 to 72 GB, 4 from 96 GB).
 *   - Without `--batch-mtp` the slots decode WITHOUT the draft layer. With it, each slot verifies one draft per window
 *     (docs/BATCHING.md), at the price of a little more memory per slot. A request that runs alone still takes the
 *     engine's solo path, so a single chat is not slower for having slots.
 *
 * Recommend, never force: a number the person sets (Expert mode, or a value already in the model's saved settings)
 * is kept exactly. The default only fills in what nobody chose. If the card has no room for 4 it is fewer, and the
 * person is told in plain words; a load that fails with several slots is tried again with one before it is reported.
 *
 * The engine does the final fitting itself ("it never refuses a count it cannot run": it logs what it could do).
 * This module keeps the request realistic so the expert cache is not squeezed for a count that could not run.
 */

import {
  BATCH_MTP_DRAFTER_GB, BATCH_MTP_MARGIN_GB, BATCH_MTP_MIN_VRAM_GB, BATCH_MTP_POLICY,
  CACHE_LOSS_SHARE, DEFAULT_SLOTS, DFLASH2_SELQ4_VRAM_GB, DFLASH2_VRAM_GB, FIRST_CARD_OTHER_GB,
  MTP_VRAM_GB, NEXT_CARD_OTHER_GB, PARALLEL_POLICY, estimateSlots, sessionGb,
} from '../shared/memory-budget.mjs';

export {
  BATCH_MTP_DRAFTER_GB, BATCH_MTP_MARGIN_GB, BATCH_MTP_MIN_VRAM_GB, BATCH_MTP_POLICY,
  CACHE_LOSS_SHARE, DEFAULT_SLOTS, DFLASH2_SELQ4_VRAM_GB, DFLASH2_VRAM_GB, FIRST_CARD_OTHER_GB,
  MTP_VRAM_GB, NEXT_CARD_OTHER_GB, PARALLEL_POLICY,
};

/** What the person is told when DFlash2 is chosen and nobody picked a number of requests (nostroma_control/drafting.py ONE_REQUEST_NOTE). */
export const DFLASH2_NOTE = 'DFlash2 answers one request at a time, so Nostroma set this model to one request at a time.';
/** The most the engine's batch window holds without grouped MTP. */
export const MAX_SLOTS = 8;

const argValue = (args, flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : undefined; };

/** Graphics memory (GB) one slot's session takes at `context` tokens: the shared figure (KV cache plus the slot's own state). */
export const slotGb = ({ context, kv = 'int8', family = 'flash', contextFit = null }) => sessionGb(context, kv, family, contextFit);

export function engineFacts(config = {}) {
  const args = Array.isArray(config.args) ? config.args.map(String) : [];
  const context = Number(argValue(args, '--max-context') ?? argValue(args, '--context') ?? config.max_context ?? config.context) || null;
  const kv = /q4/i.test(argValue(args, '--kv') ?? argValue(args, '--kv-type') ?? '') ? 'q4_0' : 'int8';
  const family = /qwen3\.6|qwen36|35b-a3b/i.test(`${config.model_name ?? ''} ${args.join(' ')}`) ? 'q36' : 'flash';
  const gpus = Array.isArray(config.gpu) ? config.gpu : config.gpu === undefined || config.gpu === null ? [0] : [config.gpu];
  return {
    args, context, kv, family, gpus,
    mtp: args.includes('--mtp') && config.mtp !== false,
    batchMtp: args.includes('--batch-mtp'),
    explicitBatch: args.includes('--batch') || args.includes('--slots'),
  };
}

/**
 * @param {object} input
 * @param {object} input.config            the model's saved settings (args, gpu, parallel, ...)
 * @param {object} [input.values]          what the person set for this load (Expert mode's "Concurrent requests")
 * @param {object} [input.hardware]        the host's hardware read (`gpus[{index, vram_gb}]`)
 * @param {number} [input.requested]       the default to aim for
 * @param {string} [input.drafter]         the drafter this load runs (resolveDrafter): with dflash2 the app fills in one request at a time unless the person chose a number
 * @returns {{slots:number, batchMtp:boolean, explicit:boolean, requested:number, note:string|null, slotGb:number}}
 */
export function chooseParallel({ config = {}, values = {}, hardware = null, requested = DEFAULT_SLOTS, drafter = null }) {
  const facts = engineFacts(config);
  const slot = slotGb({ context: facts.context, kv: facts.kv, family: facts.family });
  const chosen = values.parallel !== undefined && values.parallel !== null ? Number(values.parallel)
    : config.parallel !== undefined && config.parallel !== null ? Number(config.parallel) : null;
  // A number someone chose (including 1) is the person's decision, and so is an explicit --batch in the engine arguments.
  if (facts.explicitBatch || (chosen !== null && Number.isFinite(chosen))) {
    const slots = facts.explicitBatch ? null : Math.max(1, Math.min(1024, Math.trunc(chosen)));
    // DFlash2 chosen by name with a number of requests (owner, 2026-11-03: the person's own choice wins) runs DFlash2 with that many requests, a drafter per request
    // (nostroma_control/drafting.py blocked_by `named`). Expert mode's batch-mtp wish is still added here as in 0.2.10: the server knows the backend and the engine, takes
    // --batch-mtp out when DFlash2 runs, and keeps it when the MTP runs instead (Metal, which has no per-request drafters).
    const wantMtp = (values.batchMtp ?? config.batchMtp) === true && !facts.batchMtp && facts.mtp && facts.gpus.length === 1 && (slots ?? 0) > 1;
    return { slots: slots ?? 0, batchMtp: wantMtp, explicit: true, requested, note: null, slotGb: slot };
  }
  // DFlash2 (named, or Auto where the engine has it) and nobody chose a number of requests: one at a time, the app does not fill in slots beside it. (A number the person chose is kept
  // above: DFlash2 named runs it with that many requests; Auto keeps the MTP for several.)
  if ((drafter ?? ((values.drafting ?? config.drafting) === 'dflash2' ? 'dflash2' : null)) === 'dflash2') return { slots: 1, batchMtp: false, explicit: false, requested, note: DFLASH2_NOTE, slotGb: slot };
  const cardObjects = (hardware?.gpus ?? []).filter(g => facts.gpus.includes(g.index)).map(g => ({ ...g, vram_gb: Number(g.vram_gb) })).filter(g => Number.isFinite(g.vram_gb) && g.vram_gb > 0);
  // Without a hardware read nothing can be sized: one at a time is the safe default (a number can still be chosen).
  if (!cardObjects.length) return { slots: PARALLEL_POLICY === 'fixed' ? requested : 1, batchMtp: false, explicit: false, requested, note: null, slotGb: slot };
  const oneCard = facts.gpus.length === 1 && cardObjects.length === 1;
  const estimate = estimateSlots({ context: facts.context, kv: facts.kv, family: facts.family, cards: cardObjects, requested, mtp: facts.mtp });
  const soloCache = estimate.soloCacheGb;
  let slots = estimate.slots;
  const note = slots >= requested ? null
    : slots > 1 ? `Your graphics card has room for ${slots} requests at once with this context size, so Nostroma set that. A smaller context size leaves room for more.`
      : 'Nostroma set this model to one request at a time: your graphics card is best used that way, because more at once would make every answer slower. Helper agents and a second chat take their turn instead. A smaller context size leaves room for more at once.';
  const wish = values.batchMtp ?? config.batchMtp;   // Expert mode: true adds it by hand, false keeps it off
  const roomLeft = soloCache - slots * (slot + BATCH_MTP_DRAFTER_GB);
  const auto = BATCH_MTP_POLICY === 'auto' && oneCard && cardObjects[0].vram_gb >= BATCH_MTP_MIN_VRAM_GB && roomLeft >= BATCH_MTP_MARGIN_GB;
  const batchMtp = slots > 1 && facts.mtp && !facts.batchMtp && wish !== false && (wish === true ? oneCard : auto);
  return { slots, batchMtp, explicit: false, requested, note, slotGb: slot };
}

/**
 * Apply a choice to the run configuration that is about to be saved. Never touches a number the person chose.
 * Returns the configuration and the plain-words note (or null).
 */
export function applyParallel(cfg, choice) {
  // `batchMtp` is the app's own setting (Expert mode); the engine's config does not know it, the argument is what it reads.
  const { batchMtp: _wish, ...clean } = cfg;
  if (choice.explicit && !choice.batchMtp) return { cfg: 'batchMtp' in cfg ? clean : cfg, note: null };
  if (choice.explicit) return { cfg: { ...clean, args: [...(clean.args ?? []), '--batch-mtp'] }, note: null };
  const next = { ...clean };
  if (choice.slots > 1) next.parallel = choice.slots; else delete next.parallel;
  if (choice.batchMtp) next.args = [...(next.args ?? []), '--batch-mtp'];
  return { cfg: next, note: choice.note };
}

/** The same configuration with one request at a time, for the second try after a load that failed with several. */
export function withoutParallel(cfg) {
  const next = { ...cfg };
  delete next.parallel;
  next.args = (next.args ?? []).filter(a => a !== '--batch-mtp');
  return next;
}

/** What to say when the second try worked. */
export const FALLBACK_NOTE = 'The model could not start with several requests at once on this PC, so Nostroma loaded it for one request at a time. Everything still works; helper agents and a second chat wait their turn.';

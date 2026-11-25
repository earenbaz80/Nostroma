/**
 * The defaults the app applies when a person has not chosen (P0-5 of the first-run pass): the conversation
 * context, the request slots, the KV format, the resource profile and the graphics memory the Work profile
 * keeps free.
 *
 * They live in one place because they are what the Models page promises before anyone touches a control.
 * docs/DETAILS.md ("Defaults the app applies") states the same figures, and tests/app-defaults-docs.test.mjs
 * fails when one of them moves without that page.
 *
 * Not here: the engine's own defaults. `BASE_CONTEXT` (32K, in memory-budget.mjs) is the context the measured
 * slot and cache formulas are written against, and docs/BATCHING.md keeps the engine's one-request-at-a-time
 * default; `nostroma serve` and a run config keep those unless setup writes something else.
 */

/** 128K for every configuration (owner, 11-01), or the largest size a model offers below it. */
export const DEFAULT_CONTEXT = 131072;

/** The app aims for four requests at once; the fit policy lowers it when the card cannot hold them. */
export const DEFAULT_SLOTS = 4;

/** 8-bit conversation memory, the engine's default (docs/DETAILS.md, "KV cache"). */
export const DEFAULT_KV = 'int8';

/** Work: leave room for other programs (docs/DETAILS.md, "Defaults the app applies"). */
export const DEFAULT_PROFILE = 'work';

/**
 * The graphics memory the Work profile keeps free, in MiB (shared/memory-budget.mjs, defaultReserves).
 * A card of 16 GB or less that drives a display keeps `display`; with pictures on the card, `pictures`.
 * Above 16 GB, Work keeps `share` of the card (4,915 MiB on 24 GB). A card that drives no display keeps
 * `headless` (`headlessPictures` with pictures), and `large` is the safety floor of a larger card.
 */
export const DEFAULT_RESERVE_MIB = Object.freeze({
  display: 1536,
  large: 1024,
  pictures: 2048,
  headless: 512,
  headlessPictures: 700,
  share: 0.2,
});

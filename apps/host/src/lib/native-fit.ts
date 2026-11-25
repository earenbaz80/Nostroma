/**
 * What a model version asks of this computer, from the catalog's own figures and the hardware report.
 *
 * The accounting itself lives in shared/memory-budget.mjs: the host, the request-slot choice and this page all read
 * the same constants and the same `memoryBudget` (context per slot, slots, drafter, vision, reserve and spill). The
 * numbers are RAM + VRAM together WITHOUT the n-gram table (it stays on the SSD and is read when needed).
 */
import {
  BASE_CONTEXT, DENSE_GB, DFLASH2_SELQ4_VRAM_GB, DFLASH2_VRAM_GB, DRAFTER_VRAM_GB, MTP_VRAM_GB,
  cacheGb as sharedCacheGb, contextCacheGb as sharedContextCacheGb, memoryBudget,
  memoryNeeded as sharedMemoryNeeded, ownPathFits as sharedOwnPathFits,
} from '../../shared/memory-budget.mjs';
import type { ContextFit, FitHardware, FitInput, MemoryBudget } from '../../shared/memory-budget.mjs';

export type { ContextFit, FitHardware, FitInput } from '../../shared/memory-budget.mjs';
export { BASE_CONTEXT, DENSE_GB, DFLASH2_SELQ4_VRAM_GB, DFLASH2_VRAM_GB, DRAFTER_VRAM_GB, MTP_VRAM_GB };

export interface Fit {
  /** RAM + VRAM the version needs (the n-gram table not counted). */
  memoryGb: number;
  /** About what it takes of the graphics memory / of RAM on this PC. */
  vramUseGb: number;
  ramUseGb: number;
  /** About how much is read from the SSD while answering; 0 when it all fits in memory. */
  spillGb: number;
  known: boolean;
}

export const memoryNeeded = (v: FitInput): number => sharedMemoryNeeded(v);
/** One conversation's KV cache at `context` tokens, in GiB (the engine's figure; the budget adds the slot's own state). */
export const cacheGb = (context: number, kv = 'int8'): number => sharedCacheGb(context, kv);
export const ownPathFits = (fit: ContextFit, vramGb: number, context: number): boolean => sharedOwnPathFits(fit, vramGb, context);
/** The conversation cache of this model at this context: its own rule where the catalog gives one, else the Flash-Next figure. */
export const contextCacheGb = (context: number, kv = 'int8', fit?: ContextFit | null): number => sharedContextCacheGb(context, kv, fit);

export interface CacheChoice {
  context: number;
  kv?: string;
  /** the drafter this run loads (resolveDrafter in lib/drafting.ts); absent: the MTP, as the `mtp` argument says */
  drafter?: string;
  /** request slots at once (native-parallel); absent: one */
  slots?: number;
  /** MiB kept free for other programs (native-resources); absent: none in this estimate */
  reserveMib?: number;
}

/** The This computer card: the same placement `memoryBudget` uses, with one slot and no reserve unless the caller gives them. */
export function fitOn(v: FitInput, hw: FitHardware | null | undefined, mtp = true, cache?: CacheChoice | null): Fit {
  const budget: MemoryBudget = memoryBudget({
    model: v,
    hardware: hw,
    context: cache && cache.context > 0 ? cache.context : BASE_CONTEXT,
    kv: cache?.kv,
    slots: cache?.slots ?? 1,
    drafter: cache?.drafter ?? (mtp ? 'mtp' : 'off'),
    vision: 'no',
    reserveMib: cache?.reserveMib ?? 0,
    contextFit: v.context_fit,
  });
  return { memoryGb: budget.weightsGb, vramUseGb: budget.vramUseGb, ramUseGb: budget.ramUseGb, spillGb: budget.spillGb, known: budget.known };
}

/** The family groups of the version list, in the order shown. `family` is the engine's family id. */
export const VERSION_GROUPS: { id: string; title: string; families: string[] }[] = [
  { id: 'swift', title: 'Swift models', families: ['swift'] },
  { id: 'gsq', title: 'GSQ-RCO models', families: ['qwen', 'coder'] },
  { id: 'nvfp4', title: 'NVFP4 models', families: ['nvfp4'] },
  { id: 'gyro', title: 'Gyro models', families: ['gyro'] },
  { id: 'unsloth', title: 'Unsloth models', families: ['unsloth'] },
];

/** The fixed "Recommended" picks, in order: engine family + model name + the short note shown beside the name. */
export const RECOMMENDED: { family: string; model: string; note: string }[] = [
  { family: 'gyro', model: 'Gyro-S', note: 'the smallest' },
  { family: 'swift', model: 'IQ2_XS', note: 'good balance' },
  { family: 'qwen', model: 'IQ3_S', note: 'best quality for its size' },
  { family: 'unsloth', model: 'UD-Q4_K_XL', note: 'more quality' },
];

/** Is a group of the version list open? What the person chose wins; until they touch it, only the group holding the selected version is open
 *  (the running version's group used to stay open whatever was clicked). */
export const groupOpen = (opened: Record<string, boolean>, id: string, containsSelected: boolean): boolean => opened[id] ?? containsSelected;

/** What the engine's own pick for this PC is (catalog.recommendation: the memory tiers of setup.py and tools/nostroma_mcp.py, the same answer `nostroma launch` shows). */
export interface PcPick { family?: string | null; model?: string | null; why?: string }
export const PICK_NOTE = 'the pick for this PC';
export const OTHER_NOTE = 'the other choice';

/**
 * The recommended set, found in a version list (a version the catalog does not offer is skipped). The four fixed cards are only a display list;
 * the pick comes from the engine's own recommendation for this PC (RAM + VRAM tiers: 40 GB Swift 1.5 IQ2_XS, 48 GB IQ3_XXS, 64 GB and up IQ3_S), so
 * the page and `nostroma launch` agree. The pick comes first and is marked; when the engine names Gyro-M as the other choice (40 GB tier, NVIDIA and AMD only,
 * which the engine decides) that card follows it. Without a pick the list is the fixed four.
 */
export function recommendedVersions<V extends { sourceFamily: string; model: string }>(versions: V[], pick?: PcPick | null): { r: typeof RECOMMENDED[number]; v: V }[] {
  type Row = { r: typeof RECOMMENDED[number]; v: V };
  const find = (family: string, model: string) => versions.find(v => v.sourceFamily === family && v.model === model);
  const rows: Row[] = RECOMMENDED.map(r => ({ r, v: find(r.family, r.model) })).filter((x): x is Row => !!x.v);
  if (!pick?.family || !pick.model) return rows;
  const chosen = find(pick.family, pick.model);
  if (!chosen) return rows;
  const rest = rows.filter(x => x.v !== chosen);
  const first: Row = { r: { family: pick.family, model: pick.model, note: PICK_NOTE }, v: chosen };
  const out: Row[] = [first];
  const gyroM = /Gyro-M/.test(pick.why ?? '') ? find('gyro', 'Gyro-M') : undefined;
  if (gyroM) out.push({ r: { family: 'gyro', model: 'Gyro-M', note: OTHER_NOTE }, v: gyroM });
  return [...out, ...rest.filter(x => x.v !== gyroM)];
}

/**
 * The version list as the menu shows it, for one base model: first the versions to look at (the recommended ones, in the order given, then the ones already
 * on this computer, each by download size), then every other version by download size. A version is in exactly one of the two, so none is shown twice
 * and none is lost; the ones in `hidden` (shown elsewhere, as on the first-run page) are left out. `recommended` is one id or several.
 */
export function versionGroups<V extends { id: string; download_gb: number }>(versions: V[], hidden: ReadonlySet<string>, downloaded: ReadonlySet<string> | undefined, recommended?: string | readonly string[]): { top: V[]; more: V[] } {
  const seen = new Set<string>();
  const list = versions.filter(v => !hidden.has(v.id) && !seen.has(v.id) && !!seen.add(v.id));
  const bySize = (a: V, b: V) => a.download_gb - b.download_gb;
  const ids = typeof recommended === 'string' ? [recommended] : [...(recommended ?? [])];
  const picked = ids.map(id => list.find(v => v.id === id)).filter((v): v is V => !!v);
  const have = list.filter(v => !ids.includes(v.id) && downloaded?.has(v.id)).sort(bySize);
  const top = [...picked, ...have];
  const inTop = new Set(top.map(v => v.id));
  return { top, more: list.filter(v => !inTop.has(v.id)).sort(bySize) };
}

/**
 * What a version is on this computer: the verdict of `fitOn`, the plan the This computer card already shows, and the spill it knows about (#P0-4). The row
 * prints `fit_gb` (the files without the lookup table), so the plan measures that same figure. Up to `FIT_SPILL_GB` from the SSD is not worth a warning (the
 * plan reads it but the answer is not held back); more is 'ssd', and the list says "may run slower" with the figure. Nothing here refuses anything: no card,
 * or little memory, gets the same two words. (Not enough free disk is a different question; the download says it.) `on_this_pc` decides nothing here.
 *
 * Control's fit_label.py uses this same rule (#P0-4: the same accounting, the same 0.5 GB spill, the same two words); tests/fit-label-rule.test.mjs
 * runs both on the same computers and sizes and needs the word and the spill to come out identical.
 */
export type VersionFit = 'fits' | 'ssd' | 'unknown';
/** Spill under this is not worth a warning: the plan reads it from the SSD but the answer is not held back by it. */
export const FIT_SPILL_GB = 0.5;
/** The word and the figure behind it, so the row can say how much comes from the SSD. */
export interface VersionPlacement { state: VersionFit; spillGb: number }
export function versionPlacement(v: FitInput & { on_this_pc?: string | null }, hw: FitHardware | null | undefined, cache?: CacheChoice | null): VersionPlacement {
  const size = typeof v.fit_gb === 'number' && Number.isFinite(v.fit_gb) ? v.fit_gb : undefined;
  const fit = fitOn(size === undefined ? v : { ...v, memory_gb: size }, hw, true, cache);
  if (!fit.known) return { state: 'unknown', spillGb: 0 };
  return { state: fit.spillGb > FIT_SPILL_GB ? 'ssd' : 'fits', spillGb: fit.spillGb };
}
export function versionFit(v: FitInput & { on_this_pc?: string | null }, hw: FitHardware | null | undefined, cache?: CacheChoice | null): VersionFit {
  return versionPlacement(v, hw, cache).state;
}

/** A card as the installer's hardware report lists it. */
export interface RunCard { index: number; name: string; vram_gb: number; usable?: boolean; vendor?: string; arch?: string; uma?: boolean; integrated?: boolean; unified_gb?: number; /** a unified-memory chip: its BIOS carve-out (setup.py amd_apply_uma) */ dedicated_gb?: number }

/**
 * The graphics memory that counts for the fit label, of the largest card: nostroma_control/fit_label.py card_room_gb, the same rule (the Terminal and the
 * catalog's “on_this_pc” use it). A chip that shares the PC’s memory (Strix Halo: uma) counts only its own carve-out, because its “shared” part is the
 * RAM, already counted (QAGUI-STRIX 11-09: Q8_0, 133.8 GB, against 63.6 GB RAM + 95.8 GB carve-out-plus-shared said nothing; Control says “may run slower”
 * against 63.6 + 64). Pinned to the Python by tests/fit-label-rule.test.mjs.
 */
export function cardRoomGb(cards: readonly Pick<RunCard, 'vram_gb' | 'uma' | 'dedicated_gb'>[] | null | undefined): number {
  let best = 0;
  for (const c of cards ?? []) best = Math.max(best, c.uma ? Number(c.dedicated_gb) || 0 : Number(c.vram_gb) || 0);
  return best;
}

/**
 * The cards a model can be placed on: the ones this engine can drive (nostroma_control/gpu_fit.py `usable_cards` and `for_vendor`, same rule).
 * A card the engine has no code for, a card of the other make (an engine drives one make; the report numbers each make from 0, so
 * two cards could share a number) and a chip that shares the system memory while the computer has a card of its own are left out.
 */
export function runCards<T extends RunCard>(gpus: T[] | null | undefined, engineVendor?: string | null): T[] {
  const sharesMemory = (g: RunCard) => !!(g.integrated || g.uma || g.unified_gb);
  const mine = (gpus ?? []).filter(g => g.usable !== false && (!engineVendor || !g.vendor || g.vendor === engineVendor));
  const hasReal = mine.some(g => !sharesMemory(g) && g.vram_gb >= 4);
  return mine.filter(g => !(hasReal && sharesMemory(g)));
}

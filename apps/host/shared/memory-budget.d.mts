export interface ContextFit { bytes_per_token: number; fixed_gb: number }
export interface FitInput { ram_needed_gb?: number; experts_gb?: number | null; memory_gb?: number; mem_total?: boolean; fit_gb?: number | null; context_fit?: ContextFit | null }
export interface BudgetCard {
  index?: number;
  vram_gb?: number | null;
  drives_display?: boolean;
  uma?: boolean;
  unified?: boolean;
  integrated?: boolean;
  unified_gb?: number | null;
  dedicated_gb?: number | null;
  setup_reserve_mib?: number | null;
  vendor?: string;
  name?: string;
}
export interface FitHardware { ram_gb?: number | null; vram_gb?: number | null; gpus?: BudgetCard[]; cards?: BudgetCard[] }
export interface MemoryBudgetInput {
  model?: FitInput;
  hardware?: FitHardware | null;
  cards?: BudgetCard[] | null;
  context?: number;
  kv?: string;
  slots?: number;
  drafter?: string | null;
  mtp?: boolean;
  vision?: 'no' | 'cpu' | 'gpu' | 'yes' | string;
  reserveMib?: number | null;
  profile?: 'work' | 'performance';
  family?: string;
  contextFit?: ContextFit | null;
  baselineReserveMib?: number;
}
export interface MemoryBudget {
  weightsGb: number;
  denseGb: number;
  expertsGb: number;
  contextPerSlotGb: number;
  contextGb: number;
  slots: number;
  drafterGb: number;
  visionGb: number;
  visionRamGb: number;
  visionWhere: 'off' | 'cpu' | 'gpu';
  reserveGb: number;
  systemRoomGb: number;
  vramUseGb: number;
  ramUseGb: number;
  spillGb: number;
  totalGb: number;
  known: boolean;
}
export const DENSE_GB: number;
export const SYSTEM_ROOM_GB: number;
export const DENSE_EXTRA_GB: number;
export const BASE_CONTEXT: number;
export const MTP_VRAM_GB: number;
export const DFLASH2_VRAM_GB: number;
export const DFLASH2_SELQ4_VRAM_GB: number;
export const DRAFTER_VRAM_GB: Record<string, number>;
export const VISION_GPU_MIB: number;
export const VISION_CPU_RAM_GB: number;
export const VISION_GPU_FROM_GB: number;
export const DEFAULT_SLOTS: number;
export const PARALLEL_POLICY: 'fit' | 'fixed';
export const CACHE_LOSS_SHARE: number;
export const FIRST_CARD_OTHER_GB: number;
export const NEXT_CARD_OTHER_GB: number;
export const BATCH_MTP_POLICY: 'auto' | 'off';
export const BATCH_MTP_MIN_VRAM_GB: number;
export const BATCH_MTP_DRAFTER_GB: number;
export const BATCH_MTP_MARGIN_GB: number;
export const ENGINE_DEFAULT_RESERVE_MIB: number;
export const COMPUTE_ONLY_RESERVE_MIB: number;
export function memoryNeeded(v: FitInput): number;
export function cacheGb(context: number, kv?: string): number;
export function ownPathCacheGb(fit: ContextFit, context: number): number;
export function ownPathFits(fit: ContextFit, vramGb: number, context: number): boolean;
export function contextCacheGb(context: number, kv?: string, fit?: ContextFit | null): number;
export function sessionGb(context: number, kv?: string, family?: string, fit?: ContextFit | null): number;
export function sessionGib(context: number, kv?: string, family?: string, fit?: ContextFit | null): number;
export function drafterGb(name?: string | null): number;
export function visionMemory(vision?: string, cards?: BudgetCard[]): { vramGb: number; ramGb: number; where: 'off' | 'cpu' | 'gpu' };
export function defaultReserves(config?: Record<string, unknown>, hardware?: { gpus?: BudgetCard[] } | null, baselineReserve?: number): { work: number; performance: number };
export function reserveMibFor(cards?: BudgetCard[], vision?: string, profile?: 'work' | 'performance', baselineReserveMib?: number): number;
export function memoryBudget(input?: MemoryBudgetInput): MemoryBudget;
export function estimateSlots(input?: { context?: number; kv?: string; family?: string; contextFit?: ContextFit | null; cards?: BudgetCard[]; requested?: number; mtp?: boolean }): { slots: number; slotGb: number; soloCacheGb: number };

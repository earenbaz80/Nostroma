"""The one fit label of a model on this computer: the plan behind it, and the part it reads from the SSD.

The app's version list says the same word (apps/host/src/lib/native-fit.ts `versionFit`), and both read the same accounting: the model's files, WITHOUT the
n-gram / PLE / Engram lookup table file (it stays on the SSD and is not counted), go first to the graphics memory beyond the dense part and the draft layer,
then to the RAM beyond the room the system keeps; whatever is left is read from the SSD while the model answers.

    size  = the download size minus the lookup table's file (`files_gb`): the "Needs (RAM + VRAM)" column of the Terminal list
    room  = RAM + the card's memory (the largest card that counts; a chip that shares the RAM only its own carve-out)

Up to SPILL_GB (0.5) from the SSD is not worth a word: "fits".  More: "may run slower".  Nothing here refuses anything; a model that "may run slower" can
still be started, and a computer with no card or a Mac with little memory gets the same two words.

This is the plan of apps/host/shared/memory-budget.mjs with the defaults the app's list uses (32K of context, int8 cache, one request, the MTP drafter, no
reserve); apps/host/tests/fit-label-rule.test.mjs runs both on the same computers and sizes to keep the two identical.
"""

from __future__ import annotations

import math

FITS = "fits"
SLOWER = "may run slower"

# The arithmetic of apps/host/shared/memory-budget.mjs (DENSE_GB, DENSE_EXTRA_GB, SYSTEM_ROOM_GB, BASE_CONTEXT, the KV cache, MTP_VRAM_GB).
DENSE_GB = 5.0
DENSE_EXTRA_GB = 1.0
SYSTEM_ROOM_GB = 10.0
BASE_CONTEXT = 32768
_KV_LAYERS = 13
_KV_BYTES_INT8 = 1056
_KV_FACTOR = 1.054
MTP_VRAM_GB = 1.08
# Up to this much of the experts may come from the SSD without a word (memory-budget.mjs; native-fit.ts FIT_SPILL_GB).
SPILL_GB = 0.5

# The lookup table's file, by family (bytes from the pinned shard lists in setup.py; the Hub's LFS pointers):
#   qwen / swift / coder / unsloth (all but the three big files): the n-gram table, IQ4_NL, 28,800,138,432 bytes, a shard of its own
#   unsloth UD-Q5_K_XL, UD-Q6_K_XL, Q8_0: the Q8_0 table, shard 3, 54,400,261,312 bytes
#   nvfp4: the FP8 table `ple-fp8.gguf`, 51,200,246,176 bytes
#   nvfp4 NVFP4-QAD: its 102.2 GB download is NVIDIA's checkpoint, which this PC converts into the pack that runs; the files that run are the converted pack, the same
#     size as the other NVFP4 sets (128.0 - 51.2 = 76.8 GB), so that figure is used (owner's rule: the model files that run, minus the table)
#   gyro: the table is inside the one GGUF; the catalog states the rest (its `ram_gb`: 27.6 / 35 GB), the table is the difference
#   qwen36 (its own path) has none.  A family this module does not know counts its whole download.
_GB = 1e9
_TABLE_BYTES = {"qwen": 28_800_138_432, "swift": 28_800_138_432, "coder": 28_800_138_432, "unsloth": 28_800_138_432, "nvfp4": 51_200_246_176}
_BIG_UNSLOTH = ("UD-Q5_K_XL", "UD-Q6_K_XL", "Q8_0")
_BIG_TABLE_BYTES = 54_400_261_312
_PACK_GB = {("nvfp4", "NVFP4-QAD"): 76.8}        # sets whose download is not the files that run: the size of what runs


def table_gb(family: str | None, model: str | None, d: dict) -> float:
    """The size of the lookup table's file, in GB, of one catalog entry `d` (download_gb, ram_gb, mem_total)."""
    if d.get("mem_total") or family == "gyro":
        return max(0.0, float(d["download_gb"]) - float(d["ram_gb"]))
    if family == "unsloth" and model in _BIG_UNSLOTH:
        return _BIG_TABLE_BYTES / _GB
    return _TABLE_BYTES.get(str(family), 0) / _GB


def files_gb(family: str | None, model: str | None, d: dict) -> float:
    """The model's files without the lookup table, in GB (one decimal): the size the label and the "Needs" column use."""
    if (family, model) in _PACK_GB:
        return _PACK_GB[(family, model)]
    return round(float(d["download_gb"]) - table_gb(family, model, d), 1)


def card_room_gb(cards: list[dict] | None) -> float:
    """The graphics memory that counts for one model: the largest card, an integrated chip only for its own carve-out (its shared memory is the RAM)."""
    best = 0.0
    for c in cards or []:
        gb = float(c.get("dedicated_gb") or 0.0) if c.get("uma") else float(c.get("vram_gb") or 0.0)
        best = max(best, gb)
    return best


def _round1(n: float) -> float:
    """One decimal, as JavaScript's Math.round(n * 10) / 10 does it (the app rounds the spill before it looks at it)."""
    return math.floor(n * 10 + 0.5) / 10


def cache_gb(context: int = BASE_CONTEXT) -> float:
    """One conversation's KV cache at `context` tokens, in GiB (memory-budget.mjs cacheGb, int8)."""
    return (121 + context * _KV_LAYERS * _KV_BYTES_INT8 * _KV_FACTOR / 2 ** 20) / 1024


def session_gib(context: int = BASE_CONTEXT) -> float:
    """One request slot's whole session, in GiB: the KV cache plus the recurrent state and work buffers (memory-budget.mjs sessionGib)."""
    return ((context * 12 * 2100) / 1e9 + 0.17) * 1e9 / 2 ** 30


def spill_gb(size_gb: float, ram_gb: float | None, vram_gb: float | None, context: int = BASE_CONTEXT) -> float:
    """The experts the plan reads from the SSD, in GiB, one decimal (memory-budget.mjs memoryBudget with the app's list defaults)."""
    experts = max(0.0, float(size_gb) - DENSE_EXTRA_GB)
    dense = max(0.0, DENSE_GB - cache_gb(context)) + session_gib(context)
    vram = max(0.0, float(vram_gb or 0.0))
    on_gpu = max(0.0, min(experts, vram - dense - (MTP_VRAM_GB if vram > 0 else 0.0)))
    ram_room = max(0.0, float(ram_gb or 0.0) - SYSTEM_ROOM_GB)
    return _round1(max(0.0, experts - on_gpu - ram_room))


def label(size_gb: float, ram_gb: float | None, vram_gb: float | None) -> str:
    """"fits" when the plan keeps the experts in memory (up to SPILL_GB read from the SSD), else "may run slower"."""
    return FITS if spill_gb(size_gb, ram_gb, vram_gb) <= SPILL_GB else SLOWER

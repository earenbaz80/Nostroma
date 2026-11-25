# Engine settings

<!-- Generated from data/settings-register.json by tools/settings_register.py --docs. Do not edit by hand; change the register. -->

The engine reads its settings from environment variables. The product's name is Nostroma, so the name to write is
`NOSTROMA_<setting>`: the older `NOSTROMA_<setting>` is still read and still works, and `NOSTROMA_` wins when both are set.
The Terminal and the app choose what your hardware needs, so most people never set one. This page lists the ones meant for people:
switches that are off until you turn them on, and switches that take a newer default back to the earlier behaviour. The other
settings are for measuring and debugging and are kept in `data/settings-register.json`.

A number or a word is set like any environment variable, for example `NOSTROMA_KVA=1`. In the Terminal, `nostroma launch --set NAME=value`
puts it in the model's run configuration.

## Switches you can turn on (272)

Off unless you set them. The last column says where each one is described.

| Setting | Value | Applies to | Described in |
|---|---|---|---|
| `NOSTROMA_ADAPT_FETCH` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ADAPT_FETCH_MIN` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ADAPT_OVERLAP` | text | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_AMD_COMMUNITY_TUNING` | on / off | NVIDIA and AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_ARENA_FALLBACK_RESIDENT` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ARENA_MMAP` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ARENA_PIN_GIB` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [BATCHING.md](BATCHING.md), [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ARENA_RAM_WAIT_S` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ARGMAX_MULTI` | number | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ARGMAX_ROWS_SM70` | number | NVIDIA and AMD | [NVIDIA_V100.md](NVIDIA_V100.md) |
| `NOSTROMA_ATTN_PRE75` | on / off | NVIDIA and AMD, Intel Arc | [NVIDIA_V100.md](NVIDIA_V100.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_ATTN_RS` | number | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_AUX_CPUS` | text | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_AUX_STAGER` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_BATCH_DECODE_SHARE` | number | NVIDIA and AMD, Intel Arc | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_BATCH_MTP` | on / off | NVIDIA and AMD, Intel Arc | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_BATCH_YIELD_CHUNKS` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_CACHE_DIR` | on / off | Intel Arc | [INTEL_INT8_EXPERTS.md](INTEL_INT8_EXPERTS.md) |
| `NOSTROMA_CACHE_MESSAGE_BOUNDARY` | number | NVIDIA and AMD, Intel Arc | [MESSAGE_BOUNDARY_CACHE.md](MESSAGE_BOUNDARY_CACHE.md), [PROMPT_CACHE_TAIL.md](PROMPT_CACHE_TAIL.md) |
| `NOSTROMA_CKPT_ASYNC` | on / off | NVIDIA | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_CKPT_REREAD` | on / off | NVIDIA and AMD, Intel Arc | [KVA.md](KVA.md), [PROMPT_CACHE_TAIL.md](PROMPT_CACHE_TAIL.md) |
| `NOSTROMA_CKPT_THREADS` | on / off | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_CKPT_VRAM_SLOTS` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_COLD_OVERLAP` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.0.md](release-notes-0.2.0.md) |
| `NOSTROMA_COLD_TRACE` | on / off | NVIDIA and AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_COPY_ENGINE` | on / off | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_COPY_HIP_PRIO` | number | NVIDIA and AMD | - |
| `NOSTROMA_DBG_GDN` | on / off | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_DENSE_F32` | number | NVIDIA | [COMMUNITY_BENCHMARKS.md](COMMUNITY_BENCHMARKS.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_DENSE_MMQ` | on / off | AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md) |
| `NOSTROMA_DEQUANT_SIDE` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_DISJOINT_ADAPT` | number | NVIDIA and AMD, Intel Arc | [DISJOINT_EXPERT_CACHE.md](DISJOINT_EXPERT_CACHE.md) |
| `NOSTROMA_DMA_BATCH` | number | NVIDIA and AMD | [BATCHED_DMA.md](BATCHED_DMA.md), [DETAILS.md](DETAILS.md) |
| `NOSTROMA_DOWN_WS` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_DUMP_FIRST_LOGITS` | on / off | NVIDIA and AMD, Intel Arc | [DGX_SPARK_LINUX.md](DGX_SPARK_LINUX.md) |
| `NOSTROMA_DUMP_MOE_INPUT` | text | NVIDIA and AMD | [NVFP4.md](NVFP4.md) |
| `NOSTROMA_EMBED_VRAM` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_EXCHANGE_ROTATE` | on / off | NVIDIA and AMD, Intel Arc, CPU | [DETAILS.md](DETAILS.md), [EXCHANGE_ROTATION.md](EXCHANGE_ROTATION.md) |
| `NOSTROMA_EXPDEC_MINB` | number | NVIDIA and AMD | [EXPERTDEC.md](EXPERTDEC.md) |
| `NOSTROMA_EXPDEC_MINBLK` | number | NVIDIA and AMD | [EXPERTDEC.md](EXPERTDEC.md) |
| `NOSTROMA_EXPDEC_RB` | number | NVIDIA and AMD | [EXPERTDEC.md](EXPERTDEC.md) |
| `NOSTROMA_EXPERT_NIBBLE` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_EXPERT_NIBBLE_FMTS` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_EXPERT_NIBBLE_RECHECK` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_EXPERT_NIBBLE_SKIP` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_EXPERT_V2K` | on / off | NVIDIA and AMD, Intel Arc | [QUANTS.md](QUANTS.md), [QWEN36.md](QWEN36.md) |
| `NOSTROMA_EXP_MODE` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [NVIDIA_V100.md](NVIDIA_V100.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_F16_RANGE` | on / off | NVIDIA and AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_FETCH_THREADS` | number | NVIDIA and AMD, Intel Arc | [UNSLOTH_Q4.md](UNSLOTH_Q4.md) |
| `NOSTROMA_FILE_CACHE_OLD_RULE` | on / off | NVIDIA and AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_FILE_RELEASE` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_FILL_AHEAD` | number | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_FS_SLOTS` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md), [DETAILS.md](DETAILS.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_GDN_CHUNK` | number | NVIDIA and AMD | [GDN_CONTRACT.md](GDN_CONTRACT.md), [NVIDIA_V100.md](NVIDIA_V100.md) |
| `NOSTROMA_GDN_PIPELINE` | number | NVIDIA and AMD, Intel Arc | [GDN_CONTRACT.md](GDN_CONTRACT.md) |
| `NOSTROMA_GDN_REC_HEADS` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_GFX12_CHUNK` | text | AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_GFX12_RING` | on / off | AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_GFX906_ATTN_QUERY_SWIZZLE` | on / off | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_GFX906_ATTN_REDUCE12` | on / off | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_GRAPH_PRIO` | number | NVIDIA | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_GR_DOWN_TG` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_GR_SPLIT` | on / off | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_HANDOFF_PIPE` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_HC_PERSIST` | number | NVIDIA and AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_HC_REQ8` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_HEAD_HOST` | on / off | NVIDIA and AMD | - |
| `NOSTROMA_HIPBLASLT_TUNING` | on / off | AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [AMD_HIP_PERFORMANCE.md](AMD_HIP_PERFORMANCE.md), [RADEON_780M.md](RADEON_780M.md) |
| `NOSTROMA_HIPBLASLT_VERBOSE` | text | AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_HIP_ADAPT_KERNEL_COPY` | on / off | AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md) |
| `NOSTROMA_HIP_ROUTER_OLD` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_HIP_WMMA_MIN_Q` | number | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_HOST_CORE` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_I8_DBG` | number | Intel Arc | [INTEL_INT8_EXPERTS.md](INTEL_INT8_EXPERTS.md) |
| `NOSTROMA_I8_GRF` | number | Intel Arc | [INTEL_INT8_EXPERTS.md](INTEL_INT8_EXPERTS.md) |
| `NOSTROMA_I8_MT` | number | Intel Arc | [INTEL_INT8_EXPERTS.md](INTEL_INT8_EXPERTS.md) |
| `NOSTROMA_I8_WG` | number | Intel Arc | [INTEL_INT8_EXPERTS.md](INTEL_INT8_EXPERTS.md) |
| `NOSTROMA_IO_PF_AHEAD` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IO_PF_GATE` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.0.md](release-notes-0.2.0.md) |
| `NOSTROMA_IO_PF_GATE_LO` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IO_PF_GATE_USEFUL` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IO_PF_STAGE` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IO_PF_THREADS` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IO_PREFETCH` | on / off | NVIDIA and AMD | [BATCHING.md](BATCHING.md), [DETAILS.md](DETAILS.md), [RADEON_780M.md](RADEON_780M.md) |
| `NOSTROMA_IO_PREFETCH_DEPTH` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IQ3S_MT1` | on / off | CPU | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IQ3S_WIDE` | number | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_IQ4_W4A8` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_IQ512_FUSED_MAX` | number | CPU | - |
| `NOSTROMA_IQ_STAGE_GRID` | on / off | NVIDIA and AMD, Intel Arc | [GYRO.md](GYRO.md), [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_IQ_STAGE_TABLES` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_KVA` | on / off | NVIDIA and AMD | [KVA.md](KVA.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_KVA_ANY_MODEL` | on / off | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_CAPTURE` | on / off | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_CAPTURE_FP32` | on / off | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_GDN_NORM` | number | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_MIN_PROMPT` | number | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_MODE` | on / off | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_ONLY` | on / off | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_ORACLE` | on / off | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_SKIP` | on / off | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KVA_SUFFIX` | number | NVIDIA and AMD | [KVA.md](KVA.md) |
| `NOSTROMA_KV_GROW` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_KV_GROW_HOLD` | number | NVIDIA and AMD | - |
| `NOSTROMA_KV_HOST_REGISTER` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_KV_PREFETCH` | number | NVIDIA and AMD, Intel Arc | [KV_PREFETCH.md](KV_PREFETCH.md) |
| `NOSTROMA_KV_ROT` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md), [SPLIT_SERVE.md](SPLIT_SERVE.md) |
| `NOSTROMA_LEND_MIRROR` | number | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_LM_HIP` | on / off | AMD | - |
| `NOSTROMA_LOGITS_DUMP` | on / off | NVIDIA and AMD, Intel Arc | [KVA.md](KVA.md) |
| `NOSTROMA_LOGPOS_TOPK` | number | NVIDIA and AMD, Intel Arc | [QUANTS.md](QUANTS.md), [UNSLOTH_Q4.md](UNSLOTH_Q4.md) |
| `NOSTROMA_LOOKUP_MAX_T` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_MEMORY_LIMIT_MIB` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_METAL_ARENA_GB` | number | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_CONTIG` | number | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_GYRO_TILES` | on / off | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_KEEP_FREE_GB` | number | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_KEEP_HOST_WEIGHTS` | on / off | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_KPROF` | number | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_LEAVE_SHARE` | number | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_MTP_CHAIN` | on / off | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_PROMPT` | on / off | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_PROMPT_CHUNK` | number | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_PROMPT_EXPERTS` | on / off | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_STREAM` | on / off | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_TRACE` | on / off | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_METAL_WIRE_ARENA` | number | Mac | [MAC.md](MAC.md) |
| `NOSTROMA_MIRROR_MIB` | number | Intel Arc | [INTEL.md](INTEL.md), [INTEL_ARC.md](INTEL_ARC.md) |
| `NOSTROMA_MMQ_DIRECT` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md), [DETAILS.md](DETAILS.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_MMQ_GROUP_SORT` | text | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_MMQ_WS` | number | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_MMVQ_IL_89` | text | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [MMVQ_IL_TABLE.md](MMVQ_IL_TABLE.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_MMVQ_IL_PF` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [MMVQ_IL_TABLE.md](MMVQ_IL_TABLE.md) |
| `NOSTROMA_MMVQ_IL_ROWS` | on / off | NVIDIA and AMD | [MMVQ_IL_TABLE.md](MMVQ_IL_TABLE.md) |
| `NOSTROMA_MMVQ_WIDE_32` | number | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_MTP_KEEP` | on / off | NVIDIA and AMD | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_MTP_Q8_SM60` | on / off | NVIDIA and AMD | [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_MTP_ROOM_MIN` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_NIB_GU_PROTO` | number | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_NO_ARENA_THP` | on / off | NVIDIA and AMD, Intel Arc | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| `NOSTROMA_NO_AVXVNNI` | number | CPU | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_NO_TQ_KERNELS` | number | CPU | [GYRO.md](GYRO.md) |
| `NOSTROMA_OWNED_PRICE` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PARK_ASYNC` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PARK_TRACE` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PARK_VRAM_MIB` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PARTIAL_PIN` | number | NVIDIA and AMD, Intel Arc | [UNSLOTH_Q4.md](UNSLOTH_Q4.md) |
| `NOSTROMA_PARTIAL_PIN_GIB` | number | NVIDIA and AMD, Intel Arc | [UNSLOTH_Q4.md](UNSLOTH_Q4.md) |
| `NOSTROMA_PATTN_SM60` | number | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_PA_V2T` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PCIE_AUTO_CANON` | on / off | NVIDIA and AMD | - |
| `NOSTROMA_PCIE_FRAC_DEFAULT` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PCIE_K_RULE` | text | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PCIE_MIN1` | number | NVIDIA and AMD | - |
| `NOSTROMA_PEER_NO_P2P` | number | NVIDIA and AMD | [SECOND_GPU.md](SECOND_GPU.md) |
| `NOSTROMA_PENALTY_PROMPT` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_BATCH` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_DMA_PAGEABLE` | on / off | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_PF_FUSED_F16` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_FUSED_IQ2S` | text | NVIDIA and AMD | - |
| `NOSTROMA_PF_FUSED_NATIVE` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_FUSED_NT` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_FUSED_Q2N` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_PF_FUSED_SM75` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_FUSED_WS` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_GROUP_SCRATCH` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_HC_REGION` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_I8` | on / off | Intel Arc | [INTEL_INT8_EXPERTS.md](INTEL_INT8_EXPERTS.md) |
| `NOSTROMA_PF_P1A_L2` | on / off | AMD | - |
| `NOSTROMA_PF_PEER_CPU` | number | NVIDIA and AMD | - |
| `NOSTROMA_PF_SWITCH_MIN_T` | number | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [STRIX_HALO.md](STRIX_HALO.md) |
| `NOSTROMA_PF_WMMA` | on / off | NVIDIA and AMD | [NVIDIA_V100.md](NVIDIA_V100.md) |
| `NOSTROMA_PF_WMMA2` | on / off | NVIDIA and AMD | [NVIDIA_V100.md](NVIDIA_V100.md) |
| `NOSTROMA_PIN_BY_NEED` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [DOCKER.md](DOCKER.md), [TERMINAL_LAUNCH.md](TERMINAL_LAUNCH.md) |
| `NOSTROMA_PIN_GUARD` | number | NVIDIA and AMD | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| `NOSTROMA_PIN_RESERVE_GIB` | number | NVIDIA and AMD | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| `NOSTROMA_PIPED_CONCURRENT` | text | NVIDIA and AMD | [AMD_HIP.md](AMD_HIP.md), [BATCHING.md](BATCHING.md) |
| `NOSTROMA_PIPED_CONCURRENT_PRIO` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_PIPED_DECODE_MAX_MS` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_PIPED_DECODE_MIN_MS` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_PIPED_MTP` | on / off | NVIDIA and AMD | [BATCHING.md](BATCHING.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_PIPED_READ_PIECE` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_PIPELINE_AUTO` | text | NVIDIA and AMD, Intel Arc | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_PIPELINE_DEBUG` | on / off | NVIDIA and AMD, Intel Arc | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_PIPE_ADAPT_EVERY` | on / off | NVIDIA and AMD | [BATCHING.md](BATCHING.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_PIPE_BYIELD_NODRAIN` | on / off | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_PLE_COMPACT` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PLE_COPY_STREAM` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_POOL_CORES` | on / off | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md), [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_PREFILL_AUTO_MAX` | number | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PREFILL_BORROW` | text | NVIDIA, AMD | [STRIX_HALO.md](STRIX_HALO.md), [STRIX_HALO_WINDOWS.md](STRIX_HALO_WINDOWS.md) |
| `NOSTROMA_PREFILL_CPU_SHARE_BATCH` | on / off | NVIDIA and AMD | - |
| `NOSTROMA_PREFILL_CPU_SHARE_MAX` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PREFILL_EQUAL` | text | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PREFILL_FIRST` | number | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_PREFILL_HELP` | number | NVIDIA and AMD, Intel Arc | [BATCHING.md](BATCHING.md), [GYRO.md](GYRO.md), [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_PREFILL_HELP_FRAC` | number | NVIDIA and AMD, Intel Arc | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_PREFILL_HOST_PLAN` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.0.md](release-notes-0.2.0.md) |
| `NOSTROMA_PREFILL_ISSUER` | number | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PREFILL_LAYER_MAJOR` | on / off | NVIDIA and AMD | [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_PREFILL_MMQ` | number | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [AMD_HIP_PERFORMANCE.md](AMD_HIP_PERFORMANCE.md), [GYRO.md](GYRO.md) |
| `NOSTROMA_PREFILL_PIPE` | number | NVIDIA and AMD | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_PREFILL_ROUTED_STREAM` | text | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PREFILL_ROUTED_STREAM_DEPTH` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PREFILL_STREAM_ALL` | on / off | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_PRIMARY_DEVICE` | number | NVIDIA and AMD | [SECOND_GPU.md](SECOND_GPU.md) |
| `NOSTROMA_PROMPT_ATTN_IMMA` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PROMPT_DIRECT` | on / off | NVIDIA and AMD | [QUANTS.md](QUANTS.md) |
| `NOSTROMA_PW_WITH_BATCH` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_Q2_BITPLANE` | on / off | CPU | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_Q36_FIXED_SLOTS` | on / off | NVIDIA and AMD | [QWEN36.md](QWEN36.md) |
| `NOSTROMA_Q36_READ_WINDOWS` | number | NVIDIA and AMD | [QWEN36.md](QWEN36.md) |
| `NOSTROMA_Q36_VERIFY` | on / off | NVIDIA and AMD | [QWEN36.md](QWEN36.md) |
| `NOSTROMA_Q6_PLANAR` | on / off | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_Q8_GATHER_WIDE` | on / off | NVIDIA | [NVIDIA_V100.md](NVIDIA_V100.md) |
| `NOSTROMA_Q8_SM60` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_QSA_CLUSTER` | number | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_QSA_SPLIT_ATTN` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_RAM_ADAPT` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_RAM_KEEP_GIB` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_RDNA2_SGEMM` | number | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_RESIDENT_HEADROOM_GIB` | number | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| `NOSTROMA_ROCBLAS_TUNING` | on / off | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_ROCBLAS_VERBOSE` | text | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_ROUTE_PER_TOKEN` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_ROUTE_PRIOR` | text | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.0.md](release-notes-0.2.0.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_ROUTE_RESIDENT` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ROUTE_RESIDENT_MTP` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SCORES_HALVE` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SCORES_THREAD_TRACE` | text | AMD | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_SELECT_LONG` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_SELECT_LONG_AT` | number | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_SELECT_SIMT` | on / off | NVIDIA and AMD | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_SELECT_TWO_PASS_CHECK` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SELECT_TWO_PASS_MIN` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SM120_PERF` | number | NVIDIA | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SM121_PERF` | number | NVIDIA and AMD | [DGX_SPARK_LINUX.md](DGX_SPARK_LINUX.md) |
| `NOSTROMA_SM70_TABLE` | number | NVIDIA and AMD | [COMMUNITY_BENCHMARKS.md](COMMUNITY_BENCHMARKS.md), [NVIDIA_V100.md](NVIDIA_V100.md) |
| `NOSTROMA_SM75_PERF` | number | NVIDIA | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SPEC_COUPLED` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SPEC_FIXED` | on / off | NVIDIA and AMD | - |
| `NOSTROMA_SPEC_FIXED_TABLE` | number | NVIDIA and AMD | - |
| `NOSTROMA_SPEC_GUMBEL` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SPEC_MIN_TEMP` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SPEC_PROB` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_SPEC_PROB_GATE` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SPEC_WATCH` | number | NVIDIA and AMD | [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_SPLIT_HEADROOM` | number | Intel Arc | [INTEL_ARC.md](INTEL_ARC.md) |
| `NOSTROMA_SPLIT_HEADROOM_TOL` | number | Intel Arc | [INTEL_ARC.md](INTEL_ARC.md) |
| `NOSTROMA_SPLIT_MTP_BATCH` | text | NVIDIA and AMD | [BATCHING.md](BATCHING.md), [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_SPLIT_OVERLAP` | number | NVIDIA and AMD | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_SPLIT_UNIFORM` | on / off | NVIDIA and AMD | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_SPLIT_WAIT_MS` | number | NVIDIA and AMD | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_SSD_GBPS` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_STAGER_SLEEP` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_STAGER_SSD` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_STAGE_PIN` | number | NVIDIA and AMD | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_STATE_HASH` | on / off | NVIDIA and AMD, Intel Arc | [SPLIT_SERVE.md](SPLIT_SERVE.md) |
| `NOSTROMA_SYCL_GEMM_STAGE` | on / off | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_TEST_BELL_SLEEP_US` | number | NVIDIA and AMD | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_TOPK_MULTI` | on / off | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_TOPK_OLD` | on / off | NVIDIA and AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_TQ_ISA` | on / off | CPU | [GYRO.md](GYRO.md) |
| `NOSTROMA_UMA_HEADROOM_GIB` | number | NVIDIA and AMD, Intel Arc | [STRIX_HALO.md](STRIX_HALO.md) |
| `NOSTROMA_UNBUFFERED_LOAD` | on / off | NVIDIA and AMD, Intel Arc | [QUANTS.md](QUANTS.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| `NOSTROMA_VERIFY_ALL_SLOTS` | on / off | Intel Arc | [INTEL.md](INTEL.md) |
| `NOSTROMA_VERIFY_EARLY_PLE_FLAG` | number | NVIDIA and AMD | [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_VERIFY_NO_HOST` | on / off | Intel Arc | [A770_SPEED_SPEC.md](A770_SPEED_SPEC.md), [INTEL.md](INTEL.md), [INTEL_ARC.md](INTEL_ARC.md) |
| `NOSTROMA_VRAM_FREE` | on / off | NVIDIA and AMD | [DETAILS.md](DETAILS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_WATCHDOG_S` | number | NVIDIA and AMD, Intel Arc | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_WDDM_BUDGET` | number | AMD, Intel Arc | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_WS_FAST` | number | NVIDIA and AMD | [OLDER_GPUS.md](OLDER_GPUS.md) |

## Switches that go back to earlier behaviour (82)

These behaviours are on by default. Setting the switch returns the earlier behaviour; the notes in the register say which
version made it the default.

| Setting | Value | Applies to | Named in the engine since | Described in |
|---|---|---|---|---|
| `NOSTROMA_ADAPT_SIGNAL` | on / off | NVIDIA and AMD | v0.1.43.1 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_ATTN_V3` | on / off | NVIDIA and AMD | v0.1.45 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_BATCH_GROUPS_AUTO` | number | Intel Arc | v0.2.9 | - |
| `NOSTROMA_BATCH_GROUPS_NV_SERIAL` | text | NVIDIA and AMD | v0.2.1 | [BATCHING.md](BATCHING.md), [release-notes-0.2.1.md](release-notes-0.2.1.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_BATCH_MTP_SERIAL` | on / off | NVIDIA and AMD | v0.1.43.1 | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_DEFAULTS` | text | NVIDIA and AMD | v0.2.7 | [BATCHING.md](BATCHING.md), [DETAILS.md](DETAILS.md), [DGX_SPARK_LINUX.md](DGX_SPARK_LINUX.md) |
| `NOSTROMA_DEQUANT_WIDE` | number | NVIDIA and AMD | v0.1.44 | [DETAILS.md](DETAILS.md), [OLDER_GPUS.md](OLDER_GPUS.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_EXPERT_I8` | text | NVIDIA and AMD | - | - |
| `NOSTROMA_FILE_TIER_IDLE` | number | NVIDIA and AMD | v0.2.12 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_GFX1151_CHUNK` | text | AMD | v0.2.3 | [release-notes-0.2.3.md](release-notes-0.2.3.md), [STRIX_HALO.md](STRIX_HALO.md), [STRIX_HALO_WINDOWS.md](STRIX_HALO_WINDOWS.md) |
| `NOSTROMA_GFX1151_DEFAULTS` | on / off | NVIDIA and AMD | v0.1.40.1 | [STRIX_HALO.md](STRIX_HALO.md), [STRIX_HALO_WINDOWS.md](STRIX_HALO_WINDOWS.md) |
| `NOSTROMA_GFX12_DEFAULTS` | on / off | NVIDIA and AMD | v0.1.42 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_GR_V3` | number | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_HC_Q8_ALL_STAGES` | on / off | NVIDIA and AMD | v0.2.12 | - |
| `NOSTROMA_HIP_QUEUE_PRIME` | on / off | NVIDIA and AMD | v0.2.1 | [AMD_HIP.md](AMD_HIP.md), [release-notes-0.2.1.md](release-notes-0.2.1.md), [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_IGPU_DEFAULTS` | on / off | NVIDIA and AMD | v0.2.1 | [AMD_HIP.md](AMD_HIP.md) |
| `NOSTROMA_IGPU_PROMPT_SET` | on / off | NVIDIA and AMD | v0.2.1 | [AMD_HIP.md](AMD_HIP.md), [RADEON_780M.md](RADEON_780M.md), [release-notes-0.2.1.md](release-notes-0.2.1.md) |
| `NOSTROMA_IL_PAD` | number | NVIDIA and AMD | v0.2.10 | - |
| `NOSTROMA_IQ_MT_MIN` | on / off | NVIDIA and AMD, CPU | v0.1.40.1 | [BATCHING.md](BATCHING.md), [DETAILS.md](DETAILS.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_KEEP_MAPPING` | on / off | NVIDIA and AMD | v0.1.41 | - |
| `NOSTROMA_KV_HOST_DMA` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| `NOSTROMA_MEM_CREDIT_INACTIVE` | text | NVIDIA and AMD | - | - |
| `NOSTROMA_METAL_LDB` | on / off | Mac | v0.2.10 | - |
| `NOSTROMA_METAL_MTP_OVERLAP` | on / off | Mac | v0.2.10 | - |
| `NOSTROMA_METAL_MTP_Q8` | on / off | Mac | v0.1.44 | [MAC.md](MAC.md) |
| `NOSTROMA_MMVQ_A2` | number | Intel Arc | v0.1.40.1 | [INTEL.md](INTEL.md) |
| `NOSTROMA_MMVQ_IL` | on / off | NVIDIA and AMD | v0.1.40.2 | [MMVQ_IL_TABLE.md](MMVQ_IL_TABLE.md), [NVIDIA_V100.md](NVIDIA_V100.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_MMVQ_IL_SM80` | text | NVIDIA and AMD | v0.2.7 | [DETAILS.md](DETAILS.md), [MMVQ_IL_TABLE.md](MMVQ_IL_TABLE.md), [release-notes-0.2.7.md](release-notes-0.2.7.md) |
| `NOSTROMA_MTP_BATCH_F16` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | - |
| `NOSTROMA_MTP_BATCH_RING` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | - |
| `NOSTROMA_NAN_GUARD` | number | NVIDIA and AMD | v0.1.43 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_NO_IQ512` | on / off | CPU | v0.1.40.1 | - |
| `NOSTROMA_NUMA_CARD` | text | NVIDIA and AMD | - | - |
| `NOSTROMA_NUMA_POOL` | on / off | NVIDIA and AMD, CPU | v0.2.2 | [DETAILS.md](DETAILS.md), [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_NUMA_SPLIT` | text | NVIDIA and AMD, CPU | v0.2.2 | [DETAILS.md](DETAILS.md), [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_NV_CHUNK` | on / off | NVIDIA | v0.2.11 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PF_FUSED_IQ2X` | text | AMD | - | - |
| `NOSTROMA_PF_FUSED_KQ` | text | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [DGX_SPARK_LINUX.md](DGX_SPARK_LINUX.md), [QUANTS.md](QUANTS.md), [STRIX_HALO.md](STRIX_HALO.md) |
| `NOSTROMA_PF_FUSED_Q50` | on / off | NVIDIA and AMD | v0.2.12 | - |
| `NOSTROMA_PF_FUSED_SM75_IQ` | on / off | NVIDIA and AMD | - | - |
| `NOSTROMA_PF_PLAIN_FLOOR` | text | NVIDIA and AMD | - | - |
| `NOSTROMA_PF_SHARE_OWN` | text | NVIDIA and AMD | - | - |
| `NOSTROMA_PF_SMALL_FUSED` | on / off | NVIDIA and AMD | - | - |
| `NOSTROMA_PF_STAGED_FO` | on / off | NVIDIA and AMD | - | [STRIX_HALO.md](STRIX_HALO.md) |
| `NOSTROMA_PF_W16_CACHE_MIB` | on / off | NVIDIA and AMD | v0.2.9 | - |
| `NOSTROMA_PF_XMX` | text | Intel Arc | v0.1.42 | [INTEL.md](INTEL.md), [release-notes-0.2.0.md](release-notes-0.2.0.md) |
| `NOSTROMA_PIPELINE_ADAPT_ASYNC` | number | NVIDIA and AMD | v0.1.40.2 | - |
| `NOSTROMA_PLE_AUTO_MMAP` | number | NVIDIA and AMD, Intel Arc | v0.1.43.1 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_PREFILL_LOAN_WALK` | on / off | NVIDIA and AMD | - | - |
| `NOSTROMA_PREFILL_STREAM_MIN` | number | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [AMD_HIP.md](AMD_HIP.md), [STRIX_HALO.md](STRIX_HALO.md) |
| `NOSTROMA_PREFILL_TAIL_LOAN` | on / off | NVIDIA and AMD | - | - |
| `NOSTROMA_PROMPT_ATTN_ESIMD` | number | Intel Arc | v0.2.9 | - |
| `NOSTROMA_PROMPT_ATTN_OLD` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [NVIDIA_V100.md](NVIDIA_V100.md), [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_Q2_WARP` | on / off | NVIDIA and AMD | v0.1.45 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_Q36_CHUNK` | number | NVIDIA and AMD | v0.1.45 | [QWEN36.md](QWEN36.md) |
| `NOSTROMA_QFUSE_HC_LOCAL` | text | NVIDIA and AMD | v0.1.43 | - |
| `NOSTROMA_QSA_EARLY_EXIT` | number | NVIDIA and AMD, Intel Arc | v0.1.40.1 | - |
| `NOSTROMA_QSA_FUSE_NR` | on / off | NVIDIA and AMD | v0.2.10 | - |
| `NOSTROMA_REMOTE_SPIN` | on / off | NVIDIA, AMD, Intel Arc | v0.1.40.1 | - |
| `NOSTROMA_RESIDENT_PIN` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [DETAILS.md](DETAILS.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md), [UNSLOTH_Q4.md](UNSLOTH_Q4.md) |
| `NOSTROMA_RING_BYTES` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_S2_SWIGLU_Q8` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | - |
| `NOSTROMA_SCORES_THREAD` | number | NVIDIA and AMD | v0.1.45 | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md) |
| `NOSTROMA_SELECT_OLD` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | - |
| `NOSTROMA_SM60_TABLE` | number | NVIDIA and AMD | v0.1.43 | [OLDER_GPUS.md](OLDER_GPUS.md) |
| `NOSTROMA_SPLIT_CHUNK16K` | number | NVIDIA and AMD | v0.1.44 | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_SPLIT_OWN` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [MULTI_GPU.md](MULTI_GPU.md) |
| `NOSTROMA_SWITCH_POINT` | on / off | NVIDIA and AMD | - | - |
| `NOSTROMA_SYCL_BF16_DET` | number | Intel Arc | v0.2.13 | - |
| `NOSTROMA_SYCL_IQ4_LOOKUP` | number | Intel Arc | - | - |
| `NOSTROMA_SYCL_IQ4_PAIR_REUSE` | on / off | Intel Arc | - | - |
| `NOSTROMA_SYCL_IQ4_Q8_SPLIT` | on / off | Intel Arc | - | - |
| `NOSTROMA_SYCL_Q2_WORD_EXPAND` | on / off | Intel Arc | - | - |
| `NOSTROMA_SYCL_QSA_CHUNK_DOWN` | on / off | Intel Arc | - | - |
| `NOSTROMA_SYCL_QSA_VALUE8_K8_VEC` | on / off | Intel Arc | - | - |
| `NOSTROMA_TOPK_SAMPLE` | number | NVIDIA and AMD | v0.1.45 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_TOPK_SPLIT` | number | NVIDIA and AMD | v0.1.45 | [DETAILS.md](DETAILS.md) |
| `NOSTROMA_TOPK_STREAM` | on / off | NVIDIA and AMD, Intel Arc | v0.1.40.1 | [AMD_HIP.md](AMD_HIP.md), [DETAILS.md](DETAILS.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| `NOSTROMA_TQ_STAGE` | on / off | NVIDIA and AMD | v0.2.2 | [GYRO.md](GYRO.md), [release-notes-0.2.2.md](release-notes-0.2.2.md) |
| `NOSTROMA_UMA_PIN_CAP` | on / off | AMD | - | [BATCHING.md](BATCHING.md) |
| `NOSTROMA_UMA_RESERVE_GIB` | on / off | NVIDIA and AMD | v0.2.2 | [release-notes-0.2.2.md](release-notes-0.2.2.md), [STRIX_HALO.md](STRIX_HALO.md) |
| `NOSTROMA_XN_F16` | on / off | NVIDIA and AMD | v0.1.45 | [DETAILS.md](DETAILS.md) |

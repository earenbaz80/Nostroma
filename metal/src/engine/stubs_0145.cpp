// metal/src/engine/stubs_0145.cpp - the kernel-library entry points the 0.1.45 sources added and Metal does not implement yet.
// Same job and shape as stubs.cpp (each stops the engine with its name, metal/src/engine/missing.cpp). Written from the linker's
// undefined-symbol report because tools/gen_stubs.py reads an older clang AST dump format than macOS 27's clang prints.
// A symbol that gets a Metal implementation is deleted from here. fused_gr_persist_init / fused_gr_read_persist / f16_range_read /
// gemm_f16_range_read are opt-in features of the HIP and Turing builds: off on Metal, so they answer "nothing to do" instead of stopping the engine.

#include "nostroma/kernels/bf16_bits.hpp"
#include "nostroma/kernels/bf16_gemv.hpp"
#include "nostroma/kernels/cvec.hpp"
#include "nostroma/kernels/dequant_bf16.hpp"
#include "nostroma/kernels/dequant_s2.hpp"
#include "nostroma/kernels/elementwise.hpp"
#include "nostroma/kernels/f16_bits.hpp"
#include "nostroma/kernels/fused_gdn.hpp"
#include "nostroma/kernels/fused_gr.hpp"
#include "nostroma/kernels/gdn.hpp"
#include "nostroma/kernels/gfx_arch.hpp"
#include "nostroma/kernels/gr.hpp"
#include "nostroma/kernels/iq_kernels.hpp"
#include "nostroma/kernels/kv_q4.hpp"
#include "nostroma/kernels/kv_q8.hpp"
#include "nostroma/kernels/kv_stream.hpp"
#include "nostroma/kernels/mrope.hpp"
#include "nostroma/kernels/native_flash_attn.hpp"
#include "nostroma/kernels/native_gdn.hpp"
#include "nostroma/kernels/native_gdn_preprocess.hpp"
#include "nostroma/kernels/native_gr_norm.hpp"
#include "nostroma/kernels/native_gr_postops.hpp"
#include "nostroma/kernels/native_mmvq.hpp"
#include "nostroma/kernels/native_moe.hpp"
#include "nostroma/kernels/native_ple_postops.hpp"
#include "nostroma/kernels/native_qsa.hpp"
#include "nostroma/kernels/native_qsa_indexer.hpp"
#include "nostroma/kernels/native_qsa_score.hpp"
#include "nostroma/kernels/native_rope.hpp"
#include "nostroma/kernels/native_router.hpp"
#include "nostroma/kernels/ngram.hpp"
#include "nostroma/kernels/pdl.hpp"
#include "nostroma/kernels/ple.hpp"
#include "nostroma/kernels/qsa.hpp"
#include "nostroma/kernels/qsa_decode_attn.hpp"
#include "nostroma/kernels/qsa_prompt_attn.hpp"
#include "nostroma/kernels/qsa_select.hpp"
#include "nostroma/kernels/quantize_act.hpp"
#include "nostroma/kernels/rope.hpp"
#include "nostroma/kernels/rope_scaling.hpp"
#include "nostroma/kernels/route_prior.hpp"
#include "nostroma/kernels/router_top10.hpp"
#include "nostroma/kernels/s2_expert_grouped.hpp"
#include "nostroma/kernels/s2_gemv.hpp"
#include "nostroma/kernels/s2_gemv_q8.hpp"
#include "nostroma/kernels/s_gemv.hpp"
#include "nostroma/kernels/sampler.hpp"
#include "nostroma/kernels/shared_expert.hpp"
#include "nostroma/kernels/verify_kernels.hpp"
#include "nostroma/kernels/cpu/expert.hpp"
#include "nostroma/kernels/cpu/expert_layout.hpp"
#include "nostroma/kernels/cpu/iq_avx1.hpp"
#include "nostroma/kernels/cpu/iq_avx2.hpp"
#include "nostroma/kernels/cpu/iq_avx512.hpp"
#include "nostroma/kernels/cpu/kq_avx1.hpp"
#include "nostroma/kernels/cpu/kq_avx2.hpp"
#include "nostroma/kernels/cpu/native_expert.hpp"
#include "nostroma/kernels/cpu/pool.hpp"
#include "nostroma/prefill/gemm.hpp"
#include "nostroma/prefill/kernels.hpp"
#include "nostroma/prefill/moe_fused.hpp"
#include "nostroma/prefill/moe_fused_iq.hpp"
#include "nostroma/prefill/moe_mmq.hpp"
#include "nostroma/prefill/prefill.hpp"
#include "nostroma/prefill/share_rules.hpp"
#include "nostroma/prefill/xmx_moe.hpp"
#include "nostroma/core/arch_defaults.hpp"
#include "nostroma/core/batch_rows.hpp"
#include "nostroma/core/conversation_buffer.hpp"
#include "nostroma/core/conversation_cache.hpp"
#include "nostroma/core/conversation_file.hpp"
#include "nostroma/core/conversation_memory.hpp"
#include "nostroma/core/conversation_snapshot.hpp"
#include "nostroma/core/coupled_draft.hpp"
#include "nostroma/core/device.hpp"
#include "nostroma/core/dma_batch.hpp"
#include "nostroma/core/emulate.hpp"
#include "nostroma/core/exchange_storage.hpp"
#include "nostroma/core/expert_cache.hpp"
#include "nostroma/core/expert_source.hpp"
#include "nostroma/core/foresight_swap.hpp"
#include "nostroma/core/graph.hpp"
#include "nostroma/core/hit_hook.hpp"
#include "nostroma/core/layer.hpp"
#include "nostroma/core/layout.hpp"
#include "nostroma/core/logit_bias.hpp"
#include "nostroma/core/mtp.hpp"
#include "nostroma/core/native_dense.hpp"
#include "nostroma/core/native_head.hpp"
#include "nostroma/core/on_device.hpp"
#include "nostroma/core/peer_experts.hpp"
#include "nostroma/core/pinned.hpp"
#include "nostroma/core/pinned_ring.hpp"
#include "nostroma/core/progress.hpp"
#include "nostroma/core/remote_expert_opt.hpp"
#include "nostroma/core/remote_experts.hpp"
#include "nostroma/core/session.hpp"
#include "nostroma/core/session_save_reclaim.hpp"
#include "nostroma/core/spec_prob.hpp"
#include "nostroma/core/verify.hpp"
#include "nostroma/core/vmm.hpp"
#include "nostroma/core/weights.hpp"
#include "nostroma/platform/aux_cpus.hpp"
#include "nostroma/platform/direct_file.hpp"
#include "nostroma/platform/host_limits.hpp"
#include "nostroma/platform/memory.hpp"
#include "nostroma/ngram/ple_reader.hpp"
#include "nostroma/spec/controller.hpp"
#include "nostroma/spec/draft_policy.hpp"
#include "nostroma/spec/draft_source.hpp"
#include "nostroma/spec/suffix_drafter.hpp"
#include <type_traits>

#include <type_traits>

namespace nostroma::metal_engine { void missing(const char* name); }

namespace nostroma::kernels { void copy_rows_from_mapped_after(unsigned int const* p0, unsigned int p1, float* p2, float const* p3, long long p4, long long p5, int const* p6, int const* p7, void* p8) { nostroma::metal_engine::missing("nostroma::kernels::copy_rows_from_mapped_after"); } }
namespace nostroma::kernels::cpu { void iq256_gu_rows_exact_one(int p0, unsigned char const* p1, unsigned long p2, unsigned long p3, int p4, void const* p5, float* p6, int p7, int p8) { nostroma::metal_engine::missing("nostroma::kernels::cpu::iq256_gu_rows_exact_one"); } }
namespace nostroma::kernels { void fused_gr_persist_init() {  } }
namespace nostroma::kernels { bool fused_gr_read_persist(nostroma::kernels::FusedGrArgs const* p0, int p1, void* p2) {  return false; } }
namespace nostroma::kernels { void gdn_step_norm_groups(nostroma::kernels::GdnGroups const& p0, float const* p1, int p2, float const* p3, float const* p4, float const* p5, float const* p6, float p7, float* p8, int p9, int p10, bool p11, void* p12) { nostroma::metal_engine::missing("nostroma::kernels::gdn_step_norm_groups"); } }
namespace nostroma::kernels { void handoff_publish(float* p0, float const* p1, long long p2, float const* p3, long long p4, float const* p5, long long p6, unsigned int* p7, unsigned int* p8, void* p9, unsigned int const* p10) { nostroma::metal_engine::missing("nostroma::kernels::handoff_publish"); } }
namespace nostroma::kernels { void hc_q8_to_bf16(void const* p0, float const* p1, unsigned short* p2, long long p3, void* p4) { nostroma::metal_engine::missing("nostroma::kernels::hc_q8_to_bf16"); } }
namespace nostroma::kernels { void native_quantize_q8_1_il(float const* p0, void* p1, void* p2, int p3, int p4, void* p5) { nostroma::metal_engine::missing("nostroma::kernels::native_quantize_q8_1_il"); } }
namespace nostroma::kernels { void qsa_block_scores_rows(nostroma::kernels::QsaScoreRows const& p0, float const* p1, int const* p2, long long p3, long long p4, nostroma::kernels::QsaShapes const& p5, float* p6, void* p7) { nostroma::metal_engine::missing("nostroma::kernels::qsa_block_scores_rows"); } }
namespace nostroma::kernels { void qsa_decode_attn_batch_rows(float const* p0, nostroma::kernels::QsaAttnPoolsRows const& p1, int const* p2, int const* p3, long long p4, nostroma::kernels::QsaShapes const& p5, float* p6, float* p7, long long p8, void* p9) { nostroma::metal_engine::missing("nostroma::kernels::qsa_decode_attn_batch_rows"); } }
namespace nostroma::kernels { bool qsa_decode_attn_split(float const* p0, nostroma::kernels::QsaAttnPools const& p1, int const* p2, int const* p3, long long p4, nostroma::kernels::QsaShapes const& p5, float* p6, unsigned long long p7, float* p8, long long p9, void* p10) { nostroma::metal_engine::missing("nostroma::kernels::qsa_decode_attn_split"); return {}; } }
namespace nostroma::kernels { void res_patch(int* p0, int const* p1, int p2, void* p3) { nostroma::metal_engine::missing("nostroma::kernels::res_patch"); } }
namespace nostroma::kernels { void wait_copy_i32_from_mapped(unsigned int const* p0, unsigned int p1, int* p2, int const* p3, long long p4, void* p5) { nostroma::metal_engine::missing("nostroma::kernels::wait_copy_i32_from_mapped"); } }
namespace nostroma::kernels { void wait_flag_ge_stamped(unsigned int const* p0, unsigned int p1, unsigned long long* p2, unsigned long long* p3, void* p4) { nostroma::metal_engine::missing("nostroma::kernels::wait_flag_ge_stamped"); } }
namespace nostroma::kernels { void wait_handoff(unsigned int const* p0, unsigned int p1, unsigned int* p2, unsigned long long p3, void* p4) { nostroma::metal_engine::missing("nostroma::kernels::wait_handoff"); } }
namespace nostroma::prefill { void moe_scatter_add(float const* p0, int const* p1, int const* p2, int const* p3, float const* p4, long long p5, float* p6, void* p7) { nostroma::metal_engine::missing("nostroma::prefill::moe_scatter_add"); } }
namespace nostroma::prefill { void moe_shared_init(float const* p0, float const* p1, float* p2, long long p3, void* p4) { nostroma::metal_engine::missing("nostroma::prefill::moe_shared_init"); } }
namespace nostroma::prefill { bool f16_range_read(float& p0, unsigned long long& p1, bool p2) {  return false; } }
namespace nostroma::prefill { bool gemm_f16_range_read(float* p0, unsigned long long* p1, bool p2) {  return false; } }
namespace nostroma::prefill { void gr_norm(float const* p0, float const* p1, float p2, float* p3, unsigned short* p4, long long p5, void* p6, unsigned short* p7, bool p8) { nostroma::metal_engine::missing("nostroma::prefill::gr_norm"); } }
namespace nostroma::prefill { void gr_norm_rs(float const* p0, float const* p1, float p2, float* p3, unsigned short* p4, long long p5, void* p6, unsigned short* p7, long long p8, bool p9) { nostroma::metal_engine::missing("nostroma::prefill::gr_norm_rs"); } }
namespace nostroma::prefill { void gr_write_cvec_norm_rs(float* p0, float const* p1, float const* p2, long long p3, float const* p4, float const* p5, int const* p6, int p7, float const* p8, float p9, float* p10, unsigned short* p11, long long p12, void* p13, unsigned short* p14, long long p15, bool p16) { nostroma::metal_engine::missing("nostroma::prefill::gr_write_cvec_norm_rs"); } }
namespace nostroma::prefill { void gr_write_norm_rs(float* p0, float const* p1, float const* p2, long long p3, float const* p4, float p5, float* p6, unsigned short* p7, long long p8, void* p9, unsigned short* p10, long long p11, bool p12) { nostroma::metal_engine::missing("nostroma::prefill::gr_write_norm_rs"); } }
// pf_wmma (NOSTROMA_PF_WMMA=1, Volta prompt experts) is CUDA only; the prefill code of 148/149 references it, so the Metal link needs the entry point. Off on Metal: "not launched".
namespace nostroma::kernels { bool gemm_iq_f16_grouped(int p0, void const* p1, unsigned long p2, int p3, int p4, void const* p5, int p6, int const* p7, int p8, int p9, float* p10, int p11, void* p12) { return false; } }
// NOSTROMA_Q8_SM60 (Pascal GP100, opt-in): a no-op on Metal; NativeHead::load()/unload() call these for a Q8_0 head, so they must exist and answer "nothing packed".
namespace nostroma::kernels { bool native_q8_0_sm60_pack(void const* p0, int p1, int p2, char const* p3) { return false; } }
namespace nostroma::kernels { void native_q8_0_sm60_release(void const* p0) { } }
// the MTP drafter's NOSTROMA_MTP_Q8_SM60 packing (mtp.cpp): nothing packed on Metal
namespace nostroma::kernels { bool native_q8_0_sm60_pack_quiet(void const* p0, int p1, int p2, char const* p3) { return false; } }
namespace nostroma::kernels { bool native_q8_0_sm60_pack_in_place(void* p0, int p1, int p2, char const* p3) { return false; } }
// NOSTROMA_SELECT_LONG (verify.cpp's long-context decode select): CUDA only; never reached on Metal (no scratch asked for)
namespace nostroma::kernels { long long qsa_topk_multi_scratch_ints(long long p0) { return 0; } }
namespace nostroma::kernels { void qsa_block_topk_long(float const* p0, int const* p1, long long p2, long long p3, long long p4, nostroma::kernels::QsaShapes const& p5, int* p6, void* p7, long long p8, int* p9) { nostroma::metal_engine::missing("nostroma::kernels::qsa_block_topk_long"); } }
namespace nostroma::kernels { void qsa_block_scores_long(float const* p0, float const* p1, float const* p2, int const* p3, long long p4, long long p5, nostroma::kernels::QsaShapes const& p6, float* p7, void* p8, long long p9) { nostroma::metal_engine::missing("nostroma::kernels::qsa_block_scores_long"); } }
// only reached with pf_wmma (off on Metal)
namespace nostroma::prefill { void swiglu_split_f16(float const* p0, unsigned short* p1, long long p2, int p3, bool p4, void* p5) { } }
// NOSTROMA_PLE_COMPACT (opt-in, CUDA / HIP prompt path): prefill.cpp references it; the Metal prompt runs through its window and never reaches it.
namespace nostroma::kernels { void ple_iq4nl_dequant(const uint8_t* p0, int64_t p1, float* p2, void* p3) { nostroma::metal_engine::missing("nostroma::kernels::ple_iq4nl_dequant"); } }
// NOSTROMA_DEQUANT_SIDE (opt-in, CUDA only): off on Metal; the prompt path takes no second scratch and set_dequant_side(nullptr) keeps the serial form.
namespace nostroma::prefill { bool gemm_dequant_side() { return false; } }
auto nostroma::prefill::Gemm::set_dequant_side(uint16_t* p0, std::string& p1) -> bool { if (p0 == nullptr) return true; nostroma::metal_engine::missing("nostroma::prefill::Gemm::set_dequant_side"); return false; }

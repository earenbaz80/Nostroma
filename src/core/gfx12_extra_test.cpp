// src/core/gfx12_extra_test.cpp - the gfx12 extra defaults (gfx12_extra.hpp) and their off switches (no GPU needed).
#include "nostroma/core/arch_defaults.hpp"
#include "nostroma/env.hpp"
#include "nostroma/core/gfx12_chunk.hpp"
#include "nostroma/core/gfx12_extra.hpp"

#include <cstdio>
#include <cstdlib>
#include <string>

static int fails = 0;
#define CHECK(c) do { if (!(c)) { std::printf("FAIL line %d: %s\n", __LINE__, #c); ++fails; } } while (0)
static void unset(const char* k) {
#if defined(_WIN32)
    _putenv_s(k, "");
#else
    unsetenv(k);
#endif
}
static void put(const char* k, const char* v) {
#if defined(_WIN32)
    _putenv_s(k, v);
#else
    setenv(k, v, 1);
#endif
}
static bool has(const std::vector<std::pair<std::string, std::string>>& t, const char* k, const char* v) {
    for (const auto& kv : t) if (kv.first == k && kv.second == v) return true;
    return false;
}

int main() {
    using namespace nostroma::core;
    unset("NOSTROMA_GFX12_DEFAULTS");
    unset("NOSTROMA_DEFAULTS");
    unset("NOSTROMA_HEAD_MIX_MULTI");
    // the exact extra: gfx12 only
    CHECK(has(gfx12_exact_extra_env("gfx1201"), "NOSTROMA_HEAD_MIX_MULTI", "1"));
    CHECK(has(gfx12_exact_extra_env("gfx1200:xnack-"), "NOSTROMA_HEAD_MIX_MULTI", "1"));
    for (const char* other : {"gfx1100", "gfx1151", "gfx1030", "gfx906", "gfx1010", "", "gfx12010"}) CHECK(gfx12_exact_extra_env(other).empty());
    CHECK(gfx12_exact_extra_env(nullptr).empty());
    // the off switches
    put("NOSTROMA_GFX12_DEFAULTS", "0");
    CHECK(gfx12_exact_extra_env("gfx1201").empty());
    unset("NOSTROMA_GFX12_DEFAULTS");
    CHECK(gfx12_exact_extra_env("gfx1201", true).empty());     // NOSTROMA_DEFAULTS=026
    CHECK(!gfx12_exact_extra_env("gfx1201", false).empty());
    // apply: sets it, keeps a value the user set, does nothing off gfx12 or with the switch off
    apply_arch_defaults("gfx1201", false);
    CHECK(nostroma::env("NOSTROMA_HEAD_MIX_MULTI") != nullptr && std::string(nostroma::env("NOSTROMA_HEAD_MIX_MULTI")) == "1");
    unset("NOSTROMA_HEAD_MIX_MULTI");
    put("NOSTROMA_HEAD_MIX_MULTI", "0");
    apply_arch_defaults("gfx1201", false);
    CHECK(std::string(nostroma::env("NOSTROMA_HEAD_MIX_MULTI")) == "0");
    unset("NOSTROMA_HEAD_MIX_MULTI");
    apply_arch_defaults("gfx1100", false);
    CHECK(nostroma::env("NOSTROMA_HEAD_MIX_MULTI") == nullptr);
    put("NOSTROMA_GFX12_DEFAULTS", "0");
    apply_arch_defaults("gfx1201", false);
    CHECK(nostroma::env("NOSTROMA_HEAD_MIX_MULTI") == nullptr);
    // the value-changing default (separate commit): gfx12 only, the same off switches, and the user's own setting wins
    unset("NOSTROMA_GFX12_DEFAULTS"); unset("NOSTROMA_SELECT_WMMA"); unset("NOSTROMA_SELECT_ALT_MIN_TOKENS");
    CHECK(has(gfx12_value_changing_env("gfx1201", false), "NOSTROMA_SELECT_WMMA", "1"));
    CHECK(has(gfx12_value_changing_env("gfx1201", false), "NOSTROMA_SELECT_ALT_MIN_TOKENS", "28672"));
    CHECK(gfx12_value_changing_env("gfx1201", true).empty());
    for (const char* other : {"gfx1100", "gfx1151", "gfx1030", "gfx906", "", "gfx12010"}) CHECK(gfx12_value_changing_env(other, false).empty());
    apply_arch_defaults("gfx1201", false);
    CHECK(nostroma::env("NOSTROMA_SELECT_WMMA") != nullptr && std::string(nostroma::env("NOSTROMA_SELECT_WMMA")) == "1");
    CHECK(nostroma::env("NOSTROMA_SELECT_ALT_MIN_TOKENS") != nullptr && std::string(nostroma::env("NOSTROMA_SELECT_ALT_MIN_TOKENS")) == "28672");
    unset("NOSTROMA_SELECT_WMMA"); unset("NOSTROMA_SELECT_ALT_MIN_TOKENS");
    put("NOSTROMA_SELECT_WMMA", "0");   // the off switch
    apply_arch_defaults("gfx1201", false);
    CHECK(std::string(nostroma::env("NOSTROMA_SELECT_WMMA")) == "0");
    unset("NOSTROMA_SELECT_WMMA"); unset("NOSTROMA_SELECT_ALT_MIN_TOKENS");
    apply_arch_defaults("gfx1100", false);
    CHECK(nostroma::env("NOSTROMA_SELECT_WMMA") == nullptr);
    // NOSTROMA_MMQ_KQ (the K-quant experts' prompt products on MMQ): Linux gfx12 only, the same off switches, the user's own value wins
    unset("NOSTROMA_GFX12_DEFAULTS"); unset("NOSTROMA_DEFAULTS"); unset("NOSTROMA_MMQ_KQ");
#if defined(_WIN32)
    CHECK(!has(gfx12_value_changing_env("gfx1201", false), "NOSTROMA_MMQ_KQ", "1"));
#else
    CHECK(has(gfx12_value_changing_env("gfx1201", false), "NOSTROMA_MMQ_KQ", "1"));
    CHECK(has(gfx12_value_changing_env("gfx1200:xnack-", false), "NOSTROMA_MMQ_KQ", "1"));
    for (const char* other : {"gfx1100", "gfx1151", "gfx1030", "gfx906", "", "gfx12010"}) CHECK(!has(gfx12_value_changing_env(other, false), "NOSTROMA_MMQ_KQ", "1"));
    CHECK(!has(gfx12_value_changing_env("gfx1201", true), "NOSTROMA_MMQ_KQ", "1"));     // NOSTROMA_DEFAULTS=026
    apply_arch_defaults("gfx1201", false);
    CHECK(nostroma::env("NOSTROMA_MMQ_KQ") != nullptr && std::string(nostroma::env("NOSTROMA_MMQ_KQ")) == "1");
    unset("NOSTROMA_MMQ_KQ"); unset("NOSTROMA_SELECT_WMMA"); unset("NOSTROMA_SELECT_ALT_MIN_TOKENS");
    put("NOSTROMA_MMQ_KQ", "0");                                                           // the off switch
    apply_arch_defaults("gfx1201", false);
    CHECK(std::string(nostroma::env("NOSTROMA_MMQ_KQ")) == "0");
    unset("NOSTROMA_MMQ_KQ"); unset("NOSTROMA_SELECT_WMMA"); unset("NOSTROMA_SELECT_ALT_MIN_TOKENS");
    apply_arch_defaults("gfx1100", false);
    CHECK(nostroma::env("NOSTROMA_MMQ_KQ") == nullptr);
    put("NOSTROMA_GFX12_DEFAULTS", "0");
    apply_arch_defaults("gfx1201", false);
    CHECK(nostroma::env("NOSTROMA_MMQ_KQ") == nullptr);
    unset("NOSTROMA_GFX12_DEFAULTS");
#endif
    unset("NOSTROMA_SELECT_WMMA"); unset("NOSTROMA_SELECT_ALT_MIN_TOKENS");
    put("NOSTROMA_GFX12_DEFAULTS", "0");
    apply_arch_defaults("gfx1201", false);
    CHECK(nostroma::env("NOSTROMA_SELECT_WMMA") == nullptr && nostroma::env("NOSTROMA_SELECT_ALT_MIN_TOKENS") == nullptr);
    // the gfx12 prompt-chunk ceiling of a bare --prefill auto (gfx12_chunk.hpp): 32768 by default, 16384 with NOSTROMA_GFX12_CHUNK=16, none with =0,
    // and the RAM guard steps 32768 -> 16384 -> 8192
    CHECK(gfx12_chunk_ceiling(nullptr) == 32768);
    CHECK(gfx12_chunk_ceiling("1") == 32768);
    CHECK(gfx12_chunk_ceiling("16") == 16384);
    CHECK(gfx12_chunk_ceiling("0") == 0);
    CHECK(gfx12_chunk_step_down(32768) == 16384);
    CHECK(gfx12_chunk_step_down(16384) == 8192);
    CHECK(gfx12_chunk_step_down(12288) == 8192);
    if (fails == 0) std::printf("gfx12_extra_test: OK\n");
    return fails == 0 ? 0 : 1;
}

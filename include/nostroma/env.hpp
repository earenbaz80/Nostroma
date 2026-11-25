// include/nostroma/env.hpp - the name a setting is read by.
//
// The product is Nostroma, so a setting is written NOSTROMA_<SETTING>. Every name used to be NOSTROMA_<SETTING>, and a
// launch script, a preset, an installer or a benchmark command made before the rename still sets that one, so the old
// name is read here as the fallback instead of in every call site. The new name wins when both are set, which is the
// order the Terminal and the app already use (nostroma_control/envnames.py and apps/host/server/env-compat.mjs).
//
// Compile-time switches (NOSTROMA_METAL, NOSTROMA_USE_HIP, NOSTROMA_QUANT_X86, ...) are not settings and are not read here:
// the build defines them, so they have no runtime fallback and keep their names.
#pragma once

#include <cstddef>
#include <cstdlib>
#include <cstring>

namespace nostroma {

/// The value of `name` (a `NOSTROMA_<SETTING>` name), or the same setting under its old `NOSTROMA_<SETTING>` name.
/// Returns the environment's own storage, or nullptr when neither is set. The new name wins.
inline const char* env(const char* name) noexcept {
    if (name == nullptr) return nullptr;
    if (const char* value = std::getenv(name)) return value;

    constexpr const char* kNew = "NOSTROMA_";
    constexpr std::size_t kNewLength = 9;
    constexpr const char* kOld = "NOSTROMA_";
    constexpr std::size_t kOldLength = 7;

    if (std::strncmp(name, kNew, kNewLength) != 0) return nullptr;   // not a setting this header renames

    thread_local char legacy[kOldLength + 160];
    const std::size_t rest = std::strlen(name + kNewLength);
    if (kOldLength + rest >= sizeof legacy) return nullptr;           // a name this long is not one of ours
    std::memcpy(legacy, kOld, kOldLength);
    std::memcpy(legacy + kOldLength, name + kNewLength, rest + 1);
    return std::getenv(legacy);
}

}  // namespace nostroma

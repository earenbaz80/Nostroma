// include/nostroma/env.hpp - the name a setting is read by.
//
// The product is Nostroma, so every runtime setting is written NOSTROMA_<SETTING>. There is one name and no fallback: a
// setting that is not present under that name is unset. Compile-time switches (NOSTROMA_METAL, NOSTROMA_USE_HIP,
// NOSTROMA_QUANT_X86, ...) are not settings and are not read here: the build defines them.
#pragma once

#include <cstdlib>

namespace nostroma {

/// The value of `name`, always a `NOSTROMA_<SETTING>` name, or nullptr when it is not set.
inline const char* env(const char* name) noexcept {
    return name == nullptr ? nullptr : std::getenv(name);
}

}  // namespace nostroma

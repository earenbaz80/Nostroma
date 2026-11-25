// src/image/noise/qi21_noise.cpp - see include/nostroma/image/qi21_noise.hpp.
#include "nostroma/image/qi21_noise.hpp"

#include "nostroma_noise.hpp"   // tools/image/sdcpp_noise (one source for sd-cli's patch and for this)

namespace nostroma::image {

std::vector<float> qi21_noise(uint64_t seed, uint32_t n) { return nostroma_noise::randn(seed, n, 0); }

}  // namespace nostroma::image

// src/quant/generic.hpp - the Generic-contract dot products (dot_generic.cpp), which the x86 tiers call where ggml's own x86 code falls back to its
// generic C (a type with no SIMD branch for the flavour).  Weight row, activation row, n elements.
#pragma once

#include "internal.hpp"   // NOSTROMA_RESTRICT

namespace nostroma::quant::generic {

#define NOSTROMA_GENERIC_DOT(name) void dot_##name##_generic(int n, float* NOSTROMA_RESTRICT s, const void* NOSTROMA_RESTRICT vx, const void* NOSTROMA_RESTRICT vy)
NOSTROMA_GENERIC_DOT(q2_0_q8_0);
NOSTROMA_GENERIC_DOT(q4_0_q8_0);
NOSTROMA_GENERIC_DOT(q4_1_q8_1);
NOSTROMA_GENERIC_DOT(q5_0_q8_0);
NOSTROMA_GENERIC_DOT(q5_1_q8_1);
NOSTROMA_GENERIC_DOT(q8_0_q8_0);
NOSTROMA_GENERIC_DOT(iq4_nl_q8_0);
NOSTROMA_GENERIC_DOT(mxfp4_q8_0);
NOSTROMA_GENERIC_DOT(nvfp4_q8_0);
NOSTROMA_GENERIC_DOT(q2_K_q8_K);
NOSTROMA_GENERIC_DOT(q3_K_q8_K);
NOSTROMA_GENERIC_DOT(q4_K_q8_K);
NOSTROMA_GENERIC_DOT(q5_K_q8_K);
NOSTROMA_GENERIC_DOT(q6_K_q8_K);
NOSTROMA_GENERIC_DOT(iq1_s_q8_K);
NOSTROMA_GENERIC_DOT(iq1_m_q8_K);
NOSTROMA_GENERIC_DOT(iq2_xxs_q8_K);
NOSTROMA_GENERIC_DOT(iq2_xs_q8_K);
NOSTROMA_GENERIC_DOT(iq2_s_q8_K);
NOSTROMA_GENERIC_DOT(iq3_xxs_q8_K);
NOSTROMA_GENERIC_DOT(iq3_s_q8_K);
NOSTROMA_GENERIC_DOT(iq4_xs_q8_K);
#undef NOSTROMA_GENERIC_DOT

}  // namespace nostroma::quant::generic

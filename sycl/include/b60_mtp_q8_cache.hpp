#pragma once
#include <cstdint>
#include "strata/env.hpp"
#include <cstdlib>
namespace strata::kernels {
inline bool b60_mtp_q8_cache_requested(){
 const char* a=strata::env("NOSTROMA_PRIVATE_B60_NEXT_POOL");
 const char* b=strata::env("NOSTROMA_PRIVATE_MTP_Q8_SOA");
 return a&&a[0]=='1'&&b&&b[0]=='1';
}
void b60_make_mtp_q8_cache(const void*,int rows,int cols,unsigned token_mask,int device,void* stream);
const void* b60_cached_mtp_q8_weight(const void*,int rows,int cols,int tokens,int device);
bool b60_has_mtp_q8_cache(const void*);
void b60_release_mtp_q8_cache(const void*,int device,void* stream);
}

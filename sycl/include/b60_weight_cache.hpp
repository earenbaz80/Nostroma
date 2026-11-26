#pragma once
#include <cstdlib>
#include "nostroma/env.hpp"
namespace nostroma::kernels {
inline constexpr int kB60WeightCacheGuard=128;
inline bool b60_cache_requested(int kind){
 const char* name=kind==21?"NOSTROMA_PRIVATE_IQ3_S4":kind==23?"NOSTROMA_PRIVATE_IQ4_SSM_SOA":kind==24?"NOSTROMA_PRIVATE_IQ4_HEAD_SOA":kind==30?"NOSTROMA_PRIVATE_GR_SOA_CACHE":nullptr;
 if(!name)return false;const char* p=nostroma::env(name);return p&&p[0]=='1';
}
const void* b60_cached_weight(const void* original,int kind);
void b60_make_weight_cache(const void* original,int rows,int cols,int kind,int device,void* stream);
void b60_release_weight_cache(const void* original,int kind,int device,void* stream);
}

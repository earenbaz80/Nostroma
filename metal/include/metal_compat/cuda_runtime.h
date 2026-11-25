// The CUDA function-space qualifiers and the few launch/kernel spellings the shared sources use.  On Metal they say
#include "cuda_launch.h"
// nothing: a "kernel" here is an MSL function compiled at run time and dispatched by the host runtime, so the qualifiers
// are empty and __forceinline__ is plain inline.  Part of the metal_compat layer (M5 Max, 2026-10-23).
#ifndef __host__
#define __host__
#endif
#ifndef __device__
#define __device__
#endif
#ifndef __global__
#define __global__
#endif
#ifndef __shared__
#define __shared__
#endif
#ifndef __constant__
#define __constant__
#endif
#ifndef __forceinline__
#define __forceinline__ inline
#endif
#ifndef __launch_bounds__
#define __launch_bounds__(...)
#endif
#ifndef __restrict__
#define __restrict__
#endif

// metal/include/metal_compat/cuda_runtime.h - the CUDA runtime names the host files use, on Metal.
//
// The HIP build's approach (include/nostroma/hip_compat/cuda_runtime.h maps every cudaX the host code calls to hipX),
// applied to Metal: this directory goes first on the Metal build's include path, so the shared host files compile for
// Metal UNCHANGED, and the CUDA / HIP builds never see this file (their objects stay byte-identical by construction).
// Every name forwards to nostroma::gpu's Metal implementation (metal/src/gpu/runtime.cpp), whose semantics are the
// CUDA ones.  Only the names in the Phase 1 inventory (phaseA-tests/mac-design.md §1.3) are provided; a host file that
// uses another one fails to compile on Metal, which is the point.
#pragma once

// CUDA's alignment qualifier
#ifndef __align__
#define __align__(n) alignas(n)
#endif

#include "cuda_device_builtins.h"

#include <cmath>

using std::fmaxf;
using std::fminf;
using std::sqrtf;
using std::fabsf;
using std::powf;
using std::expf;
using std::logf;

// CUDA's headers put min/max in scope for integers; the sources rely on it
template <typename T> static inline T min(T a, T b) { return nostroma_min(a, b); }
template <typename T> static inline T max(T a, T b) { return nostroma_max(a, b); }

#include <cstddef>
#include <cstdint>

#include <immintrin.h>               // metal_compat/immintrin.h: CUDA's headers bring the x86 one in on a PC
#include "nostroma/gpu/runtime.hpp"    // metal/include/nostroma/gpu: the Metal runtime

namespace nostroma::gpu::compat_detail { inline Error bad() { return kErrorUnsupported; } }

// ---- types and constants
using cudaError_t = nostroma::gpu::Error;
using cudaStream_t = nostroma::gpu::Stream;
using cudaEvent_t = nostroma::gpu::Event;
using cudaGraph_t = nostroma::gpu::Graph;
using cudaGraphExec_t = nostroma::gpu::GraphExec;
using cudaGraphNode_t = void*;
using cudaDeviceProp = nostroma::gpu::DeviceProp;
using cudaMemcpyKind = nostroma::gpu::CopyKind;
using cudaHostFn_t = nostroma::gpu::HostFn;
inline constexpr cudaError_t cudaSuccess = nostroma::gpu::kSuccess;
inline constexpr cudaError_t cudaErrorNotReady = nostroma::gpu::kNotReady;
inline constexpr cudaError_t cudaErrorMemoryAllocation = nostroma::gpu::kErrorMemoryAllocation;
inline constexpr cudaError_t cudaErrorPeerAccessAlreadyEnabled = nostroma::gpu::kErrorPeerAccessAlreadyEnabled;
inline constexpr cudaError_t cudaErrorStreamCaptureUnsupported = nostroma::gpu::kErrorUnsupported;
inline constexpr cudaMemcpyKind cudaMemcpyHostToDevice = nostroma::gpu::kHostToDevice;
inline constexpr cudaMemcpyKind cudaMemcpyDeviceToHost = nostroma::gpu::kDeviceToHost;
inline constexpr cudaMemcpyKind cudaMemcpyDeviceToDevice = nostroma::gpu::kDeviceToDevice;
inline constexpr cudaMemcpyKind cudaMemcpyDefault = nostroma::gpu::kCopyDefault;
inline constexpr unsigned cudaHostAllocDefault = nostroma::gpu::kHostAllocDefault;
inline constexpr unsigned cudaHostAllocPortable = nostroma::gpu::kHostAllocPortable;
inline constexpr unsigned cudaHostAllocMapped = nostroma::gpu::kHostAllocMapped;
inline constexpr unsigned cudaHostRegisterPortable = nostroma::gpu::kHostRegisterPortable;
inline constexpr unsigned cudaHostRegisterMapped = nostroma::gpu::kHostRegisterMapped;
inline constexpr unsigned cudaHostRegisterReadOnly = nostroma::gpu::kHostRegisterReadOnly;
inline constexpr unsigned cudaEventDefault = nostroma::gpu::kEventDefault;
inline constexpr unsigned cudaEventDisableTiming = nostroma::gpu::kEventDisableTiming;
inline constexpr unsigned cudaEventBlockingSync = nostroma::gpu::kEventBlockingSync;
inline constexpr unsigned cudaStreamNonBlocking = nostroma::gpu::kStreamNonBlocking;
enum cudaStreamCaptureStatus { cudaStreamCaptureStatusNone = 0, cudaStreamCaptureStatusActive = 1, cudaStreamCaptureStatusInvalidated = 2 };
static inline nostroma::gpu::Error cudaStreamIsCapturing(nostroma::gpu::Stream, cudaStreamCaptureStatus* st) {
    if (st) *st = cudaStreamCaptureStatusNone;
    return nostroma::gpu::kSuccess;
}

enum cudaStreamCaptureMode { cudaStreamCaptureModeGlobal = 0, cudaStreamCaptureModeThreadLocal = 1, cudaStreamCaptureModeRelaxed = 2 };
// (the compute capability is asked by the 0.1.45 Turing defaults in verify.cpp: no answer here, which reads as "not a Turing card")
enum cudaDeviceAttr {
    cudaDevAttrClockRate = 13, cudaDevAttrMultiProcessorCount = 16, cudaDevAttrIntegrated = 18,
    cudaDevAttrComputeCapabilityMajor = 75, cudaDevAttrComputeCapabilityMinor = 76
};

// ---- errors, devices
inline cudaError_t cudaGetLastError() { return nostroma::gpu::get_last_error(); }
inline cudaError_t cudaPeekAtLastError() { return nostroma::gpu::peek_last_error(); }
inline const char* cudaGetErrorString(cudaError_t e) { return nostroma::gpu::error_string(e); }
inline cudaError_t cudaGetDevice(int* d) { return nostroma::gpu::get_device(d); }
inline cudaError_t cudaSetDevice(int d) { return nostroma::gpu::set_device(d); }
inline cudaError_t cudaGetDeviceCount(int* n) { return nostroma::gpu::device_count(n); }
inline cudaError_t cudaDeviceSynchronize() { return nostroma::gpu::device_synchronize(); }
inline cudaError_t cudaMemGetInfo(size_t* f, size_t* t) { return nostroma::gpu::mem_get_info(f, t); }
inline cudaError_t cudaGetDeviceProperties(cudaDeviceProp* p, int d) { return nostroma::gpu::get_device_properties(p, d); }
inline cudaError_t cudaRuntimeGetVersion(int* v) { return nostroma::gpu::runtime_version(v); }
inline cudaError_t cudaDriverGetVersion(int* v) { return nostroma::gpu::runtime_version(v); }
inline cudaError_t cudaDeviceGetAttribute(int* v, cudaDeviceAttr a, int d) {
    switch (a) {
        case cudaDevAttrIntegrated: return nostroma::gpu::device_integrated(v, d);
        case cudaDevAttrMultiProcessorCount: return nostroma::gpu::device_sm_count(v, d);
        case cudaDevAttrClockRate: return nostroma::gpu::device_clock_khz(v, d);
        case cudaDevAttrComputeCapabilityMajor:
        case cudaDevAttrComputeCapabilityMinor: return nostroma::gpu::compat_detail::bad();
    }
    return nostroma::gpu::compat_detail::bad();
}
inline cudaError_t cudaDeviceCanAccessPeer(int* v, int d, int p) { return nostroma::gpu::device_can_access_peer(v, d, p); }
inline cudaError_t cudaDeviceEnablePeerAccess(int p, unsigned f) { return nostroma::gpu::device_enable_peer_access(p, f); }
inline cudaError_t cudaDeviceDisablePeerAccess(int) { return cudaSuccess; }   // a Mac has one GPU: nothing to disable

// ---- memory and copies
template <class T> inline cudaError_t cudaMalloc(T** p, size_t n) { return nostroma::gpu::malloc_device(p, n); }
inline cudaError_t cudaFree(void* p) { return nostroma::gpu::free_device(p); }
template <class T> inline cudaError_t cudaHostAlloc(T** p, size_t n, unsigned f) { return nostroma::gpu::host_alloc(p, n, f); }
template <class T> inline cudaError_t cudaMallocHost(T** p, size_t n) { return nostroma::gpu::malloc_host(p, n); }
inline cudaError_t cudaFreeHost(void* p) { return nostroma::gpu::free_host(p); }
template <class T> inline cudaError_t cudaHostGetDevicePointer(T** d, void* h, unsigned f) { return nostroma::gpu::host_device_pointer(d, h, f); }
inline cudaError_t cudaHostRegister(void* p, size_t n, unsigned f) { return nostroma::gpu::host_register(p, n, f); }
inline cudaError_t cudaHostUnregister(void* p) { return nostroma::gpu::host_unregister(p); }
inline cudaError_t cudaMemset(void* p, int v, size_t n) { return nostroma::gpu::memset_device(p, v, n); }
inline cudaError_t cudaMemsetAsync(void* p, int v, size_t n, cudaStream_t s = nullptr) { return nostroma::gpu::memset_async(p, v, n, s); }
inline cudaError_t cudaMemcpy(void* d, const void* s, size_t n, cudaMemcpyKind k) { return nostroma::gpu::memcpy_sync(d, s, n, k); }
inline cudaError_t cudaMemcpyAsync(void* d, const void* s, size_t n, cudaMemcpyKind k, cudaStream_t st = nullptr) {
    return nostroma::gpu::memcpy_async(d, s, n, k, st);
}
inline cudaError_t cudaMemcpy2DAsync(void* d, size_t dp, const void* s, size_t sp, size_t w, size_t h, cudaMemcpyKind k,
                                     cudaStream_t st = nullptr) {
    return nostroma::gpu::memcpy_2d_async(d, dp, s, sp, w, h, k, st);
}
inline cudaError_t cudaMemcpyPeerAsync(void* d, int dd, const void* s, int sd, size_t n, cudaStream_t st = nullptr) {
    return nostroma::gpu::memcpy_peer_async(d, dd, s, sd, n, st);
}
inline cudaError_t cudaMemcpyPeer(void* d, int dd, const void* s, int sd, size_t n) {
    const cudaError_t e = cudaMemcpyPeerAsync(d, dd, s, sd, n, nullptr);
    return e != cudaSuccess ? e : cudaDeviceSynchronize();
}

// ---- streams, events, host functions
inline cudaError_t cudaStreamCreate(cudaStream_t* s) { return nostroma::gpu::stream_create(s); }
inline cudaError_t cudaStreamCreateWithFlags(cudaStream_t* s, unsigned f) { return nostroma::gpu::stream_create(s, f); }
inline cudaError_t cudaDeviceGetStreamPriorityRange(int*, int*) { return nostroma::gpu::compat_detail::bad(); }   // no priorities: callers fall back to a plain stream
inline cudaError_t cudaStreamCreateWithPriority(cudaStream_t* s, unsigned f, int) { return nostroma::gpu::stream_create(s, f); }
inline cudaError_t cudaStreamDestroy(cudaStream_t s) { return nostroma::gpu::stream_destroy(s); }
inline cudaError_t cudaStreamSynchronize(cudaStream_t s) { return nostroma::gpu::stream_synchronize(s); }
inline cudaError_t cudaStreamQuery(cudaStream_t s) { return nostroma::gpu::stream_query(s); }
inline cudaError_t cudaStreamWaitEvent(cudaStream_t s, cudaEvent_t e, unsigned f = 0) { return nostroma::gpu::stream_wait_event(s, e, f); }
inline cudaError_t cudaLaunchHostFunc(cudaStream_t s, cudaHostFn_t fn, void* a) { return nostroma::gpu::launch_host_func(s, fn, a); }
inline cudaError_t cudaEventCreate(cudaEvent_t* e) { return nostroma::gpu::event_create(e); }
inline cudaError_t cudaEventCreateWithFlags(cudaEvent_t* e, unsigned f) { return nostroma::gpu::event_create(e, f); }
inline cudaError_t cudaEventDestroy(cudaEvent_t e) { return nostroma::gpu::event_destroy(e); }
inline cudaError_t cudaEventRecord(cudaEvent_t e, cudaStream_t s = nullptr) { return nostroma::gpu::event_record(e, s); }
inline cudaError_t cudaEventQuery(cudaEvent_t e) { return nostroma::gpu::event_query(e); }
inline cudaError_t cudaEventSynchronize(cudaEvent_t e) { return nostroma::gpu::event_synchronize(e); }
inline cudaError_t cudaEventElapsedTime(float* ms, cudaEvent_t a, cudaEvent_t b) { return nostroma::gpu::event_elapsed_ms(ms, a, b); }

// ---- graphs
inline cudaError_t cudaStreamBeginCapture(cudaStream_t s, cudaStreamCaptureMode m) {
    return m == cudaStreamCaptureModeThreadLocal ? nostroma::gpu::begin_capture(s) : nostroma::gpu::compat_detail::bad();
}
inline cudaError_t cudaStreamEndCapture(cudaStream_t s, cudaGraph_t* g) { return nostroma::gpu::end_capture(s, g); }
inline cudaError_t cudaGraphGetNodes(cudaGraph_t g, cudaGraphNode_t* nodes, size_t* n) {
    return nodes == nullptr ? nostroma::gpu::graph_node_count(g, n) : nostroma::gpu::compat_detail::bad();
}
inline cudaError_t cudaGraphInstantiate(cudaGraphExec_t* x, cudaGraph_t g, cudaGraphNode_t*, char*, size_t) {
    return nostroma::gpu::graph_instantiate(x, g);
}
inline cudaError_t cudaGraphInstantiate(cudaGraphExec_t* x, cudaGraph_t g, unsigned long long f = 0) {
    return nostroma::gpu::graph_instantiate(x, g, f);
}
inline cudaError_t cudaGraphLaunch(cudaGraphExec_t x, cudaStream_t s) { return nostroma::gpu::graph_launch(x, s); }
inline cudaError_t cudaGraphUpload(cudaGraphExec_t x, cudaStream_t s) { return nostroma::gpu::graph_upload(x, s); }
inline cudaError_t cudaGraphDestroy(cudaGraph_t g) { return nostroma::gpu::graph_destroy(g); }
inline cudaError_t cudaGraphExecDestroy(cudaGraphExec_t x) { return nostroma::gpu::graph_exec_destroy(x); }

// cudaMemcpy2D(dst, dpitch, src, spitch, width, height, kind): a strided copy, used by the vision tower's patch rows and
// the Engram tables' column slices.  The Metal runtime has no pitched copy yet, so this reports failure rather than
// copying nothing silently.
inline nostroma::gpu::Error cudaMemcpy2D(void*, size_t, const void*, size_t, size_t, size_t, nostroma::gpu::CopyKind) {
    return nostroma::gpu::kErrorUnsupported;   // cudaMemcpy2D_unimplemented_marker
}

// occupancy query: the Metal runtime decides its own threadgroup limits, so answer "one block" and let the caller size grids
template <typename K, typename... A>
static inline nostroma::gpu::Error cudaOccupancyMaxActiveBlocksPerMultiprocessor(int* n, K&&, int, A&&...) {
    if (n) *n = 1;
    return nostroma::gpu::kSuccess;
}

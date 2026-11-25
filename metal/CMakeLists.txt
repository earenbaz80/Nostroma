# metal/ - Nostroma on Apple Silicon (Metal), MAC-PLAN.md.  Its own CMake project like sycl/, macOS only, never part of
# the CUDA / HIP / SYCL builds.
#
# Two parts:
#   * the kernel tree (mac-kern): the runtime face src/mtl_rt.*, the MSL kernels kernels/*.metal (compiled at run time),
#     CPU references src/ref_*.cpp and the parity / bench programs tests/*.cpp;
#   * the engine (mac-design): the shared host sources from ../src, UNCHANGED - include/metal_compat goes first on the
#     include path and gives them the CUDA runtime names on Metal, as include/nostroma/hip_compat does on HIP - over
#     the Metal device runtime src/gpu/runtime.cpp (metal-cpp) and the kernel library src/engine/*.
#
#   cmake -S metal -B build-metal -G Ninja -DCMAKE_BUILD_TYPE=Release -DMETAL_CPP_DIR=... [-DNOSTROMA_GGML_DIR=...]
#   ninja -C build-metal
cmake_minimum_required(VERSION 3.24)
project(nostroma_metal LANGUAGES C CXX OBJCXX)
include(${CMAKE_CURRENT_SOURCE_DIR}/../cmake/nostroma_geometry.cmake)   # -DNOSTROMA_GEOMETRY=<name> (default flash_next, no flag added)

if(NOT APPLE)
  message(FATAL_ERROR "metal/ builds on macOS only")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OBJCXX_STANDARD 20)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()
set(CMAKE_CXX_FLAGS_RELEASE "-O2")
set(CMAKE_OBJCXX_FLAGS_RELEASE "-O2")

get_filename_component(NOSTROMA_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/.." ABSOLUTE)
set(GGML_COMMON "${NOSTROMA_ROOT}/third_party/nostroma-ggml/nostroma-quant-common.h")   # the quant header's text (third_party/ggml/ggml-common.h forwards to it)

# ---- the kernel tree (mac-kern) ------------------------------------------------------------------------------------
add_library(mtl_rt STATIC src/mtl_rt.mm src/ref_quant.cpp src/gguf_lite.cpp)
target_include_directories(mtl_rt PUBLIC src ${NOSTROMA_ROOT}/third_party/ggml ${NOSTROMA_ROOT}/include)
target_compile_options(mtl_rt PRIVATE $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>)
target_compile_definitions(mtl_rt PRIVATE
  NOSTROMA_GGML_COMMON_DEFAULT="${GGML_COMMON}"
  NOSTROMA_METAL_KERNELS_DEFAULT="${CMAKE_CURRENT_SOURCE_DIR}/kernels")
target_link_libraries(mtl_rt PUBLIC "-framework Metal" "-framework Foundation")

file(GLOB NOSTROMA_METAL_TESTS CONFIGURE_DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/tests/*.cpp)
list(REMOVE_ITEM NOSTROMA_METAL_TESTS ${CMAKE_CURRENT_SOURCE_DIR}/tests/runtime_hello.cpp)
foreach(src ${NOSTROMA_METAL_TESTS})
  get_filename_component(t ${src} NAME_WE)
  add_executable(${t} ${src})
  target_link_libraries(${t} PRIVATE mtl_rt)
endforeach()

# ---- the device runtime and the engine (mac-design) ---------------------------------------------------------------
set(METAL_CPP_DIR "" CACHE PATH "metal-cpp headers (https://developer.apple.com/metal/cpp/), e.g. metal-cpp_26")
if(NOT EXISTS "${METAL_CPP_DIR}/Metal/Metal.hpp")
  message(STATUS "nostroma metal: METAL_CPP_DIR is not set: the device runtime and the engine are not built")
  return()
endif()

add_library(nostroma_gpu_metal STATIC src/gpu/runtime.cpp)
target_include_directories(nostroma_gpu_metal BEFORE PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include/metal_compat
                           ${CMAKE_CURRENT_SOURCE_DIR}/include ${NOSTROMA_ROOT}/include)
target_include_directories(nostroma_gpu_metal SYSTEM PUBLIC ${METAL_CPP_DIR})
target_compile_definitions(nostroma_gpu_metal PUBLIC NOSTROMA_GPU_METAL=1)
target_link_libraries(nostroma_gpu_metal PUBLIC "-framework Metal" "-framework Foundation" "-framework QuartzCore")

add_library(nostroma_core_metal STATIC ${NOSTROMA_ROOT}/src/core/graph.cpp)
target_link_libraries(nostroma_core_metal PUBLIC nostroma_gpu_metal)
add_executable(runtime_hello tests/runtime_hello.cpp)
target_link_libraries(runtime_hello PRIVATE nostroma_core_metal)
enable_testing()
add_test(NAME runtime_hello COMMAND runtime_hello)

# The engine: ggml (the native expert formats' type traits and ggml-cpu) from the tree vendored in third_party/nostroma-ggml (frozen at the
# commit the PC build pins, 3cf03257).  -DNOSTROMA_GGML_DIR=<llama.cpp checkout> builds from that checkout instead (an override kept for two releases).
option(NOSTROMA_METAL_ENGINE "Build the engine (nostroma) for Metal" ON)
set(NOSTROMA_GGML_DIR "" CACHE PATH "llama.cpp checkout to take ggml from instead of the vendored third_party/nostroma-ggml (empty: the vendored tree)")
if(NOT NOSTROMA_METAL_ENGINE)
  return()
endif()
include(${NOSTROMA_ROOT}/cmake/nostroma_ggml.cmake)        # -DNOSTROMA_GGML_DIR, or the vendored third_party/nostroma-ggml
include(${NOSTROMA_ROOT}/cmake/backends/metal.cmake)
nostroma_ggml_resolve("${NOSTROMA_ROOT}")
if(NOT EXISTS "${_nostroma_ggml_root}/ggml/CMakeLists.txt")
  message(FATAL_ERROR "ggml sources not found in '${_nostroma_ggml_root}' (third_party/nostroma-ggml, or the -DNOSTROMA_GGML_DIR checkout)")
endif()
nostroma_metal_ggml()
# OWN-2N: the CPU expert rows and the --mtp-q4 requantizer on the Nostroma quant layer (src/quant, its Arm NEON tier, no ggml-cpu
# call from the pool) instead of ggml-cpu's type traits.  OFF by default on Metal until the layer's oracle (tests/quant/run_oracle.sh, Apple Clang) and unit tests
# have passed on the Mac; -DNOSTROMA_OWN_CPU_QUANT=ON builds the engine on the layer.
option(NOSTROMA_OWN_CPU_QUANT "CPU expert pool and --mtp-q4 on the Nostroma quant layer instead of ggml-cpu's type traits" OFF)
option(NOSTROMA_BUILD_TESTS "Build the quant layer's self-test and ggml oracle test (needs NOSTROMA_OWN_CPU_QUANT)" OFF)
if(NOSTROMA_OWN_CPU_QUANT)
  set(NOSTROMA_QUANT_ROOT ${NOSTROMA_ROOT})
  set(NOSTROMA_CPU_X86 OFF)
  include(${NOSTROMA_ROOT}/cmake/backends/quant.cmake)
  nostroma_quant_layer()
endif()

set(S ${NOSTROMA_ROOT}/src)
set(NOSTROMA_METAL_HOST_SOURCES
  ${S}/core/device.cu ${S}/core/pinned.cu ${S}/platform/memory.cpp ${S}/core/graph.cpp ${S}/core/weights.cpp ${S}/core/layout.cpp
  ${S}/core/layer.cpp ${S}/core/session.cpp ${S}/core/expert_source.cpp ${S}/core/remote_experts.cpp ${S}/core/expert_cache.cpp
  ${S}/core/native_head.cpp ${S}/core/native_dense.cpp ${S}/core/verify.cpp ${S}/core/mtp.cpp
  ${S}/core/conversation_snapshot.cpp ${S}/core/conversation_state.cpp ${S}/core/conversation_memory.cpp
  ${S}/core/peer_experts.cpp ${S}/core/arch_defaults.cpp ${S}/core/vmm.cpp ${S}/core/conversation_file.cpp
  ${S}/kernels/ngram.cpp ${S}/ngram/ple_reader.cpp ${S}/platform/direct_file.cpp ${S}/platform/io_priority.cpp
  ${S}/prefill/prefill.cpp
  ${S}/spec/suffix_drafter.cpp ${S}/spec/controller.cpp ${S}/spec/draft_policy.cpp ${S}/spec/draft_source.cpp
  ${S}/kernels/cpu/pool.cpp ${S}/kernels/cpu/expert_layout.cpp ${S}/kernels/cpu/native_expert.cpp
  ${S}/kernels/cpu/hadamard.cpp ${S}/kernels/cpu/tq_cpu.cpp)   # Gyro: the Hadamard rotation, the scalar trellis rows
set_source_files_properties(${S}/core/device.cu ${S}/core/pinned.cu
                            PROPERTIES LANGUAGE CXX)

# The kernel library: Metal implementations (src/engine/*.cpp) and, for every entry point not ported yet, a stub
# that stops the engine with the entry point's name (src/engine/stubs.cpp, generated by tools/gen_stubs.py).
file(GLOB NOSTROMA_METAL_ENGINE_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/src/engine/*.cpp)

add_library(nostroma_metal_host STATIC ${NOSTROMA_METAL_HOST_SOURCES})
target_include_directories(nostroma_metal_host PUBLIC ${NOSTROMA_ROOT}/include ${S}/core ${NOSTROMA_ROOT}/third_party/ggml
                           ${_nostroma_ggml_root}/ggml/include ${_nostroma_ggml_root}/ggml/src ${_nostroma_ggml_root}/ggml/src/ggml-cpu)
target_compile_definitions(nostroma_metal_host PUBLIC NOSTROMA_NATIVE_EXPERTS=1 NOSTROMA_HAVE_DFLASH2=1 NOSTROMA_VERSION="0.1.60-metal")
target_compile_options(nostroma_metal_host PRIVATE -Wno-unused-parameter -Wno-deprecated-declarations)
target_link_libraries(nostroma_metal_host PUBLIC nostroma_gpu_metal ggml-cpu ggml-base)
if(NOSTROMA_OWN_CPU_QUANT)
  target_link_libraries(nostroma_metal_host PUBLIC nostroma_quant)
  target_compile_definitions(nostroma_metal_host PUBLIC NOSTROMA_OWN_CPU_QUANT=1)
endif()

add_library(nostroma_metal_kernels STATIC ${NOSTROMA_METAL_ENGINE_SOURCES})
target_include_directories(nostroma_metal_kernels PRIVATE src ${NOSTROMA_ROOT}/third_party/ggml)
target_compile_definitions(nostroma_metal_kernels PRIVATE
  NOSTROMA_GGML_COMMON_DEFAULT="${GGML_COMMON}" NOSTROMA_METAL_KERNELS_DEFAULT="${CMAKE_CURRENT_SOURCE_DIR}/kernels"
  NOSTROMA_METAL_ENGINE_KERNELS_DEFAULT="${CMAKE_CURRENT_SOURCE_DIR}/src/engine/msl"
  NOSTROMA_METAL_DATA_DEFAULT="${NOSTROMA_ROOT}/data")
target_link_libraries(nostroma_metal_kernels PUBLIC nostroma_metal_host mtl_rt)

add_executable(nostroma ${S}/program/generate.cpp)
target_link_libraries(nostroma PRIVATE nostroma_metal_kernels nostroma_metal_host nostroma_metal_kernels)
# the decode window on its own (probe/window_probe.cpp): the engine's process state without the engine, for looking at a Metal fault
add_executable(window_probe probe/window_probe.cpp)
target_link_libraries(window_probe PRIVATE nostroma_metal_kernels nostroma_metal_host nostroma_metal_kernels)

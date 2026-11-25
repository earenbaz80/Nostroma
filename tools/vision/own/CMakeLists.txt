# tools/vision/own - Nostroma's own Qwen vision tower (own-stack phase 3).  No ggml, no llama.cpp: plain C++17 and one CUDA / HIP source.
#
# Standalone (quick; this is how the reference, the GPU tower and the unit tests are built on the Linux test boxes):
#   cmake -S tools/vision/own -B build-own -DCMAKE_BUILD_TYPE=Release [-DNOSTROMA_VIT_OWN_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=86] && cmake --build build-own -j
#   build-own/nostroma-vision-own --mmproj <mmproj.gguf> [--gpu]      build-own/nostroma-vision-own-test [mmproj.gguf ...]
# From tools/vision/CMakeLists.txt it is added as a subdirectory, and nostroma-vision links nostroma_vit_own (the GPU part follows NOSTROMA_VISION_CUDA).
cmake_minimum_required(VERSION 3.21)
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  project(nostroma_vision_own C CXX)
  set(NOSTROMA_VIT_OWN_STANDALONE ON)
endif()

option(NOSTROMA_VIT_OWN_CUDA "the own tower on an NVIDIA GPU (vit_gpu.cu with cuBLAS)" OFF)
set(_vit_cuda OFF)
if(NOSTROMA_VIT_OWN_CUDA OR NOSTROMA_VISION_CUDA)
  set(_vit_cuda ON)
  enable_language(CUDA)
  find_package(CUDAToolkit REQUIRED)
  if(NOT CMAKE_CUDA_ARCHITECTURES)
    set(CMAKE_CUDA_ARCHITECTURES native)
  endif()
endif()

option(NOSTROMA_VIT_OWN_HIP "the own tower on an AMD GPU (vit_gpu.cu built as HIP, with hipBLAS)" OFF)
set(NOSTROMA_VIT_OWN_HIP_ARCHS "" CACHE STRING "gfx architectures for a standalone HIP build (';'-separated); the helper build uses NOSTROMA_VISION_HIP_ARCHS")
set(_vit_hip OFF)
if(NOSTROMA_VIT_OWN_HIP OR NOSTROMA_VISION_HIP)
  if(_vit_cuda)
    message(FATAL_ERROR "nostroma_vit_own: CUDA and HIP are two different programs")
  endif()
  set(_vit_hip ON)
  if(NOSTROMA_VISION_HIP)
    set(_vit_hip_archs "${NOSTROMA_VISION_HIP_ARCHS}")
  else()
    set(_vit_hip_archs "${NOSTROMA_VIT_OWN_HIP_ARCHS}")
  endif()
  if(NOT _vit_hip_archs)
    message(FATAL_ERROR "nostroma_vit_own: a HIP build needs the gfx architectures (NOSTROMA_VIT_OWN_HIP_ARCHS or NOSTROMA_VISION_HIP_ARCHS)")
  endif()
  set(CMAKE_HIP_ARCHITECTURES "${_vit_hip_archs}")
  enable_language(HIP)
  find_package(hip REQUIRED)
  find_package(hipblas REQUIRED)
endif()

option(NOSTROMA_VIT_OWN_SYCL "the own tower on an Intel GPU (vit_sycl.cpp with oneMKL; needs the oneAPI icpx compiler)" OFF)
set(_vit_sycl OFF)
if(NOSTROMA_VIT_OWN_SYCL OR NOSTROMA_VISION_SYCL)
  if(_vit_cuda OR _vit_hip)
    message(FATAL_ERROR "nostroma_vit_own: SYCL is its own program, not together with CUDA or HIP")
  endif()
  set(_vit_sycl ON)
  find_package(MKL REQUIRED)        # the oneMKL ggml-sycl links too (MKL::MKL_SYCL::BLAS)
endif()

option(NOSTROMA_VIT_OWN_METAL "the own tower on a Mac's GPU (vit_metal.mm, Metal; macOS only)" OFF)
set(_vit_metal OFF)
if(APPLE AND (NOSTROMA_VIT_OWN_METAL OR NOSTROMA_VISION_METAL))
  if(_vit_cuda OR _vit_hip OR _vit_sycl)
    message(FATAL_ERROR "nostroma_vit_own: Metal is its own program, not together with CUDA, HIP or SYCL")
  endif()
  set(_vit_metal ON)
  # the kernels are embedded in the program as strings and compiled when the reader starts (nothing to ship beside it; the Command Line Tools have no
  # offline `metal` compiler): a header generated at configure time, redone when a .metal file changes
  file(READ ${CMAKE_CURRENT_SOURCE_DIR}/vit_metal.metal _vit_msl)
  file(READ ${CMAKE_CURRENT_SOURCE_DIR}/vit_metal_mpp.metal _vit_msl_mpp)
  file(WRITE ${CMAKE_CURRENT_BINARY_DIR}/vit_metal_src.h
       "// generated from vit_metal.metal and vit_metal_mpp.metal by tools/vision/own/CMakeLists.txt\nstatic const char kVitMetalSrc[] = R\"VITMSL(${_vit_msl})VITMSL\";\nstatic const char kVitMetalMppSrc[] = R\"VITMSL(${_vit_msl_mpp})VITMSL\";\n")
  set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/vit_metal.metal ${CMAKE_CURRENT_SOURCE_DIR}/vit_metal_mpp.metal)
endif()

set(STB_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../third_party/stb" CACHE PATH "stb_image.h (third_party/stb)")

add_library(nostroma_vit_own STATIC gguf_lite.cpp vit_geometry.cpp image_prep.cpp vit_ref.cpp own_reader.cpp
            vit_cpu.cpp cpu_ops.cpp cpu_kernels_scalar.cpp cpu_kernels_sse41.cpp cpu_kernels_avx.cpp cpu_kernels_avx2.cpp cpu_kernels_avx512.cpp cpu_kernels_neon.cpp)
find_package(Threads REQUIRED)
target_link_libraries(nostroma_vit_own PUBLIC Threads::Threads)
if(NOT MSVC)
  # the reference's loops are written for the compiler's vectoriser: -O3, and this machine's instruction set when asked (the unit-test and
  # reference builds on the Linux boxes); the helper's portable build keeps the AVX2 baseline its other code has
  option(NOSTROMA_VIT_OWN_NATIVE "build the reference for this CPU (-march=native)" ${NOSTROMA_VIT_OWN_STANDALONE})
  set_source_files_properties(vit_ref.cpp vit_cpu.cpp cpu_kernels_scalar.cpp cpu_kernels_neon.cpp PROPERTIES COMPILE_OPTIONS "-O3")
  # The reference (VitRef, a test oracle) is the only generic file compiled above the baseline, and only where the whole program has that floor anyway: an
  # instruction-set flag on a file that uses the standard library also reaches its inline / template copies (COMDAT), which the linker may keep for the WHOLE
  # program, so a wider flag here would put AVX2 code on the path of a CPU without it (RESULTS-OWN-3V.md PART H).
  #   NOSTROMA_VIT_OWN_NATIVE (standalone test builds) or a native helper build (setup, NOSTROMA_PORTABLE=OFF): -march=native, this CPU;
  #   the portable helper (NOSTROMA_PORTABLE=ON, an AVX2 baseline for the whole program): -mavx2 -mfma as before;
  #   an older-CPU test build (NOSTROMA_ISA_FLOOR, tools/vision): that floor.
  if(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
    if(NOSTROMA_ISA_FLOOR STREQUAL "avx" OR NOSTROMA_ISA_FLOOR STREQUAL "avx_f16c")
      set_source_files_properties(vit_ref.cpp PROPERTIES COMPILE_OPTIONS "-O3;-mavx")
    elseif(NOSTROMA_ISA_FLOOR)
      set_source_files_properties(vit_ref.cpp PROPERTIES COMPILE_OPTIONS "-O3")
    elseif(NOSTROMA_VIT_OWN_NATIVE OR (DEFINED NOSTROMA_PORTABLE AND NOT NOSTROMA_PORTABLE))
      set_source_files_properties(vit_ref.cpp PROPERTIES COMPILE_OPTIONS "-O3;-march=native")
    elseif(NOSTROMA_PORTABLE)
      set_source_files_properties(vit_ref.cpp PROPERTIES COMPILE_OPTIONS "-O3;-mavx2;-mfma")
    endif()
  elseif(NOSTROMA_VIT_OWN_NATIVE)
    set_source_files_properties(vit_ref.cpp PROPERTIES COMPILE_OPTIONS "-O3;-march=native")
  endif()
  # the CPU tower: the generic part (vit_cpu.cpp) keeps the baseline, each kernel tier is compiled for its own instruction set and only called when the CPU
  # has it (cpu_caps.h); the tiers' files include no standard-library code (cpu_tier.h)
  if(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
    set_source_files_properties(cpu_kernels_sse41.cpp PROPERTIES COMPILE_OPTIONS "-O3;-msse4.1")
    set_source_files_properties(cpu_kernels_avx.cpp PROPERTIES COMPILE_OPTIONS "-O3;-mavx")
    set_source_files_properties(cpu_kernels_avx2.cpp PROPERTIES COMPILE_OPTIONS "-O3;-mavx2;-mfma;-mf16c")
    set_source_files_properties(cpu_kernels_avx512.cpp PROPERTIES COMPILE_OPTIONS "-O3;-mavx2;-mfma;-mf16c;-mavx512f;-mavx512bw;-mavx512dq;-mavx512vl")
  else()
    set_source_files_properties(cpu_kernels_sse41.cpp cpu_kernels_avx.cpp cpu_kernels_avx2.cpp cpu_kernels_avx512.cpp PROPERTIES COMPILE_OPTIONS "-O3")
  endif()
else()
  set_source_files_properties(cpu_kernels_avx.cpp PROPERTIES COMPILE_OPTIONS "/arch:AVX")      # (the SSE4.1 tier needs no flag on x64)
  set_source_files_properties(cpu_kernels_avx2.cpp PROPERTIES COMPILE_OPTIONS "/arch:AVX2")
  set_source_files_properties(cpu_kernels_avx512.cpp PROPERTIES COMPILE_OPTIONS "/arch:AVX512")
endif()
target_include_directories(nostroma_vit_own PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_include_directories(nostroma_vit_own PRIVATE ${STB_DIR})
target_compile_features(nostroma_vit_own PUBLIC cxx_std_17)
if(_vit_cuda)
  target_sources(nostroma_vit_own PRIVATE vit_gpu.cu)
  target_compile_definitions(nostroma_vit_own PUBLIC NOSTROMA_VIT_GPU NOSTROMA_VIT_CUDA)
  target_link_libraries(nostroma_vit_own PUBLIC CUDA::cublas CUDA::cudart)
  set_target_properties(nostroma_vit_own PROPERTIES CUDA_STANDARD 17 CUDA_SEPARABLE_COMPILATION OFF)
endif()

if(_vit_hip)
  set_source_files_properties(vit_gpu.cu PROPERTIES LANGUAGE HIP)
  target_sources(nostroma_vit_own PRIVATE vit_gpu.cu)
  target_compile_definitions(nostroma_vit_own PUBLIC NOSTROMA_VIT_GPU NOSTROMA_VIT_HIP)
  target_link_libraries(nostroma_vit_own PUBLIC hip::host roc::hipblas)
  # hipBLASLt (optional, as for the engine): the products through it with NOSTROMA_VIT_LT / NOSTROMA_VIT_LT_ATT (vit_gpu.cu); off by default
  find_package(hipblaslt CONFIG QUIET)
  if(TARGET roc::hipblaslt)
    target_compile_definitions(nostroma_vit_own PRIVATE NOSTROMA_VIT_HIPBLASLT)
    target_link_libraries(nostroma_vit_own PUBLIC roc::hipblaslt)
  endif()
endif()

if(_vit_sycl)
  # only this file is SYCL code, with the precise floating-point model (as the engine's SYCL port).  No device-link options here: in the helper they would
  # also change how mtmd's ggml-sycl kernels are linked and compiled (its numerics and start time stay as they are)
  # An object library of its own: oneMKL's SYCL target carries -fsycl as a COMPILE option, which must not reach the other files (their x86 code, cpuid
  # builtins included, would be compiled for the device too); the rest of the program only links oneMKL ($<LINK_ONLY:...>).
  add_library(nostroma_vit_sycl OBJECT vit_sycl.cpp)
  target_include_directories(nostroma_vit_sycl PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
  target_compile_features(nostroma_vit_sycl PRIVATE cxx_std_17)
  target_compile_options(nostroma_vit_sycl PRIVATE -fsycl -fp-model=precise)
  target_compile_definitions(nostroma_vit_sycl PRIVATE NOSTROMA_VIT_GPU NOSTROMA_VIT_SYCL)
  target_link_libraries(nostroma_vit_sycl PRIVATE MKL::MKL_SYCL::BLAS)
  target_sources(nostroma_vit_own PRIVATE $<TARGET_OBJECTS:nostroma_vit_sycl>)
  target_compile_definitions(nostroma_vit_own PUBLIC NOSTROMA_VIT_GPU NOSTROMA_VIT_SYCL)
  target_link_libraries(nostroma_vit_own INTERFACE $<LINK_ONLY:MKL::MKL_SYCL::BLAS>)     # INTERFACE + LINK_ONLY: the programs link oneMKL, nothing else compiles with its options
  target_link_options(nostroma_vit_own PUBLIC -fsycl)
endif()

if(_vit_metal)
  target_sources(nostroma_vit_own PRIVATE vit_metal.mm)
  # compiled as C++ with the Objective-C++ switch (an OBJCXX language enabled only in this subdirectory leaves the helper's build without its rules)
  set_source_files_properties(vit_metal.mm PROPERTIES LANGUAGE CXX COMPILE_OPTIONS "-xobjective-c++;-fobjc-arc;-O2")
  target_include_directories(nostroma_vit_own PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
  target_compile_definitions(nostroma_vit_own PUBLIC NOSTROMA_VIT_GPU NOSTROMA_VIT_METAL)
  target_link_libraries(nostroma_vit_own PUBLIC "-framework Metal" "-framework Foundation")
endif()

# the own-tower-only reader, the unit tests, and with a picture list the comparison with mtmd's preparation (oracle_prep.cpp is built in
# tools/vision's mtmd build) and the embedding comparison
add_executable(nostroma-vision-own own_main.cpp)
target_link_libraries(nostroma-vision-own PRIVATE nostroma_vit_own)
add_executable(nostroma-vision-own-test test_gguf_geometry.cpp)
target_link_libraries(nostroma-vision-own-test PRIVATE nostroma_vit_own)
add_executable(nostroma-vision-own-cpu-test test_cpu_kernels.cpp)
target_link_libraries(nostroma-vision-own-cpu-test PRIVATE nostroma_vit_own)
add_executable(nostroma-vision-own-prep-check test_image_prep.cpp)
target_link_libraries(nostroma-vision-own-prep-check PRIVATE nostroma_vit_own)
add_executable(nostroma-vision-own-compare compare_sve.cpp)
if(NOT NOSTROMA_VIT_OWN_STANDALONE)
  set_target_properties(nostroma-vision-own nostroma-vision-own-test nostroma-vision-own-cpu-test nostroma-vision-own-prep-check nostroma-vision-own-compare PROPERTIES EXCLUDE_FROM_ALL ON)
endif()

# cmake/backends/cuda.cmake - the NVIDIA (CUDA) parts of the root project: toolchain setup, llama.cpp's MMQ kernels (nostroma_mmq, nostroma_kq), the spill guard.
#
# Every block below is a macro: it runs in the scope of the caller (CMakeLists.txt calls it where the block used to be), so variables, targets and
# their order are those of the single-file CMakeLists.txt it was cut from (cleanup 5.4; the build graph is identical).

# CUDA: runtime library, architectures (enable_language), the architecture checks, the gpu target variables
macro(nostroma_cuda_toolchain)
  # #585: CMake links CUDA code with the STATIC runtime by default, and the targets below also link CUDA::cudart (the
  # DLL's import library).  MSVC with a CUDA 12.x toolkit - the experimental Pascal/Volta build - then fails with
  # LNK1169 (every cudart symbol defined twice); GNU ld lets it pass.  That build links the shared runtime alone.  The
  # ready-made engine (CUDA 13, no NOSTROMA_EXPERIMENTAL_SM60) is unchanged; -DCMAKE_CUDA_RUNTIME_LIBRARY overrides.
  if(MSVC AND NOSTROMA_EXPERIMENTAL_SM60 AND NOT DEFINED CMAKE_CUDA_RUNTIME_LIBRARY)
    set(CMAKE_CUDA_RUNTIME_LIBRARY Shared)
  endif()
  # #4023: the default below has to be set BEFORE enable_language(CUDA): since CMake 3.18 that call fills an unset
  # CMAKE_CUDA_ARCHITECTURES with nvcc's own default (sm_75 for CUDA 13), so a test after it never saw "undefined" and
  # a build with no option was an sm_75 build.  -DCMAKE_CUDA_ARCHITECTURES and the CUDAARCHS environment variable win.
  set(_nostroma_cuda_arch_defaulted OFF)
  if(NOT DEFINED CMAKE_CUDA_ARCHITECTURES AND NOT DEFINED ENV{CUDAARCHS})
    set(CMAKE_CUDA_ARCHITECTURES 120 CACHE STRING "CUDA architectures")
    set(_nostroma_cuda_arch_defaulted ON)
  endif()
  enable_language(CUDA)
  # `enable_language(CUDA)` gives the .cu compile rules but NOT the imported targets, so `CUDA::cudart` has to
  # be brought in explicitly for the host-side tests that call cudaMalloc themselves.
  find_package(CUDAToolkit REQUIRED)
  option(NOSTROMA_EXPERIMENTAL_SM60 "community build for GPUs below compute capability 7.5: Pascal sm_60, Volta sm_70 (#236)" OFF)
  if(_nostroma_cuda_arch_defaulted)
    # a recommendation, not a refusal: the release engine is built for 75;86;89;120, a hand build names its card
    message(WARNING "Nostroma: CMAKE_CUDA_ARCHITECTURES was not set, so this build is for ${CMAKE_CUDA_ARCHITECTURES} only (sm_120 = RTX 50). For another "
                    "card pass it: -DCMAKE_CUDA_ARCHITECTURES=native (the GPUs in this PC), 75 (RTX 20), 86 (RTX 30), "
                    "89 (RTX 40), or a list like \"86;120\".")
  endif()
  set(_nostroma_cuda_below75 OFF)   # an architecture below sm_75 in the list (only with NOSTROMA_EXPERIMENTAL_SM60): tests of sm_75+ device code are not built
  foreach(_a IN LISTS CMAKE_CUDA_ARCHITECTURES)
    string(REGEX REPLACE "-.*$" "" _base "${_a}")     # 120-real / 120-virtual are still 120
    if(_base MATCHES "^[0-9]+$" AND _base LESS 75)
      set(_nostroma_cuda_below75 ON)
    endif()
    # Turing port: developed and measured on sm_120 (RTX 50); the tf32 mma in the QSA scorer has a
    # portable fp32-FMA fallback, so RTX 20 (75), 30 (86), RTX 40 (89) and RTX 50 (120) build too.
    # Pre-sm_75 is refused.
    if(_base STREQUAL "native" OR _base STREQUAL "all" OR _base STREQUAL "all-major")
      continue()
    endif()
    # NOSTROMA_EXPERIMENTAL_SM60: a Pascal (sm_60, GP100-class) or Volta (sm_70, V100 / Titan V, #236) build.
    # These sit below every architecture the kernels were written for, so two intrinsics are replaced below
    # their arch - `__dp4a` (6.1+) and `__nanosleep` (7.0+) - in include/nostroma/kernels/dp4a.hpp, which is
    # bit-exact for the first and merely a shorter pause for the second (sm_70 has both).  Community-tested,
    # not in the ready-made engine; RTX 20/30/40/50 cards must use the release engine instead.  It needs a CUDA
    # 12.x toolkit: CUDA 13 dropped sm_60 and sm_70 (nvcc fails CMake's compiler test with "compute_70").
    if(_base LESS 75 AND NOT NOSTROMA_EXPERIMENTAL_SM60)
      message(FATAL_ERROR
        "Nostroma needs an NVIDIA GPU of compute capability 7.5 or newer (RTX 20 / 30 / 40 / 50 series), but "
        "CMAKE_CUDA_ARCHITECTURES is '${CMAKE_CUDA_ARCHITECTURES}'.  (A Pascal sm_60 or Volta sm_70 build is "
        "-DNOSTROMA_EXPERIMENTAL_SM60=ON; upstream does not support it.)")
    endif()
    if(_base LESS 52)
      message(FATAL_ERROR "CMAKE_CUDA_ARCHITECTURES '${CMAKE_CUDA_ARCHITECTURES}': even the experimental build "
                          "needs compute capability 5.2 (sm_52, Maxwell) or newer")
    endif()
    # Maxwell (sm_52, #3218): one reporter built and ran this on two Quadro M6000 (CUDA 12.x, Qwen3.8-Flash-Next
    # IQ1, about 22 t/s).  It has no native half-precision arithmetic, so it is slower per byte than Pascal; only
    # this opt-in build gets the floor.  Warn, do not refuse.
    if(_base LESS 60)
      message(WARNING "Building for sm_${_base} (Maxwell): community-tested on one reporter's Quadro M6000 only, "
                      "no native half-precision arithmetic, CUDA 12.x toolkit required (docs/OLDER_GPUS.md).")
    endif()
    # #220 / #224: RTX 50 engines built with CUDA 12.8 crashed in the prompt path on Linux (13.0 and newer did not)
    if(_base GREATER_EQUAL 120 AND CMAKE_CUDA_COMPILER_VERSION VERSION_LESS 13.0)
      message(WARNING "Building for sm_${_base} (RTX 50) with CUDA ${CMAKE_CUDA_COMPILER_VERSION}: engines built with "
                      "CUDA 12.8 crashed on long prompts on these cards (issues #220, #224). Use CUDA 13.0 or newer.")
    endif()
  endforeach()
  if(NOSTROMA_EXPERIMENTAL_SM60)
    # every target sees it: the Pascal / Volta code paths (the Volta prompt attention, PR #600) are compiled into this
    # build only, so the ready-made engine (sm_75+) keeps exactly the code it had
    add_compile_definitions(NOSTROMA_EXPERIMENTAL_SM60=1)
  endif()
  message(STATUS "Nostroma: CUDA enabled, arch ${CMAKE_CUDA_ARCHITECTURES}")
  set(_nostroma_gpu_runtime_target CUDA::cudart)
  set(_nostroma_gpu_blas_target CUDA::cublas)
  set(_nostroma_gpu_include_directories ${CMAKE_CUDA_TOOLKIT_INCLUDE_DIRECTORIES})
endmacro()

# nostroma_pf_own (Nostroma's own prompt kernels) with nostroma_mmq's include directories (in their order, the trellis overlay's
# first), definitions and options: the same command line for the files that left nostroma_mmq (CUDA and HIP)
macro(nostroma_pf_own_mirror)
  foreach(_nostroma_p INCLUDE_DIRECTORIES COMPILE_DEFINITIONS COMPILE_OPTIONS)
    get_target_property(_nostroma_v nostroma_mmq ${_nostroma_p})
    if(_nostroma_v)
      set_property(TARGET nostroma_pf_own PROPERTY ${_nostroma_p} "${_nostroma_v}")
    endif()
  endforeach()
  target_include_directories(nostroma_pf_own INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/include)
endmacro()

# nostroma_mmq, nostroma_mmq_w4a4 and libnostroma_kq: llama.cpp's MMQ kernels for the prompt path (CUDA), and their tests
macro(nostroma_cuda_mmq)
    # prompt-speed plan step 2b: llama.cpp's MMQ kernels (ggml-cuda, MIT) for the prompt path's experts, compiled
    # from the same checkout as ggml above - only mmq.cuh's instances for the packs' types and the quantizer, with
    # the few host symbols of ggml-cuda.cu they use in src/prefill/ggml_cuda_host.cu
    set(_nostroma_gg ${_nostroma_ggml_root}/ggml)
    set(_nostroma_mmq ${_nostroma_gg}/src/ggml-cuda)
    set(_nostroma_quantize_cu ${_nostroma_mmq}/quantize.cu)   # the overlay's copy when the trellis overlay is on: it includes mmq.cuh
    if(_nostroma_mmq_tq_overlay)
      set(_nostroma_quantize_cu ${_nostroma_tq_overlay_dir}/quantize.cu)
    endif()
    # #136: the Q2_0 pack's prompt experts on Nostroma's own int8 kernels (moe_fused.cu, opt-in NOSTROMA_PF_FUSED=1; CUDA
    # only: the HIP branch below keeps MMQ, and an sm_75 device or an sm_75-only build reports them unavailable)
    add_library(nostroma_mmq STATIC src/prefill/moe_mmq.cu src/prefill/moe_iq4_w4a8.cu
                src/prefill/mmq_nvfp4_w4a8.cu
                src/prefill/ggml_cuda_host.cu ${_nostroma_quantize_cu})
    # P4-SPLIT: Nostroma's own prompt kernels (the fused int8 experts) are a library of their own, nostroma_pf_own, so that a
    # build without llama.cpp's MMQ keeps them.  With MMQ they are compiled with nostroma_mmq's command line (nostroma_pf_own_mirror
    # below) and nostroma_mmq hands them on (PUBLIC): every target that links nostroma_mmq gets the same objects as before.
    add_library(nostroma_pf_own STATIC src/prefill/moe_fused.cu src/prefill/moe_fused_iq.cu src/prefill/moe_helpers.cu
                src/prefill/moe_fused_iq_q36.cu)   # (the same kernels again for Qwen3.6's expert shape, for src/qwen35/q36_engine.cu)
    if(NOSTROMA_EXPERIMENTAL_SM60 AND NOT NOSTROMA_HIP_GFX906)
      # GP100 (sm_60): a resident layer's experts weight-stationary, one launch per product (moe_ws.hpp; opt-in at
      # run time, NOSTROMA_MMQ_WS=1, and only where every visible GPU is cc 6.0)
      target_sources(nostroma_mmq PRIVATE src/prefill/moe_ws.cu src/prefill/moe_ws_gu_iq2.cu src/prefill/moe_ws_gu_iq3.cu
                     src/prefill/moe_ws_down.cu)
    endif()
    # q8_0: the drafter's matrices (E-9); NOSTROMA_ORCA_Q4KS_MMQ adds q5_0 (#296, in _nostroma_mmq_types), and
    # NOSTROMA_MMQ_KQUANTS q4_k q5_k q5_1 q6_k, the experts of Unsloth's UD-Q4/Q5/Q6_K_XL (docs/QUANTS.md; the dispatch
    # follows eddoursul/Nostroma 7706c1b).  MODEL-UPDATE Phase 1: on CUDA they are a library of their own, nostroma_kq
    # (below), loaded only for a model with these experts: the engine loads every kernel of its own binary at start
    # (CUDA_MODULE_LOADING=EAGER), and these four took ~3.8 MB of VRAM (3 expert slots of IQ3_XXS on a P100) from every
    # model.  gfx906 (HIP: code objects load on first use) keeps them in nostroma_mmq.
    set(_nostroma_mmq_cuda_types ${_nostroma_mmq_types})
    set(_nostroma_kq_types q4_k q5_k q5_1 q6_k)
    set(_nostroma_kq_dso OFF)
    if(NOSTROMA_MMQ_KQUANTS AND NOSTROMA_HIP_GFX906)
      list(APPEND _nostroma_mmq_cuda_types ${_nostroma_kq_types})
    elseif(NOSTROMA_MMQ_KQUANTS)
      set(_nostroma_kq_dso ON)
    endif()
    foreach(_t IN LISTS _nostroma_mmq_cuda_types)
      target_sources(nostroma_mmq PRIVATE ${_nostroma_mmq}/template-instances/mmq-instance-${_t}.cu)
    endforeach()
    if(_nostroma_mmq_tq_overlay)
      foreach(_t tq2_t tqk6 tqk7 tqp5 tqp6 tqp7)
        target_sources(nostroma_mmq PRIVATE ${_nostroma_tq_overlay_dir}/template-instances/mmq-instance-${_t}.cu)
      endforeach()
      # first on the include path: the patched mmq.cuh / ggml.h shadow the pinned ones for this target only
      target_include_directories(nostroma_mmq BEFORE PRIVATE ${_nostroma_tq_overlay_dir} ${_nostroma_tq_overlay_dir}/include)
    endif()
    # NVFP4: W4A8 (default) in mmq_nvfp4_w4a8.cu with the plain architectures; the opt-in W4A4 needs RTX 50's FP4 MMA,
    # which exists only in the arch-specific target, so its one unit alone is built with 12x -> 12xa (the default
    # binary is unchanged and runs on sm_121; a card without that image falls back to W4A8 at run time)
    set(_nostroma_w4a4_archs ${CMAKE_CUDA_ARCHITECTURES})
    # `native` is first replaced by the detected architectures (e.g. 120-real), so the 12x -> 12xa rewrite below applies
    # to it too: with plain sm_120 ptxas refuses the FP4 MMA of this one unit (#4023)
    if("native" IN_LIST _nostroma_w4a4_archs AND CMAKE_CUDA_ARCHITECTURES_NATIVE)
      list(REMOVE_ITEM _nostroma_w4a4_archs native)
      list(APPEND _nostroma_w4a4_archs ${CMAKE_CUDA_ARCHITECTURES_NATIVE})
    endif()
    # (two steps: CMake before 3.29 rejects a \2 whose optional group did not match, "120" alone)
    list(TRANSFORM _nostroma_w4a4_archs REPLACE "^(12[0-9])$" "\\1a")
    list(TRANSFORM _nostroma_w4a4_archs REPLACE "^(12[0-9])-(real|virtual)$" "\\1a-\\2")
    add_library(nostroma_mmq_w4a4 STATIC src/prefill/mmq_nvfp4_w4a4.cu)
    set_target_properties(nostroma_mmq_w4a4 PROPERTIES CUDA_ARCHITECTURES "${_nostroma_w4a4_archs}")
    target_include_directories(nostroma_mmq_w4a4 PRIVATE ${_nostroma_gg}/include ${_nostroma_gg}/src ${_nostroma_mmq})
    target_compile_options(nostroma_mmq_w4a4 PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:--extended-lambda -use_fast_math>)
    if(MSVC)
      target_compile_options(nostroma_mmq_w4a4 PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:-Xcompiler=/bigobj>)
    endif()
    target_link_libraries(nostroma_mmq_w4a4 PUBLIC ggml-base ${_nostroma_gpu_runtime_target})
    target_link_libraries(nostroma_mmq PRIVATE nostroma_mmq_w4a4)
    # NOSTROMA_MMQ_TAB: the pointer-table copy of MMQ's scheduler mirrors mmq.cuh from mul_mat_q_process_tile through
    # mul_mat_q_case (struct mmq_args included).  A fingerprint of that text instead of a compile probe: nothing is
    # compiled at configure time, and a llama.cpp tree with another scheduler turns the feature off instead of
    # failing the build.  _nostroma_mmq_tab_known: the hashes moe_mmq_tab.cuh was verified against (3cf03257, the
    # pinned commit, which is also what third_party/nostroma-ggml holds).
    set(_nostroma_mmq_tab_on OFF)
    if(NOSTROMA_MMQ_TAB AND NOT NOSTROMA_HIP_GFX906)   # gfx906 compiles no .cu from here (its HIP glob): no tab at all
      if(NOT NOSTROMA_GGML_DIR)
        # the vendored third_party/nostroma-ggml is the tree moe_mmq_tab.cuh was verified against (its mmq.cuh is the pinned file, unedited), and
        # tools/check_vendored.py keeps its bytes: no fingerprint of mmq.cuh is needed
        set(_nostroma_mmq_tab_on ON)
      else()   # a -DNOSTROMA_GGML_DIR checkout: only the verified scheduler is accepted
        set(_nostroma_mmq_tab_known 36e4dc716c504470ec09cc0852d29a6ac5eace257f6e5e72db3805ca4f043eb0)
        set(_nostroma_mmq_tab_hash "")
        if(EXISTS ${_nostroma_mmq}/mmq.cuh)
          file(READ ${_nostroma_mmq}/mmq.cuh _nostroma_mmq_src)
          string(REPLACE "\r\n" "\n" _nostroma_mmq_src "${_nostroma_mmq_src}")
          string(FIND "${_nostroma_mmq_src}" "static __device__ __forceinline__ void mul_mat_q_process_tile" _nostroma_tab_a)
          string(FIND "${_nostroma_mmq_src}" "#define DECL_MMQ_CASE" _nostroma_tab_b)
          if(_nostroma_tab_a GREATER -1 AND _nostroma_tab_b GREATER _nostroma_tab_a)
            math(EXPR _nostroma_tab_len "${_nostroma_tab_b} - ${_nostroma_tab_a}")
            string(SUBSTRING "${_nostroma_mmq_src}" ${_nostroma_tab_a} ${_nostroma_tab_len} _nostroma_tab_region)
            string(SHA256 _nostroma_mmq_tab_hash "${_nostroma_tab_region}")
          endif()
          unset(_nostroma_mmq_src)
          unset(_nostroma_tab_region)
        endif()
        if(_nostroma_mmq_tab_hash AND _nostroma_mmq_tab_hash IN_LIST _nostroma_mmq_tab_known)
          set(_nostroma_mmq_tab_on ON)
        else()
          message(STATUS "NOSTROMA_MMQ_TAB off: mmq.cuh differs from the mirrored scheduler (${_nostroma_mmq_tab_hash})")
        endif()
      endif()
    endif()
    if(_nostroma_mmq_tab_on)
      set(_nostroma_tab_cuh ${CMAKE_CURRENT_SOURCE_DIR}/src/prefill/moe_mmq_tab.cuh)
      # the native packs' nine types, the ones prefill_mmq_tab_test checks bit for bit; the optional Q5_0 / K-quant
      # instances (NOSTROMA_ORCA_Q4KS_MMQ, NOSTROMA_MMQ_KQUANTS) get no pointer table and keep the gather
      set(_nostroma_mmq_tab_types q2_0 iq2_xxs iq2_xs iq2_s iq3_xxs iq3_s iq4_nl iq4_xs q8_0)
      foreach(_t IN LISTS _nostroma_mmq_tab_types)
        string(TOUPPER ${_t} _nostroma_tab_T)
        configure_file(src/prefill/mmq_tab_instance.cu.in ${CMAKE_BINARY_DIR}/mmq_tab/mmq-tab-${_t}.cu @ONLY)
        target_sources(nostroma_mmq PRIVATE ${CMAKE_BINARY_DIR}/mmq_tab/mmq-tab-${_t}.cu)
      endforeach()
      target_compile_definitions(nostroma_mmq PRIVATE NOSTROMA_MMQ_TAB=1)
      message(STATUS "NOSTROMA_MMQ_TAB on: pointer-table MMQ for ${_nostroma_mmq_tab_types}")
    endif()
    target_include_directories(nostroma_mmq PRIVATE ${_nostroma_gg}/include ${_nostroma_gg}/src ${_nostroma_mmq}
                               PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
    target_compile_options(nostroma_mmq PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:--extended-lambda -use_fast_math>)
    if(MSVC)
      target_compile_options(nostroma_mmq PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:-Xcompiler=/bigobj>)
    endif()
    # GGML's CUDA error reporting calls cuGetErrorString from the driver API.
    target_link_libraries(nostroma_mmq PUBLIC ggml-base ${_nostroma_gpu_runtime_target})
    if(TARGET CUDA::cuda_driver)   # not in the HIP (gfx906) build, whose CUDA::cudart is a stand-in
      target_link_libraries(nostroma_mmq PUBLIC CUDA::cuda_driver)
    endif()
    if(NOSTROMA_MMQ_KQUANTS)
      target_compile_definitions(nostroma_mmq PRIVATE NOSTROMA_MMQ_KQUANTS=1)
    endif()
    if(_nostroma_kq_dso)
      # nostroma_kq: the K-quant MMQ instances with their own copy of ggml_cuda_host.cu's symbols and the static CUDA
      # runtime, next to the engine (libnostroma_kq.so / nostroma_kq.dll); moe_mmq.cu opens it when a model asks for one
      # of these formats (NOSTROMA_MMQ_KQ=1).  Without the file the engine runs them on the FP16 prompt path, as before.
      target_compile_definitions(nostroma_mmq PRIVATE NOSTROMA_KQ_DSO=1)
      target_sources(nostroma_mmq PRIVATE src/prefill/mmq_kq_loader.cpp)
      if(NOT WIN32)
        target_link_libraries(nostroma_mmq PUBLIC ${CMAKE_DL_LIBS})
      endif()
      add_library(nostroma_kq SHARED src/prefill/mmq_kq_lib.cu src/prefill/ggml_cuda_host.cu)
      foreach(_t IN LISTS _nostroma_kq_types)
        target_sources(nostroma_kq PRIVATE ${_nostroma_mmq}/template-instances/mmq-instance-${_t}.cu)
      endforeach()
      target_include_directories(nostroma_kq PRIVATE ${_nostroma_gg}/include ${_nostroma_gg}/src ${_nostroma_mmq}
                                 ${CMAKE_CURRENT_SOURCE_DIR}/include)
      target_compile_options(nostroma_kq PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:--extended-lambda -use_fast_math>)
      if(MSVC)
        target_compile_options(nostroma_kq PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:-Xcompiler=/bigobj>)
      endif()
      set_target_properties(nostroma_kq PROPERTIES CUDA_RUNTIME_LIBRARY Static POSITION_INDEPENDENT_CODE ON
                            CXX_VISIBILITY_PRESET hidden CUDA_VISIBILITY_PRESET hidden)
      # ggml-base is static: position-independent so a shared library can hold it (the same code otherwise)
      set_target_properties(ggml-base PROPERTIES POSITION_INDEPENDENT_CODE ON)
      target_link_libraries(nostroma_kq PRIVATE ggml-base)
      if(TARGET CUDA::cuda_driver)
        target_link_libraries(nostroma_kq PRIVATE CUDA::cuda_driver)
      endif()
      add_dependencies(nostroma_mmq nostroma_kq)
    endif()
    if(NOSTROMA_ORCA_Q4KS_MMQ)
      target_compile_definitions(nostroma_mmq PRIVATE NOSTROMA_ORCA_Q4KS_MMQ=1)
    endif()
    if(_nostroma_mmq_tq)
      target_compile_definitions(nostroma_mmq PRIVATE NOSTROMA_MMQ_TQ=1)
    endif()
    if(_nostroma_mmq_tqp)
      target_compile_definitions(nostroma_mmq PRIVATE NOSTROMA_MMQ_TQP=1)
    endif()
    nostroma_pf_own_mirror()
    target_link_libraries(nostroma_pf_own PUBLIC nostroma_quant ggml-base ${_nostroma_gpu_runtime_target})
    if(TARGET CUDA::cuda_driver)
      target_link_libraries(nostroma_pf_own PUBLIC CUDA::cuda_driver)
    endif()
    target_link_libraries(nostroma_mmq PUBLIC nostroma_pf_own)
    target_link_libraries(nostroma_prefill PUBLIC nostroma_mmq)
    target_compile_definitions(nostroma_prefill PUBLIC NOSTROMA_PREFILL_MMQ=1 NOSTROMA_PREFILL_FUSED=1)
    if(NOSTROMA_EXPERIMENTAL_SM60 AND NOT NOSTROMA_HIP_GFX906)
      # the weight-stationary experts (moe_ws.hpp) are in nostroma_mmq: the prompt path may take them (NOSTROMA_MMQ_WS=1)
      target_compile_definitions(nostroma_prefill PUBLIC NOSTROMA_PREFILL_WS=1)
    endif()
    set(_nostroma_pf_tests_lib nostroma_mmq)
endmacro()

# P4-SPLIT, NOSTROMA_MMQ=OFF (the default): Nostroma's own prompt kernels without llama.cpp's MMQ (nostroma_pf_own alone, with mmq_absent.cpp for the MMQ half
# of moe_mmq.hpp); the same sources and options as nostroma_cuda_mmq gives them, the ggml-base headers only
macro(nostroma_cuda_pf_own)
    set(_nostroma_gg ${_nostroma_ggml_root}/ggml)
    add_library(nostroma_pf_own STATIC src/prefill/moe_fused.cu src/prefill/moe_fused_iq.cu src/prefill/moe_helpers.cu
                src/prefill/moe_fused_iq_q36.cu src/prefill/mmq_absent.cpp)
    target_include_directories(nostroma_pf_own PRIVATE ${_nostroma_gg}/include ${_nostroma_gg}/src PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
    target_compile_options(nostroma_pf_own PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:--extended-lambda -use_fast_math>)
    if(MSVC)
      target_compile_options(nostroma_pf_own PRIVATE $<$<COMPILE_LANGUAGE:CUDA>:-Xcompiler=/bigobj>)
    endif()
    target_link_libraries(nostroma_pf_own PUBLIC nostroma_quant ggml-base ${_nostroma_gpu_runtime_target})
    if(TARGET CUDA::cuda_driver)
      target_link_libraries(nostroma_pf_own PUBLIC CUDA::cuda_driver)
    endif()
    if(NOSTROMA_HIP_GFX906)   # (nostroma_hip_gfx906_sources adds these two to nostroma_pf_own only with MMQ)
      target_sources(nostroma_pf_own PRIVATE src/prefill/moe_f16_kq.cu)
      target_sources(nostroma_pf_own PRIVATE src/prefill/moe_p1a.cu)
      target_compile_definitions(nostroma_pf_own PRIVATE GGML_USE_HIP)
    endif()
    target_link_libraries(nostroma_prefill PUBLIC nostroma_pf_own)
    target_compile_definitions(nostroma_prefill PUBLIC NOSTROMA_PREFILL_FUSED=1)
    set(_nostroma_pf_tests_lib nostroma_pf_own)
    message(STATUS "Nostroma: no llama.cpp MMQ prompt kernels (NOSTROMA_MMQ=OFF): Nostroma's own prompt kernels and the FP16 path")
endmacro()

# the prompt kernels' tests: the fused experts' (linked to ${_nostroma_pf_tests_lib}) and, with MMQ, MMQ's own
macro(nostroma_cuda_prompt_tests)
    if(NOSTROMA_BUILD_TESTS AND NOT NOSTROMA_MMQ)
      # P4-SPLIT: the engine and Nostroma's prompt library hold none of llama.cpp's MMQ (names in the bytes, nm, cuobjdump; tools/check_no_mmq.py)
      find_package(Python3 QUIET COMPONENTS Interpreter)
      if(Python3_Interpreter_FOUND)
        add_test(NAME no_mmq_symbols COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/tools/check_no_mmq.py
                 --cuobjdump ${CUDAToolkit_BIN_DIR}/cuobjdump${CMAKE_EXECUTABLE_SUFFIX} $<TARGET_FILE:nostroma> $<TARGET_FILE:nostroma_pf_own>)
        set_tests_properties(no_mmq_symbols PROPERTIES TIMEOUT 900)
      endif()
    endif()
    if(NOSTROMA_BUILD_TESTS)
      # the fused prompt kernels' weight decode (moe_fused_iq.cu's load_unit / convert, compiled as the library compiles them) against
      # stored digests: the same file on CUDA and HIP (exit 77 without a card).  Those device functions exist only for sm_75 and newer
      # (moe_fused_iq.cu's __CUDA_ARCH__ >= 750 sections), so a list with an older architecture (NOSTROMA_EXPERIMENTAL_SM60) does not build it
      if(_nostroma_cuda_below75)
        message(STATUS "Nostroma: prefill_decode_golden not built: ${CMAKE_CUDA_ARCHITECTURES} has an architecture below sm_75")
      else()
        add_executable(prefill_decode_golden tests/cuda/prefill_decode_golden.cu)
        target_include_directories(prefill_decode_golden PRIVATE $<TARGET_PROPERTY:nostroma_pf_own,INCLUDE_DIRECTORIES>)
        target_compile_definitions(prefill_decode_golden PRIVATE $<TARGET_PROPERTY:nostroma_pf_own,COMPILE_DEFINITIONS>)
        target_compile_options(prefill_decode_golden PRIVATE $<TARGET_PROPERTY:nostroma_pf_own,COMPILE_OPTIONS>)
        target_link_libraries(prefill_decode_golden PRIVATE ggml-base ${_nostroma_gpu_runtime_target})
        add_test(NAME prefill_decode_golden COMMAND prefill_decode_golden ${CMAKE_CURRENT_SOURCE_DIR}/tests/cuda/prefill_decode_golden.txt)
        set_tests_properties(prefill_decode_golden PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 120)
      endif()
      # #136: the fused int8 experts against a double-precision reference and the MMQ path (exit 77 below sm_80)
      add_executable(prefill_fused_moe_test tests/cuda/prefill_fused_moe_test.cpp)
      target_link_libraries(prefill_fused_moe_test PRIVATE ${_nostroma_pf_tests_lib} ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_fused_moe_test COMMAND prefill_fused_moe_test)
      set_tests_properties(prefill_fused_moe_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 300)
      # #136: the same for the native packs' formats (IQ2_XXS IQ2_XS IQ2_S IQ3_XXS IQ3_S IQ4_XS, down Q2_0 IQ4_NL)
      add_executable(prefill_fused_iq_test tests/cuda/prefill_fused_iq_test.cpp)
      target_link_libraries(prefill_fused_iq_test PRIVATE ${_nostroma_pf_tests_lib} ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_fused_iq_test COMMAND prefill_fused_iq_test)
      set_tests_properties(prefill_fused_iq_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 600)
      # one prompt layer of experts timed on every path the engine can take (MMQ where it is built, the dequantize + FP16 GEMM path with and without
      # the few-row experts, the grouped kernels, the fused kernels where the card has them), hash and error of each against a CPU reference; runs on
      # any card (77 only without one).  The ctest entry is a small smoke run; the grid is `prefill_expert_paths_bench` itself (see its source's head)
      add_executable(prefill_expert_paths_bench tests/cuda/prefill_expert_paths_bench.cpp)
      target_link_libraries(prefill_expert_paths_bench PRIVATE nostroma_prefill ${_nostroma_pf_tests_lib} $<TARGET_NAME_IF_EXISTS:nostroma_quant> ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_expert_paths_bench COMMAND prefill_expert_paths_bench --quick)
      set_tests_properties(prefill_expert_paths_bench PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 600)
      # P4-SMALL: the fused experts for one gathered group (the layer-major walk's entry) against the layer's fused path (bits) and MMQ in the walk
      # (P4-INT: MMQ builds only: the test returns 1 where mmq::built() is false, it has no no-MMQ rule yet)
      if(NOSTROMA_MMQ)
        add_executable(prefill_fused_group_test tests/cuda/prefill_fused_group_test.cpp)
        target_link_libraries(prefill_fused_group_test PRIVATE ${_nostroma_pf_tests_lib} ggml-base ${_nostroma_gpu_runtime_target})
        add_test(NAME prefill_fused_group_test COMMAND prefill_fused_group_test)
        set_tests_properties(prefill_fused_group_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 600)
      endif()
      # the same kernels at Qwen3.6's expert shape (n_embd 2048, n_ff 512: the copy moe_fused_iq_q36.cu compiles): UD-Q6_K_XL's and the
      # Q8_0 file's pairs against the reference, the int8 model and MMQ (77 below sm_80)
      add_executable(prefill_fused_q36_test tests/cuda/prefill_fused_q36_test.cpp)
      target_link_libraries(prefill_fused_q36_test PRIVATE ${_nostroma_pf_tests_lib} ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_fused_q36_test COMMAND prefill_fused_q36_test)
      set_tests_properties(prefill_fused_q36_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 900)
      # a launch whose expert blobs are not in device memory takes the unstaged kernel instead of ending the process (a staged K-quant down: timing part only, one layer of 2,048 tokens)
      add_test(NAME prefill_fused_q36_test_hostblobs COMMAND prefill_fused_q36_test "--only=Q4_K / Q5_K" --no-ref --chunks=2048 --host-blobs=1 --expect-fallback)
      set_tests_properties(prefill_fused_q36_test_hostblobs PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_Q2N=1 on its own (the test leaves NOSTROMA_PF_FUSED unset): the native Q2_0 pack's Q2_0 / Q2_0
      # layers on sm_80+ (77 below sm_80 and without a card)
      add_test(NAME prefill_fused_iq_test_q2n COMMAND prefill_fused_iq_test "--only=Q2_0 / Q2_0" --unset-pf-fused)
      set_tests_properties(prefill_fused_iq_test_q2n PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_Q2N=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the Turing set (NOSTROMA_PF_FUSED_SM75=1): the canonical Q2_0 pair and the i-quant pairs with kernels on sm_75, against the reference and the int8 model with the edge shapes.
      # 77 on any card that is not a compute capability 7.5 one and does not emulate it (NOSTROMA_EMULATE_CC=75 on a bigger card, with a build whose device code has PTX for sm_75)
      add_test(NAME prefill_fused_iq_test_sm75 COMMAND prefill_fused_iq_test --turing --edge --no-timing)
      set_tests_properties(prefill_fused_iq_test_sm75 PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_SM75=1" SKIP_RETURN_CODE 77 TIMEOUT 900)
      # the opt-in NOSTROMA_PF_FUSED_NT=256 kernels (256 threads, two blocks a multiprocessor, two-pass weight loads) against the
      # same references; the batches of the test reach them through the Batch overload of experts_native (77 below sm_80)
      add_test(NAME prefill_fused_iq_test_nt256 COMMAND prefill_fused_iq_test)
      set_tests_properties(prefill_fused_iq_test_nt256 PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_NT=256" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_F16=1 (f16 mma, rounding level) and NOSTROMA_PF_FUSED_WS=1 (warp-specialized, the same F16 products;
      # about 101 KB of shared memory at its defaults, more than an sm_86 / sm_89 / sm_120 card's 99 KB, so it is set up on
      # sm_80 and sm_90 cards and the test skips (77) elsewhere)
      add_test(NAME prefill_fused_iq_test_f16 COMMAND prefill_fused_iq_test)
      set_tests_properties(prefill_fused_iq_test_f16 PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_F16=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      add_test(NAME prefill_fused_iq_test_ws COMMAND prefill_fused_iq_test)
      set_tests_properties(prefill_fused_iq_test_ws PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_WS=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_Q50=1 (phase 4 step 1): UD-IQ4_XS v31's Q5_0 down layers on the native kernels, against the reference
      # (this build has no Q5_0 MMQ), with the tails and tile boundaries the test adds for every Q5_0 pair (77 below sm_80)
      add_test(NAME prefill_fused_iq_test_q50 COMMAND prefill_fused_iq_test "--only=Q5_0" --no-timing)
      set_tests_properties(prefill_fused_iq_test_q50 PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_Q50=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # a launch whose expert blobs are not in device memory takes the unstaged kernel instead of ending the process (timing part only: one layer of 2,048 tokens, S20_NOMMQ because MMQ does not read host blobs)
      add_test(NAME prefill_fused_iq_test_hostblobs COMMAND prefill_fused_iq_test "--only=IQ3_S / IQ4_NL" --no-ref --chunks=2048 --host-blobs=1 --expect-fallback)
      set_tests_properties(prefill_fused_iq_test_hostblobs PROPERTIES ENVIRONMENT "S20_NOMMQ=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_KQ=1 (phase 4): UD-Q4_K_XL's Q4_K / Q5_K gate/up with Q5_1 / Q8_0 down on the native kernels, against the
      # reference and the int8 model at every shape (--edge), MMQ's K-quant library alongside (NOSTROMA_MMQ_KQ=1; 77 below sm_80)
      add_test(NAME prefill_fused_iq_test_kq COMMAND prefill_fused_iq_test "--only=K / Q" --edge --no-timing)
      set_tests_properties(prefill_fused_iq_test_kq PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_KQ=1;NOSTROMA_MMQ_KQ=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the weight-staging kernels of UD-Q4_K_XL's pairs (Q5_1 and Q8_0 downs) against the unstaged kernel: the same experts and routing run with device blobs (staged)
      # and host-mapped blobs (the unstaged fallback), every output bit equal (tails, a tile boundary and a 2,048-token chunk; 77 below sm_80)
      add_test(NAME prefill_fused_iq_test_kqbits COMMAND prefill_fused_iq_test "--only=K / Q" --bits-staged)
      set_tests_properties(prefill_fused_iq_test_kqbits PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_KQ=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_Q8D=1 (phase 4): the pinned UD-IQ4_XS's IQ3_S / Q8_0 and IQ4_XS / Q8_0 layers on the native kernels, against the
      # reference, the int8 model and MMQ at every shape (--edge; 77 below sm_80)
      add_test(NAME prefill_fused_iq_test_q8d COMMAND prefill_fused_iq_test "--only=S / Q8_0" --edge --no-timing)
      set_tests_properties(prefill_fused_iq_test_q8d PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_Q8D=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_Q8GU=1 (phase 4): the Q8_0 set's Q8_0 / Q8_0 layers on the native kernels, against the reference, the int8
      # model and MMQ at every shape (--edge; 77 below sm_80)
      add_test(NAME prefill_fused_iq_test_q8gu COMMAND prefill_fused_iq_test "--only=Q8_0 / Q8_0" --edge --no-timing)
      set_tests_properties(prefill_fused_iq_test_q8gu PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_Q8GU=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_Q6K=1 (phase 4): UD-Q6_K_XL's Q6_K gate/up with a Q8_0 down on the native kernels, against the reference, the
      # int8 model and MMQ's K-quant library (NOSTROMA_MMQ_KQ=1) at every shape (--edge; 77 below sm_80)
      add_test(NAME prefill_fused_iq_test_q6k COMMAND prefill_fused_iq_test "--only=Q6_K + Q8_0" --edge --no-timing)
      set_tests_properties(prefill_fused_iq_test_q6k PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_Q6K=1;NOSTROMA_MMQ_KQ=1" SKIP_RETURN_CODE 77 TIMEOUT 600)
      # the opt-in NOSTROMA_PF_FUSED_TQ=1 (phase 4): Gyro-S's TQK6 / TQK7 and Gyro-M's TQ2_T / TQ2_T layers on the native kernels, against a reference
      # from the format definition (fp16 codebook), the int8 model (the int8 codebook) and the overlay's trellis MMQ at every shape (--edge; 77 below sm_80)
      add_test(NAME prefill_fused_iq_test_tq COMMAND prefill_fused_iq_test "--only=+ T" --edge --no-timing)
      set_tests_properties(prefill_fused_iq_test_tq PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_TQ=1" SKIP_RETURN_CODE 77 TIMEOUT 900)
      # the same pairs as Hadamard-folded experts (the Gyro packs' form): the gate/up input and H rotated per 128 values with random signs; the
      # fused path's H rotation (set_down_rotation) against the host-side rotation of the reference and MMQ with its H rotated on the device
      add_test(NAME prefill_fused_iq_test_tqh COMMAND prefill_fused_iq_test "--only=+ T" --folded --edge --no-timing)
      set_tests_properties(prefill_fused_iq_test_tqh PROPERTIES ENVIRONMENT "NOSTROMA_PF_FUSED_TQ=1" SKIP_RETURN_CODE 77 TIMEOUT 900)
      # NVFP4 / NVFP4 (ModelOpt packs) on the native kernels: weights decoded from the 36-byte blocks, the blob's tail scales on the FP32 products; edge shapes too
      add_test(NAME prefill_fused_iq_test_nvfp4 COMMAND prefill_fused_iq_test "--only=NVFP4" --edge)
      set_tests_properties(prefill_fused_iq_test_nvfp4 PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 900)
    endif()
    if(NOSTROMA_BUILD_TESTS AND NOSTROMA_MMQ)   # (P4-SPLIT: MMQ's own tests, below too)
      # the MoE input quantized per token and scattered to its rows (mmq::quantize_scatter) against the per-row
      # gather: the same q8_1 bytes for every MMQ layout (--bench: both at 2K, 8K and 32K tokens)
      # the Unsloth v3.1 sets' expert formats through MMQ (Q5_0 down only in a NOSTROMA_ORCA_Q4KS_MMQ build), and --bench
      add_executable(prefill_mmq_v31_test tests/cuda/prefill_mmq_v31_test.cpp)
      target_link_libraries(prefill_mmq_v31_test PRIVATE nostroma_mmq nostroma_kernels ggml-base ${_nostroma_gpu_blas_target} ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_mmq_v31_test COMMAND prefill_mmq_v31_test)
      set_tests_properties(prefill_mmq_v31_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 300)
      add_executable(prefill_mmq_scatter_test tests/cuda/prefill_mmq_scatter_test.cpp)
      target_link_libraries(prefill_mmq_scatter_test PRIVATE nostroma_mmq ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_mmq_scatter_test COMMAND prefill_mmq_scatter_test)
      set_tests_properties(prefill_mmq_scatter_test PROPERTIES TIMEOUT 120)
      if(NOSTROMA_EXPERIMENTAL_SM60)
        # mmq::swiglu_quant: swiglu + the down product's q8_1 rows in one kernel against the two, byte for byte
        add_executable(prefill_swiglu_quant_test tests/cuda/prefill_swiglu_quant_test.cpp)
        target_link_libraries(prefill_swiglu_quant_test PRIVATE nostroma_mmq ggml-base ${_nostroma_gpu_runtime_target})
        add_test(NAME prefill_swiglu_quant_test COMMAND prefill_swiglu_quant_test)
        set_tests_properties(prefill_swiglu_quant_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 120)
        # the weight-stationary experts (NOSTROMA_MMQ_WS) against the per-group MMQ, byte for byte, on random experts; the
        # verdict is given on a compute capability 6.0 card only (77 elsewhere)
        add_executable(prefill_ws_parity_test tests/cuda/prefill_ws_parity_test.cpp)
        target_link_libraries(prefill_ws_parity_test PRIVATE nostroma_mmq ggml-base ${_nostroma_gpu_runtime_target})
        add_test(NAME prefill_ws_parity_test COMMAND prefill_ws_parity_test)
        set_tests_properties(prefill_ws_parity_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 600)
      endif()
    endif()
    if(NOSTROMA_BUILD_TESTS AND NOSTROMA_MMQ AND NOT NOSTROMA_HIP_GFX906)
      # NOSTROMA_IQ4_W4A8: the IQ4 W4A8 expert kernel against MMQ, bit for bit, on the group buffers and (with
      # NOSTROMA_MMQ_TAB) the pointer table (exit 77 without a card or off sm_80..sm_88; gfx906: a stub, no test)
      add_executable(prefill_iq4_w4a8_test tests/cuda/prefill_iq4_w4a8_test.cu)
      target_link_libraries(prefill_iq4_w4a8_test PRIVATE nostroma_mmq ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_iq4_w4a8_test COMMAND prefill_iq4_w4a8_test)
      set_tests_properties(prefill_iq4_w4a8_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 300)
    endif()
    if(NOSTROMA_BUILD_TESTS AND _nostroma_mmq_tab_on)
      # NOSTROMA_MMQ_DIRECT: the pointer-table MMQ bit for bit against the gathered MMQ (exit 77 below sm_80)
      add_executable(prefill_mmq_tab_test tests/cuda/prefill_mmq_tab_test.cu)
      target_link_libraries(prefill_mmq_tab_test PRIVATE nostroma_mmq ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_mmq_tab_test COMMAND prefill_mmq_tab_test)
      set_tests_properties(prefill_mmq_tab_test PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 600)
    endif()
    if(NOSTROMA_BUILD_TESTS AND NOSTROMA_MMQ AND NOSTROMA_MMQ_KQUANTS)
      # the UD-Q4_K_XL expert formats through MMQ against ggml's dequantized weights (synthetic, a few seconds)
      add_executable(prefill_mmq_kquant_test tests/cuda/prefill_mmq_kquant_test.cpp)
      target_link_libraries(prefill_mmq_kquant_test PRIVATE nostroma_mmq ggml-base ${_nostroma_gpu_runtime_target})
      add_test(NAME prefill_mmq_kquant_test COMMAND prefill_mmq_kquant_test)
      # the K-quant MMQ runs when NOSTROMA_MMQ_KQ=1 (the engine's default on NVIDIA 8.0+ and Linux gfx12; see the option above), and on CUDA it is nostroma_kq next to the test
      set_tests_properties(prefill_mmq_kquant_test PROPERTIES TIMEOUT 120 ENVIRONMENT NOSTROMA_MMQ_KQ=1)
    endif()
    # the NVFP4 expert products (w4a8 / w4a4, NOSTROMA_PREFILL_NVFP4) against a double-precision reference
    if(NOSTROMA_MMQ AND CMAKE_SYSTEM_PROCESSOR MATCHES "^(x86_64|AMD64|amd64|i[3-6]86)$")   # its FP16 rounding helper is the x86 F16C intrinsics: not built on aarch64
      add_executable(mmq_nvfp4_parity src/prefill/mmq_nvfp4_parity.cpp)
      target_link_libraries(mmq_nvfp4_parity PRIVATE nostroma_mmq ggml-base CUDA::cudart)
      if(NOT MSVC)   # GCC/Clang need the target flag
        target_compile_options(mmq_nvfp4_parity PRIVATE $<$<COMPILE_LANGUAGE:CXX>:-mf16c>)
      endif()
    endif()
    # the routed-expert products (MMQ) timed at the prompt path's shapes (16 experts a launch)
    if(NOSTROMA_MMQ)
    add_executable(mmq_expert_bench src/prefill/mmq_expert_bench.cpp)
    target_link_libraries(mmq_expert_bench PRIVATE nostroma_mmq ggml-base CUDA::cudart)
    endif()
endmacro()

# the CUDA local-memory spill check of the kernel libraries (cuobjdump)
macro(nostroma_cuda_spill_guard)
if(NOSTROMA_ENABLE_CUDA AND NOSTROMA_BUILD_TESTS AND NOT NOSTROMA_ENABLE_HIP AND NOT NOSTROMA_HIP_GFX906)
  find_package(Python3 QUIET COMPONENTS Interpreter)
  if(Python3_Interpreter_FOUND)
    set(_nostroma_spill_libs)
    foreach(_t nostroma_kernels nostroma_core nostroma_engine nostroma_prefill nostroma_qwen35 nostroma_mmq nostroma_pf_own nostroma_mmq_w4a4 nostroma_kq)
      if(TARGET ${_t})
        list(APPEND _nostroma_spill_libs $<TARGET_FILE:${_t}>)
      endif()
    endforeach()
    add_test(NAME cuda_spill_guard COMMAND ${Python3_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/tools/check_cuda_spills.py
             --cuobjdump ${CUDAToolkit_BIN_DIR}/cuobjdump${CMAKE_EXECUTABLE_SUFFIX} ${_nostroma_spill_libs})
    set_tests_properties(cuda_spill_guard PROPERTIES SKIP_RETURN_CODE 77 TIMEOUT 600)
    if(NOT WIN32)   # its stand-in demanglers are sh scripts
      add_test(NAME check_cuda_spills_unit COMMAND ${Python3_EXECUTABLE} -m unittest tools.test_check_cuda_spills
               WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
    endif()
  else()
    message(STATUS "nostroma: no python3 - the cuda_spill_guard test is NOT registered")
  endif()
endif()
endmacro()

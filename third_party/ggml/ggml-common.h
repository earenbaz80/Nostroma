// ggml-common.h - the old name of Nostroma's quantization header, kept as a forwarder for two releases (own-stack phase 1B).
//
// The text (block layouts, codebook grids and sign tables of every ggml format Nostroma's kernels read; llama.cpp's ggml/src/ggml-common.h at
// 3cf03257f219afbe7334045ff7c6a06ac68c627d, MIT, with one Nostroma edit) now lives in third_party/nostroma-ggml/nostroma-quant-common.h. New code includes
// that name; every existing `#include "ggml-common.h"` keeps working through this file. The Metal runtime reads nostroma-quant-common.h's TEXT (it
// cannot follow an #include), and the Mac package ships that file plus a full-text copy under this old name for two releases.
#include "../nostroma-ggml/nostroma-quant-common.h"

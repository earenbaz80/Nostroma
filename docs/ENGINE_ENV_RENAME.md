# The engine's settings are named NOSTROMA_

The engine reads its settings under one prefix: `NOSTROMA_<SETTING>`. There is no second name and no fallback. A
setting that is not present under that name is simply unset.

The resolver in `include/nostroma/env.hpp` is the one place the engine reads a runtime setting. The Terminal and the
app use the same prefix (`nostroma_control/envnames.py` and `apps/host/server/env-compat.mjs`).

Compile-time switches are also named `NOSTROMA_*`. They come from the build and have no runtime fallback.

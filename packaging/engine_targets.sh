# packaging/engine_targets.sh - the engine targets a configured build tree has (sourced, POSIX sh).
#
#   targets=$(engine_targets <cmake> <build dir>)
#   "$cmake" --build "$build" --target $targets ...
#
# Prints "nostroma nostroma_kq" when the tree has the nostroma_kq target (libnostroma_kq.so, the K-quant prompt kernels of a build with
# llama.cpp's MMQ, -DNOSTROMA_MMQ=ON) and "nostroma" when it has not (NOSTROMA_MMQ=OFF, the default). The build tree is asked
# (a dry run of nostroma_kq), not the configure line: whether nostroma_kq exists also depends on NOSTROMA_MMQ_KQUANTS and on defaults
# the line need not name. Any other failure of the dry run stops the build instead of leaving the library out.
engine_targets() {
  if _et_probe=$("$1" --build "$2" --target nostroma_kq -- -n 2>&1); then
    echo "nostroma nostroma_kq"
    return 0
  fi
  case "$_et_probe" in
    *"unknown target 'nostroma_kq'"*|*"No rule to make target"*nostroma_kq*) echo "nostroma" ;;
    *) printf '%s\n' "$_et_probe" >&2
       echo "engine_targets.sh: cannot tell whether the build tree $2 has the nostroma_kq target" >&2
       return 1 ;;
  esac
}

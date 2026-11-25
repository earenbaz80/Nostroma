#!/usr/bin/env bash
# nostroma-sycl.sh: the SYCL-built engine as a drop-in `exe` for serve/server.py (--engine nostroma). The port's binary
# needs the oneAPI runtime of the dev image, so this runs it there with stdin/stdout attached (the serve protocol is
# lines on those pipes) and stderr going to the server's log. Paths in the config's args are the container's:
# the data root is mounted at /work.
#   NOSTROMA_SYCL_ROOT   host directory mounted at /work        (default: two levels above this script's repo)
#   NOSTROMA_SYCL_IMAGE  the runtime image                      (default: nostroma-sycl-dev)
#   NOSTROMA_SYCL_BIN    the engine binary, relative to the repo (default: build-sycl-aot/nostroma)
#   NOSTROMA_SYCL_NAME   the container's name                   (default: nostroma-sycl-serve)
#   NOSTROMA_SYCL_SHM    1 (default): the host's /dev/shm is the container's /dev/shm. Pictures: the server (on the host) writes the
#                      image embeddings of a request into /dev/shm and names that file on the engine's GENI line, so the engine in
#                      the container must see the same file. 0: the container keeps a private /dev/shm.
# The engine runs as the account that started the server (docker run -u $(id -u):$(id -g)), never as root: what it writes under the
# data root (the NOSTROMA_CACHE_DIR below) stays that account's, and the picture-embedding file serve/server.py leaves in /dev/shm
# belongs to the same account that reads it in the container. `-u` keeps only this account's own gid, so the gids of /dev/dri's
# render and video nodes are passed with --group-add: without them Level Zero finds no device and the engine stops at its start.
# NOT TESTED ON AN INTEL ARC YET: the account, the /dev/dri gids and the cache folder were checked on a machine with a render node
# (renderD128, gid 990), but the engine was not run. If it stops saying it found no device, the gid to pass is
# `stat -c %g /dev/dri/renderD128` (109 is the usual one).
# Passed into the container: every variable of this script's environment that starts with NOSTROMA_ (the config's
# "env" block arrives that way: the server puts it in the engine's environment), ONEAPI_ (level_zero:* for a
# two-card split, #423), UR_, IGC_, SYCL_ or ZES_. The port's own defaults (below) are overridden the same way,
# e.g. "env": {"NOSTROMA_VERIFY_NO_HOST": "0"} in the config.
set -euo pipefail
here=$(cd "$(dirname "$0")/../.." && pwd)                 # the repo
root=${NOSTROMA_SYCL_ROOT:-$(dirname "$here")}
repo_in=/work/$(basename "$here")
name=${NOSTROMA_SYCL_NAME:-nostroma-sycl-serve}
docker rm -f "$name" >/dev/null 2>&1 || true              # a container left behind by a killed server
args=""
for a in "$@"; do args+=" $(printf '%q' "$a")"; done
# the port's run-time switches: the device-built verify plan, and no host handshakes in it. NO_HOST is for a card on
# the xe driver (the host<->GPU flag stores are not visible there); an i915 card (Arc A-series) runs without it
# (docs/INTEL.md)
# NOSTROMA_CACHE_DIR: the engine's measurements that outlive a run (the int8 prompt experts' crossover, measured at
# the first prompt of each format: ~1.4 s of a B70's first 2K prompt) - under the mounted data root, not in the
# throwaway container's home
# the container writes that folder as you now (it used to be root), so it is made here: a folder left owned by root by an older run
# would silently lose every measurement
declare -A setting=([NOSTROMA_VERIFY_DEVICE_PLAN]=1 [NOSTROMA_VERIFY_NO_HOST]=1 [NOSTROMA_STAGER_THREADS]=12
                    [NOSTROMA_CACHE_DIR]=/work/.nostroma-cache)

cache=$root/.nostroma-cache
mkdir -p "$cache" 2>/dev/null || true
[ -w "$cache" ] || echo "nostroma-sycl.sh: $cache is not writable by $(id -un): the engine's measurements are not kept (fix: chown -R $(id -u):$(id -g) \"$cache\")" >&2
while IFS= read -r k; do
    case "$k" in
        NOSTROMA_SYCL_*) ;;                                 # this script's own settings
        NOSTROMA_*|ONEAPI_*|UR_*|IGC_*|SYCL_*|ZES_*|NEOReadDebugKeys|OverrideDefaultFP64Settings) setting[$k]=${!k} ;;
    esac
done < <(compgen -e)
envs=()
for k in "${!setting[@]}"; do
    # the engine tests the switches by presence: a value of 0 (or empty) means "not set", so it is not passed on
    case "${setting[$k]}" in 0|"") ;; *) envs+=(-e "$k=${setting[$k]}") ;; esac
done
shm=()
if [ "${NOSTROMA_SYCL_SHM:-1}" != 0 ] && [ -d /dev/shm ]; then shm=(-v /dev/shm:/dev/shm); fi
# /dev/dri's nodes belong to the host's render and video groups (990 and 44 on the machine this was written on); `-u` keeps only this
# account's gid, so each of those gids is added to the container's groups. 109 is the usual render gid when /dev/dri cannot be read.
mapfile -t gids < <(for node in /dev/dri/renderD* /dev/dri/card*; do
                       if [ -e "$node" ]; then stat -c '%g' "$node"; fi
                   done | sort -u)
[ "${#gids[@]}" -gt 0 ] || gids=(109)
groups=()
for g in "${gids[@]}"; do
    [ "$g" = "$(id -g)" ] || groups+=(--group-add "$g")
done
exec docker run --rm -i --name "$name" --device /dev/dri --oom-score-adj 1000 --stop-timeout 30 --no-healthcheck \
    --ulimit memlock=-1 \
    -u "$(id -u):$(id -g)" \
    "${groups[@]}" \
    -v "$root:/work" \
    "${shm[@]}" \
    "${envs[@]}" \
    "${NOSTROMA_SYCL_IMAGE:-nostroma-sycl-dev}" \
    "cd $repo_in && exec ${NOSTROMA_SYCL_BIN:-build-sycl-aot/nostroma}$args"

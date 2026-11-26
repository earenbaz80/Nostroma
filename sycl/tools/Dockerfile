# Nostroma SYCL port - development image for the Intel Arc path.
# It runs as root on purpose: this is an interactive toolbox (oneAPI, dpct, ninja, the CUDA headers dpct parses), not a service -
# no port, no /data, nothing to serve, and nothing published: no release ships it and no user is told to run it. The build commands
# in docs/INTEL.md run it with -u $(id -u):$(id -g), so what they write in build-sycl/ stays yours, and the engine serves from an
# image built on this one through sycl/serve/nostroma-sycl.sh, which runs as your account too. Root is only what lets you apt-get
# install or clone into /opt inside a throwaway shell.
# audit: root-ok — caja de herramientas interactiva, no se publica, se usa con -u $(id -u):$(id -g) (docs/INTEL.md)
# Base: the llama.cpp SYCL image already on the box (oneAPI 2026.1 compiler, MKL, Level Zero for Xe2), pinned to the
# digest `stable` resolved to on 26 November 2026 (a multi-arch index, so each machine still gets its platform's
# manifest). It no longer moves by itself: `docker build --pull` re-pulls this same digest. To move it, resolve the tag
# again and change the digest here in one commit (Dockerfile.unitrace pins the same one):
#   docker buildx imagetools inspect ghcr.io/snailium/llama.cpp-sycl-intel-b70/llama-sycl-b70:stable
# Adds SYCLomatic (dpct, "Intel DPC++ Compatibility Tool") for the CUDA -> SYCL migration, and the build tools.
FROM ghcr.io/snailium/llama.cpp-sycl-intel-b70/llama-sycl-b70:stable@sha256:f040fa361d70e8d8b07c8cebdd0b59dc22062aa01b14c016c5fc94cd70a598ce
RUN apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
      intel-oneapi-dpcpp-ct ninja-build unzip python3-pip python3-venv rsync \
    && rm -rf /var/lib/apt/lists/*
ENV ONEAPI_DEVICE_SELECTOR=level_zero:0 SYCL_CACHE_PERSISTENT=0 ZES_ENABLE_SYSMAN=1
ENTRYPOINT ["/bin/bash", "-lc"]

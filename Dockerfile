# Nostroma, built FROM SOURCE (NVIDIA CUDA 13). The engine is compiled here, packaged as an engine component package and then
# installed into the same runtime image as the ready-made ones (docker/Dockerfile): same Terminal, same entrypoint, same /data volume.
#
# Most people want the ready-made images instead (nothing compiled): docs/DOCKER.md.
#
#   docker build -t nostroma:src .                                        # RTX 20/30/40/50 (compiles for each, ~25 min)
#   docker build -t nostroma:src --build-arg CUDA_ARCHITECTURES=86 .      # one card only (faster); 86 = RTX 30, 89 = RTX 40, 120 = RTX 50
#   docker build -t nostroma:src-cuda12 --build-arg CUDA_IMAGE=nvidia/cuda:12.9.1-devel-ubuntu24.04 \
#              --build-arg CUDA_ARCHITECTURES="60;61;70;75;80;86;89" --build-arg BUILD_VISION=0 .   # GTX 10 / P100 / V100 (driver 575+)
#   docker run --rm --gpus all -p 127.0.0.1:8080:8080 --ulimit memlock=-1 --shm-size 2g --stop-timeout 120 \
#              -v nostroma-data:/data -e MODEL=IQ3_XXS -e API_KEY=change-me-please-123 nostroma:src
#
# docker build has no GPU, so the CUDA architectures are given here instead of read from nvidia-smi. The engine is a fat binary with
# a machine-code part per listed architecture (plus PTX for the newest, which later cards can JIT), and the runtime picks the one
# matching your card. Narrow CUDA_ARCHITECTURES to your card for a faster build. Native code for the CPU that builds the image is NOT
# used (NOSTROMA_PORTABLE=ON), so the image runs on any x86-64 CPU with AVX2.
#
# Plain legacy-builder features only (no heredocs, no --mount). AMD (HIP) and Intel (SYCL) source builds: docs/AMD_HIP.md, docs/INTEL.md.

# Base images pinned by digest: a tag can be moved to other bytes later, a digest cannot. The tag stays in front of the digest so
# the next reader knows which release it is; to move to a newer base, replace the digest (it is the tag's Docker-Content-Digest):
#   docker buildx imagetools inspect ubuntu:24.04 --format '{{.Manifest.Digest}}'
ARG CUDA_IMAGE=nvidia/cuda:13.0.0-devel-ubuntu24.04@sha256:1e8ac7a54c184a1af8ef2167f28fa98281892a835c981ebcddb1fad04bdd452d
ARG RUNTIME_BASE=ubuntu:24.04@sha256:73b999393d07f2bf65a40373778a44dc9a6d54ad7718d29247d8ff9413c4d6a8

# ---- 1. compile the engine and make its component package
FROM ${CUDA_IMAGE} AS engine-build
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PATH=/venv/bin:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential ca-certificates git libgomp1 libatomic1 python3 python3-pip python3-venv unzip \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
ARG CUDA_ARCHITECTURES="75;80;86;89;120"
ARG BUILD_VISION=1
ARG ENGINE_VERSION=
RUN python3 -m venv /venv && /venv/bin/pip install --no-cache-dir -r requirements.txt -r requirements-build.txt
# ggml comes from the vendored third_party/nostroma-ggml and nostroma-vision from third_party/nostroma-llama (llama, mtmd, ggml at the pin): nothing is downloaded
RUN set -e; \
    real=""; for a in $(echo "$CUDA_ARCHITECTURES" | tr ';,' '  '); do real="$real;${a}-real"; done; real=${real#;}; \
    last=$(echo "$CUDA_ARCHITECTURES" | tr ';,' '  ' | awk '{print $NF}'); \
    sm60=OFF; for a in $(echo "$CUDA_ARCHITECTURES" | tr ';,' '  '); do if [ "$a" -lt 75 ]; then sm60=ON; fi; done; \
    /venv/bin/cmake -G Ninja -S . -B build -DCMAKE_BUILD_TYPE=Release -DNOSTROMA_ENABLE_CUDA=ON -DNOSTROMA_BUILD_TESTS=OFF \
        -DNOSTROMA_EXPERIMENTAL_SM60=$sm60 \
        -DNOSTROMA_NATIVE_EXPERTS=ON -DNOSTROMA_PORTABLE=ON -DNOSTROMA_Q6K_EXPERTS=ON -DNOSTROMA_MMQ_KQUANTS=ON \
        "-DCMAKE_CUDA_ARCHITECTURES=${real};${last}-virtual"; \
    . packaging/engine_targets.sh; targets=$(engine_targets /venv/bin/cmake build); \
    /venv/bin/cmake --build build --target $targets -j "$(nproc)"; \
    if [ "$BUILD_VISION" = "1" ]; then \
      /venv/bin/cmake -G Ninja -S tools/vision -B build-vision -DCMAKE_BUILD_TYPE=Release \
          -DNOSTROMA_VISION_CUDA=ON -DNOSTROMA_PORTABLE=ON -DGGML_CUDA_NCCL=OFF "-DCMAKE_CUDA_ARCHITECTURES=${real};${last}-virtual"; \
      /venv/bin/cmake --build build-vision --target nostroma-vision -j "$(nproc)"; \
    fi
RUN set -e; \
    mkdir -p /stage /engine; \
    cp build/nostroma /stage/; \
    [ -f build/libnostroma_kq.so ] && cp build/libnostroma_kq.so /stage/ || true; \
    [ -f build-vision/bin/nostroma-vision ] && cp build-vision/bin/nostroma-vision /stage/ || true; \
    ver="${ENGINE_VERSION:-$(sed -n 's/^[[:space:]]*project([^)]*VERSION[[:space:]]*\([0-9][0-9.]*\).*/\1/p' CMakeLists.txt | head -1)}"; \
    cudafull=$(nvcc --version | sed -n 's/.*release \([0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -1); cudamajor=${cudafull%%.*}; \
    if [ "$cudamajor" = 13 ]; then mindriver=580.65; else mindriver=575.51; fi; \
    vision_archs=""; [ -f /stage/nostroma-vision ] && vision_archs=", \"vision_archs\": \"$CUDA_ARCHITECTURES\""; \
    echo "{\"version\": \"$ver\", \"source\": \"docker build\", \"archs\": \"$CUDA_ARCHITECTURES\", \"cuda\": \"$cudafull\", \"portable\": true${vision_archs}}" > /stage/BUILD.json; \
    python3 packaging/collect_libs.py --binary build/nostroma --search /usr/local/cuda/lib64 --out /stage --also 'libcublasLt.so*'; \
    archs=""; for a in $(echo "$CUDA_ARCHITECTURES" | tr ';,' '  '); do archs="$archs --arch sm_$a"; done; \
    last=$(echo "$CUDA_ARCHITECTURES" | tr ';,' '  ' | awk '{print $NF}'); \
    python3 packaging/package_engine.py --src /stage --backend cuda --version "$ver" --out /engine $archs --arch "compute_$last" \
        --min-driver nvidia=$mindriver --variant cuda$cudamajor --platform linux-x86_64 --build-id "docker-source-${ver}-cuda${cudafull}" --include SYSTEM-LIBS.txt --include 'libnostroma_kq*' \
        --include nostroma-vision; \
    for d in /engine/*/; do python3 packaging/package_engine.py --verify "$d"; python3 packaging/binary_deps.py "$d"; done

# ---- 2. the Terminal (the release archive, built here)
FROM ${RUNTIME_BASE} AS terminal
ARG NOSTROMA_COMMIT=
ENV NOSTROMA_BUILD_COMMIT=${NOSTROMA_COMMIT}
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates git && rm -rf /var/lib/apt/lists/*
COPY . /src/
RUN python3 /src/packaging/package_terminal.py --out /out --cache /cache \
 && mkdir -p /opt/nostroma \
 && tar -xzf /out/nostroma-terminal-*-linux-x86_64.tar.gz -C /opt/nostroma \
 && mv /opt/nostroma/nostroma-terminal-* /opt/nostroma/terminal \
 && /opt/nostroma/terminal/bin/nostroma --version
# gguf-py (the model preparation tools) is part of the Terminal archive (third_party/nostroma-gguf-py), so the first start fetches nothing from
# GitHub and the image needs no llama.cpp: check that it is there
RUN test -f /opt/nostroma/terminal/third_party/nostroma-gguf-py/gguf/__init__.py

# ---- 3. the runtime image (the same as docker/Dockerfile's, FLAVOR=cuda), which runs as an unprivileged account
FROM ${RUNTIME_BASE}
ARG NOSTROMA_VERSION=dev
# The container runs as this account, never as root: the server, the engine and the Terminal need no privilege. 1000 is the account
# on most Linux desktops, so a folder mounted from the host (a model folder, a data folder) usually belongs to the same number.
# Rebuild with --build-arg APP_UID=$(id -u) --build-arg APP_GID=$(id -g) when yours is different.
ARG APP_USER=nostroma
ARG APP_UID=1000
ARG APP_GID=1000
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates libgomp1 libatomic1 libnuma1 zlib1g \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*
COPY --chown=${APP_UID}:${APP_GID} --from=terminal /opt/nostroma/terminal /opt/nostroma/terminal
COPY --chown=${APP_UID}:${APP_GID} --from=engine-build /engine/ /opt/nostroma/components/engine/
COPY docker/entrypoint.sh docker/healthcheck.sh /opt/nostroma/
# Both names, one wrapper: `nostroma` is the command, and `nostroma` is the name it had before (install.sh links both too).
COPY docker/nostroma-wrapper.sh /usr/local/bin/nostroma
COPY docker/nostroma-wrapper.sh /usr/local/bin/nostroma
RUN chmod 0755 /opt/nostroma/entrypoint.sh /opt/nostroma/healthcheck.sh /usr/local/bin/nostroma /usr/local/bin/nostroma
# The account the container runs as, and the folders it writes. /data is created here and belongs to that account, so a NEW named
# volume mounted there inherits the ownership (Docker fills an empty volume from the image's folder). This runs before VOLUME:
# the builder discards any change made to a folder after it has been declared a volume. The components folder belongs to the
# account down to its files too: the feed cache and `nostroma update` write there, and an update removes the old engine's folders (a
# tree left owned by root cannot be deleted by the account).
RUN set -e; \
    groupadd --gid "${APP_GID}" "${APP_USER}"; \
    useradd --uid "${APP_UID}" --gid "${APP_GID}" --no-create-home --home-dir /data/home --shell /usr/sbin/nologin "${APP_USER}"; \
    install -d -m 0755 -o "${APP_UID}" -g "${APP_GID}" /data /data/home /data/state /data/install /data/config /data/Nostroma-data; \
    chown -R "${APP_UID}:${APP_GID}" /opt/nostroma/components
ENV NOSTROMA_COMPONENTS_DIR=/opt/nostroma/components NOSTROMA_INSTALL_DIR=/data/install XDG_STATE_HOME=/data/state \
    XDG_CONFIG_HOME=/data/config HOME=/data/home PORT=8080 LANG=C.UTF-8 PYTHONUNBUFFERED=1 PYTHONNOUSERSITE=1 NOSTROMA_IN_DOCKER=1 \
    NVIDIA_VISIBLE_DEVICES=all NVIDIA_DRIVER_CAPABILITIES=compute,utility
VOLUME ["/data"]
EXPOSE 8080
LABEL org.opencontainers.image.title="Nostroma" com.nostroma.flavor="cuda" com.nostroma.build="from-source" org.opencontainers.image.version="${NOSTROMA_VERSION}"
HEALTHCHECK --interval=30s --timeout=8s --start-period=2h --retries=3 CMD ["/opt/nostroma/healthcheck.sh"]
STOPSIGNAL SIGTERM
# Everything above ran as root (packages, copies, the linker check). From here every process in the container is this account, and
# /data/home is where it starts, so a program that writes a file in its working folder lands in the volume.
USER ${APP_UID}:${APP_GID}
WORKDIR /data/home
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/nostroma/entrypoint.sh"]
CMD ["run"]

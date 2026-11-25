// src/image/dit/qi21_rope_main.cpp - test program nostroma-dit-rope (not shipped): writes our RoPE table for a picture.
//   nostroma-dit-rope <text tokens> <H> <W> <out.bin>      float32, 256 a token, text tokens first
#include "nostroma/image/qi21_rope.hpp"

#include <cstdio>
#include <cstdlib>

int main(int argc, char** argv) {
    if (argc < 5) {
        std::fprintf(stderr, "usage: nostroma-dit-rope <text tokens> <H> <W> <out.bin>\n");
        return 2;
    }
    const auto t = nostroma::image::qi21_rope_table(
        nostroma::image::qi21_positions(std::atoll(argv[1]), std::atoll(argv[2]), std::atoll(argv[3])));
    FILE* f = std::fopen(argv[4], "wb");
    if (!f) return 2;
    std::fwrite(t.data(), sizeof(float), t.size(), f);
    std::fclose(f);
    return 0;
}

// src/qwen35/q36_main.cpp - nostroma-q36: the Qwen3.6 engine path on its own (the same entry point `nostroma` switches
// to for a qwen35moe model).
#include "nostroma/qwen35/engine.hpp"

int main(int argc, char** argv) { return nostroma::qwen35::run(argc, argv); }

# Nostroma standard benchmark: NVIDIA GeForce RTX 5060 Ti

Protocol `nostroma-qwen38-thinking-v1-draft.1` (draft), run `20261124T181332Z-94f4616b`, started 2026-11-24T18:13:32Z. **Status: nonconforming.**

Written by `nostroma bench run`. The machine-readable result is [results.json](results.json); every request, its raw usage and timings and the client event offsets are in [outputs.jsonl](outputs.jsonl).

This run is not a complete standard result:

- no model file could be hashed

## Hardware and software

- GPU: NVIDIA GeForce RTX 5060 Ti (15.9 GiB dedicated)
- CPU: 11th Gen Intel(R) Core(TM) i7-11700F @ 2.50GHz; RAM: 63.9 GiB
- Storage of the model files: not measured
- OS: Windows 10.0.26200; drivers: gpu-driver 621.24; runtime: cuda 13.5
- Nostroma commit: `7ace127d5e85f2fd8ce4f8a1d91cd8810a8ed701`; engine 0.1.61; source build
- Background work: not measured

## Model and configuration

- Model: qwen3.8-flash-next-iq3_s; quantization IQ3_S; revision not measured; source revision not measured
- Files: not measured
- Track: **custom** (0.1.61 built from HEAD (the tree before the rename) and 0.1.62 from the working tree; both CUDA 120-real, NOSTROMA_PORTABLE=ON, tests OFF; same pack, config, serve wrapper and corpus)
- Context 32768 tokens; server capacity 1 slot(s)
- Sampling: temperature 1.0, top_p 0.95, top_k 20, min_p 0.0, presence_penalty 0.0, repetition_penalty 1.0, reasoning_effort xhigh; thinking on, preserved
- Engine options: `config.json`; chat template: `provenance/chat_template.jinja`

## Method

The frozen requests of `bench/prompts/standard-v1` (corpus `74c07c5ec7e03f24...`) were sent over loopback HTTP, streaming, one at a time, in this order: 1 warm-up (excluded), 3 repetitions of the short, 4K and 16K prompts, and the twelve sanity checks. Prompt and decode speed are the engine's own `timings`; time to first token is the client's monotonic clock from dispatch to the first nonempty reasoning, answer or tool-call delta. No request was retried. Time after the model loaded: 3 min 27 s.

## Results

| Case | Prompt tok/s | Decode tok/s | TTFT s | First answer s | Total s | Capped |
| --- | --- | --- | --- | --- | --- | --- |
| short | n/a | 45.2 (43.9-46.9) n=3 | 1.02 (0.90-1.02) n=3 | 4.50 (2.72-6.43) n=3 | 10.4 (8.5-10.5) n=3 | 0/3 |
| prompt-4k | 1021.7 (981.6-1040.0) n=3 | 39.2 (37.5-41.3) n=3 | 4.04 (3.99-4.22) n=3 | 16.61 (16.61-16.61) n=1 | 17.1 (16.6-17.6) n=3 | 3/3 |
| prompt-16k | 1756.4 (1748.7-1954.0) n=3 | 43.0 (41.2-54.0) n=3 | 9.39 (8.45-9.46) n=3 | 17.45 (17.45-17.45) n=1 | 20.3 (18.9-21.8) n=3 | 3/3 |

Cells are median (min-max) n=samples. Short is a prompt of about 80 tokens: its prompt rate is dominated by the fixed cost of a request, so it is not shown; read prompt speed from prompt-4k and prompt-16k. Capped = requests that reached the 512-token cap, reasoning and answer together. A capped request's total time is the time to the cap, not to an answer, and it has no first-answer time when it was still reasoning.

| Phase | Planned | Completed | Truncated | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| warmup | 1 | 0 | 1 | 0 | 0 |
| performance | 9 | 3 | 6 | 0 | 0 |
| sanity | 12 | 12 | 0 | 0 | 0 |
| concurrency | 0 | 0 | 0 | 0 | 0 |

Sanity checks: **12 of 12**.

| Case | Result | Reason |
| --- | --- | --- |
| I1 | pass | the expected JSON value |
| I2 | pass | the expected JSON value |
| I3 | pass | the expected JSON value |
| I4 | pass | the exact expected text |
| R1 | pass | the exact expected text |
| R2 | pass | the exact expected text |
| R3 | pass | the exact expected text |
| R4 | pass | the expected JSON value |
| T1 | pass | the expected tool call |
| T2 | pass | the expected tool call |
| T3 | pass | the expected tool call |
| T4 | pass | the expected tool call |

## Failures, exclusions and limitations

- No request failed.
- Excluded from speed summaries: performance-prompt-16k-r1: first_answer_s is not available for this request
- Excluded from speed summaries: performance-prompt-16k-r3: first_answer_s is not available for this request
- Excluded from speed summaries: performance-prompt-4k-r2: first_answer_s is not available for this request
- Excluded from speed summaries: performance-prompt-4k-r3: first_answer_s is not available for this request
- Prompt-prefix reuse is the shared template prefix only; the cache was not emptied between requests, and the expert cache stays warm and evolves. These are not cold-model measurements.
- Output caps include reasoning; a request that reaches its cap is `truncated` and fails its sanity check.
- The runner cannot see other programs on the machine, the repeat-stop and loop-recovery switches of the server, or the quantization repository's revision; see `missing` in results.json for every value it could not read.
- The server had answered no request before this run (a freshly loaded engine).

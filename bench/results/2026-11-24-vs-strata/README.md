# Nostroma vs Strata: same machine, same model, same context and slots

Run: `2026-11-24T14:25:33Z` · **head-to-head measurement, not the standard benchmark protocol**.

## What was held equal

- Machine: NVIDIA GeForce RTX 5060 Ti (621.24), Intel64 Family 6 Model 167 Stepping 1, GenuineIntel, 8 cores / 16 threads, 63.9 GiB RAM, Windows 11.
- Model: `Qwen3.8-Flash-Next-GSQ-RCO-IQ3_S`, the same two GGUF shards and the same IQ3_S pack for both arms.
- Context: 32,768 tokens. KV: int8. Request slots: 1 (one request at a time).
- Expert cache: auto. VRAM reserve: 1536 MiB. Vision: off.
- Drafter: DFlash2, `--spec 6`, `--draft-conf 0.7`, the same pack and draft vocabulary.
- Expert profile: `expert-profile.bin`, the same file (SHA-256 identical in both installs).
- Each arm ran its own installed server: Nostroma 0.2.16 with engine 0.1.61, Strata 0.2.13 with engine 0.1.59.

## Method

- 5 rounds, alternating which arm starts first. Every arm is a fresh server and a fresh model load.
- The bundle carries 3 frozen prompt pairs, so rounds 4 to 5 reuse them in rotation (round 4 uses pair 1 again). Each reuse runs on a fresh server, and `prompt_round` in `results.json` says which pair a round used.
- Load time is wall-clock from server start to the first `GET /health` that answers `status: ok`.
- One short warm-up request is sent and excluded. Then the frozen 4K and 16K performance prompts run once each,
  streamed, thinking off, temperature 0, seed 1, at most 256 output tokens.
- TTFT is client monotonic time from dispatch to the first non-empty content/reasoning/tool-call delta.
- Prompt and decode tok/s are the engine's own `timings.prompt_per_second` and `timings.predicted_per_second`.
- Process reads are the process tree's Windows read-byte delta between `/health` and the end of the requests.
  They are a logical-read proxy, not a physical drive counter, and in arena mode they are not expert spill.
- VRAM is polled from `nvidia-smi` every 0.5 s; RSS is the server + engine process tree. Peaks include load.

## Results

Every cell is **median [min–max]** over the rounds. `n` is in `results.json`; a missing value is not zero.

### 4K prompt

| Metric | Nostroma | Strata |
| --- | ---: | ---: |
| TTFT (s) | 4.141 [4.127–4.164] | 4.556 [4.556–4.570] |
| Prompt tok/s | 988.0 [987.3–991.8] | 897.1 [894.3–898.1] |
| Decode tok/s | 48.6 [46.9–49.2] | 50.9 [47.1–52.0] |
| Total request (s) | 9.38 [9.30–9.56] | 9.57 [9.45–9.98] |

### 16K prompt

| Metric | Nostroma | Strata |
| --- | ---: | ---: |
| TTFT (s) | 8.085 [8.067–8.097] | 8.889 [8.867–8.904] |
| Prompt tok/s | 2032.9 [2030.5–2037.9] | 1847.7 [1845.7–1853.5] |
| Decode tok/s | 58.9 [56.1–60.1] | 61.2 [60.6–63.1] |
| Total request (s) | 12.41 [12.30–12.63] | 13.07 [12.93–13.08] |

### Load, spill and memory

| Metric | Nostroma | Strata |
| --- | ---: | ---: |
| Load to /health (s) | 37.51 [36.49–37.60] | 42.94 [40.38–43.97] |
| Expert spill (MB) | 0 [0–0] | 0 [0–0] |
| Process reads during requests (MB) | 80.2 [73.5–84.4] | 137.3 [131.3–138.9] |
| Process reads, whole run (MB) | 52327.3 [52320.5–52331.4] | 52767.0 [52761.5–52769.0] |
| VRAM peak (MiB) | 14679 [14679–14679] | 14589 [14587–14589] |
| VRAM above idle (MiB) | 13879 [13879–13879] | 13789 [13787–13789] |
| Process tree RSS peak (GiB) | 49.12 [49.12–49.12] | 48.94 [48.94–48.95] |
| System used above idle (GiB) | 49.88 [49.84–49.89] | 49.70 [49.67–49.71] |

- Expert arena loaded at start: Nostroma `46.84` GiB; Strata `46.84` GiB.
- Startup mode: Nostroma `arena`; Strata `arena`.
- Expert spill: **0 in both arms** (arena mode: every expert was loaded into the arena). The process reads
  during requests are PLE/table and other file reads, not experts read from the SSD.
- Prompt cache: **0 reused tokens in every request**; the round's two frozen prompts differ from each other and each arm loads them cold.

### Confirmation against the earlier run

`2026-11-24-vs-strata-r3` and this run, both read from their `summary.csv`. Δ is this run's median against the earlier one: negative is lower, which is better for times and memory and worse for tok/s.

| Case | Metric | Arm | Earlier | This run | Δ |
| --- | --- | --- | ---: | ---: | ---: |
| 4K | TTFT (s) | Nostroma | 4.27 [4.21–5.38] | 4.14 [4.13–4.16] | -3.0% |
| 4K | TTFT (s) | Strata | 4.69 [4.65–4.88] | 4.56 [4.56–4.57] | -2.9% |
| 4K | Prompt tok/s | Nostroma | 958.0 [758.7–970.9] | 988.0 [987.3–991.8] | +3.1% |
| 4K | Prompt tok/s | Strata | 871.0 [837.3–878.9] | 897.1 [894.3–898.1] | +3.0% |
| 4K | Decode tok/s | Nostroma | 47.7 [45.9–48.7] | 48.6 [46.9–49.2] | +1.9% |
| 4K | Decode tok/s | Strata | 48.4 [47.7–50.5] | 50.9 [47.1–52.0] | +5.2% |
| 4K | Total request (s) | Nostroma | 9.55 [9.50–10.92] | 9.38 [9.30–9.56] | -1.7% |
| 4K | Total request (s) | Strata | 9.99 [9.74–10.14] | 9.57 [9.45–9.98] | -4.3% |
| 16K | TTFT (s) | Nostroma | 8.25 [8.23–8.47] | 8.09 [8.07–8.10] | -2.0% |
| 16K | TTFT (s) | Strata | 9.04 [9.01–9.09] | 8.89 [8.87–8.90] | -1.6% |
| 16K | Prompt tok/s | Nostroma | 1995.8 [1938.4–1996.2] | 2032.9 [2030.5–2037.9] | +1.9% |
| 16K | Prompt tok/s | Strata | 1817.4 [1808.2–1825.2] | 1847.7 [1845.7–1853.5] | +1.7% |
| 16K | Decode tok/s | Nostroma | 58.2 [57.2–58.6] | 58.9 [56.1–60.1] | +1.2% |
| 16K | Decode tok/s | Strata | 59.0 [55.0–59.8] | 61.2 [60.6–63.1] | +3.7% |
| 16K | Total request (s) | Nostroma | 12.62 [12.58–12.93] | 12.41 [12.30–12.63] | -1.7% |
| 16K | Total request (s) | Strata | 13.35 [13.26–13.71] | 13.07 [12.93–13.08] | -2.1% |
| Load | Load to /health (s) | Nostroma | 38.47 [37.48–39.60] | 37.51 [36.49–37.60] | -2.5% |
| Load | Load to /health (s) | Strata | 43.05 [41.55–43.54] | 42.94 [40.38–43.97] | -0.3% |
| Memory | Expert spill (MB) | Nostroma | 0 [0–0] | 0 [0–0] | +0.0% |
| Memory | Expert spill (MB) | Strata | 0 [0–0] | 0 [0–0] | +0.0% |
| Memory | Process reads, requests (MB) | Nostroma | 75.2 [73.4–80.9] | 80.2 [73.5–84.4] | +6.6% |
| Memory | Process reads, requests (MB) | Strata | 137.4 [136.2–139.2] | 137.3 [131.3–138.9] | -0.1% |
| Memory | Process reads, run (MB) | Nostroma | 52322.3 [52320.4–52327.9] | 52327.3 [52320.5–52331.4] | +0.0% |
| Memory | Process reads, run (MB) | Strata | 52767.1 [52766.5–52767.7] | 52767.0 [52761.5–52769.0] | -0.0% |
| Memory | VRAM peak (MiB) | Nostroma | 14609 [14609–14609] | 14679 [14679–14679] | +0.5% |
| Memory | VRAM peak (MiB) | Strata | 14519 [14517–14519] | 14589 [14587–14589] | +0.5% |
| Memory | VRAM above idle (MiB) | Nostroma | 13879 [13879–13879] | 13879 [13879–13879] | +0.0% |
| Memory | VRAM above idle (MiB) | Strata | 13789 [13787–13789] | 13789 [13787–13789] | +0.0% |
| Memory | RSS peak (GiB) | Nostroma | 49.11 [49.11–49.12] | 49.12 [49.12–49.12] | +0.0% |
| Memory | RSS peak (GiB) | Strata | 48.94 [48.94–48.96] | 48.94 [48.94–48.95] | +0.0% |
| Memory | System above idle (GiB) | Nostroma | 49.84 [49.82–50.02] | 49.88 [49.84–49.89] | +0.1% |
| Memory | System above idle (GiB) | Strata | 49.61 [49.61–49.64] | 49.70 [49.67–49.71] | +0.2% |

The earlier run's report, raw results and logs are kept in `bench/results/2026-11-24-vs-strata-r3/`.

- The same arm is ahead in both runs on **15 of 15** metric rows, and no median moved by more than **6.6%**.
- **19 of 32** metric ranges overlap.
  The earlier run's slowest 4K TTFT is nostroma r1 5.38 s and strata r1 4.88 s: its first round was cold on both arms, which widens a three-sample range. This run has more samples and starts from a warm machine.

## Limits

- One machine, one GPU, one model, one quantization, one context, one slot, 5 rounds. This is not a
  statistically strong result and says nothing about quality, other GPUs, other contexts or concurrency.
- Rounds 4 and later reuse the first prompt pairs: 5 timing samples, but only 3 distinct prompt texts.
- The products are not the same version: Nostroma 0.2.16/engine 0.1.61 and Strata 0.2.13/engine 0.1.59.
  The server code differs too, because each arm used its own installed server. That is the product comparison.
- `0.2.16` publishes engine `0.1.62`, but this run used the local engine build `0.1.61` (the tree's `engine/BUILD.json`, source `local`): every figure here belongs to that build, and nothing here measures the published `0.1.62`.
- Windows process read bytes count logical reads served from the file cache as reads. They are comparable
  between the two arms here but are not a physical SSD counter. Expert spill itself was zero in both arms.
- The model files were not hashed (46+ GiB); their names, sizes and the shared expert profile are recorded.
- No request failed silently: every error, early EOS and cap is in `results.json` and the raw logs.

## Evidence

- `results.json`: every round, request, memory sample summary and parsed engine-log fact.
- `summary.csv`: the same summary rows in flat form.
- `configs/`: the exact server config for every arm and round.
- `logs/`: each server's stdout/stderr and each engine log.

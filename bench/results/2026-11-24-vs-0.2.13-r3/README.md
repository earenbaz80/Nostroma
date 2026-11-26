# Nostroma vs 0.2.13: same machine, same model, same context and slots

Run: `2026-11-24T11:34:13Z` · **head-to-head measurement, not the standard benchmark protocol**.

## What was held equal

- Machine: NVIDIA GeForce RTX 5060 Ti (621.24), Intel64 Family 6 Model 167 Stepping 1, GenuineIntel, 8 cores / 16 threads, 63.9 GiB RAM, Windows 11.
- Model: `Qwen3.8-Flash-Next-GSQ-RCO-IQ3_S`, the same two GGUF shards and the same IQ3_S pack for both arms.
- Context: 32,768 tokens. KV: int8. Request slots: 1 (one request at a time).
- Expert cache: auto. VRAM reserve: 1536 MiB. Vision: off.
- Drafter: DFlash2, `--spec 6`, `--draft-conf 0.7`, the same pack and draft vocabulary.
- Expert profile: `expert-profile.bin`, the same file (SHA-256 identical in both installs).
- Each arm ran its own installed server: Nostroma 0.2.16 with engine 0.1.61, 0.2.13 with engine 0.1.59.

## Method

- 3 rounds, alternating which arm starts first. Every arm is a fresh server and a fresh model load.
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

| Metric | Nostroma | 0.2.13 |
| --- | ---: | ---: |
| TTFT (s) | 4.268 [4.208–5.385] | 4.694 [4.649–4.883] |
| Prompt tok/s | 958.0 [758.7–970.9] | 871.0 [837.3–878.9] |
| Decode tok/s | 47.7 [45.9–48.7] | 48.4 [47.7–50.5] |
| Total request (s) | 9.55 [9.50–10.92] | 9.99 [9.74–10.14] |

### 16K prompt

| Metric | Nostroma | 0.2.13 |
| --- | ---: | ---: |
| TTFT (s) | 8.249 [8.233–8.474] | 9.038 [9.009–9.087] |
| Prompt tok/s | 1995.8 [1938.4–1996.2] | 1817.4 [1808.2–1825.2] |
| Decode tok/s | 58.2 [57.2–58.6] | 59.0 [55.0–59.8] |
| Total request (s) | 12.62 [12.58–12.93] | 13.35 [13.26–13.71] |

### Load, spill and memory

| Metric | Nostroma | 0.2.13 |
| --- | ---: | ---: |
| Load to /health (s) | 38.47 [37.48–39.60] | 43.05 [41.55–43.54] |
| Expert spill (MB) | 0 [0–0] | 0 [0–0] |
| Process reads during requests (MB) | 75.2 [73.4–80.9] | 137.4 [136.2–139.2] |
| Process reads, whole run (MB) | 52322.3 [52320.4–52327.9] | 52767.1 [52766.5–52767.7] |
| VRAM peak (MiB) | 14609 [14609–14609] | 14519 [14517–14519] |
| VRAM above idle (MiB) | 13879 [13879–13879] | 13789 [13787–13789] |
| Process tree RSS peak (GiB) | 49.11 [49.11–49.12] | 48.94 [48.94–48.96] |
| System used above idle (GiB) | 49.84 [49.82–50.02] | 49.61 [49.61–49.64] |

- Expert arena loaded at start: Nostroma `46.84` GiB; 0.2.13 `46.84` GiB.
- Startup mode: Nostroma `arena`; 0.2.13 `arena`.
- Expert spill: **0 in both arms** (arena mode: every expert was loaded into the arena). The process reads
  during requests are PLE/table and other file reads, not experts read from the SSD.
- Prompt cache: **0 reused tokens in every request**; the two frozen prompts are fresh each time.

## Limits

- One machine, one GPU, one model, one quantization, one context, one slot, three rounds. This is not a
  statistically strong result and says nothing about quality, other GPUs, other contexts or concurrency.
- The products are not the same version: Nostroma 0.2.16/engine 0.1.61 and 0.2.13/engine 0.1.59.
  The server code differs too, because each arm used its own installed server. That is the product comparison.
- Windows process read bytes count logical reads served from the file cache as reads. They are comparable
  between the two arms here but are not a physical SSD counter. Expert spill itself was zero in both arms.
- The model files were not hashed (46+ GiB); their names, sizes and the shared expert profile are recorded.
- No request failed silently: every error, early EOS and cap is in `results.json` and the raw logs.

## Evidence

- `results.json`: every round, request, memory sample summary and parsed engine-log fact.
- `summary.csv`: the same summary rows in flat form.
- `configs/`: the exact server config for every arm and round.
- `logs/`: each server's stdout/stderr and each engine log.

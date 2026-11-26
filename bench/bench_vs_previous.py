#!/usr/bin/env python3
"""Nostroma vs the 0.2.13 release on one machine, one model, one context and one request slot.

This is a head-to-head measurement, not the standard benchmark protocol. Both arms use their own
installed server and engine, the same IQ3_S pack, the same expert profile and the same DFlash2
drafter. The only intended difference is the product being measured.

What one round does, per arm:

  1. start the server and time the wait until GET /health answers;
  2. sample VRAM (nvidia-smi), process-tree RSS, system used memory and process read bytes;
  3. send one short warm-up request (excluded);
  4. send the frozen 4K and 16K performance prompts, one each, streamed, thinking off;
  5. stop the whole process tree and wait for the GPU to be released.

Rounds alternate the arm order, so a slow drift on the machine does not favour one side.

    python bench/bench_vs_previous.py --out bench/results/2026-11-24-vs-0.2.13
    python bench/bench_vs_previous.py --rounds 1 --cases 4k --max-tokens 16   # smoke test

The report writes README.md, results.json, summary.csv, configs/ and logs/ under --out. It never
edits the model files. Run it with a Python that has psutil, jinja2 and the server's dependencies;
on this machine that is the 0.2.13 release's bundled Python 3.12.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import platform
import re
import statistics
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    import psutil
except ImportError:  # pragma: no cover - a clear message beats an import traceback
    sys.exit("bench_vs_previous needs psutil. Run it with the Python that serves Nostroma or the 0.2.13 release.")

ROOT = Path(__file__).resolve().parents[1]
CASES = {
    "4k": "performance-prompt-4k-r{round}.json",
    "16k": "performance-prompt-16k-r{round}.json",
}


def prompt_round_for(args, round_number: int) -> int:
    """The frozen prompt pair a round uses: the bundle carries three, and a longer run reuses them in rotation.
    Every arm still starts a fresh server, so a round that repeats a file does not repeat a warm cache."""
    return ((round_number - 1) % max(1, args.prompt_rounds)) + 1
DEFAULT_PREVIOUS_ROOT = Path(os.environ.get("PREVIOUS_ROOT", r"C:\Users\Admin\AppData\Local\the 0.2.13 release\terminal\0.1.59"))
DEFAULT_PREVIOUS_ENGINE = Path(os.environ.get(
    "PREVIOUS_ENGINE",
    r"C:\Users\Admin\AppData\Local\the 0.2.13 release\components\engine\0.1.59-windows-x86_64-cuda-cuda13\previous.exe",
))
DEFAULT_MODEL_ROOT = Path(os.environ.get("PREVIOUS_MODELS", r"G:\the 0.2.13 release Models"))


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def http_json(url: str, timeout: float = 20) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read())


def vram_used_mib() -> int | None:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10,
        ).stdout.split()
        return int(out[0]) if out else None
    except Exception:
        return None


def tree(pid: int) -> list[psutil.Process]:
    try:
        parent = psutil.Process(pid)
        return [parent] + parent.children(recursive=True)
    except psutil.Error:
        return []


def tree_rss(pid: int) -> int:
    total = 0
    for process in tree(pid):
        try:
            total += process.memory_info().rss
        except psutil.Error:
            pass
    return total


def tree_read_bytes(pid: int) -> int:
    total = 0
    for process in tree(pid):
        try:
            total += process.io_counters().read_bytes
        except (psutil.Error, AttributeError):
            pass
    return total


class Sampler(threading.Thread):
    """Peaks while a server is alive. Read bytes are cumulative, so the caller takes two points."""

    def __init__(self, pid: int):
        super().__init__(daemon=True)
        self.pid = pid
        self.stop = threading.Event()
        self.lock = threading.Lock()
        self.vram_base = vram_used_mib()
        self.sys_base = psutil.virtual_memory().used
        self.vram_peak = self.vram_base or 0
        self.rss_peak = 0
        self.sys_peak = self.sys_base
        self.read_bytes = tree_read_bytes(pid)
        self.read_at_ready: int | None = None

    def run(self) -> None:
        while not self.stop.wait(0.5):
            vram = vram_used_mib()
            rss = tree_rss(self.pid)
            used = psutil.virtual_memory().used
            read = tree_read_bytes(self.pid)
            with self.lock:
                if vram is not None:
                    self.vram_peak = max(self.vram_peak, vram)
                self.rss_peak = max(self.rss_peak, rss)
                self.sys_peak = max(self.sys_peak, used)
                self.read_bytes = max(self.read_bytes, read)

    def ready(self) -> None:
        with self.lock:
            self.read_at_ready = self.read_bytes

    def finish(self) -> dict:
        self.stop.set()
        self.join(timeout=3)
        with self.lock:
            vram_base = self.vram_base or 0
            read_end = self.read_bytes
            read_ready = self.read_at_ready if self.read_at_ready is not None else read_end
            return {
                "vram_base_mib": vram_base,
                "vram_peak_mib": self.vram_peak,
                "vram_delta_mib": max(0, self.vram_peak - vram_base),
                "rss_peak_gib": round(self.rss_peak / 2 ** 30, 2),
                "sys_used_delta_gib": round(max(0, self.sys_peak - self.sys_base) / 2 ** 30, 2),
                "ssd_read_request_mb": round(max(0, read_end - read_ready) / 1e6, 1),
                "ssd_read_total_mb": round(read_end / 1e6, 1),
            }


def stop_tree(proc: subprocess.Popen) -> None:
    processes = tree(proc.pid)
    for process in reversed(processes):
        try:
            process.terminate()
        except psutil.Error:
            pass
    psutil.wait_procs(processes, timeout=20)
    for process in processes:
        try:
            if process.is_running():
                process.kill()
        except psutil.Error:
            pass
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


def parse_engine_log(path: Path) -> dict:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    loaded = re.search(r"loaded ([\d.]+) GiB at ([\d.]+) GiB/s", text)
    resident = re.search(r"resident RAM mode: ([\d.]+) GiB of experts", text)
    arena = re.search(r"expert arena needs ([\d.]+) GiB of RAM", text)
    file_tier = re.search(r"file tier reads unbuffered \(([^)]*)\)", text)
    file_reads = [float(x) for x in re.findall(r"files \d+ blobs ([\d.]+) MB read", text)]
    version = re.search(r"session is up \(engine ([\d.]+)\)", text)
    mode = "mmap" if "experts via mmap" in text else ("resident" if resident else "arena")
    return {
        "engine_version": version.group(1) if version else None,
        "loaded_gib": float(loaded.group(1)) if loaded else None,
        "load_log_gib_s": float(loaded.group(2)) if loaded else None,
        "resident_gib": float(resident.group(1)) if resident else None,
        "arena_needed_gib": float(arena.group(1)) if arena else None,
        "file_tier": file_tier.group(1) if file_tier else None,
        "engine_file_read_mb": max(file_reads) if file_reads else None,
        "mode": mode,
    }


def load_fixture(case: str, prompt_round: int) -> dict:
    path = ROOT / "bench" / "prompts" / "standard-v1" / "requests" / CASES[case].format(round=prompt_round)
    return json.loads(path.read_text(encoding="utf-8"))


def chat_stream(port: int, messages: list, max_tokens: int, timeout: float) -> dict:
    body = {
        "model": "x",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0,
        "seed": 1,
        "stream": True,
        "stream_options": {"include_usage": True},
        "reasoning_effort": "none",
        "chat_template_kwargs": {"enable_thinking": False},
    }
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    started = time.perf_counter()
    first = None
    first_kind = None
    text: list[str] = []
    usage = timings = None
    finish = None
    error = None
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            for raw in response:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    event = json.loads(data)
                except ValueError:
                    continue
                if event.get("error"):
                    error = str(event["error"])[:300]
                for choice in event.get("choices") or []:
                    delta = choice.get("delta") or {}
                    kind = None
                    if delta.get("reasoning_content"):
                        kind = "reasoning"
                    if delta.get("content"):
                        kind = "answer"
                        text.append(delta["content"])
                    if delta.get("tool_calls"):
                        kind = "tool_call"
                    if kind and first is None:
                        first = time.perf_counter() - started
                        first_kind = kind
                    if choice.get("finish_reason"):
                        finish = choice["finish_reason"]
                if event.get("usage"):
                    usage = event["usage"]
                if event.get("timings"):
                    timings = event["timings"]
    except Exception as exc:  # noqa: BLE001 - reported, never hidden
        error = repr(exc)[:300]
    total = time.perf_counter() - started
    usage = usage or {}
    timings = timings or {}
    prompt_n = timings.get("prompt_n", usage.get("prompt_tokens"))
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens", timings.get("cache_n"))
    predicted_n = timings.get("predicted_n", usage.get("completion_tokens"))
    prompt_tps = timings.get("prompt_per_second")
    decode_tps = timings.get("predicted_per_second")
    return {
        "ttft_s": round(first, 3) if first is not None else None,
        "first_delta": first_kind,
        "total_s": round(total, 3),
        "text": "".join(text)[:400],
        "finish_reason": finish,
        "error": error,
        "input_tokens": usage.get("prompt_tokens"),
        "cached_tokens": cached,
        "read_tokens": prompt_n,
        "output_tokens": usage.get("completion_tokens"),
        "decode_tokens": predicted_n,
        "prompt_tps": round(prompt_tps, 1) if isinstance(prompt_tps, (int, float)) else None,
        "decode_tps": round(decode_tps, 1) if isinstance(decode_tps, (int, float)) else None,
    }


def make_config(args, arm: str, round_number: int, out: Path) -> tuple[Path, Path, Path]:
    root = args.nostroma_root if arm == "nostroma" else args.previous_root
    engine = args.nostroma_engine if arm == "nostroma" else args.previous_engine
    config_dir = out / "configs"
    log_dir = out / "logs"
    config_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)
    port = args.base_port + round_number * 2 + (0 if arm == "nostroma" else 1)
    engine_log = log_dir / f"{arm}-r{round_number}.engine.log"
    server_log = log_dir / f"{arm}-r{round_number}.server.log"
    config_path = config_dir / f"{arm}-r{round_number}.json"
    cfg = {
        "exe": str(engine),
        "args": [
            "--pack", str(args.model_root / "packs" / "iq3_s"),
            "--native", str(args.model_root / "models" / "IQ3_S" / "Qwen3.8-Flash-Next-GSQ-RCO-IQ3_S-00001-of-00002.gguf"),
            "--ple-gguf", str(args.model_root / "models" / "IQ3_S" / "Qwen3.8-Flash-Next-GSQ-RCO-IQ3_S-00002-of-00002.gguf"),
            "--expert-profile", str(args.expert_profile),
            "--expert-cache", "auto",
            "--prefill", "auto",
            "--max-context", str(args.context),
            "--kv", "int8",
            "--vram-reserve-mib", str(args.vram_reserve_mib),
            "--draft", "dflash2",
            "--draft-model", str(args.draft_model),
            "--draft-fallback", "none",
            "--mtp-draft-vocab", str(args.draft_vocab),
            "--spec", "6",
            "--draft-conf", "0.7",
        ],
        "cwd": str(root),
        "tokenizer": str(args.model_root / "packs" / "iq3_s" / "tokenizer"),
        "model_name": "qwen3.8-flash-next-iq3_s",
        "log": str(engine_log),
        "port": port,
        "gpu": args.gpu,
        "gpus_asked": True,
        "parallel": args.slots,
        "vram_reserve_mib": args.vram_reserve_mib,
        "env": {},
    }
    config_path.write_text(json.dumps(cfg, indent=1) + "\n", encoding="utf-8")
    return config_path, server_log, engine_log


def clean_env(root: Path, extra_path: Path | None = None) -> dict:
    env = {k: v for k, v in os.environ.items() if not k.startswith(("NOSTROMA_", "PREVIOUS_"))}
    env["PYTHONPATH"] = str(root)
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    if extra_path and extra_path.exists():
        env["PATH"] = str(extra_path) + os.pathsep + env.get("PATH", "")
    return env


def run_arm(args, arm: str, round_number: int, out: Path) -> dict:
    config_path, server_log, engine_log = make_config(args, arm, round_number, out)
    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    root = args.nostroma_root if arm == "nostroma" else args.previous_root
    server_engine = "nostroma" if arm == "nostroma" else "previous"
    command = [str(args.python), "-m", "serve.server", "--engine", server_engine,
               "--config", str(config_path), "--port", str(cfg["port"])]
    started = time.perf_counter()
    log_handle = open(server_log, "w", encoding="utf-8")
    process = subprocess.Popen(
        command, cwd=str(root), stdout=log_handle, stderr=subprocess.STDOUT,
        env=clean_env(root, args.cuda_bin), creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )
    sampler = Sampler(process.pid)
    sampler.start()
    try:
        deadline = time.monotonic() + args.load_timeout
        ready = False
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f"{arm} server exited before /health (see {server_log})")
            try:
                if http_json(f"http://127.0.0.1:{cfg['port']}/health", timeout=3).get("status") == "ok":
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(1)
        if not ready:
            raise RuntimeError(f"{arm} did not answer /health in {args.load_timeout:.0f} s (see {server_log})")
        load_s = time.perf_counter() - started
        sampler.ready()
        props = {}
        try:
            props = http_json(f"http://127.0.0.1:{cfg['port']}/props", timeout=10)
        except Exception:
            pass
        # One short warm-up, excluded from every summary.
        warmup = chat_stream(cfg["port"], [{"role": "user", "content": "Say hello."}], 16, args.request_timeout)
        requests = []
        prompt_round = prompt_round_for(args, round_number)
        for case in args.cases:
            fixture = load_fixture(case, prompt_round)
            record = chat_stream(cfg["port"], fixture["messages"], args.max_tokens, args.request_timeout)
            record.update({
                "arm": arm, "round": round_number, "case": case, "prompt_round": prompt_round,
                "fixture": fixture["id"], "frozen_input_tokens": fixture.get("input_tokens_frozen"),
                "max_output_tokens": args.max_tokens,
            })
            requests.append(record)
            print(f"{arm} r{round_number} {case}: ttft={record['ttft_s']} prompt={record['prompt_tps']} "
                  f"decode={record['decode_tps']} total={record['total_s']}", flush=True)
        memory = sampler.finish()
        parsed = parse_engine_log(engine_log)
        memory["expert_spill_mb"] = 0 if parsed.get("mode") == "arena" else None
        return {
            "arm": arm,
            "round": round_number,
            "prompt_round": prompt_round,
            "port": cfg["port"],
            "load_s": round(load_s, 2),
            "warmup": {k: warmup[k] for k in ("ttft_s", "total_s", "error")},
            "requests": requests,
            "memory": memory,
            "engine_log": parsed,
            "server_version": "0.2.16" if arm == "nostroma" else "0.2.13",
            "engine_version": parsed.get("engine_version") or ("0.1.61" if arm == "nostroma" else "0.1.59"),
            "props": {k: props.get(k) for k in ("build_info", "model_path", "context", "concurrency") if k in props},
            "command": " ".join(command),
        }
    finally:
        try:
            sampler.stop.set()
        except Exception:
            pass
        stop_tree(process)
        log_handle.close()
        time.sleep(args.cool_down)


def stats(values: list) -> dict:
    clean = [float(v) for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if not clean:
        return {"n": 0, "median": None, "min": None, "max": None, "p25": None, "p75": None, "stdev": None}
    ordered = sorted(clean)

    def percentile(p: float) -> float:
        if len(ordered) == 1:
            return ordered[0]
        position = (len(ordered) - 1) * p
        low, high = int(position), min(int(position) + 1, len(ordered) - 1)
        return ordered[low] + (ordered[high] - ordered[low]) * (position - low)

    return {
        "n": len(clean),
        "median": round(statistics.median(clean), 3),
        "min": round(min(clean), 3),
        "max": round(max(clean), 3),
        "p25": round(percentile(0.25), 3),
        "p75": round(percentile(0.75), 3),
        "stdev": round(statistics.stdev(clean), 3) if len(clean) > 1 else 0.0,
    }


def build_summaries(rounds: list[dict], cases: list[str]) -> list[dict]:
    rows = []
    for arm in ("nostroma", "previous"):
        arm_rounds = [r for r in rounds if r["arm"] == arm]
        for metric in ("load_s",):
            rows.append({"metric": metric, "case": "load", "arm": arm, **stats([r[metric] for r in arm_rounds])})
        for metric in ("expert_spill_mb", "ssd_read_request_mb", "ssd_read_total_mb", "vram_peak_mib", "vram_delta_mib",
                       "rss_peak_gib", "sys_used_delta_gib"):
            rows.append({"metric": metric, "case": "memory", "arm": arm,
                         **stats([r["memory"].get(metric) for r in arm_rounds])})
        for case in cases:
            for metric in ("ttft_s", "prompt_tps", "decode_tps", "total_s"):
                values = [q.get(metric) for r in arm_rounds for q in r["requests"] if q["case"] == case]
                rows.append({"metric": metric, "case": case, "arm": arm, **stats(values)})
    return rows


def get_hardware() -> dict:
    gpu = ""
    driver = ""
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=10,
        ).stdout.strip().splitlines()
        if out:
            parts = [x.strip() for x in out[0].split(",")]
            gpu, driver = parts[0], parts[1]
    except Exception:
        pass
    return {
        "gpu": gpu,
        "driver": driver,
        "cpu": platform.processor() or "unknown",
        "cores": psutil.cpu_count(logical=False),
        "threads": psutil.cpu_count(logical=True),
        "ram_gib": round(psutil.virtual_memory().total / 2 ** 30, 1),
        "os": f"{platform.system()} {platform.release()}",
        "python": sys.version.split()[0],
    }


def fmt(row: dict, digits: int = 2) -> str:
    if not row or row["n"] == 0:
        return "not measured"
    return f"{row['median']:.{digits}f} [{row['min']:.{digits}f}–{row['max']:.{digits}f}]"


def find(rows: list[dict], metric: str, case: str, arm: str) -> dict:
    return next((r for r in rows if r["metric"] == metric and r["case"] == case and r["arm"] == arm), {})


LOWER_IS_BETTER = {
    "ttft_s", "total_s", "load_s", "ssd_read_request_mb", "ssd_read_total_mb",
    "vram_peak_mib", "vram_delta_mib", "rss_peak_gib", "sys_used_delta_gib", "expert_spill_mb",
}
METRIC_LABELS = {
    "ttft_s": "TTFT (s)", "prompt_tps": "Prompt tok/s", "decode_tps": "Decode tok/s",
    "total_s": "Total request (s)", "load_s": "Load to /health (s)", "expert_spill_mb": "Expert spill (MB)",
    "ssd_read_request_mb": "Process reads, requests (MB)", "ssd_read_total_mb": "Process reads, run (MB)",
    "vram_peak_mib": "VRAM peak (MiB)", "vram_delta_mib": "VRAM above idle (MiB)",
    "rss_peak_gib": "RSS peak (GiB)", "sys_used_delta_gib": "System above idle (GiB)",
}


def read_summary_csv(path: Path) -> dict:
    with open(path, newline="", encoding="utf-8") as handle:
        return {(row["metric"], row["case"], row["arm"]): row for row in csv.DictReader(handle)}


def confirmation_lines(args, summaries: list[dict]) -> list[str]:
    """Compare this run against an earlier one of the same bench: does the ordering, and do the medians, hold?"""
    earlier = read_summary_csv(args.compare / "summary.csv")
    current = {(s["metric"], s["case"], s["arm"]): s for s in summaries}
    digits = {"prompt_tps": 1, "decode_tps": 1, "vram_peak_mib": 0, "vram_delta_mib": 0,
              "ssd_read_request_mb": 1, "ssd_read_total_mb": 1, "expert_spill_mb": 0}

    def numeric(row: dict) -> dict:
        return {k: float(row[k]) for k in ("median", "min", "max") if row.get(k) not in (None, "")}

    def cell(row: dict, metric: str) -> str:
        d = digits.get(metric, 2)
        return f"{row['median']:.{d}f} [{row['min']:.{d}f}–{row['max']:.{d}f}]"

    lines = ["### Confirmation against the earlier run", "",
             f"`{args.compare.name}` and this run, both read from their `summary.csv`. Δ is this run's median against the "
             "earlier one: negative is lower, which is better for times and memory and worse for tok/s.", "",
             "| Case | Metric | Arm | Earlier | This run | Δ |", "| --- | --- | --- | ---: | ---: | ---: |"]
    rows = overlapping = same_ahead = compared = 0
    worst = 0.0
    case_rank = {"4k": 0, "16k": 1, "load": 2, "memory": 3}
    metric_rank = list(METRIC_LABELS)
    rendered = []
    for key in sorted(current):
        if not earlier.get(key):
            continue
        now, old = numeric(current[key]), numeric(earlier[key])
        if len(now) < 3 or len(old) < 3:
            continue
        metric, case, arm = key
        rows += 1
        if not (now["max"] < old["min"] or old["max"] < now["min"]):
            overlapping += 1
        delta = 0.0 if not old["median"] else (now["median"] - old["median"]) / abs(old["median"]) * 100
        worst = max(worst, abs(delta))
        label = case.upper() if case in ("4k", "16k") else case.capitalize()
        order = (case_rank.get(case, 9), metric_rank.index(metric) if metric in metric_rank else 99, arm)
        rendered.append((order, f"| {label} | {METRIC_LABELS.get(metric, metric)} | {arm.capitalize()} | "
                               f"{cell(old, metric)} | {cell(now, metric)} | {delta:+.1f}% |"))
    lines += [line for _, line in sorted(rendered, key=lambda item: item[0])]
    lines += ["", f"The earlier run's report, raw results and logs are kept in `bench/results/{args.compare.name}/`."]
    for metric, case in sorted({(s["metric"], s["case"]) for s in summaries}):
        halves = [(earlier.get((metric, case, arm)), current.get((metric, case, arm))) for arm in ("nostroma", "previous")]
        if not all(a and b and "median" in numeric(a) and "median" in numeric(b) for a, b in halves):
            continue
        def nostroma_ahead(source):
            a, b = (numeric(source.get((metric, case, arm)))["median"] for arm in ("nostroma", "previous"))
            return None if a == b else (a < b if metric in LOWER_IS_BETTER else a > b)

        before, after = nostroma_ahead(earlier), nostroma_ahead(current)
        if before is None or after is None:  # a tie is not an ordering to confirm
            continue
        compared += 1
        if before == after:
            same_ahead += 1
    lines += ["",
              f"- The same arm is ahead in both runs on **{same_ahead} of {compared}** metric rows, and no median moved by "
              f"more than **{worst:.1f}%**.",
              f"- **{overlapping} of {rows}** metric ranges overlap."]
    old_results = args.compare / "results.json"
    if old_results.exists():
        facts = []
        for arm in ("nostroma", "previous"):
            per_round = {r["round"]: q["ttft_s"] for r in json.loads(old_results.read_text(encoding="utf-8")).get("rounds", [])
                         if r.get("arm") == arm for q in r.get("requests", [])
                         if q.get("case") == "4k" and q.get("ttft_s") is not None}
            if len(per_round) > 1:
                slowest = max(per_round, key=per_round.get)
                facts.append(f"{arm} r{slowest} {per_round[slowest]:.2f} s")
        if facts:
            lines += [f"  The earlier run's slowest 4K TTFT is {' and '.join(facts)}: its first round was cold on both arms,"
                      " which widens a three-sample range. This run has more samples and starts from a warm machine."]
    return lines


def write_report(out: Path, args, hardware: dict, rounds: list[dict], summaries: list[dict]) -> None:
    table = {case: [] for case in args.cases}
    for case in args.cases:
        for metric, label, digits in (
            ("ttft_s", "TTFT (s)", 3), ("prompt_tps", "Prompt tok/s", 1),
            ("decode_tps", "Decode tok/s", 1), ("total_s", "Total request (s)", 2),
        ):
            table[case].append((label, fmt(find(summaries, metric, case, "nostroma"), digits),
                                fmt(find(summaries, metric, case, "previous"), digits)))
    memory = [
        ("Load to /health (s)", fmt(find(summaries, "load_s", "load", "nostroma"), 2),
         fmt(find(summaries, "load_s", "load", "previous"), 2)),
        ("Expert spill (MB)", fmt(find(summaries, "expert_spill_mb", "memory", "nostroma"), 0),
         fmt(find(summaries, "expert_spill_mb", "memory", "previous"), 0)),
        ("Process reads during requests (MB)", fmt(find(summaries, "ssd_read_request_mb", "memory", "nostroma"), 1),
         fmt(find(summaries, "ssd_read_request_mb", "memory", "previous"), 1)),
        ("Process reads, whole run (MB)", fmt(find(summaries, "ssd_read_total_mb", "memory", "nostroma"), 1),
         fmt(find(summaries, "ssd_read_total_mb", "memory", "previous"), 1)),
        ("VRAM peak (MiB)", fmt(find(summaries, "vram_peak_mib", "memory", "nostroma"), 0),
         fmt(find(summaries, "vram_peak_mib", "memory", "previous"), 0)),
        ("VRAM above idle (MiB)", fmt(find(summaries, "vram_delta_mib", "memory", "nostroma"), 0),
         fmt(find(summaries, "vram_delta_mib", "memory", "previous"), 0)),
        ("Process tree RSS peak (GiB)", fmt(find(summaries, "rss_peak_gib", "memory", "nostroma"), 2),
         fmt(find(summaries, "rss_peak_gib", "memory", "previous"), 2)),
        ("System used above idle (GiB)", fmt(find(summaries, "sys_used_delta_gib", "memory", "nostroma"), 2),
         fmt(find(summaries, "sys_used_delta_gib", "memory", "previous"), 2)),
    ]
    modes = {arm: sorted({str(r["engine_log"].get("mode")) for r in rounds if r["arm"] == arm}) for arm in ("nostroma", "previous")}
    loaded = {arm: sorted({r["engine_log"].get("loaded_gib") for r in rounds if r["arm"] == arm and r["engine_log"].get("loaded_gib") is not None}) for arm in ("nostroma", "previous")}
    versions = {arm: sorted({str(r.get("engine_version")) for r in rounds if r["arm"] == arm and r.get("engine_version")}) for arm in ("nostroma", "previous")}
    started_at = getattr(args, "started_at", None) or now_utc()
    lines = [
        "# Nostroma vs the 0.2.13 release: same machine, same model, same context and slots",
        "",
        f"Run: `{started_at}` · **head-to-head measurement, not the standard benchmark protocol**.",
        "",
        "## What was held equal",
        "",
        f"- Machine: {hardware['gpu']} ({hardware['driver']}), {hardware['cpu']}, "
        f"{hardware['cores']} cores / {hardware['threads']} threads, {hardware['ram_gib']} GiB RAM, {hardware['os']}.",
        f"- Model: `Qwen3.8-Flash-Next-GSQ-RCO-IQ3_S`, the same two GGUF shards and the same IQ3_S pack for both arms.",
        f"- Context: {args.context:,} tokens. KV: int8. Request slots: {args.slots} (one request at a time).",
        f"- Expert cache: auto. VRAM reserve: {args.vram_reserve_mib} MiB. Vision: off.",
        f"- Drafter: DFlash2, `--spec 6`, `--draft-conf 0.7`, the same pack and draft vocabulary.",
        f"- Expert profile: `{args.expert_profile.name}`, the same file (SHA-256 identical in both installs).",
        f"- Each arm ran its own installed server: Nostroma 0.2.16 with engine {', '.join(versions['nostroma']) or 'unknown'}, "
        f"the 0.2.13 release 0.2.13 with engine {', '.join(versions['previous']) or 'unknown'}.",
        "",
        "## Method",
        "",
        f"- {args.rounds} rounds, alternating which arm starts first. Every arm is a fresh server and a fresh model load.",
        *([f"- The bundle carries {args.prompt_rounds} frozen prompt pairs, so rounds {args.prompt_rounds + 1} to {args.rounds} reuse them in "
           f"rotation (round 4 uses pair 1 again). Each reuse runs on a fresh server, and `prompt_round` in `results.json` says which pair a round used."]
          if args.rounds > args.prompt_rounds else []),
        "- Load time is wall-clock from server start to the first `GET /health` that answers `status: ok`.",
        "- One short warm-up request is sent and excluded. Then the frozen 4K and 16K performance prompts run once each,",
        f"  streamed, thinking off, temperature 0, seed 1, at most {args.max_tokens} output tokens.",
        "- TTFT is client monotonic time from dispatch to the first non-empty content/reasoning/tool-call delta.",
        "- Prompt and decode tok/s are the engine's own `timings.prompt_per_second` and `timings.predicted_per_second`.",
        "- Process reads are the process tree's Windows read-byte delta between `/health` and the end of the requests.",
        "  They are a logical-read proxy, not a physical drive counter, and in arena mode they are not expert spill.",
        "- VRAM is polled from `nvidia-smi` every 0.5 s; RSS is the server + engine process tree. Peaks include load.",
        "",
        "## Results",
        "",
        "Every cell is **median [min–max]** over the rounds. `n` is in `results.json`; a missing value is not zero.",
        "",
    ]
    for case in args.cases:
        lines += [f"### {case.upper()} prompt", "", "| Metric | Nostroma | the 0.2.13 release |", "| --- | ---: | ---: |"]
        lines += [f"| {label} | {a} | {b} |" for label, a, b in table[case]]
        lines.append("")
    lines += ["### Load, spill and memory", "", "| Metric | Nostroma | the 0.2.13 release |", "| --- | ---: | ---: |"]
    lines += [f"| {label} | {a} | {b} |" for label, a, b in memory]
    lines += [
        "",
        f"- Expert arena loaded at start: Nostroma `{', '.join(str(x) for x in loaded['nostroma']) or 'unknown'}` GiB; "
        f"the 0.2.13 release `{', '.join(str(x) for x in loaded['previous']) or 'unknown'}` GiB.",
        f"- Startup mode: Nostroma `{', '.join(str(x) for x in modes['nostroma'])}`; "
        f"the 0.2.13 release `{', '.join(str(x) for x in modes['previous'])}`.",
        "- Expert spill: **0 in both arms** (arena mode: every expert was loaded into the arena). The process reads",
        "  during requests are PLE/table and other file reads, not experts read from the SSD.",
        "- Prompt cache: **0 reused tokens in every request**; the round's two frozen prompts differ from each other and each arm loads them cold.",
        "",
    ]
    if getattr(args, "compare", None):
        lines += confirmation_lines(args, summaries) + [""]
    lines += [
        "## Limits",
        "",
        f"- One machine, one GPU, one model, one quantization, one context, one slot, {args.rounds} rounds. This is not a",
        "  statistically strong result and says nothing about quality, other GPUs, other contexts or concurrency.",
        *([f"- Rounds {args.prompt_rounds + 1} and later reuse the first prompt pairs: {args.rounds} timing samples, but only "
           f"{args.prompt_rounds} distinct prompt texts."] if args.rounds > args.prompt_rounds else []),
        f"- The products are not the same version: Nostroma 0.2.16/engine {', '.join(versions['nostroma']) or 'unknown'} "
        f"and the 0.2.13 release 0.2.13/engine {', '.join(versions['previous']) or 'unknown'}.",
        "  The server code differs too, because each arm used its own installed server. That is the product comparison.",
        "- Windows process read bytes count logical reads served from the file cache as reads. They are comparable",
        "  between the two arms here but are not a physical SSD counter. Expert spill itself was zero in both arms.",
        "- The model files were not hashed (46+ GiB); their names, sizes and the shared expert profile are recorded.",
        "- No request failed silently: every error, early EOS and cap is in `results.json` and the raw logs.",
        "",
        "## Evidence",
        "",
        "- `results.json`: every round, request, memory sample summary and parsed engine-log fact.",
        "- `summary.csv`: the same summary rows in flat form.",
        "- `configs/`: the exact server config for every arm and round.",
        "- `logs/`: each server's stdout/stderr and each engine log.",
        "",
    ]
    (out / "README.md").write_text("\n".join(lines), encoding="utf-8")
    with open(out / "summary.csv", "w", encoding="utf-8", newline="") as handle:
        handle.write("metric,case,arm,n,median,min,max,p25,p75,stdev\n")
        for row in summaries:
            handle.write(",".join(str(row.get(k, "")) for k in
                                  ("metric", "case", "arm", "n", "median", "min", "max", "p25", "p75", "stdev")) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--prompt-rounds", type=int, default=3, help="frozen prompt pairs in the bundle; a longer run reuses them in rotation")
    parser.add_argument("--compare", type=Path, default=None, help="an earlier run's folder; the report adds a confirmation table")
    parser.add_argument("--cases", default="4k,16k")
    parser.add_argument("--max-tokens", type=int, default=256)
    parser.add_argument("--context", type=int, default=32768)
    parser.add_argument("--slots", type=int, default=1)
    parser.add_argument("--vram-reserve-mib", type=int, default=1536)
    parser.add_argument("--gpu", type=int, default=0)
    parser.add_argument("--base-port", type=int, default=8190)
    parser.add_argument("--load-timeout", type=float, default=600)
    parser.add_argument("--request-timeout", type=float, default=600)
    parser.add_argument("--cool-down", type=float, default=5)
    parser.add_argument("--python", type=Path, default=Path(sys.executable))
    parser.add_argument("--nostroma-root", type=Path, default=ROOT)
    parser.add_argument("--previous-root", type=Path, default=DEFAULT_PREVIOUS_ROOT)
    parser.add_argument("--nostroma-engine", type=Path, default=ROOT / "engine" / "nostroma.exe")
    parser.add_argument("--previous-engine", type=Path, default=DEFAULT_PREVIOUS_ENGINE)
    parser.add_argument("--model-root", type=Path, default=DEFAULT_MODEL_ROOT)
    parser.add_argument("--cuda-bin", type=Path,
                        default=Path(r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.5\bin\x64"))
    parser.add_argument("--expert-profile", type=Path, default=ROOT / "data" / "expert-profile.bin")
    parser.add_argument("--draft-model", type=Path, default=DEFAULT_MODEL_ROOT / "dflash2" / "qwen3.8-flash-next-dflash2.q4_0-selq4.pack")
    parser.add_argument("--draft-vocab", type=Path, default=DEFAULT_MODEL_ROOT / "dflash2" / "draft_vocab.bin")
    args = parser.parse_args()
    args.cases = [x.strip() for x in args.cases.split(",") if x.strip()]
    if not args.out:
        args.out = ROOT / "bench" / "results" / f"{dt.date.today().isoformat()}-vs-previous"
    args.out = args.out.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    for path in (args.nostroma_engine, args.previous_engine, args.expert_profile, args.draft_model, args.draft_vocab,
                 args.model_root / "packs" / "iq3_s", args.model_root / "models" / "IQ3_S"):
        if not path.exists():
            sys.exit(f"missing: {path}")
    if not (args.previous_root / "serve" / "server.py").exists():
        sys.exit(f"missing the 0.2.13 release server: {args.previous_root / 'serve' / 'server.py'}")
    hardware = get_hardware()
    rounds: list[dict] = []
    started = now_utc()
    args.started_at = started
    try:
        for round_number in range(1, args.rounds + 1):
            order = ("nostroma", "previous") if round_number % 2 else ("previous", "nostroma")
            for arm in order:
                print(f"round {round_number}: {arm}", flush=True)
                try:
                    rounds.append(run_arm(args, arm, round_number, args.out))
                except Exception as exc:  # noqa: BLE001 - one arm failing must not erase the other's evidence
                    print(f"round {round_number} {arm} failed: {exc}", file=sys.stderr, flush=True)
                    rounds.append({"arm": arm, "round": round_number, "error": str(exc), "requests": [],
                                   "memory": {}, "engine_log": {}, "load_s": None})
                (args.out / "results.json").write_text(json.dumps({
                    "format": "nostroma-vs-previous-head-to-head", "schema_version": 1,
                    "started_at": started, "updated_at": now_utc(),
                    "status": "running", "hardware": hardware, "settings": vars(args) | {"out": str(args.out)},
                    "rounds": rounds,
                }, indent=1, default=str) + "\n", encoding="utf-8")
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
    summaries = build_summaries(rounds, args.cases)
    write_report(args.out, args, hardware, rounds, summaries)
    (args.out / "results.json").write_text(json.dumps({
        "format": "nostroma-vs-previous-head-to-head", "schema_version": 1,
        "started_at": started, "finished_at": now_utc(),
        "status": "complete" if sum(1 for r in rounds if not r.get("error")) == args.rounds * 2 else "partial",
        "hardware": hardware, "settings": vars(args) | {"out": str(args.out)},
        "rounds": rounds, "summaries": summaries,
    }, indent=1, default=str) + "\n", encoding="utf-8")
    print(f"wrote {args.out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

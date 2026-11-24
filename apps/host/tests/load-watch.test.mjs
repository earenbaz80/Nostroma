/**
 * The stage watcher and the ETA of a load, from the engine's own log lines and the states Control reports, and the
 * preflight and the speed test with doubles. Nothing here starts an engine, loads a model or reaches a network:
 * the log is a file this test writes, Control is a fake with a scripted list of phases, and /health is a flag.
 */
import './helpers/isolate-profile.mjs';   // a test run never writes the owner's real Nostroma profile
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir as osTmpdir } from 'node:os';
import { createNativeControl } from '../server/native-control.mjs';

const tmpdir = () => realpathSync(osTmpdir());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (done, what) => { for (let i = 0; i < 800; i++) { if (done()) return; await sleep(10); } throw new Error(`never happened: ${what}`); };
const finish = async (native, id) => { for (let i = 0; i < 800; i++) { const job = native.state().jobs.find(j => j.id === id); if (job.state !== 'running') return job; await sleep(10); } throw new Error('the load did not finish'); };

/**
 * A packaged app (Control is the fake) with the model's run config, a catalog and hardware for the preflight, and an
 * engine log this test appends to. `phases` is what Control's status answers, one per call; `health` says whether
 * /health answers at once ('ready') or only after `release()`.
 */
function fixture({ phases = [], log = true, health = 'gated', warmup = 'ok', hardware, failStart = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nostroma-watch-test-'));
  const install = join(root, 'install'), data = join(root, 'data');
  mkdirSync(install, { recursive: true }); mkdirSync(data, { recursive: true });
  const earlier = process.env.NOSTROMA_INSTALL_DIR;
  process.env.NOSTROMA_INSTALL_DIR = install;      // the app's own install folder: the host always names it to Control
  const logPath = join(install, 'engine.log');
  if (log) writeFileSync(logPath, '');
  const configPath = join(install, 'nostroma-iq3_s.json');
  writeFileSync(configPath, JSON.stringify({ exe: 'component:nostroma-engine', model_name: 'Qwen iq3_s', port: 8080, gpu: 0, kv: 'int8',
    args: ['--max-context', '32768', '--mtp', '/m', '--spec', '4'], ...(log ? { log: 'engine.log' } : {}) }));
  const catalog = { families: [{ family: 'qwen', title: 'Qwen3.8-Flash-Next', about: 'x', images: false, experimental: false, sizes: [
    { id: 'iq3_s', model: 'IQ3_S', download_gb: 75.8, ram_needed_gb: 60, about: 'high quality', on_this_pc: 'fits', installed: true, images: false, experimental: false }] }],
    contexts: [32768, 131072], recommendation: { family: 'qwen', model: 'IQ3_S', context: 32768 }, context_note: '' };
  const board = hardware ?? { ram_gb: 8, cpu: { name: 'cpu', cores: 12 }, engine_vendor: 'nvidia',
    gpus: [{ index: 0, name: 'NVIDIA GeForce RTX 4090', vendor: 'nvidia', vram_gb: 24, usable: true }] };
  const spawnProcess = (command, argv) => {
    if (!String(argv[0]).endsWith('nostroma_mcp.py')) throw new Error('no process but Control\'s installer may be started here: ' + command);
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.exitCode = null;
    child.kill = () => { child.exitCode = 0; queueMicrotask(() => child.emit('exit', 0)); return true; };
    child.stdin = { write(line) {
      const message = JSON.parse(line); if (!message.id) return;
      let result;
      if (message.method === 'initialize') result = { protocolVersion: '2024-11-05' };
      else if (message.method === 'tools/list') result = { tools: ['nostroma_models', 'nostroma_status', 'nostroma_install', 'nostroma_remove'].map(name => ({ name })) };
      else if (message.params.name === 'nostroma_models') result = { structuredContent: catalog };
      else if (message.params.name === 'nostroma_status') result = { structuredContent: { hardware: board, recommendation: catalog.recommendation, install: null, running: [], summary: 'x' } };
      else result = { structuredContent: { summary: 'Ready', install: { running: false, exit_code: 0 } } };
      queueMicrotask(() => child.stdout.emit('data', Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + String.fromCharCode(10))));
    } };
    return child;
  };
  let ready = health === 'ready', asked = 0;
  const control = {
    control: { dir: join(root, 'control'), python: join(root, 'control', 'python', 'python') }, version: '0.2.9',
    async installedModels() { return { install_dir: install, models: [{ id: 'iq3_s', name: 'Qwen iq3_s', source_config: configPath, context_tokens: 32768, backend: 'cuda', component_status: 'present', missing: [], issue_codes: [] }] }; },
    async engine() { return { usable: true, backend: 'cuda', components_dir: join(root, 'c'), engine: { version: '0.1.62', platform: 'win32-x86_64', backend: 'cuda', exe: join(root, 'engine', 'nostroma.exe'), root: join(root, 'engine') } }; },
    async saveProfile() { return {}; },
    async start() { if (failStart) throw new Error('server_exited: out of memory'); return { ok: true, state: 'ready' }; },
    async stop() { return { ok: true }; },
    async status() { const phase = phases[Math.min(asked++, Math.max(0, phases.length - 1))]; return phase ? { state: 'starting', phase } : {}; },
  };
  const fetcher = async (url, options = {}) => {
    if (url.endsWith('/health')) return ready ? Response.json({ status: 'ok' }) : new Response('', { status: 503 });
    if (url.endsWith('/v1/chat/completions')) {
      if (warmup === 'fail') return Response.json({ error: { message: 'The speed test did not finish.' } }, { status: 500 });
      if (warmup === 'no-timings') return Response.json({ usage: { prompt_tokens: 30, completion_tokens: 4 } });
      return Response.json({ usage: { prompt_tokens: 30, completion_tokens: 8 }, timings: { predicted_per_second: 42, prompt_per_second: 900 } });
    }
    if (url.includes('/metrics')) return Response.json({ engine: { max_context: 32768, drafting_note: '' }, live: { state: 'idle' }, requests: [] });
    if (url.endsWith('/mcp')) return Response.json({ tools: 0, servers: [] });
    return Response.json({ status: 'ok' });
  };
  const native = createNativeControl({ control, directory: data, spawnProcess, fetcher, requests: () => [], modelsDirectory: () => join(root, 'models'), hardwareProbe: () => board.gpus });
  return { native, logPath, configPath, catalog, hardware: board, release: () => { ready = true; },
    cleanup: () => { if (earlier === undefined) delete process.env.NOSTROMA_INSTALL_DIR; else process.env.NOSTROMA_INSTALL_DIR = earlier; rmSync(root, { recursive: true, force: true }); } };
}
const jobOf = (f, id) => f.native.state().jobs.find(j => j.id === id);

test('the preflight says what a start needs before the engine runs, and it never stops the load', async () => {
  const f = fixture();
  try {
    await f.native.refresh(true);
    const id = f.native.operation('load', { model: 'iq3_s' }).id;
    await until(() => jobOf(f, id)?.progress?.stage === 'preflight', 'the preflight stage');
    const job = jobOf(f, id), p = job.progress.preflight;
    assert.equal(job.state, 'running', 'a warning, never a refusal');
    // the figures are the Models page's own accounting: 8 GB of RAM cannot hold 60 GB of experts, so they spill
    assert.equal(p.ram.totalGb, 8);
    assert.equal(p.ram.ok, false);
    assert.ok(p.ram.usedGb > p.ram.totalGb, `${p.ram.usedGb} GB asked of ${p.ram.totalGb} GB`);
    assert.equal(p.vram.totalGb, 24);
    assert.equal(p.vram.ok, true, 'the card has room for what it holds');
    assert.ok(p.vram.usedGb > 0 && p.vram.usedGb <= p.vram.totalGb);
    assert.ok(p.spillGb > 0, 'the experts that do not fit are read from the SSD');
    assert.equal(p.disk.needGb, 0.5);
    assert.equal(p.disk.ok, p.disk.freeGb >= 0.5 && p.disk.freeGb >= p.disk.cacheGb, 'free space against the cache it must also hold');
    assert.ok(p.warnings.includes('SSD spill likely. Part of this model may be read from storage, so responses can be slower.'));
    assert.ok(p.warnings.includes('The context cache and runtime need to fit in RAM or GPU memory.'));
    assert.equal(p.warnings.includes('Not enough disk space'), !p.disk.ok, 'the disk warning follows the disk row, never the other figures');
    // the ETA of this stage is its fallback (5 s), counted from when the stage began
    assert.ok(job.progress.etaSeconds <= 5 && job.progress.etaSeconds >= 0, String(job.progress.etaSeconds));
    assert.ok(Date.parse(job.progress.since) > 0);
    assert.ok(job.progress.elapsedS >= 0);
    f.release();
    const done = await finish(f.native, id);
    assert.equal(done.state, 'done', done.error);
  } finally { await f.native.close(); f.cleanup(); }
});

test('the engine log moves the stage forward with its own ETA, and no line takes it back', async () => {
  const f = fixture({ phases: ['preparing'] });   // Control, asked every 2 s, stays behind the log
  try {
    await f.native.refresh(true);
    const id = f.native.operation('load', { model: 'iq3_s' }).id;
    await until(() => jobOf(f, id)?.progress?.stage === 'preflight', 'the preflight stage');
    const expertsGb = jobOf(f, id).progress.preflight.expertsGb;
    assert.ok(expertsGb > 0);

    appendFileSync(f.logPath, 'loaded 12.5 GiB at 0.5 GiB/s\n');
    await until(() => jobOf(f, id)?.progress?.stage === 'reading-experts', 'reading the experts');
    let p = jobOf(f, id).progress;
    assert.equal(p.expertsDoneGb, 12.5, 'how much is in memory, from the engine');
    const elapsed = (Date.now() - Date.parse(p.since)) / 1000;
    assert.ok(Math.abs(p.etaSeconds - (expertsGb / 0.5 - elapsed)) <= 2.5, `${p.etaSeconds} against ${expertsGb / 0.5 - elapsed}`);
    const expertsSince = p.since;

    appendFileSync(f.logPath, 'expert cache 8 slots\n');
    await until(() => jobOf(f, id)?.progress?.stage === 'filling-cache', 'filling the cache');
    p = jobOf(f, id).progress;
    assert.notEqual(p.since, expertsSince, 'the ETA counts from this stage');
    assert.equal(p.percent, undefined, 'no percentage without a count of layers');
    assert.ok(p.etaSeconds <= 30 && p.etaSeconds >= 0, String(p.etaSeconds));

    appendFileSync(f.logPath, 'copied cache complement through layer 3/10\n');
    await until(() => jobOf(f, id)?.progress?.percent === 30, 'the cache percentage');
    assert.equal(jobOf(f, id).progress.stage, 'filling-cache');

    appendFileSync(f.logPath, 'session is up\n');
    await until(() => jobOf(f, id)?.progress?.stage === 'waiting-server', 'waiting for the server');

    appendFileSync(f.logPath, 'starting the engine\n');
    await sleep(1200);
    assert.equal(jobOf(f, id).progress.stage, 'waiting-server', 'a line of an earlier stage does not go back');

    f.release();
    const done = await finish(f.native, id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(done.progress.stage, 'ready');
    assert.equal(done.progress.percent, 100);
    assert.match(done.summary, /is ready/, 'the instance is ready once the server answers');
    assert.equal(done.progress.etaSeconds, null, 'nothing left to count');
    assert.equal(done.progress.expertsDoneGb, undefined, 'the per-stage figure is not left behind');
  } finally { await f.native.close(); f.cleanup(); }
});

test('with nothing in the log, the states Control reports are the stages', async () => {
  const f = fixture({ log: false, phases: ['checking_engine', 'loading'] });
  try {
    await f.native.refresh(true);
    const id = f.native.operation('load', { model: 'iq3_s' }).id;
    await until(() => jobOf(f, id)?.progress?.stage === 'checking-engine', 'Control checking the engine');
    await until(() => jobOf(f, id)?.progress?.stage === 'loading', 'Control loading');
    assert.equal(jobOf(f, id).state, 'running');
    f.release();
    const done = await finish(f.native, id);
    assert.equal(done.state, 'done', done.error);
    assert.equal(done.progress.stage, 'ready');
  } finally { await f.native.close(); f.cleanup(); }
});

test('a load that fails keeps its error and the preflight figures, never the stage it stopped in', async () => {
  const f = fixture({ failStart: true });
  try {
    await f.native.refresh(true);
    const job = await finish(f.native, f.native.operation('load', { model: 'iq3_s' }).id);
    assert.equal(job.state, 'error');
    assert.match(job.error, /out of memory/);
    assert.equal(job.progress.stage, undefined, 'no "reading the experts" beside the error');
    assert.equal(job.progress.etaSeconds, undefined, 'and no time left to count');
    assert.equal(job.progress.since, undefined);
    assert.equal(job.progress.percent, undefined);
    assert.equal(job.progress.expertsDoneGb, undefined);
    assert.ok(job.progress.preflight, 'the figures that explain the failure stay');
    assert.equal(job.progress.preflight.ram.ok, false);
  } finally { await f.native.close(); f.cleanup(); }
});

test('a load the person stops clears the stage and the time left too', async () => {
  const f = fixture();
  try {
    await f.native.refresh(true);
    const id = f.native.operation('load', { model: 'iq3_s' }).id;
    await until(() => jobOf(f, id)?.progress?.stage === 'preflight', 'the preflight stage');
    await f.native.cancel(id);
    const job = jobOf(f, id);
    assert.equal(job.state, 'cancelled');
    assert.equal(job.summary, 'Stopped.');
    assert.equal(job.progress.stage, undefined);
    assert.equal(job.progress.etaSeconds, undefined);
    assert.equal(job.progress.since, undefined);
    assert.ok(job.progress.preflight, 'what was checked before the stop is still there');
    // the stopped load still unloads and writes its own job file: let it settle before the folder goes
    await until(() => f.native.state().instances.length === 0, 'the stopped load is unloaded');
    await sleep(400);
  } finally { await f.native.close(); f.cleanup(); }
});

test('the card says a failed load once: the step falls back to the kind, the error stays in its notice', async () => {
  const models = readFileSync(new URL('../src/components/NativeModels.tsx', import.meta.url), 'utf8');
  assert.match(models, /: job\.error \? '' : job\.summary/, 'no stage and an error: not the error again as the step');
});

test('the speed test after a load is reported in the progress, and its failure never fails the load', async () => {
  const cases = [
    { warmup: 'ok', check: w => { assert.equal(w.outputTps, 42); assert.equal(w.promptTps, 900); assert.equal(w.tokensOut, 8); } },
    { warmup: 'no-timings', check: w => { assert.equal(w.tokensOut, 4); assert.ok(w.outputTps > 0, 'tokens over the time it took'); } },
    { warmup: 'fail', check: w => assert.equal(w.error, 'The speed test did not finish.') },
  ];
  for (const { warmup, check } of cases) {
    const f = fixture({ log: false, health: 'ready', warmup });
    try {
      await f.native.refresh(true);
      const done = await finish(f.native, f.native.operation('load', { model: 'iq3_s', warmup: true }).id);
      assert.equal(done.state, 'done', done.error);
      assert.ok(done.progress.warmup, `${warmup}: the speed test ran`);
      if (!done.progress.warmup.error) assert.ok(done.progress.warmup.ms >= 1, 'a measured time');
      check(done.progress.warmup);
      assert.equal(done.progress.stage, 'ready');
      assert.equal(f.native.state().instances[0].status, 'ready', `${warmup}: the model is loaded all the same`);
    } finally { await f.native.close(); f.cleanup(); }
  }
});

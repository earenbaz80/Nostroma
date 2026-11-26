/**
 * The local terminal behind the Workbench.
 *
 * It is deliberately small: one shell command at a time, run in the folder the
 * person is in, with the output handed to the panel while the command runs.
 * `cd` is handled here so the next command starts in the new folder; everything
 * else is a real child process. The panel is a local development tool, not an
 * agent tool: the route that calls it refuses requests that did not come from
 * this computer.
 */
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { clampTimeoutSec, planShell } from './agent/custom-command-run.mjs';
import { childEnv } from './env-compat.mjs';
import { endTreeThenKill, ownGroup } from './process-tree.mjs';

const OUT_MAX = 200_000;
const SESSION_LIMIT = 80;
/* A build can take minutes. Now that the panel has a Stop key the timer is only
   a backstop against a command that never ends, so it is generous. */
const DEFAULT_TIMEOUT_SEC = 900;

/** A folder a command may run in, or a plain sentence saying why it cannot. */
function folderFor(value, base) {
  const raw = String(value ?? '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return { error: 'Type a folder.' };
  const expanded = raw.replace(/^~(?=$|[\\/])/, homedir());
  const target = resolve(base, expanded);
  try {
    if (!statSync(target).isDirectory()) return { error: `“${raw}” is not a folder.` };
    return { target };
  } catch {
    return { error: `The folder “${raw}” does not exist.` };
  }
}

/**
 * Run one command, handing each piece of output over as it arrives.
 *
 * `onOutput(text, stream)` sees every chunk, stdout and stderr kept apart, so
 * the panel can paint a build while it runs. `onStart` receives the way to stop
 * it, and a run the person stopped says so rather than looking like a failure.
 * Returns how it ended; the text itself is not repeated to the caller.
 */
function runShell(command, cwd, { onOutput, onStart, timeoutSec = DEFAULT_TIMEOUT_SEC } = {}) {
  return new Promise(resolveRun => {
    const plan = planShell(command, { shell: 'auto' });
    let child;
    try {
      child = spawn(plan.file, plan.args, {
        shell: plan.shell,
        cwd,
        env: childEnv(process.env),
        windowsHide: true,
        detached: ownGroup(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      return resolveRun({ ok: false, output: `The command could not start: ${error.message}`, exitCode: null });
    }
    let forwarded = 0;
    let cut = false;
    let timedOut = false;
    let stopped = false;
    const take = (chunk, stream) => {
      const text = chunk.toString();
      if (forwarded >= OUT_MAX) {
        cut = true;
        return;
      }
      forwarded += text.length;
      onOutput?.(text, stream);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      /* The whole tree, then whatever is still there: a build leaves children. */
      endTreeThenKill(child, 1500);
    };
    onStart?.(stop);
    child.stdout.on('data', chunk => take(chunk, 'out'));
    child.stderr.on('data', chunk => take(chunk, 'err'));
    const timer = setTimeout(() => {
      timedOut = true;
      endTreeThenKill(child, 1500);
    }, clampTimeoutSec(timeoutSec) * 1000);
    child.on('error', error => {
      clearTimeout(timer);
      resolveRun({ ok: false, output: `The command could not start: ${error.message}`, exitCode: null });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolveRun({ ok: !timedOut && !stopped && code === 0, exitCode: code, cut, stopped, timedOut, streamed: true });
    });
  });
}

export function createTerminal({ defaultCwd = process.cwd() } = {}) {
  const sessions = new Map();

  function stateFor(id) {
    const key = String(id ?? '').slice(0, 100) || 'default';
    let state = sessions.get(key);
    if (!state) {
      state = { cwd: defaultCwd, previous: defaultCwd, active: null };
      if (sessions.size >= SESSION_LIMIT) {
        const oldest = sessions.keys().next().value;
        if (oldest !== undefined) sessions.delete(oldest);
      }
      sessions.set(key, state);
    }
    return state;
  }

  return {
    /** The folder this terminal session is in. */
    cwd(id) {
      return stateFor(id).cwd;
    },

    /**
     * Run one command. Early answers (`cd`, `clear`, a folder that is gone) carry
     * their text in `output`; a real command streams through `onOutput` and
     * resolves with how it ended, the folder afterwards and the exit code.
     */
    async run({ sessionId, command, cwd, onOutput } = {}) {
      const state = stateFor(sessionId);
      if (state.active) {
        return { ok: false, output: 'A command is already running in this terminal.', cwd: state.cwd, exitCode: null };
      }
      if (cwd) {
        const where = folderFor(cwd, state.cwd);
        if (where.error) return { ok: false, output: where.error, cwd: state.cwd, exitCode: null };
        state.cwd = where.target;
      }
      const text = String(command ?? '').replace(/\r\n/g, '\n').trim();
      if (!text) return { ok: true, output: '', cwd: state.cwd, exitCode: 0 };
      if (text.length > 4000) {
        return { ok: false, output: 'That command is too long.', cwd: state.cwd, exitCode: null };
      }
      if (/^(clear|cls)$/i.test(text)) {
        return { ok: true, clear: true, output: '', cwd: state.cwd, exitCode: 0 };
      }
      const changeFolder = /^cd(?:\s+([\s\S]*))?$/i.exec(text);
      if (changeFolder) {
        const wanted = changeFolder[1]?.trim() ?? '';
        if (wanted === '-') {
          const swap = state.previous;
          state.previous = state.cwd;
          state.cwd = swap;
          return { ok: true, output: `Changed folder to ${state.cwd}.`, cwd: state.cwd, exitCode: 0 };
        }
        const where = folderFor(wanted || '~', state.cwd);
        if (where.error) return { ok: false, output: where.error, cwd: state.cwd, exitCode: null };
        state.previous = state.cwd;
        state.cwd = where.target;
        return { ok: true, output: `Changed folder to ${state.cwd}.`, cwd: state.cwd, exitCode: 0 };
      }
      const startedAt = Date.now();
      let stop = null;
      state.active = { stop: () => stop?.() };
      try {
        const result = await runShell(text, state.cwd, {
          onOutput,
          onStart: handle => { stop = handle; },
        });
        return { ...result, cwd: state.cwd, durationMs: Date.now() - startedAt };
      } finally {
        state.active = null;
      }
    },

    /**
     * Stop the command this session is running, with everything it started.
     * Stopping nothing is not an error: a command may have just finished.
     */
    stop(sessionId) {
      const state = stateFor(sessionId);
      if (!state.active) return { ok: true, stopped: false };
      state.active.stop();
      return { ok: true, stopped: true };
    },
  };
}

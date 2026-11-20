/**
 * Which remembered model the host starts by itself when it comes up (STRATA_REAL_ENGINE=1): the one loaded last, else the current one.
 * A remembered DeepSeek model (Nostroma 0.2.13 and earlier; nostroma_control/retired.py) is not started: the approved refusal goes to the host
 * log, as every autostart failure does, and nothing is written - the remembered value stays in the settings file exactly as it was.
 */
export const DEEPSEEK_ID = /deepseek/i;

export function refusalLine(id) {
  return `autostart failed: ${id} is a DeepSeek model. This version of Nostroma no longer runs DeepSeek models, so it was not started.`;
}

/** The model id to start, or null. Reads `state` only; `log` gets the refusal line for a DeepSeek id. */
export function autostartModel(state, env = process.env, log = (line) => console.error(line)) {
  const id = (env.NOSTROMA_REAL_ENGINE ?? env.STRATA_REAL_ENGINE) === '1' ? (state?.loaded ?? state?.current ?? null) : null;
  if (id && DEEPSEEK_ID.test(String(id))) {
    log(refusalLine(id));
    return null;
  }
  return id;
}

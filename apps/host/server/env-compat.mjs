/**
 * The environment variables moved from STRATA_* to NOSTROMA_*. This build reads and writes the new names; the old ones are
 * still accepted, so a launcher, a script, an engine child or a component that was set up before the rename keeps working.
 */

/** The value of NOSTROMA_<name>, or the older STRATA_<name> when only that one is set. */
export const envVar = name => process.env[`NOSTROMA_${name}`] ?? process.env[`STRATA_${name}`];

/** True when either name is set to anything. */
export const hasEnvVar = name => envVar(name) !== undefined;

/** One value under both names, for a child that may still read the old name. */
export function setEnvVars(target, values) {
  for (const [name, value] of Object.entries(values)) {
    target[`NOSTROMA_${name}`] = value;
    target[`STRATA_${name}`] = value;
  }
  return target;
}

/**
 * An environment for a child process: every NOSTROMA_* value is also under STRATA_* and the other way round, so the engine
 * and the Python packages (which read the old names) and the host (which reads the new ones) see the same settings. When
 * both are set, the new name wins in both: the engine cannot read a value the host ignores.
 */
export function childEnv(values = process.env) {
  const out = { ...values };
  for (const [name, value] of Object.entries(values)) {
    if (name.startsWith('NOSTROMA_')) out[`STRATA_${name.slice('NOSTROMA_'.length)}`] = value;
    else if (name.startsWith('STRATA_') && out[`NOSTROMA_${name.slice('STRATA_'.length)}`] === undefined) out[`NOSTROMA_${name.slice('STRATA_'.length)}`] = value;
  }
  return out;
}

/** Fill in the missing name for every variable in this process, once at startup, so anything inherited carries both. */
export function aliasOldNames(env = process.env) {
  Object.assign(env, childEnv(env));
  return env;
}

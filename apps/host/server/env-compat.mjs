/** The environment variables are NOSTROMA_*: one prefix, read and written everywhere. */

/** The value of NOSTROMA_<name>. */
export const envVar = name => process.env[`NOSTROMA_${name}`];

/** True when NOSTROMA_<name> is set to anything. */
export const hasEnvVar = name => envVar(name) !== undefined;

/** Set one value per name under the Nostroma prefix. */
export function setEnvVars(target, values) {
  for (const [name, value] of Object.entries(values)) {
    target[`NOSTROMA_${name}`] = value;
  }
  return target;
}

/** A copy of the environment for a child process. */
export function childEnv(values = process.env) {
  return { ...values };
}

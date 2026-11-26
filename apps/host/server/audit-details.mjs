/** The sentences the general audit says. They travel as keys, not as prose, so
 *  the page translates them: a path, a version or a count is a value and never
 *  part of the sentence. AUDIT_KEYS is the list the catalog test covers.
 *  The audit is opened from a chat in a project, so its first rows are that
 *  project's folder and its git state. */
export const AUDIT_KEYS = [
  'This project folder was not found: {0}',
  '{0} is a file, not a folder.',
  'git keeps no versions of this folder: it is not a repository.',
  '{0} files changed in this project and not saved in a commit.',
  '{0} · nothing to commit',
  'The profile folder {0} cannot be written: {1}',
  '{0} GiB free in {1}',
  'The free space could not be read: {0}',
  'This build does not manage the engine from here.',
  'No usable engine was found in {0}. Use Update engine in Settings, or `nostroma update` in the Terminal.',
  'No usable engine was found. Use Update engine in Settings, or `nostroma update` in the Terminal.',
  'No model is loaded.',
  'The models could not be read: {0}',
  '{0} projects',
  '{0} folders were not found: {1}',
  '{0} chats',
  '{0} chats, {1} unreadable',
  'git is not installed: cloning and linking a repository need it.',
  'No graphics card was found.',
];

const fill = (key, values) => values.reduce((text, value, at) => text.split(`{${at}}`).join(String(value)), key);

/** One audit line: the English text (for logs and readers of the API) and the
 *  key the page translates, with its values. */
export function auditLine(key, values = []) {
  return { detail: fill(key, values), detailKey: key, detailValues: values.map(String) };
}

/** A line that is a value, not a sentence: a path, a version, a list of names. */
export function auditValue(value) {
  return { detail: String(value) };
}

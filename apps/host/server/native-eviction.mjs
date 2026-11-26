/**
 * What a Prepare (`install`) does with the models that are loaded (P0-3 of the first-run pass).
 *
 * A model that is loaded only has to stop when the files being prepared are its own, or when the new model does not fit
 * beside it. Three rules:
 *
 *   - A model the person asked to keep in memory is never stopped by a Prepare. "Asked to keep" is the mark the
 *     person set for this model in its own run config (`keep_loaded: true`, the settings row "Keep this model loaded
 *     when preparing files"), or the page was set to Run multiple models, which is the same request for the models it
 *     loaded. An idle unload of zero is not that request: it says "do not unload me for being idle", not "never touch
 *     me", so it does not protect a model from a Prepare.
 *   - A loaded model that leaves room for the new one stays loaded: a Prepare for another model does not need the memory.
 *   - Otherwise the model stops, and the job says what the stop will cost before it happens: the memory it frees and how
 *     long this PC needs to load it again.
 *
 * The figures are not invented here: the caller passes the memory the model held (shared/memory-budget.mjs) and the
 * load time measured on this PC (Control's stage durations) or the app's own per-stage fallbacks.
 */

/** True when the person asked for this model to stay in memory: the explicit mark the settings row writes. */
export function keepsLoaded(config) {
  return config?.keep_loaded === true;                       // only the mark: an idle unload of zero says something else
}

/** Which loaded models a Prepare may stop and which it must leave alone. */
export function evictionPlan({ instances = [], multiple = false, keeps = () => false } = {}) {
  const kept = [], evict = [];
  for (const instance of instances) (multiple || keeps(instance) ? kept : evict).push(instance);
  return { kept, evict };
}

/**
 * The same decision for a Prepare: `fits` is whether the model being prepared fits in memory beside the loaded ones.
 * When it does, nothing stops (unless it is the model whose files are being rewritten). When it does not, the models the
 * person did not ask to keep stop, and `fits` comes back false so the caller knows the Prepare needed the room.
 *
 * `shared` are the models the preparation writes a file of (sharedWritePlan below): the picture reader or the draft
 * layer its engine has open. They stop whatever the memory says. A model the person asked to keep is never stopped, so
 * it comes back in `keptWriting` for the caller to refuse instead.
 */
export function installPlan({ instances = [], target = null, multiple = false, keeps = () => false, fits = true, shared = [] } = {}) {
  const plan = evictionPlan({ instances, multiple, keeps });
  const same = instances.some(instance => instance.model === target);
  const writing = new Set(shared);
  const keptWriting = plan.kept.filter(instance => writing.has(instance));
  /* When the memory allows both, only the files the preparation rewrites stop a model: the rest stay loaded. */
  const memory = fits && !same ? [] : plan.evict;
  const evict = [...new Set([...memory, ...shared.filter(instance => !plan.kept.includes(instance))])];
  if (!evict.length) return { ...plan, evict: [], fits: fits && !same, writing: [], keptWriting };
  return { ...plan, evict, fits: false, writing: [...writing], keptWriting };
}

const normalizePath = path => String(path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const insideFolder = (path, folder) => {
  const p = normalizePath(path), f = normalizePath(folder);
  return !!p && !!f && (p === f || p.startsWith(`${f}/`));
};

/**
 * The files a model's run config names that a Prepare of another model can rewrite while its engine has them open:
 * the picture reader (its own section) and the draft layer (`--mtp`). Null when the config names none.
 */
export function openFiles(config = {}) {
  const args = Array.isArray(config?.args) ? config.args : [];
  const flag = name => {
    const at = args.indexOf(name);
    return at >= 0 && typeof args[at + 1] === 'string' ? args[at + 1] : null;
  };
  return {
    reader: typeof config?.vision?.mmproj === 'string' && config.vision.mmproj ? config.vision.mmproj : null,
    draft: flag('--mtp'),
  };
}

/**
 * Which loaded models a Prepare has to stop because it writes a file their engine has open, whatever the memory says.
 * `target.files` are the paths the target's own run config names (an installed model being prepared again);
 * `target.reader`/`target.draft` say whether the preparation fetches them, and `target.folder`/`target.families` narrow
 * it to the folder it writes into and the picture reader of its own family. A model that names neither file is never
 * stopped for this.
 */
export function sharedWritePlan({ instances = [], target = {} } = {}) {
  const files = new Set((target.files ?? []).filter(Boolean).map(normalizePath));
  const families = target.families ? new Set(target.families) : null;
  const inFolder = path => !target.folder || insideFolder(path, target.folder);
  return instances.filter(instance => {
    const open = openFiles(instance.config);
    if (open.reader && (files.has(normalizePath(open.reader))
      || (target.reader === true && inFolder(open.reader) && (!families || families.has(instance.family))))) return true;
    if (open.draft && (files.has(normalizePath(open.draft)) || (target.draft === true && inFolder(open.draft)))) return true;
    return false;
  });
}

const listWords = items => items.length < 2 ? String(items[0] ?? '')
  : items.length === 2 ? `${items[0]} and ${items[1]}`
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** "30 seconds", "a minute", "4 minutes"; null when there is no figure to give. */
export function aboutText(seconds) {
  const value = Math.round(Number(seconds));
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 45) return `${value} seconds`;
  const minutes = Math.max(1, Math.round(value / 60));
  return minutes === 1 ? 'a minute' : `${minutes} minutes`;
}

/**
 * Why a loaded model stops in a Prepare: it is the model being prepared again (its own engine is replaced), the
 * preparation rewrites a file its engine has open, or the new model needs the memory. The same model prepared again
 * comes first: replacing its engine is what stops it, not a lack of room.
 */
export function stopWhy(instance, { target = null, writing = [] } = {}) {
  if (!instance) return 'memory';
  if (target !== null && target !== undefined && instance.model === target) return 'again';
  return writing.some(one => one && one.id === instance.id) ? 'files' : 'memory';
}

/**
 * The question asked before a Prepare stops loaded models: their names, the memory the stop frees and how long
 * loading them again takes. Null when there is nothing to stop (and nothing to ask).
 *
 * Each model says why it stops (`why`: 'memory', 'files' or 'again', stopWhy above) and the opening names every reason
 * the stop really is, so a model stopped because its own files are rewritten is never said to lack memory. `why` is the
 * reason for a model that does not carry one.
 */
export function evictionQuestion(models = [], why = 'memory') {
  const list = models.filter(model => model && model.label);
  if (!list.length) return null;
  const reason = model => ['memory', 'files', 'again'].includes(model.why) ? model.why : why;
  const many = list.length > 1;
  const them = many ? 'them' : 'it';
  const gb = list.reduce((total, model) => total + (Number(model.gb) > 0 ? Number(model.gb) : 0), 0);
  const seconds = Math.max(0, ...list.map(model => Number(model.seconds)).filter(Number.isFinite));
  const freed = gb > 0 ? `${gb.toFixed(1)} GB of memory` : `${many ? 'their' : 'its'} memory`;
  const time = aboutText(seconds);
  const named = kind => list.filter(model => reason(model) === kind).map(model => model.label);
  const again = named('again'), files = named('files'), memory = named('memory');
  const clauses = [];
  if (again.length) clauses.push(`replaces the engine of ${listWords(again)}`);
  if (files.length) clauses.push(`rewrites a file ${listWords(files)} ${files.length > 1 ? 'have' : 'has'} open`);
  if (memory.length) clauses.push(`needs the memory of ${listWords(memory)}`);
  return `Preparing this model ${clauses.join(', and ')}. `
    + `Stopping ${them} frees ${freed}${time ? `, and loading ${them} again takes about ${time}` : ''}. Continue?`;
}

/** Why a stop happens: the memory the new model needs, a file the preparation rewrites, or the same model loading again. */
const stopReason = why => why === 'again' ? ' to replace its engine' : why === 'files' ? ' to replace a file it has open' : ' to make room';

/**
 * The words while the stop is under way: the model is still in memory, so it is not "Stopped" yet. The job says this
 * before it calls unload, and only a stop that finished is said in the past (evictionSentence below).
 */
export function stoppingSentence({ label, gb = null, seconds = null, why = 'memory' } = {}) {
  const freed = Number(gb) > 0 ? ` and freeing ${Number(gb).toFixed(1)} GB of memory` : ' and freeing its memory';
  const time = aboutText(seconds);
  return `Stopping ${label}${stopReason(why)}${freed}. ${time ? `It takes about ${time} to load it again.` : 'It loads again when you start it.'}`;
}

/** The line the job keeps: which model stopped, how much memory that freed, and how long it takes to load again. */
export function evictionSentence({ label, gb = null, seconds = null, why = 'memory' } = {}) {
  const freed = Number(gb) > 0 ? ` and freed ${Number(gb).toFixed(1)} GB of memory` : ' and freed its memory';
  const time = aboutText(seconds);
  return `Stopped ${label}${stopReason(why)}${freed}. ${time ? `It takes about ${time} to load it again.` : 'It loads again when you start it.'}`;
}

/** Said instead of stopping a model the person asked to keep: what happened and the two ways forward. */
export function keptRefusal(labels = []) {
  const many = labels.length > 1;
  const them = many ? 'them' : 'it';
  return `${listWords(labels)} ${many ? 'are' : 'is'} set to stay in memory, so preparing files did not stop ${them}. `
    + `Unload ${them} in Models, or set “Unload after idle seconds” above zero, then try again.`;
}

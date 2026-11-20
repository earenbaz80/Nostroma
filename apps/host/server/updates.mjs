import { APP_UPDATES_OFF, looksOffline, plainUpdateError } from './update-messages.mjs';

/**
 * This checkout publishes no release feed of its own, and the only one it could read belongs to another product. So the check
 * names no version and makes no request: a browser-mode "Check for updates" can never point at, or offer, that build.
 */
export async function checkUpdates({ appVersion, engineVersion }) {
  return {
    checkedAt: new Date().toISOString(),
    strata: { installedVersion: appVersion, status: 'unavailable', canInstall: false, message: APP_UPDATES_OFF },
    engine: { installedVersion: engineVersion, status: 'unavailable', canInstall: false, message: 'Engine update checks are not available in this build.' },
  };
}

/** The engine row after a version failed its test start on this computer (owner-approved wording, 11-09). */
export const engineFailedBeforeText = (offered, installed) => `Engine ${offered ?? 'update'} didn't start correctly on this computer, so Nostroma kept engine ${installed ?? 'in use'}. Press Update engine to try again.`;

/**
 * The packaged app's update check: the signed feed, read by Control (`strata update --check`), for the engine row. The app row
 * is always off (see below). Same result shape as `checkUpdates`, so the Settings screen needs no change. This is the only
 * place the host reaches the feed, and only when the user presses "Check for updates".
 */
export async function checkComponentUpdates({ control, appVersion = null }) {
  const checkedAt = new Date().toISOString();
  let report;
  try {
    report = await control.updateCheck({ appVersion });
  } catch (error) {
    const plain = plainUpdateError(error, 'Nostroma');
    const message = /update server|aren't available|No internet/.test(plain.headline) ? plain.message : `Couldn't check for updates. Try again in a moment.`;
    return { checkedAt, strata: { installedVersion: appVersion ?? control.version ?? null, status: 'error', message, details: plain.details, canInstall: false }, engine: { installedVersion: null, status: 'error', message, details: plain.details, canInstall: false } };
  }
  const mib = bytes => `${Math.round((bytes ?? 0) / 1_000_000)} MB`;      // decimal megabytes, like the Terminal and the release page
  const engine = report.engine ?? {};
  const installedEngine = engine.installed?.version ?? null;
  const offered = engine.offered?.version ?? null;
  const engineView = { installedVersion: installedEngine, latestVersion: offered ?? undefined, canInstall: engine.status === 'available' || engine.status === 'install' };
  if (engine.status === 'available' && engine.installed_locally) Object.assign(engineView, { status: 'available', message: 'A newer engine is already on this computer. Update switches to it; nothing is downloaded.' });
  else if (engine.status === 'available') Object.assign(engineView, { status: 'available', message: `A new engine is available (${mib(engine.download_bytes)}).` });
  else if (engine.status === 'install') Object.assign(engineView, { status: 'available', message: `This PC needs an engine to run models. Press Update engine to download it (${mib(engine.download_bytes)}).` });
  // A version that failed its test start here is held back by Control for a day (status failed-before). It is not 'up to date': the row says what happened and
  // offers the update again (the app's Update engine passes --force, so the press really tries it again). QAGUI-LIN 0213.
  else if (engine.status === 'failed-before') Object.assign(engineView, { status: 'available', canInstall: true, retry: true, message: engineFailedBeforeText(offered, installedEngine), details: engine.note });
  else if (engine.status === 'current' || engine.status === 'skipped') Object.assign(engineView, { status: 'current', message: 'The engine is up to date.', details: engine.note });
  else if (engine.status === 'wrong-make') Object.assign(engineView, { status: 'unavailable', message: engine.note ?? 'Nothing was changed: the update was for another make of graphics card.', details: (engine.reasons ?? []).join('\n') || undefined });
  else if (engine.status === 'not-in-feed') Object.assign(engineView, { status: 'current', message: 'No engine update is listed right now.' });
  else Object.assign(engineView, { status: 'unavailable', message: "There isn't an engine for this PC's graphics card yet.", details: (engine.reasons ?? []).join('\n') || undefined });
  const control_ = report.control ?? {};
  /* The app row is off in this build. Control's feed carries the app installer and the Control package of the project that
     publishes it, and this checkout has one of neither: offering them here could only install that other build. The engine
     row above is Control's own and keeps working, and so does the engine step of an update. */
  const strata = {
    installedVersion: appVersion ?? control_.installed ?? control.version ?? null,
    status: 'unavailable',
    canInstall: false,
    message: APP_UPDATES_OFF,
  };
  return { checkedAt, feed: report.feed, strata, engine: engineView, serving: report.serving ?? [] };
}

/**
 * What the first-run card shows: this PC's graphics card(s), the engine package the signed feed offers for it and how big it is.
 * One feed read, nothing downloaded. `status`: offer (a package fits), none (nothing fits; `reasons` say why), offline (the feed could not be
 * read), installed (an engine is already here), wrong-make (an engine for another make of card is installed).
 */
export async function engineFirstRun({ control, gpus = [] }) {
  const cards = gpus.map(g => ({ name: g.name ?? 'Graphics card', vramGb: g.vramGb ?? null }));
  let report;
  try {
    report = await control.updateCheck({});
  } catch (error) {
    const plain = plainUpdateError(error, 'Nostroma');
    return { status: looksOffline(error) || /update server|No internet/.test(plain.headline ?? '') ? 'offline' : 'error', gpus: cards, message: plain.message, details: plain.details };
  }
  const engine = report.engine ?? {};
  const hardware = report.hardware ?? {};
  const base = { gpus: cards, driver: hardware.nvidia_driver ?? null, backend: hardware.backend ?? null };
  if (engine.installed) return { ...base, status: 'installed', installedVersion: engine.installed.version ?? null };
  if (engine.status === 'wrong-make') return { ...base, status: 'wrong-make', message: engine.note ?? null, reasons: engine.reasons ?? [] };
  if (engine.offered && (engine.status === 'install' || engine.status === 'available')) {
    // A newer Nostroma Control in the same feed comes with the engine (an Arc user who has just installed the app needed 0.1.59.1's fix and had to find Settings > Updates; ARCFIX 0213).
    const ctl = report.control ?? {};
    const control = ctl.status === 'available' && ctl.offered ? { version: ctl.offered, bytes: ctl.download_bytes || 0 } : null;
    return { ...base, status: 'offer', offer: { version: engine.offered.version, bytes: engine.download_bytes || engine.offered.size || 0, variant: engine.offered.variant ?? '', backend: engine.offered.backend ?? null }, control };
  }
  return { ...base, status: 'none', message: engine.note ?? null, reasons: engine.reasons ?? [] };
}

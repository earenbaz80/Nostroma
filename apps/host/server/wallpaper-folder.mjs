/**
 * Where the background pictures live (Settings > Appearance > Background).
 *
 * A source checkout keeps `wallpapers/` at the project root, beside `apps/`, where a person can drop a picture.
 * The packaged app cannot use that rule: the host runs from `<install>/resources/host`, so `ROOT/../../wallpapers` is
 * `<install>/wallpapers`, outside the app's own files. Measured on 0.2.16 with a packaged layout
 * (`<install>/resources/host/server/index.mjs`, NOSTROMA_PACKAGED=1): the upload landed in `<install>/wallpapers`. On
 * Linux the AppImage is a read-only image, and on macOS that folder is inside the signed bundle, so there the picture
 * cannot be written at all; on Windows it is a folder beside the app that no uninstall removes.
 *
 * There the pictures go to `<NOSTROMA_HOME>/wallpapers`: the home the host already keeps its models and data in
 * (`~/.nostroma` by default, `store.mjs`). A checkout whose `wallpapers/` cannot be written (a read-only clone, a
 * folder owned by another user) falls back to the same place, so choosing a picture never fails because of where the
 * app happens to sit.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** True when a file can be written in this folder (made first when it is missing). */
export function canWrite(folder) {
    try {
        mkdirSync(folder, { recursive: true });
        const probe = join(folder, `.write-probe-${process.pid}`);
        writeFileSync(probe, '');
        rmSync(probe, { force: true });
        return true;
    }
    catch {
        return false;
    }
}

/** The folder the host lists and writes: `checkout` in a source build, `<home>/wallpapers` in the packaged app. */
export function wallpaperFolder({ packaged = false, checkout = null, home } = {}) {
    const perUser = join(home, 'wallpapers');
    if (packaged)
        return perUser;
    return checkout && canWrite(checkout) ? resolve(checkout) : perUser;
}

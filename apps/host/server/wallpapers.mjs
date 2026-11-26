/** The pictures a person can put behind the app (Settings > Appearance > Background).
 *
 * They live in `wallpapers/` at the project's root: the person can drop files there, and the page's
 * "Choose an image…" copies one in through the host. Only the picture types a browser can draw are
 * listed or served; anything else in the folder is ignored, and a name never reaches outside the
 * folder. Nothing here changes the setting itself: that stays in the page's preferences.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve, sep } from 'node:path';

export const WALLPAPER_TYPES = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
});

export const WALLPAPER_MAX_BYTES = 25 * 1024 * 1024;

/** The content type a stored picture is served with, or null for a file this app does not draw. */
export function wallpaperType(name) {
  return WALLPAPER_TYPES[extname(String(name)).toLowerCase()] ?? null;
}

/** A name safe to write in the folder: no folders, no control characters, and a picture extension. */
export function safeWallpaperName(name) {
  const base = basename(String(name ?? '').replace(/\\/g, '/'))
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, '-')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return null;
  const ext = extname(base).toLowerCase();
  if (!WALLPAPER_TYPES[ext]) return null;
  const stem = base.slice(0, -ext.length).slice(0, Math.max(1, 120 - ext.length)).trim();
  return `${stem || 'wallpaper'}${ext}`;
}

/** The same name, with -2, -3... before the extension when the folder already holds one. */
function uniqueName(folder, name) {
  const ext = extname(name), stem = name.slice(0, -ext.length);
  let candidate = name, n = 2;
  while (existsSync(join(folder, candidate))) candidate = `${stem}-${n++}${ext}`;
  return candidate;
}

/** The pictures directly inside the folder, in a stable order. Missing folder: no pictures. */
export function listWallpapers(folder) {
  if (!folder || !existsSync(folder)) return [];
  let entries;
  try { entries = readdirSync(folder, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter(entry => entry.isFile() && !entry.name.startsWith('.') && wallpaperType(entry.name))
    .map(entry => {
      let bytes = 0;
      try { bytes = statSync(join(folder, entry.name)).size; } catch { /* it left while we read */ }
      return { name: entry.name, url: `/api/appearance/wallpapers/${encodeURIComponent(entry.name)}`, bytes };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The file a request names, or null when that name is not a picture directly in this folder. */
export function wallpaperFile(folder, name) {
  const raw = String(name ?? '');
  if (!raw || raw.startsWith('.') || basename(raw) !== raw || !wallpaperType(raw)) return null;
  const root = resolve(folder), file = resolve(root, raw);
  return file.startsWith(`${root}${sep}`) ? file : null;
}

/** Write a picture the page uploaded. Returns the name the page should select. */
export function saveWallpaper(folder, { body, contentType = '', name = '' } = {}) {
  if (!Buffer.isBuffer(body) || !body.length) throw new Error('That image is empty.');
  if (body.length > WALLPAPER_MAX_BYTES) throw new Error('Choose an image smaller than 25 MB.');
  const type = String(contentType).toLowerCase();
  if (!/^image\//.test(type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
  const fallback = Object.entries(WALLPAPER_TYPES).find(([, value]) => value === type)?.[0] ?? '.png';
  const wanted = name ? safeWallpaperName(name) : `wallpaper-${Date.now()}${fallback}`;
  if (!wanted) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
  mkdirSync(folder, { recursive: true });
  const stored = uniqueName(folder, wanted);
  writeFileSync(join(folder, stored), body);
  return { name: stored, url: `/api/appearance/wallpapers/${encodeURIComponent(stored)}`, bytes: body.length };
}

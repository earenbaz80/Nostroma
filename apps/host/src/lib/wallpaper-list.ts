/** The pictures in `wallpapers/`, as the host lists them. */
export type Wallpaper = { name: string; url: string; bytes?: number };

/**
 * Settings > Appearance > Background reads this list every time its menu opens, not once when the section mounts.
 * `wallpapers/` is an ordinary folder: a picture dropped into it while the app is open has to show up without a
 * reload, and one deleted there has to stop being offered. Nothing is cached here, so every call asks the host.
 */
export async function readWallpapers(get: (path: string) => Promise<{ wallpapers?: Wallpaper[] }>): Promise<Wallpaper[]> {
    const data = await get('/api/appearance/wallpapers');
    return Array.isArray(data.wallpapers) ? data.wallpapers : [];
}

/** One entry of the Background strip: the app's own background (no picture), or a picture in the folder. */
export type WallpaperChoice = { value: string; name: string; url: string | null };

/** Everything the strip shows, in the order it is browsed: the app's own background first, then the folder's pictures. */
export function wallpaperChoices(items: Wallpaper[], defaultName: string): WallpaperChoice[] {
    return [
        { value: 'default', name: defaultName, url: null },
        ...items.map(item => ({ value: item.name, name: item.name, url: item.url })),
    ];
}

/**
 * The value the arrows move to: it wraps at both ends, starts at the first entry when the applied one is not in the
 * folder any more (a picture deleted there), and stays put when there is nothing else to show. Null then, so the
 * caller does not have to guess.
 */
export function nextWallpaper(choices: WallpaperChoice[], current: string, by: number): string | null {
    if (choices.length < 2)
        return null;
    const at = choices.findIndex(choice => choice.value === current);
    const from = at < 0 ? (by < 0 ? 0 : -1) : at;
    return choices[((from + by) % choices.length + choices.length) % choices.length].value;
}

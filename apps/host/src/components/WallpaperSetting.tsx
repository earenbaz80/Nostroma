import { useCallback, useEffect, useRef, useState } from 'react';
import { Btn, ErrorNotice, IconBtn, Select } from './ui';
import { tr } from '../lib/i18n';
import { api } from '../lib/client';
import { setWallpaper, useStore } from '../lib/store';
import { nextWallpaper, readWallpapers, wallpaperChoices, type Wallpaper } from '../lib/wallpaper-list';

const host = () => (globalThis as { __NOSTROMA_HOST__?: string }).__NOSTROMA_HOST__ ?? '';

/**
 * Settings > Appearance > Background: the app's own background, a picture from `wallpapers/`, or one
 * the person picks here. The page asks the host for the folder's pictures and copies a chosen file in;
 * the preference itself lives in the store, so the background is there before the next render.
 *
 * The folder is read when the section mounts, every time the menu opens, and when the window comes back to the
 * front: a picture dropped into `wallpapers/` shows up by itself. Below the menu is the strip of everything the
 * folder holds: the arrows step through it, each thumbnail shows that background, and picking one applies it.
 */
export function WallpaperSetting() {
    const current = useStore(s => s.wallpaper);
    const [items, setItems] = useState<Wallpaper[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const file = useRef<HTMLInputElement>(null);
    const strip = useRef<HTMLDivElement>(null);
    const load = useCallback(async () => {
        try {
            setItems(await readWallpapers(path => api.get<{ wallpapers?: Wallpaper[] }>(path)));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    /* `wallpapers/` is an ordinary folder: a picture put there while the app is open is read again when the window
       comes back to the front, not only when the menu opens. */
    useEffect(() => {
        const again = () => { void load(); };
        window.addEventListener('focus', again);
        return () => window.removeEventListener('focus', again);
    }, [load]);
    const selected = items.find(item => item.name === current);
    const choices = wallpaperChoices(items, tr('Default background'));
    function step(by: number) {
        const next = nextWallpaper(choices, current, by);
        if (next)
            setWallpaper(next);
    }
    /* The strip follows the choice: the applied picture stays in view when the arrows move past the edge. */
    useEffect(() => {
        strip.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, [current, items.length]);
    async function upload(chosen: File) {
        setBusy(true);
        setError('');
        try {
            const saved = await api.upload<Wallpaper>('/api/appearance/wallpapers', chosen, chosen.name);
            setItems(previous => [...previous.filter(item => item.name !== saved.name), saved].sort((a, b) => a.name.localeCompare(b.name)));
            setWallpaper(saved.name);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
            if (file.current)
                file.current.value = '';
        }
    }
    const known = current === 'default' || items.some(item => item.name === current);
    return <div className="wallpaper-setting">
    <div className="wallpaper-setting__row">
      <Select translateLabels={false} ariaLabel={tr("Background")} value={current} onOpen={() => { void load(); }} options={[{ value: 'default', label: tr("Default background") }, ...(!known ? [{ value: current, label: current }] : []), ...items.map(item => ({ value: item.name, label: item.name }))]} onChange={setWallpaper}/>
      <Btn size="sm" disabled={busy} onClick={() => file.current?.click()}>{tr(busy ? 'Uploading…' : 'Choose an image…')}</Btn>
    </div>
    <div className="wallpaper-setting__view">
      <IconBtn className="wallpaper-setting__step wallpaper-setting__step--back" name="chevron" title={tr('Previous background')} disabled={choices.length < 2} onClick={() => step(-1)}/>
      <div className="wallpaper-setting__preview" data-default={selected ? undefined : 'true'}>
        {selected ? <img src={`${host()}${selected.url}`} alt=""/> : null}
      </div>
      <IconBtn className="wallpaper-setting__step wallpaper-setting__step--next" name="chevron" title={tr('Next background')} disabled={choices.length < 2} onClick={() => step(1)}/>
    </div>
    <div className="wallpaper-setting__strip" ref={strip} role="group" aria-label={tr('Background')}>
      {choices.map(choice => <button key={choice.value} type="button" className="wallpaper-thumb" data-active={choice.value === current ? 'true' : undefined} aria-pressed={choice.value === current} aria-label={choice.name} title={choice.name} onClick={() => setWallpaper(choice.value)}>
        {choice.url ? <img src={`${host()}${choice.url}`} alt=""/> : null}
      </button>)}
    </div>
    <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const chosen = e.target.files?.[0]; if (chosen)
        void upload(chosen); }}/>
    {error ? <ErrorNotice message={error}/> : null}
  </div>;
}

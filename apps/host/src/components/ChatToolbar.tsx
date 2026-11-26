import {sessionTitle} from '../lib/session-title';
import { tr } from '../lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArtifactTabs, type ExtraPreviewTab } from './ArtifactPanel';
import { FloatingMenu } from './FloatingMenu';
import { Icon, IconBtn } from './ui';
import { SamplingDrawer } from '../app/SamplingDrawer';
import { downloadSessionLog } from '../lib/session-log';
import { closeTab, go, selectSession, setTheme, themeScheme, useStore } from '../lib/store';
import { useMedia } from '../lib/responsive';
import type { Session } from '../lib/types';
import type { PreviewArtifact } from '../lib/artifacts';
export function ChatToolbar({ session, items, selected, onSelect, onClose, onCloseTab, inline, expanded, onExpand, extraTabs = [], previewWidth }: {
    previewWidth?: number;
    extraTabs?: ExtraPreviewTab[];
    session: Session | null;
    items: PreviewArtifact[];
    selected: string | null;
    onSelect: (id: string) => void;
    onClose: () => void;
    onCloseTab: (id: string) => void;
    inline: boolean;
    expanded: boolean;
    onExpand: () => void;
}) {
    const remote = useStore(s => s.remoteModel);
    const storedTabs = useStore(s => s.tabs);
    const all = useStore(s => s.sessions);
    /* A tab for a chat that no longer exists has nothing to show: it is dropped here, not deleted from the list. */
    const saved = new Map(all.map(s => [s.id, s]));
    const tabs = storedTabs.filter(id => saved.has(id));
    const [menu, setMenu] = useState(false), [settings, setSettings] = useState(false), [list, setList] = useState(false);
    const menuRef = useRef<HTMLButtonElement>(null), listRef = useRef<HTMLButtonElement>(null), stripRef = useRef<HTMLElement>(null);
    /* What the strip is hiding, so the fades, the arrows and the list chip only appear when there is something to reach. */
    const [strip, setStrip] = useState({ over: false, start: false, end: false });
    const theme = useStore(s => s.theme), systemDark = useMedia('(prefers-color-scheme: dark)'), dark = themeScheme(theme, systemDark) === 'dark';
    const previews = !!selected && inline;
    const title = session ? sessionTitle(session) : tr('New chat');

    const measure = useCallback(() => {
        const el = stripRef.current;
        if (!el) return;
        /* Two pixels of slack: a scaled interface leaves fractional scroll offsets, so an end counts as reached a hair before the exact number. */
        const over = el.scrollWidth - el.clientWidth > 2;
        setStrip(current => {
            const next = { over, start: over && el.scrollLeft > 2, end: over && el.scrollLeft + el.clientWidth < el.scrollWidth - 2 };
            return current.over === next.over && current.start === next.start && current.end === next.end ? current : next;
        });
    }, []);
    /* A frame later, so the reading is of the layout the change produced and not of the one before it. */
    const measureSoon = useCallback(() => requestAnimationFrame(measure), [measure]);
    useEffect(() => { measureSoon(); }, [measureSoon, tabs.length]);
    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        el.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        return () => { observer.disconnect(); el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
    }, [measureSoon]);
    /* A wheel over the strip goes along it: the bar is wide enough to hold the tabs, the gesture should not have to be found. */
    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;
        const wheel = (e: WheelEvent) => {
            if (el.scrollWidth - el.clientWidth < 2) return;
            const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            if (!delta) return;
            e.preventDefault();
            el.scrollLeft += delta;
            measure();
        };
        el.addEventListener('wheel', wheel, { passive: false });
        return () => el.removeEventListener('wheel', wheel);
    }, [measure]);
    /* The chat in front is never left half off the strip, whichever way the tabs moved. */
    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;
        const active = el.querySelector<HTMLElement>('.chat-tab[data-active]');
        if (active) {
            /* Measured against the strip itself, so it holds whether or not the strip is the offset parent. */
            const tab = active.getBoundingClientRect(), frame = el.getBoundingClientRect();
            const left = tab.left - frame.left + el.scrollLeft, right = left + tab.width;
            if (left < el.scrollLeft) el.scrollLeft = left;
            else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
        }
        measure();
    }, [session?.id, tabs.length, measure]);
    const step = (direction: -1 | 1) => {
        const el = stripRef.current;
        if (el) el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' });
    };

    return <header className="chat-toolbar" style={previews && !expanded && previewWidth ? { gridTemplateColumns: `minmax(0,1fr) ${previewWidth}px` } : undefined} data-timeskip={selected?.startsWith('time-skip:') || undefined} data-preview={previews || undefined} data-expanded={expanded && previews || undefined}>
    <div className="chat-toolbar__conversation">
    {tabs.length > 1
        ? <div className="chat-tabs" data-over={strip.over || undefined} data-start={strip.start || undefined} data-end={strip.end || undefined}>
            {strip.over ? <button type="button" className="chat-tabs__step" data-side="start" disabled={!strip.start} aria-label={tr('Scroll tabs left')} onClick={() => step(-1)}><Icon name="chevron" size={13}/></button> : null}
            <nav ref={stripRef} className="chat-tabs__strip" aria-label={tr("Open chats")}>
                {tabs.map(id => { const other = saved.get(id); if (!other) return null; return <span key={id} className="chat-tab" data-active={id === session?.id || undefined}><button type="button" className="chat-tab__pick" aria-current={id === session?.id ? 'page' : undefined} title={sessionTitle(other)} onClick={() => { selectSession(id); go('chat', id); }}><span className="chat-tab__title">{sessionTitle(other)}</span></button><button type="button" className="chat-tab__close" aria-label={tr("Close {0}", [sessionTitle(other)])} title={tr("Close tab")} onClick={() => closeTab(id)}><Icon name="x" size={11}/></button></span>; })}
            </nav>
            {strip.over ? <button type="button" className="chat-tabs__step" data-side="end" disabled={!strip.end} aria-label={tr('Scroll tabs right')} onClick={() => step(1)}><Icon name="chevron" size={13}/></button> : null}
            {strip.over ? <button ref={listRef} type="button" className="chat-tabs__all" aria-haspopup="menu" aria-expanded={list} aria-label={tr('All open chats')} title={tr('All open chats')} onClick={() => setList(v => !v)}>{tabs.length}<Icon name="chevron" size={11}/></button> : null}
        </div>
        : <h1 title={title}>{title}</h1>}
    <span className="spacer"/><button type="button" className="chat-workbench-toggle" title={tr("Open workbench")} aria-label={tr("Open workbench")} onClick={() => window.dispatchEvent(new Event('nostroma:open-workbench'))}><Icon name="layers" size={17}/><span>{tr("Workbench")}</span></button><button className="st-btn st-btn--icon theme-switch" aria-label={tr(dark ? 'Switch to light mode' : 'Switch to dark mode')} title={tr(dark ? 'Switch to light mode' : 'Switch to dark mode')} onClick={() => setTheme(dark ? 'light' : 'dark')}><span key={String(dark)} className="theme-switch__icon"><Icon name={dark ? 'sun' : 'moon'} size={19}/></span></button><button ref={menuRef} className="st-btn st-btn--icon" title={tr("Chat options")} aria-label={tr("Chat options")} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(v => !v)}><Icon name="ellipsis"/></button>{tr(!selected && (items.length || extraTabs.length) ? <IconBtn name="panel" title={tr("Open previews")} onClick={() => onSelect(extraTabs.at(-1)?.id ?? items[0].id)}/> : null)}</div>
    {tr(previews ? <div className="chat-toolbar__previews"><ArtifactTabs extraTabs={extraTabs} onCloseTab={onCloseTab} items={items} selected={selected} onSelect={onSelect}/><div className="preview-window-actions"><div id="preview-file-actions" className="preview-file-actions"/><IconBtn name={expanded ? 'contract' : 'expand'} title={tr(expanded ? 'Exit full screen preview' : 'Full screen preview')} onClick={onExpand}/><IconBtn name="panel" title={tr("Collapse preview sidebar")} onClick={onClose}/></div></div> : null)}
    
    {tr(list ? <FloatingMenu anchor={listRef.current} title={tr('All open chats')} onClose={() => setList(false)} width={288}>
        {tabs.map(id => { const other = saved.get(id); if (!other) return null; const active = id === session?.id;
            return <div key={id} className="chat-tabs__row">
                <button role="menuitem" className="menu__item" aria-current={active ? 'true' : undefined} onClick={() => { setList(false); selectSession(id); go('chat', id); }}>{active ? <Icon name="check"/> : <span className="chat-tabs__row-dot"/>}<span className="chat-tabs__row-title">{sessionTitle(other)}</span></button>
                <button role="menuitem" className="menu__item chat-tabs__row-close" aria-label={tr("Close {0}", [sessionTitle(other)])} title={tr("Close tab")} onClick={() => closeTab(id)}><Icon name="x" size={11}/></button>
            </div>; })}
    </FloatingMenu> : null)}
    {tr(menu ? <FloatingMenu anchor={menuRef.current} title={tr("Chat options")} onClose={() => setMenu(false)}><button role="menuitem" className="menu__item" disabled={!!remote} title={tr(remote ? "API models use their provider’s response settings." : undefined)} onClick={() => { setMenu(false); setSettings(true); }}><Icon name="sliders"/>{tr("Response settings")}</button><button role="menuitem" className="menu__item" disabled={!session} onClick={() => { if (session)
        downloadSessionLog(session); setMenu(false); }}><Icon name="download"/>{tr("Download session log")}</button></FloatingMenu> : null)}
    <SamplingDrawer open={settings} onClose={() => setSettings(false)}/>
  </header>;
}

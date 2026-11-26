import {sessionTitle} from '../lib/session-title';
import { tr } from '../lib/i18n';
import { useNative } from '../lib/native';
import { modelFamilyIcon } from '../lib/model-icons';
import { TaskTree } from './TaskTree';
/** Quiet navigation, with the same destinations at every window size. */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FloatingMenu } from '../components/FloatingMenu';
import { measureFrame } from '../lib/overlay-place';
import { NAV_COLUMN, publishColumnWidth, storedColumnWidth } from '../lib/column-width';
import { QuitNostromaDialog } from '../components/QuitNostroma';
import { useAppMode } from '../lib/app-mode';
import { href, useLocation, type Route } from '../lib/router';
import { cx, relTime, relTimeShort } from '../lib/format';
import { useMedia } from '../lib/responsive';
import { recentChats, recentChatDescription } from '../lib/recent-chats';
import type { Session, Workspace } from '../lib/types';
import { MOD, runCommand } from '../lib/commands';
import { bindingFor, bindingKeys, useBindings } from '../lib/shortcut-bindings';
import { Btn, Dialog, Icon, IconBtn, type IconName } from '../components/ui';
import { Brand } from '../components/Brand';
import { addWorkspace, connectWorkspaceGit, deleteSession, dismissToast, go, isUnread, liveChatIds, pickWorkspace, pushToast, renameSession, removeWorkspace, renameWorkspace, selectSession, setActiveWorkspace, setNavOpen, shareWorkspace, startChatInWorkspace, toggleArchive, togglePin, toggleRail, updateWorkspace, useStore, workspaceGit, type WorkspaceGit } from '../lib/store';
import { CopyBtn } from '../components/CopyBtn';

/** The colours a workspace can take. Eight, all readable on light and dark, and no picked shade is a colour at all. */
/* The chat needs room to stay readable: past this the sidebar stops growing,
   however wide the window is. */
const NAV_CHAT_FLOOR = 760;
const NAV_WIDTH_STEP = 24;

const WS_COLORS = [
    { name: 'Blue', value: '#4c7fe0' },
    { name: 'Violet', value: '#8a6cf0' },
    { name: 'Green', value: '#2f9e6a' },
    { name: 'Amber', value: '#d9a21b' },
    { name: 'Rose', value: '#d4514d' },
    { name: 'Cyan', value: '#1f9bb0' },
    { name: 'Pink', value: '#c956a0' },
    { name: 'Slate', value: '#7b828c' },
];
export function Sidebar({ containerRef }: {
    containerRef: RefObject<HTMLElement | null>;
}) {
    useBindings();
    const location = useLocation();
    const compact = useMedia('(max-width: 1279px)');
    const rail = useStore(s => s.rail);
    const navOpen = useStore(s => s.navOpen);
    const collapsed = compact ? !navOpen : rail;
    /* The sidebar is the grid's first column, so the width the person drags is
       published as the token the grid reads: the panel keeps no inline width, and
       the rail and the narrow-window drawer stay exactly as they were. */
    const [navWidth, setNavWidth] = useState<number | null>(() => storedColumnWidth(NAV_COLUMN));
    /* The column's own width, measured: the separator still has to announce one
       before anyone drags it. */
    const [navMeasured, setNavMeasured] = useState<number | null>(null);
    /* The re-clamp on a resize runs from a listener bound once: it reads the width
       through this ref instead of a closure from the first render. */
    const navWidthNow = useRef<number | null>(navWidth);
    navWidthNow.current = navWidth;
    const navDrag = useRef<{ id: number; left: number; scale: number } | null>(null);
    /* offsetWidth and not the rect: the whole surface is scaled, and the drag sets
       pixels the layout uses. */
    const navWidest = () => Math.max(NAV_COLUMN.min, Math.min(NAV_COLUMN.max, document.documentElement.offsetWidth - NAV_CHAT_FLOOR));
    const clampNav = (value: number) => Math.max(NAV_COLUMN.min, Math.min(navWidest(), value));
    /* A width is set, not animated. The grid carries a transition for the rail,
       and a transition that starts before the document is painted holds the track
       it started from — and goes on swallowing every later change — until it gets
       a frame, which a window opened behind another one never gets. The attribute
       takes that transition out for the one change; the drag sets it for its own
       duration. */
    const setNavWidthQuietly = (next: number | null) => {
        const root = document.documentElement;
        if (!root.hasAttribute('data-nav-resizing')) {
            root.setAttribute('data-nav-sizing', 'true');
            requestAnimationFrame(() => root.removeAttribute('data-nav-sizing'));
        }
        setNavWidth(next);
    };
    useEffect(() => { publishColumnWidth(NAV_COLUMN, navWidth); }, [navWidth]);
    /* A window that gets narrower re-clamps a width chosen on a wider one, so the
       chat keeps its floor instead of being squeezed. */
    useEffect(() => {
        const fit = () => {
            const current = navWidthNow.current;
            if (current !== null)
                setNavWidthQuietly(clampNav(current));
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, []);
    useEffect(() => {
        const panel = containerRef.current;
        if (!panel || typeof ResizeObserver === 'undefined')
            return;
        const observer = new ResizeObserver(() => setNavMeasured(Math.round(panel.offsetWidth)));
        observer.observe(panel);
        return () => observer.disconnect();
    }, [containerRef]);
    const releaseNav = () => { navDrag.current = null; document.documentElement.removeAttribute('data-nav-resizing'); };
    useEffect(() => releaseNav, []);
    const sessions = useStore(s => s.sessions);
    const library = useStore(s => s.library);
    const monitor = useStore(s => s.monitor);
    const workspaces = useStore(s => s.workspaces);
    const activeWorkspace = useStore(s => s.activeWorkspace);
    const activeSession = useStore(s => s.activeSession);
    // The chats that have a turn running now (the board reads the same list). The count is what makes this redraw when one starts or ends.
    const liveCount = useStore(s => s.liveChats);
    const working = new Set(liveCount ? liveChatIds() : []);
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInput = useRef<HTMLInputElement>(null);
    const searchTrigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (searchOpen)
            searchInput.current?.focus();
    }, [searchOpen, collapsed]);
    function closeSearch() { setQuery(''); setSearchOpen(false); requestAnimationFrame(() => searchTrigger.current?.focus()); }
    const [recentOpen, setRecentOpen] = useState(false);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [removeWorkspaceId, setRemoveWorkspaceId] = useState<string | null>(null);
    const [menuId, setMenuId] = useState<string | null>(null);
    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameWsId, setRenameWsId] = useState<string | null>(null), [wsName, setWsName] = useState('');
    const [wsMenuId, setWsMenuId] = useState<string | null>(null);
    const [showArchivedWs, setShowArchivedWs] = useState(false);
    /* Archived chats are out of the tree until asked for, the way archived
       workspaces are: comparing the two would be confusing otherwise. */
    const [showArchivedChats, setShowArchivedChats] = useState(false);
    const wsMenuTrigger = useRef<HTMLElement | null>(null);
    const [shareWs, setShareWs] = useState<Workspace | null>(null);
    const [shareResult, setShareResult] = useState<{ path: string; chats: number } | null>(null);
    const [shareBusy, setShareBusy] = useState(false);
    const [gitWs, setGitWs] = useState<Workspace | null>(null);
    const [gitInfo, setGitInfo] = useState<WorkspaceGit | null>(null);
    const [gitRemote, setGitRemote] = useState('');
    const [gitBusy, setGitBusy] = useState(false);
    const [name, setName] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [folders, setFolders] = useState<Record<string, boolean>>({});
    const menuTrigger = useRef<HTMLElement | null>(null);
    const current = library?.variants.find(v => v.id === library.loaded);
    const native = useNative(), nativeCurrent = native?.instances.find(i => i.id === native.defaultId);
    const modelName = nativeCurrent?.label ?? (current?.local ? current.name : current?.family) ?? tr('No model loaded');
    // The version from the catalog and the card it runs on ("Q2_0 · GPU 2"), not the file id.
    const nativeSize = nativeCurrent ? native?.catalog?.families.flatMap(f => f.sizes).find(s => s.id === nativeCurrent.model) : undefined;
    const nativeSecond = nativeCurrent ? [nativeSize?.model ?? nativeCurrent.model.toUpperCase(), nativeCurrent.gpus.length ? nativeCurrent.gpus.map(g => `GPU ${g + 1}`).join(' + ') : ''].filter(Boolean).join(' · ') : null;
    const modelQuant = nativeSecond ?? current?.quant ?? tr('View model versions');
    const phase = nativeCurrent ? (nativeCurrent.status === 'ready' ? nativeCurrent.phase : nativeCurrent.status) : monitor?.phase ?? 'idle';
    const status = phase === 'unavailable' ? 'Status unavailable' : phase === 'error' ? 'Error' : phase === 'loading' ? 'Loading' : !current && !nativeCurrent ? 'No model loaded' : phase === 'reading' ? 'Reading prompt' : phase === 'thinking' ? 'Thinking' : phase === 'generating' ? 'Generating' : 'Ready';
    // The model is busy with a chat that is not the one in front of the person: the chip says which one (a title, or how many).
    const awayChats = [...working].filter(id => !(location.route === 'chat' && id === activeSession));
    const awayTitle = awayChats.length === 1 ? sessions.find(s => s.id === awayChats[0]) : undefined;
    const workingLine = awayChats.length === 1 && awayTitle ? tr("Working · {0}", [sessionTitle(awayTitle)]) : awayChats.length > 1 ? tr("{0} chats working", [awayChats.length]) : null;
    const menuSession = sessions.find(s => s.id === menuId);
    const wsMenu = workspaces.find(w => w.id === wsMenuId);
    const archivedWs = workspaces.filter(w => w.archived).length;
    const archivedChats = sessions.filter(s => s.archived).length;
    const q = query.trim().toLowerCase();
    const matching = sessions.filter(s => (!s.archived || q || includeArchived || showArchivedChats) && (!q || `${sessionTitle(s)} ${s.messages.map(m => m.content).join(' ')}`.toLowerCase().includes(q))).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    function openMenu(id: string, trigger: HTMLElement) { menuTrigger.current = trigger; setMenuId(id); }
    function closeMenu() { setMenuId(null); menuTrigger.current?.focus(); }
    return <>
    <aside className="nav" ref={containerRef} aria-label={tr("Main navigation")} aria-modal={navOpen && compact ? true : undefined} role={navOpen && compact ? 'dialog' : undefined} tabIndex={-1}>
      <div className="nav__top">{tr(!collapsed ? <a className="nav__brand" href={href('chat')} aria-label={tr("Nostroma — open chat")}><Brand variant="lockup" height={28} decorative className="nav__brand-lockup"/></a> : null)}<button type="button" className="nav__collapse" aria-label={tr(collapsed ? 'Show sidebar' : 'Hide sidebar')} title={tr(collapsed ? 'Show sidebar' : 'Hide sidebar')} onClick={() => compact ? setNavOpen(!navOpen) : toggleRail()}><Icon name="panel" size={20}/></button></div>
      <div className="nav__scroll">
        <button className="st-btn st-btn--primary nav-new" aria-label={tr("New chat")} title={tr("New chat")} onClick={() => runCommand('new')}><Icon name="new-chat" size={18}/><span className="nav__rail-hide">{tr("New chat")}</span></button>
        <TaskTree collapsed={collapsed}/>
        {tr(collapsed ? <div className="nav-recent" aria-label={tr("Recent chats")}>{tr(recentChats(sessions, activeSession).map((session, index) => <RecentChatLink key={session.id} session={session} slot={index + 1} active={activeSession === session.id && location.route === 'chat'}/>))}</div> : null)}
        {!collapsed ? <div className="ws">
          <div className="ws__head">{tr(searchOpen ? <div className="nav-search"><Icon name="search" size={16}/><input ref={searchInput} className="st-input st-input--bare" type="search" placeholder={tr("Search chats…")} aria-label={tr("Search chats")} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        closeSearch();
                    }
                }}/><IconBtn name="x" title={tr("Close chat search")} onClick={closeSearch}/></div> : <><span className="navgroup__label">{tr("Workspaces")}</span><div className="ws__tools"><button ref={searchTrigger} type="button" className="st-btn st-btn--icon" aria-label={tr("Search chats")} title={tr("Search chats")} onClick={() => setSearchOpen(true)}><Icon name="search" size={18}/></button><IconBtn name="folder-plus" title={tr("Add a workspace folder")} onClick={() => { void pickWorkspace().then(path => path ? addWorkspace(path) : undefined); }}/></div></>)}</div>
          {workspaces.filter(w => showArchivedWs || !w.archived).map(w => {
                const expanded = folders[w.id] !== false || !!q;
                const rows = matching.filter(s => s.workspace === w.path || !!w.aliases?.includes(s.workspace));
                const shown = q ? rows : rows.slice(0, 20);
                return <div className="ws__group" key={w.id}>
              <div className={cx('ws__row', activeWorkspace === w.id && 'is-active', !!w.color && 'has-color')} style={w.color ? { '--ws-color': w.color } as CSSProperties : undefined}><button className="ws__name" aria-expanded={expanded} onClick={() => { setActiveWorkspace(w.id); setFolders(f => ({ ...f, [w.id]: !expanded })); }}><Icon name="chevron" size={14} className={cx('ws__chev', expanded && 'is-open')}/><Icon name="folder" size={17}/><span>{w.name}</span>{tr(w.archived ? <span className="ws__archived xs">{tr('Archived')}</span> : null)}</button><button type="button" className="st-btn st-btn--icon ws__more" aria-haspopup="menu" aria-expanded={wsMenuId === w.id} aria-label={tr("Actions for {0}", [w.name])} title={tr("Actions for {0}", [w.name])} onClick={e => { wsMenuTrigger.current = e.currentTarget; setWsMenuId(w.id); }}><Icon name="ellipsis" size={16}/></button></div>
              {tr(expanded ? <div className="navsessions">
                {tr(shown.map(s => <div key={s.id}>
                  <div className="ws__session row"><a className="navsession" href={href('chat', s.id)} data-working={working.has(s.id) || undefined} aria-current={activeSession === s.id && location.route === 'chat' ? 'page' : undefined} onClick={() => selectSession(s.id)} onContextMenu={e => { e.preventDefault(); openMenu(s.id, e.currentTarget); }} title={sessionTitle(s)}>{tr(working.has(s.id) ? <span className="navsession__working" role="img" aria-label={tr("Working")} title={tr("Working")}><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle className="navsession__track" cx="8" cy="8" r="6"/><circle className="navsession__arc" cx="8" cy="8" r="6" pathLength="100"/></svg></span> : null)}<span className="navsession__title">{sessionTitle(s)}</span>{tr(s.pinned ? <span aria-label={tr("Pinned")}><Icon name="pin" size={12}/></span> : <span className="navsession__time">{relTimeShort(s.updatedAt)}</span>)}{tr(!working.has(s.id) && isUnread(s, activeSession) ? <span className="navsession__unread" aria-label={tr("Unread")}/> : null)}{tr(s.archived ? <span className="xs muted">{tr("Archived")}</span> : null)}</a><button className="st-btn st-btn--icon session-overflow" aria-label={tr("Actions for {0}", [sessionTitle(s)])} onClick={e => openMenu(s.id, e.currentTarget)}><Icon name="ellipsis" size={16}/></button></div>
                </div>))}
                {tr(!shown.length ? <p className="small muted ws__empty">{tr(q ? 'No matching chats' : 'No chats yet')}</p> : null)}
                {tr(!q && rows.length > shown.length ? <button className="ws-view small" onClick={() => { setNavOpen(false); setRecentOpen(true); }}>{tr("View all chats")}</button> : null)}
              </div> : null)}
            </div>;
            })}
          {tr(archivedWs ? <button type="button" className="ws__toggle small" onClick={() => setShowArchivedWs(v => !v)}>{tr(showArchivedWs ? 'Hide archived workspaces' : 'Show archived workspaces ({0})', [archivedWs])}</button> : null)}
          {tr(archivedChats ? <button type="button" className="ws__toggle small" onClick={() => setShowArchivedChats(v => !v)}>{tr(showArchivedChats ? 'Hide archived chats' : 'Show archived chats ({0})', [archivedChats])}</button> : null)}
        </div> : null}
      </div>
      {/* The model chip and the destinations under it are a fixed foot: only the
          chats and projects above scroll, so these never move away. */}
      <div className="nav__foot">
        <button className="enginechip" data-state={status === 'Ready' ? 'ready' : ['Reading prompt', 'Thinking', 'Generating', 'Loading'].includes(status) ? 'busy' : 'off'} onClick={() => go('models')} title={tr("{0} \u00B7 {1} \u00B7 {2}", [modelName, workingLine ?? modelQuant, tr(status)])} aria-label={tr("{0} \u00B7 {1}", [modelName, modelQuant])}><span className="enginechip__family"><Icon name={modelFamilyIcon(current?.family)} size={20}/><span className="enginechip__dot"/></span><span className="enginechip__text nav__rail-hide"><span className="enginechip__title">{modelName}</span><span className="enginechip__sub">{workingLine ?? modelQuant}</span></span></button>
        <div className="nav__extra">
          <NavLink route="skills" label={tr("Skills")} icon="skills" current={location.route}/>
          <NavLink route="monitor" label={tr("Monitor")} icon="activity" current={location.route}/>
          <NavLink route="models" label={tr("Models")} icon="models" current={location.route === 'tuning' ? 'models' : location.route}/>
          <button type="button" className="navitem nav-workbench" title={tr("Workbench")} aria-label={tr("Workbench")} onClick={() => window.dispatchEvent(new Event('nostroma:open-workbench'))}><Icon name="layers"/><span className="navitem__text">{tr("Workbench")}</span></button>
          <NavExtra current={location.route}/>
        </div>
      </div>
      {/* The sidebar's own edge: dragging it widens the column. Not drawn in the
          rail or on the narrow layout, where the sidebar is a drawer. */}
      {!compact && !collapsed ? <div
        className="nav__resize"
        role="separator"
        tabIndex={0}
        aria-label={tr('Resize the sidebar')}
        aria-orientation="vertical"
        aria-valuemin={NAV_COLUMN.min}
        aria-valuemax={navWidest()}
        aria-valuenow={navWidth ?? navMeasured ?? undefined}
        title={tr('Resize the sidebar')}
        onPointerDown={event => {
            if (event.button !== 0)
                return;
            const box = containerRef.current?.getBoundingClientRect();
            if (!box)
                return;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            /* clientX is in the scaled pixels the window draws, the width is in
               layout pixels: the probe divides one into the other. */
            navDrag.current = { id: event.pointerId, left: box.left, scale: measureFrame().scale };
            event.currentTarget.setPointerCapture(event.pointerId);
            document.documentElement.setAttribute('data-nav-resizing', 'true');
        }}
        onPointerMove={event => {
            const state = navDrag.current;
            if (!state || state.id !== event.pointerId)
                return;
            setNavWidth(clampNav(Math.round((event.clientX - state.left) / state.scale)));
        }}
        onPointerUp={releaseNav}
        onPointerCancel={releaseNav}
        onDoubleClick={() => setNavWidthQuietly(null)}
        onKeyDown={event => {
            const step = event.shiftKey ? NAV_WIDTH_STEP * 3 : NAV_WIDTH_STEP;
            const shown = navWidth ?? containerRef.current?.offsetWidth ?? 0;
            if (event.key === 'ArrowRight') { event.preventDefault(); setNavWidthQuietly(clampNav(shown + step)); }
            else if (event.key === 'ArrowLeft') { event.preventDefault(); setNavWidthQuietly(clampNav(shown - step)); }
            else if (event.key === 'Home' || event.key === 'Enter') { event.preventDefault(); setNavWidthQuietly(null); }
            else if (event.key === 'End') { event.preventDefault(); setNavWidthQuietly(navWidest()); }
        }}
      ><span/></div> : null}
    </aside>
    {tr(wsMenu ? <FloatingMenu anchor={wsMenuTrigger.current} width={248} title={tr("Actions for {0}", [wsMenu.name])} onClose={() => setWsMenuId(null)}>
      <button role="menuitem" className="menu__item" onClick={() => { setWsName(wsMenu.name); setNavOpen(false); setRenameWsId(wsMenu.id); setWsMenuId(null); }}><Icon name="pencil"/>{tr("Rename")}</button>
      <button role="menuitem" className="menu__item" onClick={() => { setWsMenuId(null); setNavOpen(false); startChatInWorkspace(wsMenu.id); }}><Icon name="new-chat"/>{tr("New chat here")}</button>
      <button role="menuitem" className="menu__item" onClick={() => { setShareWs(wsMenu); setShareResult(null); setWsMenuId(null); }}><Icon name="copy"/>{tr("Share…")}</button>
      <button role="menuitem" className="menu__item" onClick={() => { setGitWs(wsMenu); setGitInfo(null); setGitRemote(wsMenu.repo ? `https://github.com/${wsMenu.repo}.git` : ''); setWsMenuId(null); void workspaceGit(wsMenu.id).then(info => setGitInfo(info)); }}><Icon name="branch"/>{tr("Connect with Git…")}</button>
      <button role="menuitem" className="menu__item" onClick={() => { void updateWorkspace(wsMenu.id, { archived: !wsMenu.archived }); setWsMenuId(null); }}><Icon name="folder"/>{tr(wsMenu.archived ? 'Unarchive' : 'Archive')}</button>
      <p className="menu__label xs muted">{tr("Colour")}</p>
      <div className="menu__swatches" role="group" aria-label={tr("Colour")}>{WS_COLORS.map(colour => <button key={colour.value} type="button" className="menu__swatch" style={{ background: colour.value }} aria-pressed={wsMenu.color === colour.value} aria-label={tr(colour.name)} title={tr(colour.name)} onClick={() => void updateWorkspace(wsMenu.id, { color: wsMenu.color === colour.value ? null : colour.value })}/>)}<button type="button" className="menu__swatch menu__swatch--none" aria-pressed={!wsMenu.color} aria-label={tr("No colour")} title={tr("No colour")} onClick={() => void updateWorkspace(wsMenu.id, { color: null })}><Icon name="x" size={10}/></button></div>
      {tr(wsMenu.id !== 'root' ? <button role="menuitem" className="menu__item menu__item--danger" onClick={() => { setNavOpen(false); setRemoveWorkspaceId(wsMenu.id); setWsMenuId(null); }}><Icon name="x"/>{tr("Remove from sidebar")}</button> : null)}
    </FloatingMenu> : null)}
    {tr(menuId && menuSession ? <FloatingMenu anchor={menuTrigger.current} title={tr("Actions for {0}", [sessionTitle(menuSession)])} onClose={closeMenu}>
      <button role="menuitem" className="menu__item" onClick={() => { setName(sessionTitle(menuSession)); setNavOpen(false); setRenameId(menuId); setMenuId(null); }}><Icon name="pencil"/>{tr("Rename")}</button>
      <button role="menuitem" className="menu__item" onClick={() => { togglePin(menuId); closeMenu(); }}><Icon name="pin"/>{tr(menuSession.pinned ? 'Unpin' : 'Pin')}</button>
      <button role="menuitem" className="menu__item" onClick={() => { if (menuSession.archived) toggleArchive(menuId); else archiveChatWithUndo(menuSession); closeMenu(); }}><Icon name="folder"/>{tr(menuSession.archived ? 'Unarchive' : 'Archive')}</button>
      <button role="menuitem" className="menu__item menu__item--danger" onClick={() => { setNavOpen(false); setDeleteId(menuId); setMenuId(null); }}><Icon name="trash"/>{tr("Delete chat")}</button>
    </FloatingMenu> : null)}
    <Dialog open={!!renameId} compact title={tr("Rename chat")} onClose={() => setRenameId(null)} actions={<><Btn onClick={() => setRenameId(null)}>{tr("Cancel")}</Btn><Btn variant="primary" disabled={!name.trim()} onClick={() => {
                if (renameId)
                    renameSession(renameId, name.trim());
                setRenameId(null);
            }}>{tr("Save name")}</Btn></>}><label className="input-field" htmlFor="chat-name"><span>{tr("Chat name")}</span><input className="st-input" id="chat-name" value={name} onFocus={e => e.currentTarget.select()} onChange={e => setName(e.target.value)}/></label></Dialog>
    <Dialog open={!!renameWsId} compact title={tr("Rename workspace")} onClose={() => setRenameWsId(null)} actions={<><Btn onClick={() => setRenameWsId(null)}>{tr("Cancel")}</Btn><Btn variant="primary" disabled={!wsName.trim()} onClick={() => {
                if (renameWsId)
                    void renameWorkspace(renameWsId, wsName.trim());
                setRenameWsId(null);
            }}>{tr("Save name")}</Btn></>}><label className="input-field" htmlFor="workspace-name"><span>{tr("Workspace name")}</span><input className="st-input" id="workspace-name" value={wsName} onFocus={e => e.currentTarget.select()} onChange={e => setWsName(e.target.value)}/></label><p className="small muted">{tr("Only the name changes. The folder stays where it is.")}</p></Dialog>
    <Dialog open={!!deleteId} compact title={tr("Delete this chat?")} onClose={() => setDeleteId(null)} actions={<><Btn onClick={() => setDeleteId(null)}>{tr("Keep chat")}</Btn><Btn variant="danger" onClick={() => {
                if (deleteId)
                    deleteSession(deleteId);
                setDeleteId(null);
            }}>{tr("Delete chat")}</Btn></>}><p>{tr("This chat will be permanently deleted.")}</p></Dialog>
    <Dialog open={!!removeWorkspaceId} title={tr("Remove workspace from sidebar?")} onClose={() => setRemoveWorkspaceId(null)} actions={<><Btn onClick={() => setRemoveWorkspaceId(null)}>{tr("Keep workspace")}</Btn><Btn onClick={() => {
                if (removeWorkspaceId)
                    void removeWorkspace(removeWorkspaceId).then(() => setRemoveWorkspaceId(null));
            }}>{tr("Remove from sidebar")}</Btn></>}><p>{tr("Files stay on your computer. Add this folder again to reopen its chats.")}</p></Dialog>
    <Dialog open={!!shareWs} compact title={tr("Share this project")} onClose={() => { setShareWs(null); setShareResult(null); }} actions={<><Btn onClick={() => { setShareWs(null); setShareResult(null); }}>{tr("Close")}</Btn><Btn variant="primary" disabled={shareBusy} onClick={() => {
                if (!shareWs)
                    return;
                setShareBusy(true);
                void shareWorkspace(shareWs.id).then(result => { setShareBusy(false); if (result)
                    setShareResult(result); });
            }}>{tr(shareBusy ? 'Exporting…' : 'Export chats')}</Btn></>}><p>{tr("Nostroma writes the chats of this project into one Markdown file on this computer. Nothing is uploaded.")}</p>{shareResult ? <><label className="input-field" htmlFor="share-path"><span>{tr("File")}</span><div className="row"><input className="st-input" id="share-path" readOnly value={shareResult.path}/><CopyBtn text={shareResult.path} label={tr("the path")} title={tr("Copy path")}/></div></label><p className="small muted">{tr("{0} chats are in it. Send the file, or copy the path for whatever you use to share files.", [shareResult.chats])}</p></> : null}</Dialog>
    <Dialog open={!!gitWs} compact title={tr("Connect with Git")} onClose={() => setGitWs(null)} actions={<><Btn onClick={() => setGitWs(null)}>{tr("Close")}</Btn><Btn variant="primary" disabled={gitBusy || !gitRemote.trim()} onClick={() => {
                if (!gitWs)
                    return;
                setGitBusy(true);
                void connectWorkspaceGit(gitWs.id, gitRemote.trim()).then(info => { setGitBusy(false); if (info)
                    setGitInfo(info); });
            }}>{tr(gitInfo?.repo ? 'Set remote' : 'Connect')}</Btn></>}>{gitInfo === null ? <p className="small muted">{tr("Checking what git says about this folder…")}</p> : gitInfo.repo ? <p>{tr("This folder is a Git repository. Branch {0}; {1} changed files. Origin: {2}.", [gitInfo.branch ?? '—', String(gitInfo.changed ?? 0), gitInfo.remote ?? tr('none')])}</p> : <p>{tr("This folder is not a Git repository yet. Nostroma starts one here and uses the address you type as origin; the files are not committed or pushed.")}</p>}<label className="input-field" htmlFor="git-remote"><span>{tr("Repository")}</span><input className="st-input" id="git-remote" value={gitRemote} placeholder={tr('owner/name or https://…')} onChange={e => setGitRemote(e.target.value)}/></label></Dialog>
    <Dialog open={recentOpen} title={tr("All chats")} onClose={() => setRecentOpen(false)}><div className="stack"><label className="row small"><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)}/>{tr("Include archived chats")}</label><input type="search" className="st-input" placeholder={tr("Search chats…")} aria-label={tr("Search all chats")} value={query} onChange={e => setQuery(e.target.value)}/>{tr(matching.map(s => <div className="recent-chat" key={s.id}><button type="button" className="recent-chat__open" onClick={() => { selectSession(s.id); go('chat', s.id); setRecentOpen(false); }}><span className="recent-chat__title">{sessionTitle(s)}</span>{tr(s.archived ? <span className="xs muted">{tr('Archived')}</span> : null)}<span className="xs muted">{tr(relTime(s.updatedAt))}</span></button><button type="button" className="st-btn st-btn--icon recent-chat__archive" aria-label={tr(s.archived ? 'Unarchive {0}' : 'Archive {0}', [sessionTitle(s)])} title={tr(s.archived ? 'Unarchive {0}' : 'Archive {0}', [sessionTitle(s)])}                 onClick={() => { if (s.archived) toggleArchive(s.id); else archiveChatWithUndo(s); }}><Icon name="folder" size={16}/></button></div>))}{tr(!matching.length ? <p className="small muted">{tr("No matching chats. Try another search.")}</p> : null)}</div></Dialog>
  </>;
}
/**
 * Archives a chat and offers it back in a notice. The chat leaves the tree (or the "All chats" list) at once, so the
 * notice is the only way back that does not mean opening the menu again or ticking "Include archived chats".
 */
function archiveChatWithUndo(session: Pick<Session, 'id' | 'title' | 'messages' | 'defaultTitle'>) {
    toggleArchive(session.id);
    const id = pushToast('info', tr('Chat archived'), sessionTitle(session), { label: tr('Undo'), run: () => { toggleArchive(session.id); dismissToast(id); } }, 9000);
}

function RecentChatLink({ session, active, slot }: {
    session: Session;
    active: boolean;
    slot: number;
}) {
    const binding = bindingFor('chat:slot:' + slot, { key: String(slot), mod: true, shift: false, alt: false });
    const keys = bindingKeys(binding, MOD);
    const anchor = useRef<HTMLAnchorElement>(null);
    const tooltip = useRef<HTMLDivElement>(null);
    const id = useId();
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ left: 0, top: 0 });
    useLayoutEffect(() => {
        if (!open)
            return;
        const place = () => {
            const rect = anchor.current?.getBoundingClientRect();
            if (!rect)
                return;
            const { scale, viewport } = measureFrame();
            const height = tooltip.current?.getBoundingClientRect().height ?? 80 * scale;
            setPosition({ left: (rect.right + 12) / scale, top: Math.max(12, Math.min(rect.top, viewport.height - height - 12)) / scale });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    }, [open]);
    return <>
    <a ref={anchor} className="navitem nav-recent__chat" href={href('chat', session.id)} aria-label={sessionTitle(session)} aria-current={active ? 'page' : undefined} aria-describedby={open ? id : undefined} onClick={() => { setOpen(false); selectSession(session.id); }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={event => {
            if (event.key === 'Escape' && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
            }
        }}><Icon name="chat"/><span className="nav-chat-number" aria-hidden="true">{tr(slot)}</span></a>
    {open ? createPortal(<div ref={tooltip} id={id} role="tooltip" className="nav-chat-tooltip" style={position}><strong>{sessionTitle(session)}</strong><span>{session.messages.length ? recentChatDescription(session) : tr(recentChatDescription(session))}</span>{tr(binding ? <kbd className="nav-chat-shortcut">{tr(keys.join(" "))}</kbd> : null)}</div>, document.body) : null}
  </>;
}
function NavLink({ route, label, icon, current, meta }: {
    route: Route;
    label: string;
    icon: IconName;
    current: string;
    meta?: string;
}) {
    return <a className="navitem" href={href(route)} aria-current={current === route ? 'page' : undefined} title={tr(label)} aria-label={tr(label)}><Icon name={icon}/><span className="navitem__text">{tr(label)}</span>{tr(meta ? <span className="navitem__meta">{tr(meta)}</span> : null)}</a>;
}
/* The rows the "More" menu held: they are ordinary navigation and belong in the
   column, where they can be scrolled to. */
function NavExtra({ current }: {
    current: string;
}) {
    const [quitOpen, setQuitOpen] = useState(false);
    const appMode = useAppMode();
    return <><NavLink route="settings" label={tr("Settings")} icon="settings" current={current}/>
    {appMode.canQuit ? <button type="button" className="navitem" onClick={() => { setNavOpen(false); setQuitOpen(true); }}><Icon name="x"/><span className="navitem__text">{tr("Quit Nostroma")}</span></button> : null}
    <QuitNostromaDialog open={quitOpen} onClose={() => setQuitOpen(false)}/></>;
}

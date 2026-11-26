import { tr } from '../lib/i18n';
import { api, postStream } from '../lib/client';
import { addGithubWorkspace, addWorkspace, pickWorkspace, setActiveWorkspace, useStore } from '../lib/store';
import { openExternal } from '../lib/open-external';
import { Brand } from './Brand';
import { Btn, Dialog, Icon, IconBtn, Select, type IconName } from './ui';
import type { WorkspaceFile } from '../lib/types';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { OPEN_IN_FILES, OPEN_IN_SANDBOX, RUN_IN_TERMINAL, locateInWorkspaces, openInFiles, sandboxDocument, type FilesOpen, type SandboxOpen, type TerminalRun } from '../lib/workbench-bridge';
import { withSandboxConsole } from '../lib/sandbox-console';
import { publishColumnWidth, storedColumnWidth, WORKBENCH_COLUMN } from '../lib/column-width';
import { SandboxConsole, useSandboxLogs } from './SandboxConsole';

/**
 * The Workbench: a right-side dock with the small local tools that are useful
 * beside a conversation. It stays out of the way until the person opens it,
 * and every pane works against the host (the sandbox is an isolated frame).
 */
const OPEN_EVENT = 'nostroma:open-workbench';
const STORE_KEY = 'nostroma.workbench.v1';
const SANDBOX_KEY = 'nostroma.workbench.sandbox.v1';
const TERM_KEY = 'nostroma.workbench.terminal.v1';
const MIN_WIDTH = WORKBENCH_COLUMN.min;
const MAX_WIDTH = WORKBENCH_COLUMN.max;
const WIDTH_STEP = 24;
/* The chat needs room to stay readable: past this the dock stops growing, however
   wide the window is. */
const CHAT_FLOOR = 760;

type Tab = 'live' | 'terminal' | 'browser' | 'files';
type Saved = { open?: boolean; tab?: Tab };

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'live', label: 'Live', icon: 'play' },
  { id: 'terminal', label: 'Terminal', icon: 'computer' },
  { id: 'browser', label: 'Browser', icon: 'link' },
  { id: 'files', label: 'Files', icon: 'folder' },
];

const START_CODE = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      display: grid;
      place-items: center;
      background: #0b0803;
      color: #ffe7c2;
      font: 14px/1.5 ui-monospace, "Cascadia Code", Consolas, monospace;
    }
    .card {
      border: 2px solid #ffb000;
      padding: 26px 30px;
      text-align: center;
      box-shadow: 0 0 28px rgba(255,176,0,.28), inset 0 0 18px rgba(255,176,0,.08);
    }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: .18em; text-transform: uppercase; }
    p { margin: 0; color: #bf9555; font-size: 12px; letter-spacing: .08em; }
    .n { color: #ffb000; text-shadow: 0 0 14px #ffb000; }
  </style>
</head>
<body>
  <div class="card">
    <h1><span class="n">N</span>OSTROMA</h1>
    <p>live sandbox · edit the HTML</p>
  </div>
</body>
</html>`;

function readSaved(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Saved;
    return { open: value.open === true, tab: TABS.some(t => t.id === value.tab) ? value.tab : 'live' };
  } catch {
    return { open: false, tab: 'live' };
  }
}

function storedCode(): string {
  try { return localStorage.getItem(SANDBOX_KEY) || START_CODE; } catch { return START_CODE; }
}

function terminalSession(): string {
  try {
    const saved = localStorage.getItem(TERM_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID?.() ?? `term-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(TERM_KEY, id);
    return id;
  } catch {
    return `term-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function addressOf(value: string): string {
  const text = value.trim();
  if (!text) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
}

function sizeText(kb?: number): string {
  if (!Number.isFinite(kb) || kb === undefined) return '';
  return kb < 1024 ? `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/** The widest the dock may get on this window, leaving the chat its floor. */
function widest(): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - CHAT_FLOOR));
}

export function Workbench() {
  const [saved] = useState(readSaved);
  const [open, setOpen] = useState(saved.open);
  const [tab, setTab] = useState<Tab>(saved.tab ?? 'live');
  /* null means "the width the stylesheet gives", so a window that was never
     resized keeps its responsive clamp. */
  const [width, setWidth] = useState<number | null>(() => storedColumnWidth(WORKBENCH_COLUMN));
  /* The dock's own width, measured. `width` is null while the stylesheet gives
     the size, and the separator still has to announce one before anyone drags:
     reset keeps meaning null, this only says how wide that is. */
  const [measured, setMeasured] = useState<number | null>(null);
  /* A command or a file the conversation handed over. `id` is what runs the
     hand-off once: clearing it afterwards would otherwise run it again. */
  const [pendingRun, setPendingRun] = useState<{ command: string; id: number } | null>(null);
  const [pendingFile, setPendingFile] = useState<{ path: string; cwd?: string; id: number } | null>(null);
  const [pendingSandbox, setPendingSandbox] = useState<(SandboxOpen & { id: number }) | null>(null);
  const rail = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; right: number } | null>(null);
  const focus = useStore(s => s.focus);
  const setup = useStore(s => s.setup);
  const setupOpen = useStore(s => s.setupOpen);
  const clamp = (value: number) => Math.max(MIN_WIDTH, Math.min(widest(), value));
  /* offsetWidth, not getBoundingClientRect: the whole surface is scaled, and the
     separator must report the same pixels the drag sets and min/max are written
     in. */
  const measure = () => {
    const actual = rail.current?.offsetWidth;
    if (actual) setMeasured(Math.round(actual));
  };

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ open, tab })); } catch { /* storage is optional */ }
  }, [open, tab]);

  /* The dock is the app grid's third column, so the width is published as a
     token the grid reads; the panel itself keeps no inline width and the narrow-
     window drawer stays exactly as it was. */
  useEffect(() => { publishColumnWidth(WORKBENCH_COLUMN, width); }, [width]);

  const release = () => {
    drag.current = null;
    document.documentElement.removeAttribute('data-workbench-resizing');
  };
  useEffect(() => release, []);

  /* A window that gets narrower re-clamps the dragged width, so the chat keeps its
     floor instead of being squeezed by a width chosen on a wider screen. One
     listener for the whole life of the dock: the width is read through the state
     updater, so it does not need re-binding on every pixel of a drag. */
  useEffect(() => {
    const fit = () => setWidth(current => (current === null ? current : clamp(current)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  /* Observed rather than measured once: the edge moves on the first paint, on a
     reset back to the stylesheet's clamp, and through the transition that
     follows either, where a single frame would have caught the old size. */
  useEffect(() => {
    const dock = rail.current;
    if (!dock || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(dock);
    return () => observer.disconnect();
  }, [open]);

  /* The conversation's hand-offs: a shell block runs in the terminal, a page or
     script opens in the sandbox, a path in the output opens in the file pane.
     Each opens the dock on the tool that will use it. */
  useEffect(() => {
    const onRun = (event: Event) => {
      const command = (event as CustomEvent<TerminalRun>).detail?.command?.trim();
      if (!command) return;
      setPendingRun({ command, id: Date.now() });
      setTab('terminal');
      setOpen(true);
    };
    const onFile = (event: Event) => {
      const detail = (event as CustomEvent<FilesOpen>).detail;
      if (!detail?.path) return;
      setPendingFile({ path: detail.path, cwd: detail.cwd, id: Date.now() });
      setTab('files');
      setOpen(true);
    };
    const onSandbox = (event: Event) => {
      const detail = (event as CustomEvent<SandboxOpen>).detail;
      if (!detail?.code?.trim()) return;
      setPendingSandbox({ code: detail.code, language: detail.language ?? 'html', id: Date.now() });
      setTab('live');
      setOpen(true);
    };
    window.addEventListener(RUN_IN_TERMINAL, onRun);
    window.addEventListener(OPEN_IN_FILES, onFile);
    window.addEventListener(OPEN_IN_SANDBOX, onSandbox);
    return () => {
      window.removeEventListener(RUN_IN_TERMINAL, onRun);
      window.removeEventListener(OPEN_IN_FILES, onFile);
      window.removeEventListener(OPEN_IN_SANDBOX, onSandbox);
    };
  }, []);

  const hidden = focus || setupOpen || (!!setup && !setup.complete && !setup.dismissed);
  if (!open || hidden) return null;

  return <aside className="workbench" aria-label={tr('Workbench')} id="workbench" ref={rail}>
    {/* The dock's own edge: dragging it left widens the panel. Hidden by the
        stylesheet below 1280px, where the panel is a full-height drawer. */}
    <div
      className="workbench__resize"
      role="separator"
      tabIndex={0}
      aria-label={tr('Resize workbench')}
      aria-orientation="vertical"
      aria-controls="workbench"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={widest()}
      aria-valuenow={width ?? measured ?? undefined}
      title={tr('Drag to resize · arrow keys adjust · double-click to reset')}
      onPointerDown={event => {
        if (event.button !== 0) return;
        const box = rail.current?.getBoundingClientRect();
        if (!box) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        drag.current = { id: event.pointerId, right: box.right };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.documentElement.setAttribute('data-workbench-resizing', 'true');
      }}
      onPointerMove={event => {
        const state = drag.current;
        if (!state || state.id !== event.pointerId) return;
        setWidth(clamp(Math.round(state.right - event.clientX)));
      }}
      /* The browser drops the capture itself when the pointer goes up; these two
         only have to stop tracking and give the cursor back. */
      onPointerUp={release}
      onPointerCancel={release}
      onDoubleClick={() => setWidth(null)}
      onKeyDown={event => {
        const step = event.shiftKey ? 64 : WIDTH_STEP;
        const shown = width ?? Math.round(rail.current?.getBoundingClientRect().width ?? 0);
        if (event.key === 'ArrowLeft') { event.preventDefault(); setWidth(clamp(shown + step)); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); setWidth(clamp(shown - step)); }
        else if (event.key === 'Home' || event.key === 'Enter') { event.preventDefault(); setWidth(null); }
        else if (event.key === 'End') { event.preventDefault(); setWidth(widest()); }
      }}
    ><span /></div>

    <header className="workbench__head">
      <Brand variant="mark" height={21} decorative />
      <div className="workbench__heading">
        <span className="workbench__title">{tr('Workbench')}</span>
        <span className="workbench__sub">{tr('Local tools')}</span>
      </div>
      <span className="spacer" />
      <IconBtn name="x" title={tr('Close workbench')} onClick={() => setOpen(false)} />
    </header>

    <div className="workbench__tabs" role="tablist" aria-label={tr('Workbench tools')}>
      {TABS.map(item => <button
        key={item.id}
        type="button"
        role="tab"
        id={`workbench-tab-${item.id}`}
        aria-selected={tab === item.id}
        aria-controls={`workbench-pane-${item.id}`}
        tabIndex={tab === item.id ? 0 : -1}
        data-active={tab === item.id || undefined}
        onClick={() => setTab(item.id)}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const at = TABS.findIndex(t => t.id === tab);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
            : (at + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
          setTab(TABS[next].id);
          document.getElementById(`workbench-tab-${TABS[next].id}`)?.focus();
        }}
      >
        <Icon name={item.icon} size={15} />
        <span>{tr(item.label)}</span>
      </button>)}
    </div>

    <div className="workbench__body">
      <LivePane active={tab === 'live'} pending={pendingSandbox} onOpened={() => setPendingSandbox(null)} />
      <TerminalPane active={tab === 'terminal'} pending={pendingRun} onRan={() => setPendingRun(null)} />
      <BrowserPane active={tab === 'browser'} />
      <FilesPane active={tab === 'files'} pending={pendingFile} onOpened={() => setPendingFile(null)} />
    </div>
  </aside>;
}

function Pane({ id, active, children }: { id: Tab; active: boolean; children: ReactNode }) {
  return <section
    id={`workbench-pane-${id}`}
    role="tabpanel"
    aria-labelledby={`workbench-tab-${id}`}
    className="workbench__pane"
    hidden={!active}
  >{children}</section>;
}

type LiveSaved = { split?: number; code?: boolean; preview?: boolean; follow?: boolean };
const LIVE_KEY = 'nostroma.workbench.live.v1';
const SPLIT_DEFAULT = 43;
const SPLIT_FLOOR = 18;
const SPLIT_CEILING = 82;

function readLive(): Required<LiveSaved> {
  const fallback = { split: SPLIT_DEFAULT, code: false, preview: false, follow: true };
  try {
    const value = JSON.parse(localStorage.getItem(LIVE_KEY) ?? '{}') as LiveSaved;
    const split = Number(value.split);
    return {
      split: Number.isFinite(split) ? Math.min(SPLIT_CEILING, Math.max(SPLIT_FLOOR, split)) : SPLIT_DEFAULT,
      code: value.code === true,
      preview: value.preview === true,
      follow: value.follow !== false,
    };
  } catch {
    return fallback;
  }
}

/**
 * The live view: the page being worked on above, what it renders below, with the
 * seam between the two draggable and either half foldable. The page is taken
 * from the project itself and read again whenever it changes on disk, so the
 * work in progress can be watched instead of copied in.
 */
function LivePane({ active, pending, onOpened }: { active: boolean; pending: (SandboxOpen & { id: number }) | null; onOpened: () => void }) {
  const [saved] = useState(readLive);
  const [code, setCode] = useState(storedCode);
  const [running, setRunning] = useState(code);
  const [revision, setRevision] = useState(0);
  const [split, setSplit] = useState(saved.split);
  const [codeFolded, setCodeFolded] = useState(saved.code);
  const [previewFolded, setPreviewFolded] = useState(saved.preview);
  const [follow, setFollow] = useState(saved.follow);
  const [page, setPage] = useState<{ path: string; mtimeMs: number } | null>(null);
  const [pageText, setPageText] = useState('');
  const [pageError, setPageError] = useState('');
  const timer = useRef<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const splitBox = useRef<HTMLDivElement>(null);
  const splitDrag = useRef<{ id: number; y: number; height: number; start: number } | null>(null);
  const shown = useRef<{ path: string; mtimeMs: number } | null>(null);
  const reloadPage = useRef<() => void>(() => { });
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspace = useStore(s => s.activeWorkspace);
  const root = (workspaces.find(w => w.id === activeWorkspace) ?? workspaces[0])?.id ?? '';
  /* A run is a new document: what the last one logged says nothing about it. */
  const { messages, clear } = useSandboxLogs(frame, revision);

  useEffect(() => {
    try { localStorage.setItem(LIVE_KEY, JSON.stringify({ split, code: codeFolded, preview: previewFolded, follow })); } catch { /* storage is optional */ }
  }, [split, codeFolded, previewFolded, follow]);

  /* A code block handed over from the conversation becomes the page this strip
     runs, and the project is left alone: the block is what is being discussed.
     The effect below saves it and reloads the frame on its debounce, so the
     hand-off needs no reload path of its own. */
  useEffect(() => {
    if (!pending) return;
    setFollow(false);
    setCode(sandboxDocument(pending.code, pending.language));
    onOpened();
  }, [pending, onOpened]);

  useEffect(() => {
    try { localStorage.setItem(SANDBOX_KEY, code); } catch { /* storage is optional */ }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setRunning(code);
      setRevision(value => value + 1);
    }, 650);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [code]);

  /* Something the person is working on can change without this pane touching an
     editor: the conversation writes the file, or another program does. The
     folder's page is looked up every two seconds, and the page itself is read
     only when its stamp moves, so a change appears while it is being made. */
  useEffect(() => {
    if (!active || !follow) return;
    let stopped = false;
    let beat = 0;
    const load = async (force: boolean) => {
      try {
        const source = await api.get<{ path: string | null; mtimeMs?: number }>(`/api/workspace/source?root=${encodeURIComponent(root)}`);
        if (stopped) return;
        if (!source.path) {
          shown.current = null;
          setPage(null);
          setPageText('');
          setPageError('');
          return;
        }
        const current = shown.current;
        if (!force && current && current.path === source.path && current.mtimeMs === source.mtimeMs) return;
        const file = await api.get<{ text?: string; tooLarge?: boolean; binary?: boolean }>(`/api/workspace/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(source.path)}`);
        if (stopped) return;
        shown.current = { path: source.path, mtimeMs: source.mtimeMs ?? 0 };
        setPage(shown.current);
        if (file.tooLarge || file.binary || typeof file.text !== 'string') {
          setPageText('');
          setPageError(tr(file.tooLarge ? 'This page is too large to preview.' : 'This page has no text to preview.'));
          return;
        }
        setPageError('');
        setPageText(file.text);
        setRevision(value => value + 1);
      } catch (cause) {
        if (!stopped) setPageError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    const tick = () => {
      void load(false).then(() => { if (!stopped) beat = window.setTimeout(tick, 2000); });
    };
    reloadPage.current = () => void load(true);
    tick();
    return () => {
      stopped = true;
      window.clearTimeout(beat);
      reloadPage.current = () => { };
    };
  }, [active, follow, root]);

  function run() {
    if (follow) { reloadPage.current(); return; }
    if (timer.current) window.clearTimeout(timer.current);
    setRunning(code);
    setRevision(value => value + 1);
  }

  /* The seam between the two panels: dragged, or moved with the arrow keys, and
     double-clicked back to where it started. */
  function startSplit(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const height = splitBox.current?.offsetHeight ?? 0;
    if (!height) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    splitDrag.current = { id: event.pointerId, y: event.clientY, height, start: split };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSplit(event: React.PointerEvent<HTMLDivElement>) {
    const state = splitDrag.current;
    if (!state || state.id !== event.pointerId) return;
    const next = state.start + ((event.clientY - state.y) / state.height) * 100;
    setSplit(Math.round(Math.min(SPLIT_CEILING, Math.max(SPLIT_FLOOR, next))));
  }

  function endSplit() { splitDrag.current = null; }
  useEffect(() => endSplit, []);

  const following = follow;
  const source = following ? (page?.path ?? '') : 'sandbox.html';
  return <Pane id="live" active={active}>
    <div className="workbench__bar">
      <span className="workbench__file" title={source || undefined}><Icon name="file" size={14} /><span className="workbench__file-text">{source || tr('No page yet')}</span></span>
      <button type="button" className="workbench__link live__follow" aria-pressed={follow} title={tr('Runs the page in this project, and again whenever it changes')} onClick={() => setFollow(value => !value)}><span className="workbench__link-text">{tr(follow ? 'Following project' : 'Follow project')}</span></button>
      <button type="button" className="workbench__run" onClick={run}><Icon name="play" size={14} /><span className="workbench__link-text">{tr('Run')}</span></button>
    </div>
    <div
      className="live-split"
      ref={splitBox}
      data-code-folded={codeFolded || undefined}
      data-preview-folded={previewFolded || undefined}
      style={{ '--live-code': `${split}%` } as CSSProperties}
    >
      <section className="live__panel live__panel--code" aria-label={tr(follow ? 'Page source' : 'Sandbox HTML')}>
        <header className="live__head">
          <Icon name="file" size={13} />
          <span className="live__title">{tr(follow ? 'Page' : 'Sandbox')}</span>
          <span className="spacer" />
          <button type="button" className="live__fold" aria-expanded={!codeFolded} aria-label={tr(codeFolded ? 'Show the source' : 'Hide the source')} title={tr(codeFolded ? 'Show the source' : 'Hide the source')} onClick={() => setCodeFolded(value => !value)}><Icon name="chevron" size={13} className={codeFolded ? 'live__chev' : undefined} /></button>
        </header>
        {codeFolded ? null : <div className="live__body">
          {following
            ? <pre className="live__source" aria-label={tr('Page source')}>{pageText || pageError || tr('No page to show yet.')}</pre>
            : <textarea
                className="sandbox__code"
                aria-label={tr('Sandbox HTML')}
                spellCheck={false}
                value={code}
                onChange={event => setCode(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Tab') return;
                  event.preventDefault();
                  const el = event.currentTarget;
                  const start = el.selectionStart, end = el.selectionEnd;
                  const next = `${code.slice(0, start)}  ${code.slice(end)}`;
                  setCode(next);
                  requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
                }}
              />}
        </div>}
      </section>
      <div
        className="live__handle"
        role="separator"
        tabIndex={codeFolded || previewFolded ? -1 : 0}
        aria-label={tr('Resize the live panels')}
        aria-orientation="horizontal"
        aria-valuemin={SPLIT_FLOOR}
        aria-valuemax={SPLIT_CEILING}
        aria-valuenow={split}
        title={tr('Drag to resize · double-click to reset')}
        onPointerDown={startSplit}
        onPointerMove={moveSplit}
        onPointerUp={endSplit}
        onPointerCancel={endSplit}
        onDoubleClick={() => setSplit(SPLIT_DEFAULT)}
        onKeyDown={event => {
          const step = event.shiftKey ? 10 : 4;
          if (event.key === 'ArrowUp') { event.preventDefault(); setSplit(value => Math.max(SPLIT_FLOOR, value - step)); }
          else if (event.key === 'ArrowDown') { event.preventDefault(); setSplit(value => Math.min(SPLIT_CEILING, value + step)); }
          else if (event.key === 'Home' || event.key === 'Enter') { event.preventDefault(); setSplit(SPLIT_DEFAULT); }
          else if (event.key === 'End') { event.preventDefault(); setSplit(SPLIT_CEILING); }
        }}
      ><span /></div>
      <section className="live__panel live__panel--preview" aria-label={tr('Preview')}>
        <header className="live__head">
          <Icon name="play" size={13} />
          <span className="live__title">{tr('Preview')}</span>
          <span className="spacer" />
          <button type="button" className="live__fold" aria-expanded={!previewFolded} aria-label={tr(previewFolded ? 'Show the preview' : 'Hide the preview')} title={tr(previewFolded ? 'Show the preview' : 'Hide the preview')} onClick={() => setPreviewFolded(value => !value)}><Icon name="chevron" size={13} className={previewFolded ? 'live__chev' : undefined} /></button>
        </header>
        {previewFolded ? null : <div className="live__body">
          {following && !pageText ? <div className="workbench__empty workbench__empty--compact">
            <Icon name="play" size={24} />
            <strong>{tr('Nothing to run yet')}</strong>
            <p>{tr(pageError || 'Ask for a page, or add an index.html to this project, and it appears here while it is being written.')}</p>
          </div> : <div className="sandbox__output">
            <iframe
              key={revision}
              ref={frame}
              title={tr('Sandbox preview')}
              sandbox="allow-scripts"
              srcDoc={withSandboxConsole(following ? pageText : running)}
            />
            {/* A blank preview is the usual symptom of an error: the strip underneath
                is where the page says what happened. */}
            <SandboxConsole messages={messages} onClear={clear} label={tr('Sandbox console')} />
          </div>}
        </div>}
      </section>
    </div>
  </Pane>;
}

type TermLine = { id: number; kind: 'command' | 'output' | 'error' | 'meta'; text: string };

/** What a run reports when it ends. */
type TerminalDone = {
  ok?: boolean;
  output?: string;
  cwd?: string;
  clear?: boolean;
  exitCode?: number | null;
  cut?: boolean;
  stopped?: boolean;
  timedOut?: boolean;
};

/** Path-looking words in a command's output, as buttons that open that file. */
const PATH_TOKEN = /(?<![\w:/\\])(?:[A-Za-z]:[\\/]|\/|\.{1,2}[\\/])?(?:[\w.@+-]+[\\/])*[\w.@+-]+\.[A-Za-z][A-Za-z0-9]{0,7}\b/g;

function linkified(text: string, cwd: string): ReactNode {
  /* A path needs a folder to be made absolute against, and a very long line is
     output, not a list of files worth turning into links. */
  if (!cwd || text.length > 4000) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  let count = 0;
  for (let hit = PATH_TOKEN.exec(text); hit && count < 24; hit = PATH_TOKEN.exec(text)) {
    if (hit.index > last) parts.push(text.slice(last, hit.index));
    const token = hit[0];
    parts.push(<button key={hit.index} type="button" className="terminal__path" title={tr('Open in files')} onClick={() => openInFiles(token, cwd)}>{token}</button>);
    last = hit.index + token.length;
    count++;
  }
  if (!parts.length) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function TerminalPane({ active, pending, onRan }: {
  active: boolean;
  pending: { command: string; id: number } | null;
  onRan: () => void;
}) {
  const [session] = useState(terminalSession);
  const [cwd, setCwd] = useState('');
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyAt, setHistoryAt] = useState(-1);
  const nextLine = useRef(0);
  const output = useRef<HTMLPreElement>(null);
  const field = useRef<HTMLInputElement>(null);
  /* Output arrives in chunks that can end anywhere: the tail of a line waits
     here until the rest of it does. */
  const buffered = useRef<{ text: string; kind: 'output' | 'error' }>({ text: '', kind: 'output' });

  useEffect(() => {
    let live = true;
    api.get<{ cwd: string }>(`/api/terminal?sessionId=${encodeURIComponent(session)}`)
      .then(result => { if (live) setCwd(result.cwd); })
      .catch(() => { /* the first command will report a real error */ });
    return () => { live = false; };
  }, [session]);

  useEffect(() => {
    const el = output.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  function push(kind: TermLine['kind'], text: string) {
    if (!text) return;
    setLines(old => [...old, { id: nextLine.current++, kind, text }].slice(-2000));
  }

  /** One chunk of a running command: complete lines go in, the rest waits. */
  function appendStream(text: string, kind: 'output' | 'error') {
    if (buffered.current.kind !== kind) flushStream();
    buffered.current.kind = kind;
    buffered.current.text += text.replace(/\r\n/g, '\n');
    const parts = buffered.current.text.split('\n');
    buffered.current.text = parts.pop() ?? '';
    const ready = parts.filter(part => part.length > 0);
    if (ready.length) setLines(old => [...old, ...ready.map(line => ({ id: nextLine.current++, kind, text: line }))].slice(-2000));
  }

  /** The line a command left without a newline, once it is done. */
  function flushStream() {
    const text = buffered.current.text.replace(/\r$/, '').trimEnd();
    const kind = buffered.current.kind;
    buffered.current.text = '';
    if (text) setLines(old => [...old, { id: nextLine.current++, kind, text }].slice(-2000));
  }

  /* A command from an answer runs the same way a typed one does; if one is
     already running, the new one waits in the prompt instead of being lost. */
  useEffect(() => {
    if (!pending) return;
    if (busy) setInput(pending.command);
    else void runCommand(pending.command);
    onRan();
  }, [pending?.id]);

  async function runCommand(text: string) {
    const command = text.trim();
    if (!command || busy) return;
    if (/^(clear|cls)$/i.test(command)) {
      setLines([]);
      setInput('');
      return;
    }
    setInput('');
    setHistoryAt(-1);
    setHistory(old => [command, ...old.filter(item => item !== command)].slice(0, 60));
    push('command', command);
    setBusy(true);
    setStopping(false);
    buffered.current = { text: '', kind: 'output' };
    /* The end of the run is read from the stream, so it has to survive state
       changes and closures: an object holds it. */
    const report: { value?: TerminalDone } = {};
    try {
      await postStream('/api/terminal/run', { sessionId: session, command }, event => {
        if (event.type === 'out') appendStream(String(event.text ?? ''), 'output');
        else if (event.type === 'err') appendStream(String(event.text ?? ''), 'error');
        else if (event.type === 'done') {
          report.value = event as TerminalDone;
          if (event.clear) setLines([]);
          else if (typeof event.output === 'string' && event.output) push(event.ok ? 'output' : 'error', event.output);
          if (typeof event.cwd === 'string' && event.cwd) setCwd(event.cwd);
        }
      });
    } catch (error) {
      push('error', error instanceof Error ? error.message : String(error));
    } finally {
      flushStream();
      if (report.value?.cut) push('meta', tr('Output cut after 200,000 characters.'));
      if (report.value?.stopped) push('meta', tr('Stopped.'));
      if (report.value?.timedOut) push('meta', tr('Stopped after the time limit.'));
      const exit = report.value?.exitCode;
      if (report.value && !report.value.ok && !report.value.stopped && !report.value.timedOut && exit != null) push('meta', `exit ${exit}`);
      setBusy(false);
      setStopping(false);
      requestAnimationFrame(() => field.current?.focus());
    }
  }

  /** Ask the host to end the command and everything it started. */
  async function stop() {
    setStopping(true);
    try {
      await api.post('/api/terminal/stop', { sessionId: session });
    } catch (error) {
      setStopping(false);
      push('error', error instanceof Error ? error.message : String(error));
    }
  }

  function run() { void runCommand(input); }

  return <Pane id="terminal" active={active}>
    <div className="workbench__bar">
      <span className="workbench__file" title={cwd}><Icon name="computer" size={14} /><span className="workbench__file-text">{cwd || tr('Working folder')}</span></span>
      {busy ? <button type="button" className="workbench__link terminal__stop" onClick={() => void stop()} disabled={stopping}><Icon name="stop" size={13} /><span className="workbench__link-text">{tr(stopping ? 'Stopping…' : 'Stop')}</span></button> : null}
      <button type="button" className="workbench__link" onClick={() => setLines([])}><Icon name="trash" size={14} /><span className="workbench__link-text">{tr('Clear')}</span></button>
    </div>
    <pre className="terminal__output" ref={output} aria-live="polite">
      {lines.length === 0 ? <span className="terminal__welcome">{tr('Type a command and press Enter.')}{'\n'}<span className="terminal__dim">{tr('The terminal runs on this computer.')}</span></span> : null}
      {lines.map(line => <span key={line.id} className={`terminal__line terminal__line--${line.kind}`}>
        {line.kind === 'command' ? <><span className="terminal__prompt-mark">❯</span> {line.text}</> : line.kind === 'meta' ? line.text : linkified(line.text, cwd)}{'\n'}
      </span>)}
      {busy ? <span className="terminal__line terminal__line--meta">{tr('Running…')}</span> : null}
    </pre>
    <form className="terminal__form" onSubmit={event => { event.preventDefault(); void run(); }}>
      <span className="terminal__prompt-mark" aria-hidden="true">❯</span>
      <input
        ref={field}
        className="terminal__input"
        value={input}
        aria-label={tr('Command')}
        placeholder={tr('Type a command and press Enter.')}
        spellCheck={false}
        autoComplete="off"
        disabled={busy}
        onChange={event => { setInput(event.target.value); setHistoryAt(-1); }}
        onKeyDown={event => {
          if (event.key === 'ArrowUp' && history.length) {
            event.preventDefault();
            const next = Math.min(history.length - 1, historyAt + 1);
            setHistoryAt(next);
            setInput(history[next] ?? '');
          } else if (event.key === 'ArrowDown' && historyAt >= 0) {
            event.preventDefault();
            const next = historyAt - 1;
            setHistoryAt(next);
            setInput(next < 0 ? '' : history[next] ?? '');
          }
        }}
      />
      <button type="submit" className="workbench__send" aria-label={tr('Run')} title={tr('Run')} disabled={busy || !input.trim()}>
        <Icon name="send" size={15} />
      </button>
    </form>
  </Pane>;
}

function BrowserPane({ active }: { active: boolean }) {
  const [address, setAddress] = useState('');
  const [stack, setStack] = useState<string[]>([]);
  const [at, setAt] = useState(-1);
  const [revision, setRevision] = useState(0);
  const url = stack[at] ?? '';
  const canBack = at > 0;
  const canForward = at >= 0 && at < stack.length - 1;

  function go(value = address) {
    const next = addressOf(value);
    if (!next) return;
    const history = [...stack.slice(0, at + 1), next];
    setStack(history);
    setAt(history.length - 1);
    setAddress(next);
    setRevision(value => value + 1);
  }

  function step(delta: number) {
    const next = at + delta;
    if (next < 0 || next >= stack.length) return;
    setAt(next);
    setAddress(stack[next]);
    setRevision(value => value + 1);
  }

  return <Pane id="browser" active={active}>
    <form className="browser__bar" onSubmit={event => { event.preventDefault(); go(); }}>
      <button type="button" className="workbench__icon" aria-label={tr('Back')} title={tr('Back')} disabled={!canBack} onClick={() => step(-1)}><Icon name="chevron" size={15} className="browser__back" /></button>
      <button type="button" className="workbench__icon" aria-label={tr('Forward')} title={tr('Forward')} disabled={!canForward} onClick={() => step(1)}><Icon name="chevron" size={15} className="browser__forward" /></button>
      <input
        className="browser__address"
        value={address}
        aria-label={tr('URL')}
        placeholder={tr('Enter a URL')}
        spellCheck={false}
        onChange={event => setAddress(event.target.value)}
      />
      <button type="submit" className="workbench__send" aria-label={tr('Go')} title={tr('Go')} disabled={!address.trim()}><Icon name="chevron" size={15} /></button>
    </form>
    <div className="browser__body">
      {url ? <iframe
        key={`${url}-${revision}`}
        title={tr('Browser')}
        src={url}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
      /> : <div className="workbench__empty">
        <Brand variant="mark" height={54} decorative />
        <strong>{tr('Browser')}</strong>
        <p>{tr('Enter a URL to preview a site here. Some sites refuse to be embedded.')}</p>
      </div>}
    </div>
    <div className="browser__foot">
      <span>{tr('Some sites refuse to be embedded.')}</span>
      <span className="spacer" />
      <button type="button" className="workbench__link" disabled={!url} onClick={() => { if (url) void openExternal(url); }}>
        <Icon name="link" size={14} />{tr('Open in browser')}
      </button>
      <button type="button" className="workbench__link" disabled={!url} onClick={() => setRevision(value => value + 1)}>
        <Icon name="refresh" size={14} />{tr('Reload')}
      </button>
    </div>
  </Pane>;
}

type OpenFile = {
  path: string;
  loading?: boolean;
  text?: string;
  binary?: boolean;
  tooLarge?: boolean;
  sizeKb?: number;
  error?: string;
};

function FilesPane({ active, pending, onOpened }: {
  active: boolean;
  pending: { path: string; cwd?: string; id: number } | null;
  onOpened: () => void;
}) {
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspace = useStore(s => s.activeWorkspace);
  const root = workspaces.find(w => w.id === activeWorkspace) ?? workspaces[0];
  const [entries, setEntries] = useState<WorkspaceFile[]>([]);
  const [prefix, setPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<OpenFile | null>(null);
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [repo, setRepo] = useState('');
  const [cloning, setCloning] = useState(false);
  /* A file from another workspace: the switch and the open happen in two renders,
     so the target waits here for the reset that follows the workspace change. */
  const [wanted, setWanted] = useState<{ rel: string; rootId: string } | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const next = wanted;
    setWanted(null);
    if (next) {
      setPrefix(next.rel.includes('/') ? next.rel.slice(0, next.rel.lastIndexOf('/')) : '');
      void openFile(next.rel, next.rootId);
      return;
    }
    setPrefix('');
    setSelected(null);
  }, [root?.id]);

  /* A path from the terminal's output: find the workspace that owns it, and show
     it there. A path outside every workspace is said plainly instead of opening
     a file that is not there. */
  useEffect(() => {
    if (!pending || !root) return;
    const found = locateInWorkspaces(pending.path, pending.cwd ?? root.path, workspaces);
    onOpened();
    if (!found) {
      setSelected({ path: pending.path, error: tr('That file is outside this workspace.') });
      return;
    }
    if (found.id === root.id) {
      setPrefix(found.rel.includes('/') ? found.rel.slice(0, found.rel.lastIndexOf('/')) : '');
      setSelected(null);
      void openFile(found.rel, found.id);
      return;
    }
    setWanted({ rel: found.rel, rootId: found.id });
    setActiveWorkspace(found.id);
  }, [pending?.id]);

  useEffect(() => {
    if (!root?.id) { setEntries([]); return undefined; }
    let live = true;
    setLoading(true);
    setError('');
    api.get<{ path: string; entries: WorkspaceFile[] }>(`/api/workspace?root=${encodeURIComponent(root.id)}`)
      .then(result => { if (live) setEntries(result.entries ?? []); })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : String(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [root?.id, reload]);

  const visible = useMemo(() => {
    const base = prefix ? `${prefix}/` : '';
    return entries
      .filter(entry => entry.path.startsWith(base) && entry.path.slice(base.length).split('/').length === 1)
      .sort((a, b) => a.kind === b.kind ? a.path.localeCompare(b.path) : a.kind === 'dir' ? -1 : 1);
  }, [entries, prefix]);

  const crumbs = prefix.split('/').filter(Boolean);

  async function openFile(path: string, rootId = root?.id) {
    if (!rootId) return;
    const id = ++request.current;
    setSelected({ path, loading: true });
    try {
      const result = await api.get<OpenFile>(`/api/workspace/file?root=${encodeURIComponent(rootId)}&path=${encodeURIComponent(path)}`);
      if (request.current === id) setSelected({ ...result, path });
    } catch (cause) {
      if (request.current === id) setSelected({ path, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  function enter(path: string) {
    setPrefix(path);
    setSelected(null);
  }

  async function addFolder() {
    setAdding(true);
    try {
      const path = await pickWorkspace();
      if (path) await addWorkspace(path);
    } finally {
      setAdding(false);
    }
  }

  async function cloneFromGithub() {
    const wanted = repo.trim();
    if (!wanted) return;
    setCloning(true);
    try {
      const ws = await addGithubWorkspace(wanted);
      if (ws) { setActiveWorkspace(ws.id); setGithubOpen(false); setRepo(''); }
    } finally {
      setCloning(false);
    }
  }

  return <Pane id="files" active={active}>
    <div className="workbench__bar">
      {workspaces.length > 1
        ? <Select ariaLabel={tr('Workspace')} translateLabels={false} value={root?.id ?? ''} options={workspaces.map(workspace => ({ value: workspace.id, label: workspace.name }))} onChange={setActiveWorkspace} />
        : <span className="workbench__file" title={root?.path}><Icon name="folder" size={14} /><span className="workbench__file-text">{root?.name ?? tr('Workspace')}</span></span>}
      <button type="button" className="workbench__icon" aria-label={tr('Refresh files')} title={tr('Refresh files')} onClick={() => setReload(value => value + 1)}>
        <Icon name="refresh" size={15} />
      </button>
    </div>

    <div className="files__crumbs" aria-label={tr('Folder path')}>
      <button type="button" onClick={() => setPrefix('')}>{root?.name ?? tr('Workspace')}</button>
      {crumbs.map((crumb, index) => {
        const path = crumbs.slice(0, index + 1).join('/');
        return <span key={path}><span className="files__slash">/</span><button type="button" onClick={() => setPrefix(path)}>{crumb}</button></span>;
      })}
    </div>

    <div className="files__split">
      <div className="files__list" aria-busy={loading}>
        {error ? <p className="workbench__error" role="alert">{error}</p> : null}
        {!error && !loading && visible.length === 0 ? <div className="workbench__empty workbench__empty--compact">
          <Icon name="folder" size={24} />
          <strong>{tr('This workspace is empty.')}</strong>
          <p>{tr('Add a folder from the sidebar to explore it here.')}</p>
          <button type="button" className="workbench__run" disabled={adding} onClick={() => void addFolder()}><Icon name="folder-plus" size={14} />{tr(adding ? 'Adding…' : 'Add folder')}</button>
          <button type="button" className="workbench__run" data-github-open onClick={() => setGithubOpen(true)}><Icon name="branch" size={14} />{tr('Add from GitHub')}</button>
        </div> : null}
        {visible.map(entry => entry.kind === 'dir'
          ? <button key={entry.path} type="button" className="files__row files__row--dir" onClick={() => enter(entry.path)}>
              <Icon name="folder" size={15} /><span>{entry.path.slice(entry.path.lastIndexOf('/') + 1)}</span><Icon name="chevron" size={13} className="files__chev" />
            </button>
          : <button key={entry.path} type="button" className="files__row" data-selected={selected?.path === entry.path || undefined} onClick={() => void openFile(entry.path)}>
              <Icon name="file" size={15} /><span>{entry.path.slice(entry.path.lastIndexOf('/') + 1)}</span><small>{sizeText(entry.sizeKb)}</small>
            </button>)}
      </div>
      <div className="files__viewer">
        {!selected ? <div className="workbench__empty workbench__empty--compact">
          <Icon name="file" size={24} />
          <strong>{tr('No file selected')}</strong>
          <p>{tr('Choose a file to read it here.')}</p>
        </div> : selected.loading ? <p className="workbench__muted">{tr('Loading…')}</p>
          : selected.error ? <p className="workbench__error" role="alert">{selected.error}</p>
          : selected.tooLarge ? <p className="workbench__muted">{tr('This file is too large to preview.')}</p>
          : selected.binary ? <p className="workbench__muted">{tr('This file is binary, so it has no text preview.')}</p>
          : <>
              <div className="files__viewer-head"><span title={selected.path}>{selected.path}</span><small>{sizeText(selected.sizeKb)}</small></div>
              <pre className="files__text">{selected.text}</pre>
            </>}
      </div>
    </div>
    <Dialog open={githubOpen} title={tr('Add a repository from GitHub')} onClose={() => setGithubOpen(false)} actions={<><Btn onClick={() => setGithubOpen(false)}>{tr('Cancel')}</Btn><Btn variant="primary" disabled={cloning || !repo.trim()} onClick={() => void cloneFromGithub()}>{tr(cloning ? 'Cloning…' : 'Clone repository')}</Btn></>}>
      <div className="stack">
        <label className="input-field"><span>{tr('Repository')}</span><input className="st-input" data-github-repo autoFocus value={repo} placeholder={tr('owner/name or a github.com address')} onChange={e => setRepo(e.target.value)}/></label>
        <p className="small muted">{tr('Nostroma clones it into Documents/Nostroma/Projects and adds it as a workspace. A private repository needs a token in Settings.')}</p>
      </div>
    </Dialog>
  </Pane>;
}

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { tr } from '../lib/i18n';
import { useStore } from '../lib/store';
import { Icon } from './ui';

/**
 * Nono, the assistant: two narrow rectangles that say what the app is doing and
 * hand over one tip at a time.
 *
 * Each eye is its own pupil: it travels up, down and to the sides towards what
 * is worth looking at, and drifts to a new corner now and then when nothing is,
 * while the pair leans towards the pointer and towards the conversation while
 * someone types. It shows curiosity, thinking, a
 * happy squint, an "oops" or a wink as things happen. The button is the help:
 * each click moves to the next tip. The blink is irregular (and sometimes
 * double) rather than a metronome, and a double has its own pace every time. It
 * can be dragged off its corner, and the
 * place it is left is remembered. The idle blink stops when motion is reduced;
 * the brief blinks that answer an event and the wink stay, because they carry
 * state, not motion.
 */
const tips = () => [
  tr('Run a shell block from an answer in the Workbench terminal, instead of copying it.'),
  tr('An HTML or JavaScript block opens in the sandbox from its Sandbox button.'),
  tr('Type /plan to agree on the approach before any file changes.'),
  tr('Type /goal to start a Mission that keeps working until it is done.'),
  tr('The console under a preview says why a page is blank.'),
  tr('Drag the Workbench edge to widen it, or press Home on it to reset.'),
];

/** Where the pupils sit inside their sockets for a gaze from (0,0) towards (dx,dy). */
export function gaze(dx: number, dy: number, maxX = 3, maxY = 5) {
  const length = Math.hypot(dx, dy);
  if (!length) return { x: 0, y: 0 };
  const reach = Math.min(1, length / 90);
  return { x: Number(((dx / length) * maxX * reach).toFixed(2)), y: Number(((dy / length) * maxY * reach).toFixed(2)) };
}

/**
 * How far each eye travels for a gaze from `gaze()`: the eye is its own pupil,
 * so the movement is the look. `weight` is how much of it is taken (typing leans
 * all the way, the pointer a little less), and the reach is a little longer
 * downwards, where the eyes are taller than wide.
 */
export function eyeShift(gx: number, gy: number, weight = 1) {
  const clamp = (value: number, max: number) => Number(Math.max(-max, Math.min(max, value)).toFixed(2));
  return { x: clamp((gx / 3) * 5.2 * weight, 5.2), y: clamp((gy / 5) * 6.4 * weight, 6.4) };
}

/** The eight ways a glance can go, so up, down and both sides all happen. */
const GLANCES: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const GLANCE_MAX = GLANCES.length - 1;

/**
 * Where the eyes wander when nothing asks for them: a reach in one of the eight
 * directions, never the very edge. `random` is injectable for the test.
 */
export function idleGlance(random: () => number = Math.random) {
  const [dx, dy] = GLANCES[Math.min(GLANCE_MAX, Math.floor(random() * GLANCES.length))];
  const reach = 0.5 + random() * 0.5;
  return { x: Number((dx * 5 * reach).toFixed(2)), y: Number((dy * 6.2 * reach).toFixed(2)) };
}

/** A blink arrives every 3 to 7.5 seconds; `random` is injectable for the test. */
export function nextBlinkDelay(random: () => number = Math.random) {
  return Math.round(3000 + random() * 4500);
}

/**
 * The two blinks of a double, in milliseconds: the first lid, the pause with the
 * eyes open again, then the second lid. The ranges keep the pair readable (a
 * pause too short reads as one long blink) and are drawn again for every double,
 * so no two look the same; `random` is injectable for the test.
 */
export function blinkPattern(random: () => number = Math.random) {
  return {
    first: Math.round(80 + random() * 70),
    gap: Math.round(110 + random() * 120),
    second: Math.round(90 + random() * 60),
  };
}

/** What Nono looks at, in order: the composer while typing, a new message, the project, then the pointer. */
export type GazeTarget = 'typing' | 'message' | 'project' | 'pointer' | null;
export function gazePriority(state: { typing: boolean; message: boolean; project: boolean; pointer: boolean }): GazeTarget {
  if (state.typing) return 'typing';
  if (state.message) return 'message';
  if (state.project) return 'project';
  if (state.pointer) return 'pointer';
  return null;
}

/** The active workspace row, or the Workbench button when the sidebar is collapsed (that row is not rendered then). */
export function projectAnchor(doc: Pick<Document, 'querySelector'> = document): Element | null {
  return doc.querySelector('.ws__row.is-active') ?? doc.querySelector('.chat-workbench-toggle');
}

const SHIFT_KEY = 'nostroma.nono.shift.v1';

/** Add a timeout to the set and take its id out when it fires, so the set holds only timers still waiting. */
export function trackTimeout(timers: Set<number>, fn: () => void, ms: number,
  set: (fn: () => void, ms: number) => number = (run, wait) => window.setTimeout(run, wait)): number {
  const id = set(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
}

/**
 * Schedule work only while the component is mounted. The callback may already be
 * in the event loop when React runs the cleanup: clearing its timer cannot take
 * it back, so the guard runs again when the callback fires. A skipped callback
 * must not update state or schedule anything else.
 */
export function scheduleLater(isLive: () => boolean, timers: Set<number>, fn: () => void, ms: number,
  set: (fn: () => void, ms: number) => number = (run, wait) => window.setTimeout(run, wait)): number {
  if (!isLive()) return 0;
  return trackTimeout(timers, () => { if (isLive()) fn(); }, ms, set);
}

/** Where the person left Nono, relative to its corner; the corner is the default. */
function readShift() {
  try {
    if (typeof localStorage === 'undefined') return { x: 0, y: 0 };
    const raw = localStorage.getItem(SHIFT_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return { x: value.x, y: value.y };
  } catch { /* Private mode, or a value someone edited by hand. */ }
  return { x: 0, y: 0 };
}

type Drag = {
  id: number;
  startX: number;
  startY: number;
  left: number;
  top: number;
  shiftX: number;
  shiftY: number;
  moved: boolean;
  next: { x: number; y: number };
};

export function Nono({ streaming = false, problem = false }: { streaming?: boolean; problem?: boolean }) {
  const [tip, setTip] = useState<number | null>(null);
  const [blink, setBlink] = useState(false);
  const [wink, setWink] = useState(false);
  const [near, setNear] = useState(false);
  const [typingActive, setTypingActive] = useState(false);
  const [curious, setCurious] = useState(false);
  const [shift, setShift] = useState(readShift);
  const root = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const next = useRef(0);
  const hide = useRef<number | null>(null);
  const curiousTimer = useRef<number | null>(null);
  const timers = useRef(new Set<number>());
  const live = useRef(true);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const typing = useRef(false);
  const hold = useRef<number | null>(null);
  const held = useRef<'message' | 'project' | null>(null);
  const holdPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPointerAt = useRef(0);
  /* Bumped whenever something aims the eyes, so a glance that is over does not
     pull them back to the middle after a pointer took them somewhere else. */
  const aimToken = useRef(0);
  const aimAt = useRef<(x: number, y: number) => void>(() => { });
  const lookAt = useRef<(element: Element | null, ms?: number, kind?: 'message' | 'project') => void>(() => { });

  /* The chat and the project are read here rather than passed down: Nono is the
     companion of the whole conversation, not of the composer alone. */
  const lastMessage = useStore((s) => s.sessions.find((x) => x.id === s.activeSession)?.messages.at(-1)?.id ?? null);
  const workspace = useStore((s) => s.activeWorkspace);
  const seenMessage = useRef(lastMessage);
  const seenWorkspace = useRef(workspace);
  const wasStreaming = useRef(streaming);

  const still = () =>
    matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';

  const later = (fn: () => void, ms: number) =>
    scheduleLater(() => live.current, timers.current, fn, ms);

  /* The eyes move by writing two lengths; the stylesheet does the travelling. */
  const setLook = (x: number, y: number) => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty('--nono-look-x', `${x.toFixed(2)}px`);
    el.style.setProperty('--nono-look-y', `${y.toFixed(2)}px`);
  };

  /* A new message and a project change share one expression: the latest event extends it instead of an older timer ending it early. */
  const curiousFor = (ms = 1200) => {
    if (!live.current) return;
    setCurious(true);
    if (curiousTimer.current !== null) {
      window.clearTimeout(curiousTimer.current);
      timers.current.delete(curiousTimer.current);
    }
    curiousTimer.current = later(() => {
      curiousTimer.current = null;
      setCurious(false);
    }, ms);
  };

  function blinkOnce(duration = 120) {
    if (!live.current) return;
    /* The lids close and open in the time this blink was given, not in a fixed
       one: the stylesheet reads this for the scale transition. */
    root.current?.style.setProperty('--nono-blink', `${duration}ms`);
    setBlink(true);
    later(() => setBlink(false), duration);
  }

  function blinkTwice() {
    const pattern = blinkPattern();
    blinkOnce(pattern.first);
    later(() => blinkOnce(pattern.second), pattern.first + pattern.gap);
  }

  function winkOnce() {
    if (!live.current) return;
    setWink(true);
    later(() => setWink(false), 300);
  }

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      for (const id of timers.current) window.clearTimeout(id);
      timers.current.clear();
      curiousTimer.current = null;
    };
  }, []);

  useEffect(() => {
    if (still()) return;
    let stopped = false;
    let pending = 0;
    const schedule = () => {
      pending = later(() => {
        if (stopped) return;
        if (Math.random() < 0.18) {
          const pattern = blinkPattern();
          blinkOnce(pattern.first);
          later(() => { if (!stopped) blinkOnce(pattern.second); }, pattern.first + pattern.gap);
        } else blinkOnce(90 + Math.random() * 70);
        schedule();
      }, nextBlinkDelay());
    };
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(pending);
      timers.current.delete(pending);
    };
  }, []);

  useEffect(() => () => { if (hide.current) window.clearTimeout(hide.current); }, []);

  /* Nothing is asking for the eyes, so they wander: up, down or to a side, a
     glance now and then, coming back to the middle in between, rather than a
     stare fixed on nothing. The pointer, the composer or a held target stop it
     at once, and the glance is drawn again every time. */
  useEffect(() => {
    if (still()) return;
    let stopped = false;
    let pending = 0;
    const queue = (fn: () => void, ms: number) => { pending = later(fn, ms); };
    const wander = () => {
      if (stopped) return;
      const quiet = !typing.current && !held.current && Date.now() - lastPointerAt.current > 1200;
      if (quiet) {
        const glance = idleGlance();
        const token = aimToken.current + 1;
        aimToken.current = token;
        setLook(glance.x, glance.y);
        queue(() => {
          if (!stopped && aimToken.current === token && !typing.current && !held.current) setLook(0, 0);
        }, 620 + Math.random() * 900);
      }
      queue(wander, 1500 + Math.random() * 2200);
    };
    queue(wander, 1600);
    return () => {
      stopped = true;
      window.clearTimeout(pending);
      timers.current.delete(pending);
    };
  }, []);

  /* The gaze, in priority order: the composer while someone types, a held
     target (a new message, the project), then the pointer. A hold expires on its
     own and gives the eyes back to wherever the pointer is. */
  useEffect(() => {
    const aim = (x: number, y: number) => {
      const el = face.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const look = gaze(x - (box.left + box.width / 2), y - (box.top + box.height / 2));
      /* The eye is its own pupil: it travels inside the place it holds, and the
         pair leans a little towards what it is looking at. Typing leans further. */
      const weight = typing.current ? 1 : 0.82;
      const shift = eyeShift(look.x, look.y, weight);
      aimToken.current += 1;
      setLook(shift.x, shift.y);
      root.current?.style.setProperty('--nono-tilt', `${((look.x / 3) * 16 * weight).toFixed(2)}deg`);
      root.current?.style.setProperty('--nono-rise', `${((look.y / 5) * 2.2 * weight).toFixed(2)}px`);
    };
    const atChat = () => {
      const chat = document.querySelector('.chat');
      if (!chat) return;
      const box = chat.getBoundingClientRect();
      aim(box.left + box.width / 2, box.top + box.height / 2);
    };
    const aimFocus = () => {
      const focus = gazePriority({
        typing: typing.current,
        message: held.current === 'message',
        project: held.current === 'project',
        pointer: !!pointer.current,
      });
      if (focus === 'typing') atChat();
      else if ((focus === 'message' || focus === 'project') && holdPoint.current) aim(holdPoint.current.x, holdPoint.current.y);
      else if (focus === 'pointer' && pointer.current) aim(pointer.current.x, pointer.current.y);
    };
    aimAt.current = aim;
    lookAt.current = (element, ms = 1100, kind = 'message') => {
      if (!element) return;
      const box = element.getBoundingClientRect();
      held.current = kind;
      holdPoint.current = { x: box.left + box.width / 2, y: box.top + Math.min(box.height / 2, 150) };
      if (hold.current) window.clearTimeout(hold.current);
      aimFocus();
      hold.current = window.setTimeout(() => {
        if (!live.current) return;
        hold.current = null;
        held.current = null;
        holdPoint.current = null;
        aimFocus();
      }, ms);
    };
    const onPointer = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      lastPointerAt.current = Date.now();
      if (gazePriority({ typing: typing.current, message: held.current === 'message', project: held.current === 'project', pointer: true }) === 'pointer') aim(event.clientX, event.clientY);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.composer')) return;
      typing.current = true;
      setTypingActive(true);
      aimFocus();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.composer')) return;
      typing.current = false;
      setTypingActive(false);
      aimFocus();
      if (!pointer.current) {
        /* Nothing to look at any more: back to the middle, until something asks. */
        setLook(0, 0);
        root.current?.style.setProperty('--nono-tilt', '0deg');
        root.current?.style.setProperty('--nono-rise', '0px');
      }
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (hold.current) window.clearTimeout(hold.current);
      hold.current = null;
      held.current = null;
      holdPoint.current = null;
    };
  }, []);

  /* A message lands: look at it. The conversation is the thing being discussed,
     so the eyes go there before they go back to the pointer. */
  useEffect(() => {
    if (!lastMessage || lastMessage === seenMessage.current) return;
    seenMessage.current = lastMessage;
    curiousFor();
    lookAt.current(document.querySelector('.chat__inner')?.lastElementChild ?? null, 1100);
  }, [lastMessage]);

  /* The project changes: look at the workspace, and acknowledge it with a blink. */
  useEffect(() => {
    if (workspace === seenWorkspace.current) return;
    seenWorkspace.current = workspace;
    const row = projectAnchor();
    curiousFor();
    lookAt.current(row, 1200, 'project');
    blinkTwice();
  }, [workspace]);

  /* A reply starts or ends: follow the transcript, then blink twice when it is done. */
  useEffect(() => {
    if (streaming === wasStreaming.current) return;
    wasStreaming.current = streaming;
    const last = document.querySelector('.chat__inner')?.lastElementChild ?? document.querySelector('.chat');
    if (streaming) lookAt.current(last, 1500);
    else blinkTwice();
  }, [streaming]);

  function showTip() {
    if (!live.current) return;
    const list = tips();
    setTip(next.current % list.length);
    next.current += 1;
    winkOnce();
    if (hide.current) window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => { if (live.current) setTip(null); }, 9000);
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const el = face.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    drag.current = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY,
      left: box.left, top: box.top, shiftX: shift.x, shiftY: shift.y,
      moved: false, next: shift,
    };
    el.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    const el = face.current;
    if (!current || current.id !== event.pointerId || !el) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 4) return;
    current.moved = true;
    const width = el.offsetWidth, height = el.offsetHeight;
    const left = Math.min(Math.max(8, current.left + dx), window.innerWidth - width - 8);
    const top = Math.min(Math.max(8, current.top + dy), window.innerHeight - height - 8);
    current.next = { x: current.shiftX + left - current.left, y: current.shiftY + top - current.top };
    setShift(current.next);
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    face.current?.releasePointerCapture?.(event.pointerId);
    if (!current.moved) return;
    dragged.current = true;
    blinkTwice();
    try { localStorage.setItem(SHIFT_KEY, JSON.stringify(current.next)); } catch { /* Private mode: it still moves, it just is not remembered. */ }
  }

  const mood = problem ? 'oops' : streaming ? 'thinking' : typingActive || curious ? 'curious' : near ? 'happy' : 'idle';
  const list = tips();

  return <div
    className="nono"
    data-mood={mood}
    data-blink={blink || undefined}
    data-wink={wink || undefined}
    ref={root}
    style={{ transform: `translate(${shift.x}px, calc(-50% + ${shift.y}px))` } as CSSProperties}
  >
    <button
      type="button"
      ref={face}
      className="nono__face"
      aria-label={tr('Nono, the assistant')}
      aria-expanded={tip !== null}
      aria-controls={tip !== null ? 'nono-tip' : undefined}
      title={tr('Nono, the assistant')}
      onClick={() => {
        if (dragged.current) { dragged.current = false; return; }
        showTip();
      }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setNear(true)}
      onPointerLeave={() => setNear(false)}
      onBlur={() => setNear(false)}
    >
      <span className="nono__eyes">
        <span className="nono__eye" />
        <span className="nono__eye" />
      </span>
    </button>
    {tip !== null ? <div className="nono__tip" id="nono-tip" role="status">
      <span>{list[tip]}</span>
      <button type="button" className="nono__close" aria-label={tr('Close tip')} title={tr('Close tip')} onClick={() => setTip(null)}><Icon name="x" size={12} /></button>
    </div> : null}
  </div>;
}

/**
 * Text the layout had to cut. Every element whose own text does not fit — the
 * ones that end in an ellipsis, and the ones whose overflow is simply hidden —
 * is marked, and a marked row scrolls itself to the end of its text while the
 * pointer is on it or it has keyboard focus, so the whole line is read without
 * having to do anything. The mark goes away as soon as the text fits again, so
 * nothing is left behind after a resize, a new language or a longer path.
 *
 * CSS cannot ask "is this text cut?", so the measurement happens here. Only
 * elements that already overflow have their style read, and the scan is
 * debounced on mutations and resizes, which keeps it off the hot path.
 */
const MARK = 'data-overflow-x';
const GLIDE = 'data-gliding';
/* About 50 px a second: fast enough to finish a cut name in a second, slow
   enough to read. A cut path can be much longer, so the same speed applies. */
const GLIDE_MS = 40;
const GLIDE_STEP = 2;

let pending: ReturnType<typeof setTimeout> | undefined;
let gliding: number | undefined;
let glidingOn: HTMLElement | null = null;

function scan() {
  pending = undefined;
  const marks: HTMLElement[] = [];
  const clears: HTMLElement[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('*')) {
    const marked = el.hasAttribute(MARK);
    /* A row's overflow belongs to the text inside it, not to the box: only an
       element whose own first child is a text node can be the cut one. */
    const leaf = el.children.length === 0 && el.firstChild?.nodeType === 3;
    if (!leaf || el.scrollWidth <= el.clientWidth + 1) {
      if (marked) clears.push(el);
      continue;
    }
    const style = getComputedStyle(el);
    const cut = style.overflowX === 'hidden' || style.overflowX === 'clip';
    if (cut && !marked) marks.push(el);
    else if (!cut && marked) clears.push(el);
  }
  /* Read first, write after: one layout for the whole pass. */
  for (const el of clears) el.removeAttribute(MARK);
  for (const el of marks) el.setAttribute(MARK, '');
  if (glidingOn && !glidingOn.isConnected) stopGlide();
}

function stopGlide() {
  if (gliding !== undefined) window.clearInterval(gliding);
  gliding = undefined;
  if (glidingOn) {
    glidingOn.removeAttribute(GLIDE);
    glidingOn.scrollLeft = 0;
    glidingOn = null;
  }
}

/* With motion turned off the end of the line arrives at once instead of
   travelling: nothing animates, and nothing stays hidden either. */
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function startGlide(el: HTMLElement) {
  if (glidingOn === el || el.scrollWidth <= el.clientWidth + 1) return;
  stopGlide();
  glidingOn = el;
  el.setAttribute(GLIDE, '');
  if (still()) {
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    return;
  }
  gliding = window.setInterval(() => {
    if (!glidingOn || !glidingOn.isConnected) { stopGlide(); return; }
    const end = glidingOn.scrollWidth - glidingOn.clientWidth;
    if (glidingOn.scrollLeft >= end) {
      window.clearInterval(gliding);
      gliding = undefined;
      return;
    }
    glidingOn.scrollLeft = Math.min(end, glidingOn.scrollLeft + GLIDE_STEP);
  }, GLIDE_MS);
}

const markedRow = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>(`[${MARK}]`) : null);

export function startTextScroll() {
  const schedule = () => {
    if (pending) return;
    pending = setTimeout(scan, 180);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', schedule);
  /* Pointing at a cut label, or tabbing onto it, is enough: the text travels to
     the end by itself and comes back when the pointer leaves. */
  document.addEventListener('pointerover', event => {
    const row = markedRow(event.target);
    if (row) startGlide(row);
    else if (!event.relatedTarget || !(event.relatedTarget instanceof Node && glidingOn?.contains(event.relatedTarget))) stopGlide();
  });
  document.addEventListener('pointerout', event => {
    const row = markedRow(event.target);
    if (row && !row.contains(event.relatedTarget as Node | null)) stopGlide();
  });
  document.addEventListener('focusin', event => {
    const row = markedRow(event.target);
    if (row) startGlide(row);
    else stopGlide();
  });
  document.addEventListener('focusout', event => {
    const row = markedRow(event.target);
    if (row) stopGlide();
  });
  schedule();
}

/** A column of the app grid that can be dragged, and the width it was left at.
 *
 *  The grid reads the width from a custom property. The page publishes it
 *  before the first paint (main.tsx): applied after the first layout it would be
 *  a change to `grid-template-columns`, and the transition that animates the
 *  grid holds the old track until the document gets a frame — which a window
 *  opened behind another one never gets, so a saved width looked lost until
 *  `transition: none` was forced. Publishing first means the first width the
 *  grid sees is the saved one and no transition runs. */
export interface ColumnWidth {
  /** Where the dragged width is kept between starts. */
  key: string;
  /** The custom property the grid's tracks read. */
  variable: string;
  min: number;
  max: number;
}

/** The sidebar: room for a chat title, and no more than leaves the chat its floor. */
export const NAV_COLUMN: ColumnWidth = { key: 'nostroma.nav.width.v1', variable: '--st-nav-w', min: 220, max: 420 };
/** The Workbench dock. */
export const WORKBENCH_COLUMN: ColumnWidth = { key: 'nostroma.workbench.width.v1', variable: '--workbench-w', min: 320, max: 760 };

/** The width left from before, or null for the stylesheet's own size. */
export function storedColumnWidth(column: ColumnWidth): number | null {
  try {
    const value = Number(localStorage.getItem(column.key));
    /* '' (a reset) and a missing key both parse as 0, which is not a width. */
    return Number.isFinite(value) && value >= column.min ? Math.min(value, column.max) : null;
  } catch {
    return null;
  }
}

/** Writes the width the grid reads; null goes back to the stylesheet's size. */
export function applyColumnWidth(column: ColumnWidth, width: number | null): void {
  const root = document.documentElement;
  if (width === null) root.style.removeProperty(column.variable);
  else root.style.setProperty(column.variable, `${Math.round(width)}px`);
}

/** Keeps the width for the next start and publishes it now. */
export function publishColumnWidth(column: ColumnWidth, width: number | null): void {
  try { localStorage.setItem(column.key, String(width ?? '')); } catch { /* storage is optional */ }
  applyColumnWidth(column, width);
}

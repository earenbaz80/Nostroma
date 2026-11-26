import { tr } from '../lib/i18n';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { measureFrame, placeAnchored } from '../lib/overlay-place';
const MENU_ITEMS = '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)';
export function FloatingMenu({ anchor, title, onClose, children, width = 232 }: {
    anchor: HTMLElement | null;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    width?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [placed, setPlaced] = useState<{ left: number; top: number; maxWidth?: number; maxHeight?: number }>({ left: 12, top: 12 });
    useLayoutEffect(() => {
        // Placed in visual pixels and written in the page's own pixels (lib/overlay-place.ts): the page may be scaled by "Interface size" (#4653).
        const place = () => {
            const el = ref.current;
            const { scale, viewport } = measureFrame();
            const rect = anchor?.getBoundingClientRect();
            const natural = el ? Math.max(el.getBoundingClientRect().height, el.scrollHeight * scale) : 200 * scale;
            const home = { left: 12, top: 12, right: 12, bottom: 12 };
            const p = placeAnchored({ anchor: rect ?? home, size: { width: width * scale, height: natural }, viewport, scale });
            setPlaced({ left: p.left, top: p.top, maxWidth: p.maxWidth, maxHeight: p.maxHeight });
        };
        place();
        (ref.current?.querySelector<HTMLElement>(MENU_ITEMS) ?? ref.current)?.focus();
        const outside = (e: PointerEvent) => {
            const target = e.target as Node;
            if (!ref.current?.contains(target) && !anchor?.contains(target) && !(target instanceof Element && target.closest('.anchored-popover')))
                onClose();
        };
        document.addEventListener('pointerdown', outside);
        window.addEventListener('resize', place);
        return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); if (anchor?.isConnected)
            anchor.focus({ preventScroll: true }); };
    }, [anchor, width]);
    return createPortal(<div className="menu" role="menu" aria-label={tr(title)} ref={ref} tabIndex={-1} style={{ ...placed, zIndex: anchor?.closest('[role="dialog"]') ? 'var(--layer-dialog-popover)' : 'var(--layer-popover)', width, maxWidth: placed.maxWidth ?? 'calc(100dvw - 24px)', maxHeight: placed.maxHeight ?? 'calc(100dvh - 24px)', overflowY: 'auto' }} onKeyDown={e => {
            const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>(MENU_ITEMS) ?? []);
            const at = nodes.indexOf(document.activeElement as HTMLElement);
            if (['Escape', 'Tab'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
            if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                nodes[e.key === 'Home' ? 0 : e.key === 'End' ? nodes.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus();
            }
        }}>{tr(children)}</div>, document.body);
}

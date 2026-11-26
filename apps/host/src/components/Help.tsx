import { useRef, useState, type ReactNode } from 'react';
import { tr } from '../lib/i18n';
import { Icon } from './ui';
import { Popover } from './Popover';

/**
 * One small help button for a skill, an MCP server or a tool.
 *
 * The explanation opens beside the row, so the list can say what the thing is
 * and how it is used without turning every row into a wall of text.
 */
export function Help({ title, name, children, menuItem = false }: { title: string; name: string; children: ReactNode; menuItem?: boolean }) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const label = `${tr(title)}: ${name}`;
    return <>
        <button ref={trigger} type="button" role={menuItem ? 'menuitem' : undefined} className="st-btn st-btn--icon help-button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(v => !v)}>
            <Icon name="info" size={16}/>
        </button>
        {open ? <Popover anchor={trigger.current} title={title} width={390} align="end" onClose={() => setOpen(false)}>{children}</Popover> : null}
    </>;
}

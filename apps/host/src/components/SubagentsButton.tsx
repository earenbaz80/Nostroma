/** The subagent overview, under the conversation: who is working, how long
 *  they have been at it and what they have said, kept one click away from the
 *  reading of the context it sits beside. */
import { useEffect, useRef, useState } from 'react';
import { tr } from '../lib/i18n';
import { Icon } from './ui';
import { Popover } from './Popover';
import { SubagentRow } from './SubagentRow';
import { runningAgents } from '../lib/agents';
import type { Session } from '../lib/types';

export function SubagentsButton({ session }: { session: Session | null }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    const count = runningAgents(session?.agents ?? []);
    const [now, setNow] = useState(Date.now);
    // The durations keep counting while the overview is open, once a second.
    useEffect(() => { if (!open || !count) return; setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [open, count, session?.id]);
    useEffect(() => setOpen(false), [session?.id]);
    return <>
      <button ref={ref} className="chat-agents" title={tr(count ? `${count} subagents running · View overview` : 'View subagent overview')} aria-label={tr(count ? `${count} subagents running — show overview` : 'Subagents — show overview')} aria-haspopup="dialog" aria-expanded={open} data-working={count > 0 || undefined} onClick={() => setOpen(v => !v)}><Icon name="experts" size={17}/>{tr(count > 0 ? <span className="agent-live-dot"/> : null)}<span className="chat-agents__label">{tr("Subagents")}</span>{tr(session?.agents?.length ? <span className="chat-agents__count">{tr(count || session.agents.length)}</span> : null)}<Icon name="chevron" className={open ? 'is-open' : ''} size={13}/></button>
      {tr(open ? <Popover anchor={ref.current} title={tr(session?.agents?.length ? "Subagents" : "No subagents recorded")} detail={session?.agents?.length ? <>{tr(count)}{tr(" running · ")}{tr(session.agents.filter(a => a.status === 'completed').length)}{tr(" completed · ")}{tr(session.agents.length)}{tr(" total")}</> : undefined} width={460} onClose={() => setOpen(false)}>{tr(session?.agents?.length ? <>{tr(session.agents.map(a => <SubagentRow key={a.id} agent={a} now={now} sessionId={session && !session.showcase ? session.id : undefined}/>))}</> : null)}</Popover> : null)}
    </>;
}

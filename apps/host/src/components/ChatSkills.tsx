import { tr } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { FloatingMenu } from './FloatingMenu';
import { SkillHelp } from './SkillHelp';
import { Icon } from './ui';
import { api } from '../lib/client';
import type { Skill } from '../lib/types';

/**
 * The skills this chat may use, and the switch for each.
 *
 * A skill is not picked per message: the host applies the ones whose triggers
 * match what was written. So this is about what is on, and it says so.
 */
export function ChatSkills() {
    const [open, setOpen] = useState(false);
    const [skills, setSkills] = useState<Skill[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const trigger = useRef<HTMLButtonElement>(null);

    /* The list is read every time the menu opens: a skill can be added in
       Settings while this chat stays open. */
    useEffect(() => {
        if (!open)
            return;
        let live = true;
        setError('');
        api.get<Skill[]>('/api/skills').then(list => { if (live) setSkills(list); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
        return () => { live = false; };
    }, [open]);

    async function toggle(skill: Skill) {
        setBusy(skill.id);
        setError('');
        try {
            const result = await api.patch<Skill[]>(`/api/skills/${encodeURIComponent(skill.id)}`, { enabled: !skill.enabled });
            setSkills(Array.isArray(result) ? result : (skills ?? []).map(s => s.id === skill.id ? { ...s, enabled: !s.enabled } : s));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy('');
        }
    }

    const on = skills?.filter(s => s.enabled).length ?? null;
    return <>
    <button ref={trigger} className="composer-choice composer-skills" title={tr('Skills')} aria-label={tr('Skills')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}><Icon name="skills" size={16}/><span>{tr('Skills')}{on === null ? '' : ` · ${on}`}</span><Icon name="chevron" size={13}/></button>
    {tr(open ? <FloatingMenu anchor={trigger.current} title={tr('Skills')} width={350} onClose={() => setOpen(false)}>
      <p className="composer-menu-heading">{tr('Nostroma applies the skills that match your message. This switches each one on or off everywhere.')}</p>
      {tr(error ? <p className="small inline-error">{tr(error)}</p> : null)}
      {tr(!skills ? <p className="menu__item">{tr('Loading…')}</p> : null)}
      {tr(skills && !skills.length ? <p className="menu__item">{tr('No skills yet. Add one in Settings.')}</p> : null)}
      {tr(skills?.map(skill => <div className="composer-skill-row" role="none" key={skill.id}>
        <button role="menuitemcheckbox" aria-checked={skill.enabled} disabled={busy === skill.id} className="menu__item composer-skill-toggle" onClick={() => void toggle(skill)}><Icon name={skill.enabled ? 'check' : 'skills'}/><span><strong>{tr(skill.name)}</strong><small>{tr(skill.description)}</small>{tr(skill.onlyIn ? <small>{tr('Only in {0}', [skill.onlyIn])}</small> : null)}</span></button>
        <SkillHelp menuItem name={tr(skill.name)} description={skill.description} triggers={skill.triggers ?? []} installed scope={skill.onlyIn ?? null}/>
      </div>))}
    </FloatingMenu> : null)}
  </>;
}

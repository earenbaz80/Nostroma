import { tr } from '../lib/i18n';
import { Help } from './Help';

/** The explanation of one skill: the same words in the Skills screen and the chat's quick selector. */
export function SkillHelp({ name, description, triggers, installed, scope, requires, menuItem }: {
    name: string;
    description: string;
    triggers: string[];
    installed: boolean;
    scope?: string | null;
    requires?: string;
    /** The quick selector is a menu: its help button has to take part in the menu's arrow-key navigation. */
    menuItem?: boolean;
}) {
    return <Help title="About this skill" name={name} menuItem={menuItem}>
        <div className="help-copy">
            <p>{tr("A skill is a set of instructions the assistant reads. It does not run commands or change files by itself.")}</p>
            <p><strong>{tr("What it does")}</strong><br/>{tr(description)}</p>
            <p><strong>{tr("When it runs")}</strong><br/>{triggers.length ? tr("When your message contains one of these phrases: {0}.", [triggers.join(', ')]) : tr("It has no trigger phrases, so it will not run automatically.")}</p>
            <p><strong>{tr("How to use it")}</strong><br/>{tr(installed ? "The assistant applies it when your message matches one of its trigger phrases. Use the switch to turn it on or off." : "Add this skill first. It stays off until you turn it on.")}</p>
            {scope !== undefined ? <p className="xs muted">{scope ? tr("Only in {0}", [scope]) : tr("All workspaces")}</p> : null}
            {requires ? <p className="xs muted">{tr("Requires {0}", [tr(requires)])}</p> : null}
        </div>
    </Help>;
}

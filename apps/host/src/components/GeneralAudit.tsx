/** The general audit: the few things that, when they are wrong, explain most
 *  trouble — the profile folder, free space, the engine, the model, the
 *  projects, the chats, git and the card. It only looks; the host does the
 *  reading and nothing is installed or changed. */
import { useEffect, useState } from 'react';
import { tr } from '../lib/i18n';
import { api } from '../lib/client';
import { go, setSettingsSection } from '../lib/store';
import { Btn, Dialog, Icon, type IconName } from './ui';

type Status = 'ok' | 'warn' | 'fail' | 'unknown';
/* `detailKey` carries the sentence as a catalog key; `detail` is the same line
   in English (a path, a version or a list are values, not sentences). */
/* `action` is what the row can offer: the host names it, the person presses it,
   and nothing happens until they do. */
type Check = { id: string; status: Status; detail: string; detailKey?: string; detailValues?: string[]; action?: 'commit' | 'engine' };

const LABELS: Record<string, string> = {
  project: 'Project folder',
  'project-git': 'Project changes',
  data: 'Profile folder',
  'space-data': 'Free space for the profile',
  'space-models': 'Free space for models',
  engine: 'Engine',
  model: 'Model',
  workspaces: 'Projects',
  chats: 'Chats',
  git: 'git',
  gpus: 'Graphics card',
};

const ICONS: Record<Status, IconName> = { ok: 'check', warn: 'warning', fail: 'error', unknown: 'info' };

/* Shown as the project row when there is no folder to look at, so an audit
   without project rows says why instead of leaving the reader guessing. */
const NO_PROJECT = 'No project: this chat has no folder of its own and no workspace is open to stand in for it.';

/* `project` is the folder of the chat the audit was opened from: its own two rows
   come first, because this is the audit of the project being worked on. */
export function GeneralAudit({ open, onClose, project }: { open: boolean; onClose: () => void; project?: string | null }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  /* The project the checks above belong to: opening the audit from another chat
     looks again instead of showing the previous project's rows. */
  const [ranFor, setRanFor] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The commit the project row offers: the message is written before it runs. */
  const [commitRow, setCommitRow] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const folderName = (project ?? '').split(/[\\/]/).filter(Boolean).at(-1) ?? '';

  function run() {
    setBusy(true);
    setError(null);
    api.get<{ at: string; checks: Check[] }>(`/api/audit${project ? `?project=${encodeURIComponent(project)}` : ''}`)
      .then(result => { setChecks(result.checks); setAt(result.at); setRanFor(project ?? null); })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }

  /* A result is worth keeping while the dialog stays closed, but a failure is not
     an answer: reopening after a run that did not come back looks again, instead of
     showing an error from a run the user already saw. */
  useEffect(() => { if (open && !busy && (error || !checks || ranFor !== (project ?? null))) run(); }, [open, project]);

  async function saveCommit() {
    if (!project || saving || !commitMessage.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/audit/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-nostroma-client': 'web' },
        body: JSON.stringify({ project, message: commitMessage.trim() }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; commit?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setCommitRow(null);
      run();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const trouble = checks?.filter(c => c.status === 'fail').length ?? 0;
  const warnings = checks?.filter(c => c.status === 'warn').length ?? 0;
  const summary = !checks ? null
    : trouble ? tr('{0} need attention; {1} to watch.', [trouble, warnings])
      : warnings ? tr('Nothing broken; {0} to watch.', [warnings])
        : tr('Everything checked out.');

  return <Dialog open={open} title={tr('General audit')} onClose={onClose} actions={<>
    <Btn onClick={onClose}>{tr('Close')}</Btn>
    <Btn variant="primary" disabled={busy} onClick={run}>{tr(busy ? 'Checking…' : 'Check again')}</Btn>
  </>}>
    <p className="small muted">{tr(project ? 'Nostroma looks at this project, this computer and this profile. Nothing is changed and nothing is sent.' : 'Nostroma looks at this computer and this profile. Nothing is changed and nothing is sent.')}</p>
    {error ? <p className="small inline-error" role="alert">{tr("The audit could not run: {0}", [error])}</p> : null}
    {checks ? <div className="audit-list">{(project ? checks : [{ id: 'project', status: 'unknown' as Status, detail: NO_PROJECT, detailKey: NO_PROJECT }, ...checks]).map(check => <div key={check.id} className="audit-row" data-status={check.status}>
      <Icon name={ICONS[check.status]} className="audit-row__icon" size={16}/>
      <div>
        <strong>{tr(LABELS[check.id] ?? check.id)}</strong>
        <p className="small muted">{check.detailKey ? tr(check.detailKey, check.detailValues ?? []) : check.detail}</p>
        {check.action === 'engine' ? <div className="audit-row__action"><Btn size="sm" variant="ghost" onClick={() => { setSettingsSection('Engine'); onClose(); go('settings'); }}>{tr('Open Settings › Engine')}</Btn></div> : null}
        {check.action === 'commit' ? commitRow === check.id
          ? <div className="audit-row__action"><input className="st-input" aria-label={tr('Commit message')} placeholder={tr('Commit message')} value={commitMessage} disabled={saving} maxLength={400} onChange={e => setCommitMessage(e.target.value)}/><Btn size="sm" variant="primary" disabled={saving || !commitMessage.trim()} onClick={() => void saveCommit()}>{tr(saving ? 'Saving…' : 'Save')}</Btn><Btn size="sm" disabled={saving} onClick={() => { setCommitRow(null); setSaveError(null); }}>{tr('Cancel')}</Btn></div>
          : <div className="audit-row__action"><Btn size="sm" variant="ghost" onClick={() => { setCommitRow(check.id); setSaveError(null); setCommitMessage(tr('Save the work in {0}', [folderName])); }}>{tr('Save in a commit')}</Btn></div> : null}
        {check.action === 'commit' && commitRow === check.id && saveError
          ? <p className="small inline-error" role="alert">{tr("Couldn't save a commit")}: {saveError}</p> : null}
      </div>
    </div>)}</div> : busy ? <p className="small muted">{tr('Checking…')}</p> : null}
    {summary ? <p className="audit-summary small">{summary}</p> : null}
    {at ? <p className="xs muted">{tr('Checked {0}', [new Date(at).toLocaleTimeString()])}</p> : null}
  </Dialog>;
}

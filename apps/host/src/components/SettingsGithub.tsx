import { useEffect, useState } from 'react';
import { tr } from '../lib/i18n';
import { api } from '../lib/client';
import { Btn, Field } from './ui';

interface GithubState {
  connected: boolean;
  login: string;
}

/** The GitHub access the app has: one personal token, checked against github.com when it is saved. */
export function SettingsGithub() {
  const [state, setState] = useState<GithubState>({ connected: false, login: '' });
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get<GithubState>('/api/github').then(setState).catch(() => {});
  }, []);

  async function save() {
    setBusy(true); setProblem(''); setNotice('');
    try {
      setState(await api.post<GithubState>('/api/github', { token: token.trim() }));
      setToken('');
      setNotice(tr('Token saved'));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true); setProblem(''); setNotice('');
    try {
      setState(await api.del<GithubState>('/api/github'));
      setNotice(tr('Token removed'));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return <section className="settings-section" data-github-settings>
    <h2 className="h3" style={{ marginBottom: 14 }}>{tr('GitHub')}</h2>
    <div className="st-card st-card--flush">
      <Field label={tr('Personal access token')} hint={tr('A token with repo access lets Nostroma clone private repositories. It stays on this computer and is only sent to github.com.')}>
        <div className="stack">
          <input className="st-input" type="password" autoComplete="off" data-github-token aria-label={tr('Personal access token')} value={token} placeholder={state.connected ? '••••••••' : 'ghp_…'} onChange={e => setToken(e.target.value)}/>
          <div className="row">
            <Btn variant="primary" disabled={busy || !token.trim()} onClick={() => void save()}>{tr('Save token')}</Btn>
            {state.connected ? <Btn disabled={busy} onClick={() => void remove()}>{tr('Remove token')}</Btn> : null}
          </div>
        </div>
      </Field>
      <p className="small muted" role="status" data-github-status>{state.connected ? tr('Connected as {0}.', [state.login || 'GitHub']) : tr('No token saved. Public repositories clone without one.')}</p>
      {notice ? <p className="small" role="status">{tr(notice)}</p> : null}
      {problem ? <p className="small inline-error" role="alert">{tr(problem)}</p> : null}
    </div>
  </section>;
}

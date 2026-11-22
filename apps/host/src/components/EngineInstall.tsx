import { useState } from 'react';
import { tr } from '../lib/i18n';
import { installEngine, useStore } from '../lib/store';
import { Bar, Btn, ErrorNotice } from './ui';

/**
 * Settings > Engine: fetches the llama.cpp build for this computer
 * (server/engine-install.mjs). The host reports every step as an engine-install
 * event, so the line moves while the POST is still waiting; the POST answers
 * with the last state when the download ends.
 */
export function EngineInstall() {
  const install = useStore(s => s.engineInstall);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const working = pending || (install ? ['checking', 'downloading', 'extracting'].includes(install.status) : false);
  const failed = error || (install?.status === 'error' ? install.error ?? '' : '');

  async function start() {
    setPending(true);
    setError('');
    try { await installEngine(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPending(false); }
  }

  return <section className="st-card">
    <div className="section-toolbar">
      <h2 className="h3">{tr('Engine files')}</h2>
      <Btn variant="primary" disabled={working} onClick={() => void start()}>{tr(working ? 'Installing the engine…' : 'Install engine')}</Btn>
    </div>
    <p className="small muted">{tr('Downloads the llama.cpp build that matches this computer.')}</p>
    {working || install?.stage ? <div className="stack" role="status" aria-live="polite">
      <Bar value={install?.pct ?? 0} label={tr('Progress')} indeterminate={pending && !install}/>
      {install?.stage ? <p className="small">{tr(install.stage)}{working && install.pct > 0 ? ` · ${Math.round(install.pct)}%` : ''}</p> : null}
    </div> : null}
    {failed ? <ErrorNotice message={failed}/> : null}
  </section>;
}

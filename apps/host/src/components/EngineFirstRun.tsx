import { tr } from '../lib/i18n';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Brand } from './Brand';
import { Bar, Btn, Icon } from './ui';
import { api } from '../lib/client';
import { useDownloadEta } from '../lib/download-eta';
import { jobSummary, type NativeJob } from '../lib/native';
import { megabytes } from '../lib/format';
import { FirstRunLanguage } from './FirstRunLanguage';

/** What the host says about this PC's engine (GET /api/engine/first-run). */
export interface FirstRunInfo {
    status: 'offer' | 'none' | 'offline' | 'error' | 'installed' | 'wrong-make' | 'unavailable';
    gpus: { name: string; vramGb: number | null }[];
    driver?: string | null;
    offer?: { version: string; bytes: number; variant: string; backend: string | null };
    /** A newer Nostroma Control in the same feed: the Download takes it too (the Arc fix of 0.2.13.1 came this way). */
    control?: { version: string; bytes: number } | null;
    message?: string | null;
    reasons?: string[];
    details?: string;
    freeBytes?: number;
}

export const mb = megabytes;
/** After the size when the download also brings the newer Nostroma Control (owner-approved wording, 11-09). */
export const WITH_CONTROL = " (with the Nostroma setup update)";

/**
 * Whether this PC still needs its engine. Reads only Control's local answer (no network): the engine is missing and the engine that came
 * with the app is not being unpacked. `null` while that is not known yet.
 */
export function useEngineNeeded(): boolean | null {
    const [needed, setNeeded] = useState<boolean | null>(null);
    useEffect(() => {
        let live = true;
        const ask = () => api.get<{ engine?: { usable?: boolean } | null; engineSetup?: boolean }>('/api/control/status').then(s => {
            if (!live) return;
            if (s.engineSetup) return setNeeded(null);
            setNeeded(!!s.engine && s.engine.usable === false);
        }, () => { if (live) setNeeded(false); });
        void ask();
        const timer = setInterval(() => void ask(), 3000);
        return () => { live = false; clearInterval(timer); };
    }, []);
    return needed;
}


/**
 * The first-run card: the engine this PC needs, one button to download it, progress, and the offline way (choose a downloaded file).
 * Nothing is downloaded before a button is pressed.
 */
export function EngineFirstRun({ onDone }: { onDone: () => void }) {
    const [info, setInfo] = useState<FirstRunInfo | null>(null);
    const [job, setJob] = useState<NativeJob | null>(null);
    const [busy, setBusy] = useState(false), [problem, setProblem] = useState('');
    const [finished, setFinished] = useState(false);
    const file = useRef<HTMLInputElement>(null);
    const started = useRef(false);

    const look = useCallback(() => {
        setInfo(null);
        setProblem('');
        api.get<FirstRunInfo>('/api/engine/first-run').then(setInfo, e => setInfo({ status: 'error', gpus: [], message: e instanceof Error ? e.message : String(e) }));
    }, []);
    useEffect(() => { look(); }, [look]);

    // follow the download / install job
    useEffect(() => {
        const timer = setInterval(() => {
            if (!started.current) return;
            api.get<{ job: NativeJob | null }>('/api/engine/job').then(r => {
                setJob(r.job);
                if (r.job?.state === 'done') setFinished(true);
                if (r.job && r.job.state !== 'running') started.current = false;
            }, () => { });
        }, 700);
        return () => clearInterval(timer);
    }, []);

    async function start() {
        setBusy(true);
        setProblem('');
        try {
            started.current = true;
            setJob(await api.post<NativeJob>('/api/native/operations', { kind: 'update-engine', args: { firstRun: true, ...(info?.control ? { withControl: true } : {}) } }));
        }
        catch (e) {
            started.current = false;
            setProblem(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function chosen(files: FileList | null) {
        const picked = files?.[0];
        if (!picked) return;
        setBusy(true);
        setProblem('');
        try {
            const response = await fetch('/api/engine/from-file', { method: 'POST', headers: { 'x-file-name': picked.name }, body: picked });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body?.error ?? `The file could not be used (${response.status}).`);
            started.current = true;
            setJob(body as NativeJob);
        }
        catch (e) {
            setProblem(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
            if (file.current) file.current.value = '';
        }
    }

    const running = job?.state === 'running';
    const failed = !!job && (job.state === 'error' || job.state === 'cancelled');
    const percent = Number(job?.result?.install?.download?.percent ?? 0);
    const bytes = info?.offer?.bytes ?? 0;
    const doneMb = Math.round(mb(bytes) * percent / 100);
    const eta = useDownloadEta(running && bytes ? { done_gb: bytes * percent / 100 / 1e9, remaining_gb: bytes * (100 - percent) / 100 / 1e9 } : undefined, job?.id);
    const cards = (info?.gpus ?? []).filter(g => (g.vramGb ?? 0) >= 1);
    const hidden = <input ref={file} type="file" accept=".gz,.tgz,.xz,.zip" hidden onChange={e => void chosen(e.target.files)}/>;
    const pick = (label: string) => <button type="button" className="firstrun__quiet" disabled={busy || running} onClick={() => file.current?.click()}>{tr(label)}</button>;
    /* The engine is optional for looking around: every state that is not a
       download in flight leaves a way into the app, so a missing engine (or a
       github.com that will not answer) can never hold the interface. */
    const escape = <button type="button" className="firstrun__quiet" disabled={busy || running} onClick={onDone}>{tr('Skip for now')}</button>;

    const card = cards[0] ?? info?.gpus?.[0];
    const engineFact = !info ? tr('Looking…')
        : info.status === 'installed' ? tr('Installed')
            : info.offer ? `${tr('One download')} · ${mb(info.offer.bytes + (info.control?.bytes ?? 0))} MB${info.control ? tr(WITH_CONTROL) : null}`
                : tr('Not installed');
    const sheet = [
        { label: tr('Graphics card'), value: card?.name ?? tr('Not recognised') },
        { label: tr('Memory'), value: card?.vramGb ? `${Math.round(card.vramGb)} GB` : '—' },
        { label: tr('Driver'), value: info?.driver || '—' },
        { label: tr('Engine'), value: engineFact },
    ];

    let lede = tr('Your own AI, with chats, files and tools, right here on this computer.');
    let notice: ReactNode = null;
    let actions: ReactNode = null;
    if (finished) {
        lede = tr('Engine ready. Now choose your model.');
        actions = <><Btn variant="primary" onClick={onDone}>{tr('Continue')}<Icon name="chevron" size={16}/></Btn></>;
    }
    else if (running) {
        lede = bytes && job?.result?.install?.download ? tr('{0} of {1} MB{2}', [doneMb, mb(bytes), eta ? ` · ${eta}` : '']) : (jobSummary(job) || tr('Starting…'));
        notice = <div className="firstrun__progress"><Bar value={percent} label={tr('Downloading the engine')}/><p className="small muted">{tr('You can close Nostroma; it continues where it stopped.')}</p></div>;
    }
    else if (!info) {
        lede = tr('Looking at your graphics card…');
    }
    else if (info.status === 'offer' && info.offer) {
        lede = tr('Nostroma needs one download to run models here: the engine built for this card.');
        notice = <>
            {info.freeBytes !== undefined && info.freeBytes < info.offer.bytes * 2.5 ? <p className="small inline-error">{tr('The engine needs about {0} GB of free space on this drive and only {1} GB is free. Free some space, then continue.', [Math.ceil(info.offer.bytes * 2.5 / 1e9), (info.freeBytes / 1e9).toFixed(1)])}</p> : null}
            <p className="small muted">{tr('It comes from Nostroma’s own update server and is checked before it is used. Your models and chats are never touched by it.')}</p>
            {cards.length > 1 ? <p className="small muted">{tr('{0} cards found. Nostroma uses the first one for the engine; change it later in Settings.', [cards.length])}</p> : null}
        </>;
        actions = <><Btn variant="primary" disabled={busy} onClick={() => void start()}>{tr(failed ? 'Continue' : 'Get the engine')}</Btn>{pick(tr("I already have the file…"))}{escape}</>;
    }
    else if (info.status === 'offline') {
        /* No "could not reach github.com" line: the sheet already says the engine
           is not installed, and the two ways forward (try again, choose a file)
           are the buttons below it. */
        actions = <><Btn variant="primary" disabled={busy} onClick={look}>{tr('Try again')}</Btn>{pick(tr('Choose a downloaded file…'))}{escape}</>;
    }
    else if (info.status === 'wrong-make') {
        lede = info.message ?? tr('The engine installed here is for another make of graphics card.');
        actions = <><Btn variant="primary" disabled={busy} onClick={look}>{tr('Try again')}</Btn>{pick(tr('Choose a downloaded file…'))}{escape}</>;
    }
    else {
        lede = tr('Nostroma can’t pick an engine for this PC from its update list.');
        notice = <>{info.message ? <p className="small muted">{info.message}</p> : null}{(info.reasons ?? []).length ? <ul className="small muted">{(info.reasons ?? []).map(r => <li key={r}>{r}</li>)}</ul> : null}</>;
        actions = <><Btn variant="primary" disabled={busy} onClick={look}>{tr('Try again')}</Btn>{pick(tr('Choose a downloaded file…'))}{escape}</>;
    }

    return <div className="setup guided-onboarding firstrun" data-step="engine">{hidden}
        <header className="onboard-header"><Brand variant="lockup" height={22}/><FirstRunLanguage/></header>
        <div className="firstrun__body">
            <div className="firstrun__intro">
                <span className="firstrun__eyebrow"><span className="firstrun__dot" data-state={info?.status ?? 'looking'}/>{tr('This machine')}</span>
                <h1 tabIndex={-1} data-initial-focus>{tr(finished ? 'The engine is ready.' : running ? 'Downloading the engine' : 'Welcome to Nostroma earthling')}</h1>
                <p className="firstrun__lede" role={!info ? 'status' : undefined}>{lede}</p>
                {!finished && !running ? <p className="firstrun__hint">{tr('You can add the engine later, in Settings > Engine.')}</p> : null}
            </div>
            <dl className="firstrun__sheet">
                {sheet.map(row => <div key={row.label} className="firstrun__row"><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
            </dl>
        </div>
        {notice ? <div className="firstrun__notice">{notice}</div> : null}
        {failed ? <div className="firstrun__notice"><p role="alert" className="small inline-error">{job?.error ?? job?.summary}</p>
            {job?.details ? <details className="error-detail"><summary className="small">{tr('Details')}</summary><pre className="small muted">{job.details}</pre></details> : null}
            <p className="small muted">{percent >= 100 ? tr('The file was downloaded. Continue tries the install again.') : tr('The download stopped. Continue picks it up where it stopped.')}</p></div> : null}
        {problem ? <div className="firstrun__notice"><p role="alert" className="small inline-error">{problem}</p></div> : null}
        {actions ? <footer className="firstrun__actions">{actions}</footer> : null}
    </div>;
}

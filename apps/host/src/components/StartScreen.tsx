import { useEffect } from 'react';
import { tr } from '../lib/i18n';
import { Icon } from './ui';
import { addWorkspaceAndActivate, go, liveChatIds, pickWorkspace, selectSession, useStore } from '../lib/store';
import { useNative } from '../lib/native';
import { recentChats, recentChatDescription } from '../lib/recent-chats';
import { sessionTitle } from '../lib/session-title';
import { compactTokens } from '../lib/chat-metrics';
import { relTime } from '../lib/format';

/**
 * The start of a conversation in this app: what the machine is doing, the three
 * ways in, and the work that was already here.
 *
 * The three verbs are the point: a chat, a folder for the Workbench to work in,
 * or a mission that keeps going. The numbers are real shortcuts, not decoration,
 * and they stay out of the way while the person is typing.
 */
export function StartScreen({ onAsk, onMission }: { onAsk: () => void; onMission: () => void }) {
  const sessions = useStore(s => s.sessions);
  const library = useStore(s => s.library);
  const monitor = useStore(s => s.monitor);
  const remote = useStore(s => s.remoteModel);
  const live = useStore(s => s.liveChats);
  const native = useNative();
  const working = new Set(live ? liveChatIds() : []);

  const current = library?.variants.find(v => v.id === library.loaded);
  const nativeCurrent = native?.instances.find(i => i.id === native.defaultId);
  /* A dash instead of "no model loaded" in three wrapped lines: the engine gauge
     and the header already say there is no model; this is a reading, not a note. */
  const model = nativeCurrent?.label ?? (current?.local ? current.name : current?.family) ?? '—';
  const modelTitle = model === '—' ? tr('No model loaded') : model;
  const phase = nativeCurrent ? (nativeCurrent.status === 'ready' ? nativeCurrent.phase : nativeCurrent.status) : monitor?.phase ?? 'idle';
  const state = phase === 'unavailable' ? tr('Status unavailable') : phase === 'error' ? tr('Error') : phase === 'loading' ? tr('Loading')
    : phase === 'reading' ? tr('Reading prompt') : phase === 'thinking' ? tr('Thinking')
    : phase === 'generating' ? tr('Generating') : tr('Idle');
  const busy = phase === 'reading' || phase === 'thinking' || phase === 'generating';
  const context = monitor?.context?.maxTokens ? compactTokens(monitor.context.maxTokens) : tr('Not reported');

  const gauges = [
    { label: tr('Engine'), value: nativeCurrent ? tr('Local engine') : remote ? tr('Remote model') : tr('No engine'), state: nativeCurrent || remote ? 'on' : 'off' },
    { label: tr('Model'), value: model, title: modelTitle, state: model === '—' ? 'off' : 'on' },
    { label: tr('State'), value: state, state: phase === 'error' ? 'error' : busy ? 'working' : 'on' },
    { label: tr('Context'), value: context, state: context === tr('Not reported') ? 'off' : 'on' },
    ...(nativeCurrent?.gpus.length ? [{ label: tr('GPU'), value: nativeCurrent.gpus.map(g => `GPU ${g + 1}`).join(' + '), state: 'on' }] : []),
  ];

  async function openFolder() {
    const path = await pickWorkspace();
    /* The verb promises the Workbench works in that folder, so the new folder
       becomes the active workspace; the sidebar list alone is not the promise. */
    if (path) await addWorkspaceAndActivate(path);
  }

  const verbs = [
    { key: '1', icon: 'chat' as const, title: tr('Ask something'), note: tr('Write in the composer, the way you would ask a person.'), run: onAsk },
    { key: '2', icon: 'folder' as const, title: tr('Open a folder'), note: tr('The Workbench reads and runs inside that folder.'), run: openFolder },
    { key: '3', icon: 'bolt' as const, title: tr('Start a mission'), note: tr('Keeps working after you look away, until it is done.'), run: onMission },
  ];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
      const verb = verbs.find(v => v.key === event.key);
      if (!verb) return;
      event.preventDefault();
      void verb.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* Only work with something in it: a list of empty "New conversation" rows is
     not somewhere to continue from. */
  const recent = recentChats(sessions)
    .filter(session => session.messages.some(message => message.role === 'user' && !message.example))
    .slice(0, 3);

  return <section className="start" aria-label={tr('Start here')}>
    <div className="start__machine" role="group" aria-label={tr('Machine')}>
      {gauges.map(gauge => <div className="start__gauge" key={gauge.label}>
        <span className="start__gauge-label">{gauge.label}</span>
        <span className="start__gauge-value" data-state={gauge.state} title={'title' in gauge ? gauge.title : gauge.value}>{gauge.value}</span>
      </div>)}
    </div>

    <div className="start__verbs">
      {verbs.map(verb => <button key={verb.key} type="button" className="start__verb" onClick={() => void verb.run()}>
        <span className="start__verb-head"><kbd className="start__verb-key">{verb.key}</kbd><Icon name={verb.icon} size={16} /></span>
        <strong className="start__verb-title">{verb.title}</strong>
        <span className="start__verb-note">{verb.note}</span>
      </button>)}
    </div>

    {recent.length ? <div className="start__continue">
      <h2 className="start__continue-label">{tr('Continue where you left off')}</h2>
      {recent.map(session => <button key={session.id} type="button" className="start__recent" onClick={() => { selectSession(session.id); go('chat', session.id); }}>
        <span className="start__recent-title">{sessionTitle(session)}</span>
        <span className="start__recent-note">{recentChatDescription(session)}</span>
        <span className="start__recent-time" data-working={working.has(session.id) || undefined}>{working.has(session.id) ? tr('Working') : relTime(session.updatedAt)}</span>
      </button>)}
    </div> : null}
  </section>;
}

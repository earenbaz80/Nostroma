import { useEffect, useRef, useState, type RefObject } from 'react';
import { tr } from '../lib/i18n';
import { Icon } from './ui';
import { isSandboxLog, type SandboxLog } from '../lib/sandbox-console';

/** One line in the strip. */
export type ConsoleLine = SandboxLog & { id: number };

/**
 * What a sandboxed frame reports through the bridge in lib/sandbox-console.ts.
 *
 * The frame is opaque, so it posts out; only its own window counts, and a stray
 * page cannot fill the strip by posting the same shape. A new document starts
 * with an empty strip: `resetKey` changes with the frame's own key, so what the
 * last run logged is never attributed to this one.
 */
export function useSandboxLogs(frame: RefObject<HTMLIFrameElement | null>, resetKey?: unknown) {
  const [messages, setMessages] = useState<ConsoleLine[]>([]);
  const serial = useRef(0);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !isSandboxLog(event.data)) return;
      setMessages(list => [...list.slice(-199), { ...event.data, id: ++serial.current }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame]);

  useEffect(() => { setMessages([]); }, [resetKey]);

  return { messages, clear: () => setMessages([]) };
}

/**
 * The strip under a preview: the page's own console, uncaught errors and
 * rejected promises. Without it a page that throws is a blank frame with no
 * reason given.
 */
export function SandboxConsole({ messages, onClear, label }: { messages: ConsoleLine[]; onClear: () => void; label: string }) {
  return <section className="sandbox__console" aria-label={label}>
    <div className="sandbox__console-bar">
      <span>{tr('Console')}</span>
      <span className="sandbox__console-count">{messages.length}</span>
      <span className="spacer" />
      <button type="button" className="workbench__link" disabled={!messages.length} onClick={onClear}><Icon name="trash" size={12} />{tr('Clear')}</button>
    </div>
    <div className="sandbox__console-lines" role="log" aria-live="polite">
      {messages.length
        ? messages.map(message => <p key={message.id} className="sandbox__console-line" data-level={message.level}><b>{message.level}</b><span>{message.text}</span></p>)
        : <p className="sandbox__console-line" data-level="empty"><b>›</b><span>{tr('Nothing logged yet.')}</span></p>}
    </div>
  </section>;
}

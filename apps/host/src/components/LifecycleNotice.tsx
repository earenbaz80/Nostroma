import { tr } from '../lib/i18n';
import { openServerSettings, useLifecycle } from '../lib/store';
import { Btn } from './ui';
export function LifecycleNotice({ showScope = true }: {
    showScope?: boolean;
}) {
    const status = useLifecycle();
    if (!showScope && status.allowed)
        return null;
    return <div className="lifecycle-notice small muted">{tr(showScope ? <span>{tr("Global \u00B7 all chats")}</span> : null)}{tr(!status.allowed ? <><span role="status">{tr(status.reason)}</span><Btn size="sm" variant="ghost" onClick={() => openServerSettings()}>{tr("View requests")}</Btn></> : null)}</div>;
}

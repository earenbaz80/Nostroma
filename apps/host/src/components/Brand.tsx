import { tr } from '../lib/i18n';
/** The approved three-bar mark, and the name set in the app's own face beside it. */
import { useEffect, useState, type CSSProperties } from 'react';
import { useMedia } from '../lib/responsive';
import { useStore } from '../lib/store';
export function Brand({ variant, height, decorative = false, className = '', }: {
    variant: 'mark' | 'lockup';
    height: number;
    decorative?: boolean;
    className?: string;
}) {
    const preference = useStore(s => s.theme);
    const systemDark = useMedia('(prefers-color-scheme: dark)');
    const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
    /* The mark is artwork. The wordmark next to it is text, in the app's own face, so the name in
       the header follows the product (Nostroma) instead of letters baked into a picture. */
    const src = `/brand/strata-mark-${theme}.svg`;
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    const style = { height, '--brand-h': `${height}px`, ...(variant === 'mark' ? { width: height } : {}) } as CSSProperties;
    return <span className={`brand brand--${variant} ${className}`} style={style} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Nostroma'} aria-hidden={decorative || undefined}>
    {tr(!failed ? <img className="brand__img" src={src} width={height} height={height} style={{ width: height, height }} alt="" onError={() => setFailed(true)}/> : null)}
    {tr(variant === 'lockup' ? <span className="brand__word" aria-hidden="true">Nostroma</span> : null)}
    <span className="brand__fallback" aria-hidden="true">{tr(variant === 'mark' ? 'N' : null)}</span>
  </span>;
}

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
    /* The mark is artwork, and it is the N of the name: the word beside it starts at "ostroma",
       the same word the lockup SVGs draw (prepare-brand-lockups.py, WORD). The wordmark is text in
       the app's own face, so it follows the app instead of letters baked into a picture. */
    const src = `/brand/nostroma-mark-${theme}.svg`;
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    const style = { height, '--brand-h': `${height}px`, ...(variant === 'mark' ? { width: height } : {}) } as CSSProperties;
    return <span className={`brand brand--${variant} ${className}`} style={style} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Nostroma'} aria-hidden={decorative || undefined}>
    {tr(!failed ? <img className="brand__img" src={src} width={height} height={height} style={{ width: height, height }} alt="" onError={() => setFailed(true)}/> : null)}
    {/* The N stands in for the mark when its picture does not load, so a lockup still reads
        [N]ostroma instead of a bare "ostroma". */}
    <span className="brand__fallback" aria-hidden="true">{tr('N')}</span>
    {tr(variant === 'lockup' ? <span className="brand__word" aria-hidden="true">ostroma</span> : null)}
  </span>;
}

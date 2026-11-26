/**
 * The working signal: a dotted lemniscate (an infinity loop) whose dots travel the path, after the loading loop the owner pointed at
 * (a line of small dots on a dark surface). One SVG in currentColor, so it takes the accent in the status line and the muted ink
 * inside a reply. The still path keeps the shape readable between dots; the running dash is the movement.
 */
const PATH = 'M20 10C20 3 6 3 6 10C6 17 20 17 20 10C20 3 34 3 34 10C34 17 20 17 20 10';

export function LoopDots({ className }: { className?: string }) {
  return <span className={className ? `loop-dots ${className}` : 'loop-dots'} aria-hidden="true">
    <svg viewBox="0 0 40 20" focusable="false">
      <path className="loop-dots__still" d={PATH}/>
      <path className="loop-dots__run" d={PATH}/>
    </svg>
  </span>;
}

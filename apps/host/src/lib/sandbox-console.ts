/**
 * The sandbox's console.
 *
 * The preview frame runs with `sandbox="allow-scripts"` and no same-origin
 * right, so nothing outside it can read its console or catch its errors. A
 * bridge script is injected at the top of the document instead: it wraps
 * `console`, listens for uncaught errors and rejected promises, and posts each
 * one to the parent, which is the only reader it has.
 */

export type SandboxLogLevel = 'log' | 'info' | 'warn' | 'error';
export type SandboxLog = { source: 'nostroma-sandbox'; level: SandboxLogLevel; text: string };

/* One entry is one line in a small strip: a runaway log should not carry a
   whole payload through the channel. */
const LIMIT = 4000;

const BRIDGE = `(function () {
  function describe(value) {
    if (typeof value === 'string') return value;
    if (value === null) return 'null';
    if (typeof value === 'undefined') return 'undefined';
    if (typeof value === 'function') return '\\u0192 ' + (value.name || 'anonymous');
    if (typeof value === 'bigint') return String(value) + 'n';
    if (typeof value === 'symbol') return value.toString();
    if (value instanceof Error) return (value.name || 'Error') + ': ' + value.message;
    if (typeof value !== 'object') return String(value);
    var seen = [];
    try {
      return JSON.stringify(value, function (key, inner) {
        if (typeof inner === 'bigint') return String(inner) + 'n';
        if (typeof inner === 'function') return '\\u0192 ' + (inner.name || 'anonymous');
        if (inner && typeof inner === 'object') {
          if (seen.indexOf(inner) !== -1) return '[circular]';
          seen.push(inner);
        }
        return inner;
      }) || String(value);
    } catch (error) {
      return Object.prototype.toString.call(value);
    }
  }
  function send(level, text) {
    try {
      parent.postMessage({ source: 'nostroma-sandbox', level: level, text: String(text).slice(0, ${LIMIT}) }, '*');
    } catch (error) { /* a closed frame has nowhere to report */ }
  }
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      var parts = [];
      for (var index = 0; index < arguments.length; index++) parts.push(describe(arguments[index]));
      send(level, parts.join(' '));
      if (original) original.apply(console, arguments);
    };
  });
  /* The capture phase also sees a script or an image that failed to load; those
     arrive without a message and with the element as the target. */
  window.addEventListener('error', function (event) {
    if (!event.message) {
      var target = event.target;
      if (target && target.tagName) {
        var where = target.src || target.href || '';
        send('error', 'Failed to load <' + target.tagName.toLowerCase() + (where ? ' ' + where : '') + '>');
      }
      return;
    }
    /* Browsers already word these "Uncaught …", a second prefix would be noise. */
    send('error', event.message + (event.lineno ? ' (line ' + event.lineno + ')' : ''));
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    send('error', 'Uncaught (in promise) ' + describe(event.reason));
  });
})();`;

const SCRIPT = `<script>${BRIDGE}</script>`;

/** The page with the bridge in place, ahead of the page's own scripts. */
export function withSandboxConsole(html: string): string {
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + SCRIPT + html.slice(head.index + head[0].length);
  const root = /<html[^>]*>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + SCRIPT + html.slice(root.index + root[0].length);
  /* Before the doctype the page would render in quirks mode, so it goes after. */
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return html.slice(0, doctype[0].length) + SCRIPT + html.slice(doctype[0].length);
  return SCRIPT + html;
}

export function isSandboxLog(value: unknown): value is SandboxLog {
  if (!value || typeof value !== 'object') return false;
  const log = value as Partial<SandboxLog>;
  return log.source === 'nostroma-sandbox'
    && typeof log.text === 'string'
    && (log.level === 'log' || log.level === 'info' || log.level === 'warn' || log.level === 'error');
}

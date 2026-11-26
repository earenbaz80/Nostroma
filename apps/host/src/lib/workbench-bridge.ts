/**
 * The hand-offs between a conversation and the Workbench dock.
 *
 * A code block in an answer can be run in the dock's terminal, and a path in
 * that terminal's output can be opened in its file pane. Both travel as window
 * events because the chat and the dock are separate trees; the helper that
 * resolves a path to a workspace lives here so the pane stays about its layout.
 */

export const RUN_IN_TERMINAL = 'nostroma:run-in-terminal';
export const OPEN_IN_FILES = 'nostroma:open-in-files';
export const OPEN_IN_SANDBOX = 'nostroma:open-in-sandbox';

export type TerminalRun = { command: string };
export type FilesOpen = { path: string; cwd?: string };
export type SandboxOpen = { code: string; language: string };

export function runInTerminal(command: string): void {
  window.dispatchEvent(new CustomEvent<TerminalRun>(RUN_IN_TERMINAL, { detail: { command } }));
}

export function openInSandbox(code: string, language: string): void {
  window.dispatchEvent(new CustomEvent<SandboxOpen>(OPEN_IN_SANDBOX, { detail: { code, language } }));
}

export function openInFiles(path: string, cwd?: string): void {
  window.dispatchEvent(new CustomEvent<FilesOpen>(OPEN_IN_FILES, { detail: { path, cwd } }));
}

/**
 * The fence languages that are a command line rather than a program: only those
 * get a Run button, because a TypeScript block in a shell fails every time.
 */
const SHELL_LANGUAGES = new Set([
  'bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'cmd', 'bat', 'batch', 'dos', 'powershell', 'ps1', 'pwsh',
]);

export function isShellBlock(language: string): boolean {
  return SHELL_LANGUAGES.has(language.trim().toLowerCase());
}

/**
 * The fences the sandbox can show: a page as written, or a plain script. A
 * TypeScript or Python block would fail there, so it gets no button rather than
 * a preview that is blank for a reason the sandbox cannot explain.
 */
const SANDBOX_LANGUAGES = new Set(['html', 'htm', 'xhtml', 'svg', 'javascript', 'js', 'mjs']);

export function opensInSandbox(language: string): boolean {
  return SANDBOX_LANGUAGES.has(language.trim().toLowerCase());
}

/* The shell a bare script gets: the same dark page the sandbox starts with, so a
   fragment does not arrive on a white rectangle. */
function page(body: string): string {
  return `<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8" />\n  <title>sandbox</title>\n  <style>\n    :root { color-scheme: dark; }\n    html, body { height: 100%; margin: 0; }\n    body { padding: 18px; background: #0b0803; color: #ffe7c2; font: 14px/1.5 ui-monospace, "Cascadia Code", Consolas, monospace; }\n  </style>\n</head>\n<body>\n${body}\n</body>\n</html>`;
}

/**
 * What the sandbox should run for this block. A page is handed over untouched;
 * a script is wrapped in a document, so its `console.*`, throws and rejections
 * reach the sandbox console instead of a blank frame. The closing tag of the
 * wrapper is escaped, because a `</script>` in the block would end it early.
 */
export function sandboxDocument(code: string, language: string): string {
  const name = language.trim().toLowerCase();
  if (name !== 'javascript' && name !== 'js' && name !== 'mjs') return code;
  return page(`<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`);
}

/** A path from the output made absolute against the folder the command ran in. */
export function absolutePath(path: string, cwd: string): string {
  const unified = path.replace(/\\/g, '/');
  const fromRoot = /^[A-Za-z]:\//.test(unified) || unified.startsWith('/');
  /* The drive is read after joining, because a relative path takes its drive
     from the folder: reading it from the token alone turned every relative hit
     into "/C:/…", which matches no workspace. */
  const full = fromRoot ? unified : `${cwd.replace(/\\/g, '/')}/${unified}`;
  const drive = /^[A-Za-z]:/.exec(full)?.[0] ?? '';
  const parts: string[] = [];
  for (const part of full.slice(drive.length).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `${drive}/${parts.join('/')}`;
}

/**
 * Which workspace holds this path, and where inside it. Windows comparisons are
 * folded because its file names are not case-sensitive; other systems are not,
 * so a path that differs only in case stays unresolved rather than opening the
 * wrong file.
 */
export function locateInWorkspaces(
  path: string,
  cwd: string,
  workspaces: { id: string; path: string }[],
): { id: string; rel: string } | null {
  const target = absolutePath(path, cwd);
  const fold = (value: string) => (/^[A-Za-z]:/.test(value) ? value.toLowerCase() : value);
  let best: { id: string; rel: string; depth: number } | null = null;
  for (const workspace of workspaces) {
    const base = workspace.path.replace(/\\/g, '/').replace(/\/$/, '');
    if (fold(target) !== fold(base) && !fold(target).startsWith(`${fold(base)}/`)) continue;
    const rel = target.slice(base.length).replace(/^\//, '');
    if (!rel) continue;
    /* The deepest folder wins: a workspace inside another one owns its files. */
    if (!best || base.length > best.depth) best = { id: workspace.id, rel, depth: base.length };
  }
  return best ? { id: best.id, rel: best.rel } : null;
}

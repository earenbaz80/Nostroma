// A block in an answer is handed to the Workbench instead of being copied: a
// shell fence runs in the terminal, a page or script opens in the sandbox. This
// pins which fences get which button, and how a bare script is wrapped (its
// logs and throws reach the sandbox console instead of a blank frame).
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const entry = [
  "import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';",
  "import { Markdown } from './src/components/Markdown.tsx';",
  "import { opensInSandbox, sandboxDocument } from './src/lib/workbench-bridge.ts';",
  "export { opensInSandbox, sandboxDocument };",
  "export const page = (text) => renderToStaticMarkup(React.createElement(Markdown, { text }));",
].join('\n');

const bundle = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['katex', 'katex/dist/katex.min.css'],
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /^\.\.?\/ui$/ }, () => ({ path: 'ui', namespace: 'test-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({ contents: 'export const IconBtn = () => null; export const Btn = () => null; export const Icon = () => null; export const Select = () => null;' }));
  } }],
});
/* The bundle goes to a file: it is large, and a data: URL is a poor place to
   import 70 KB of React from. React's server build is CommonJS (it requires
   `util`), so the file is `.cjs` and is required rather than imported. */
const dir = mkdtempSync(join(tmpdir(), 'nostroma-handoff-'));
const file = join(dir, 'handoff.cjs');
writeFileSync(file, bundle.outputFiles[0].text);
const { page, opensInSandbox, sandboxDocument } = createRequire(import.meta.url)(file);

const fence = (language, code) => `Here:\n\n\`\`\`${language}\n${code}\n\`\`\`\n`;

test('an html block offers the sandbox, not the terminal', () => {
  const html = page(fence('html', '<h1>hi</h1>'));
  assert.match(html, /st-code__sandbox/);
  assert.match(html, />Sandbox</);
  assert.doesNotMatch(html, /st-code__run/);
});

test('a script block offers the sandbox too', () => {
  assert.match(page(fence('js', 'console.log(1)')), /st-code__sandbox/);
  assert.match(page(fence('javascript', 'console.log(1)')), /st-code__sandbox/);
});

test('a shell block still offers the terminal and no sandbox', () => {
  const html = page(fence('bash', 'ls -la'));
  assert.match(html, /st-code__run/);
  assert.match(html, />Run</);
  assert.doesNotMatch(html, /st-code__sandbox/);
});

test('a block the sandbox cannot run offers neither', () => {
  const html = page(fence('python', 'print(1)'));
  assert.doesNotMatch(html, /st-code__sandbox|st-code__run/);
  assert.equal(opensInSandbox('python'), false);
  assert.equal(opensInSandbox('ts'), false);
  assert.equal(opensInSandbox('HTML'), true);
});

test('a page is handed over untouched', () => {
  assert.equal(sandboxDocument('<h1>hi</h1>', 'html'), '<h1>hi</h1>');
});

test('a script arrives wrapped, so the console strip has something to show', () => {
  const doc = sandboxDocument('console.log(1)', 'js');
  assert.match(doc, /^<!doctype html>/);
  assert.match(doc, /<script>\nconsole\.log\(1\)\n<\/script>/);
});

test('a closing script tag inside the block cannot end the wrapper', () => {
  const doc = sandboxDocument('document.write("</script>")', 'javascript');
  assert.equal(doc.match(/<\/script>/g).length, 1);
  assert.match(doc, /<\\\/script>/);
});

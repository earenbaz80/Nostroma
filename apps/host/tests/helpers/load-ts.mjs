import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Load a TypeScript module of the page the way Vite does: bundle its imports (shared/memory-budget.mjs) and import the result. */
export async function loadTs(url) {
  const result = await build({ entryPoints: [fileURLToPath(url)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

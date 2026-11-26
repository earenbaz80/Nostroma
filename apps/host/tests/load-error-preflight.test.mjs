import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const models = read('src/components/NativeModels.tsx');
const control = read('server/native-control.mjs');

test('a failed load shows the preflight figures beside its error, from the progress the host kept', () => {
  const branch = /job\?\.state === 'error' \? (<div className="stack" data-load-error>[\s\S]*?<\/div>) : null/.exec(models);
  assert.ok(branch, 'the error branch is one block');
  assert.match(branch[1], /<ErrorNotice message=\{job\.error \?\? job\.summary\}/, 'the error is still said once');
  assert.match(branch[1], /<PreflightFigures preflight=\{job\.progress\?\.preflight as PreflightProgress \| undefined\}\/>/, 'the figures come from the job progress, not from the plan');
});

test('the running card and the failed card read the figures from one rule', () => {
  assert.match(models, /export function PreflightFigures\(\{ preflight \}/, 'one component draws the rows');
  assert.match(models, /<PreflightFigures preflight=\{preflight\}\/>/, 'the running card uses it');
  assert.ok(!/preflightRows/.test(models), 'no second copy of the rows is left behind');
  assert.match(models, /data-preflight/, 'the rows carry an anchor a probe can find');
});

test('a load that stopped keeps the preflight and loses only its stage and time left', () => {
  const at = control.indexOf('function clearLoadProgress(job)');
  assert.ok(at >= 0, 'clearLoadProgress is there');
  const destructured = /const \{([^}]*)\}=job\.progress/.exec(control.slice(at, at + 400));
  assert.ok(destructured, 'it clears fields by name');
  for (const kept of ['preflight', 'warmup']) assert.ok(!destructured[1].split(',').includes(kept), `${kept} survives a failed load`);
  for (const cleared of ['stage', 'etaSeconds', 'percent']) assert.ok(destructured[1].split(',').includes(cleared), `${cleared} is cleared`);
});

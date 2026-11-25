/**
 * "Check for updates" in a build that publishes no release feed of its own: the app row names no version, offers nothing to
 * install and makes no request, so another product's release can never be presented or installed from here. The engine row
 * keeps its own (Control) path and is not part of this check.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUpdates } from '../server/updates.mjs';
import { APP_UPDATES_OFF } from '../server/update-messages.mjs';

test('the check names no version and reaches no network at all', async () => {
  let called = 0;
  const fetcher = async () => { called++; throw new Error('the check must not reach the network'); };
  const result = await checkUpdates({ appVersion: '0.1.0', engineVersion: 'nostroma-engine 0.1.0' }, fetcher);
  assert.equal(called, 0, 'no request was made');
  assert.ok(result.checkedAt, 'a check still says when it ran');
  assert.equal(result.nostroma.status, 'unavailable');
  assert.equal(result.nostroma.canInstall, false);
  assert.equal(result.nostroma.latestVersion, undefined, 'no version is named');
  assert.equal(result.nostroma.releaseUrl, undefined, 'no link to another product');
  assert.equal(result.nostroma.message, APP_UPDATES_OFF);
  assert.equal(result.nostroma.installedVersion, '0.1.0');
  assert.equal(result.engine.status, 'unavailable');
  assert.equal(result.engine.canInstall, false);
});

test('an installation without a comparable version still says no version is offered', async () => {
  const result = await checkUpdates({ appVersion: 'development', engineVersion: null });
  assert.equal(result.nostroma.status, 'unavailable');
  assert.equal(result.nostroma.message, APP_UPDATES_OFF);
  assert.equal(result.nostroma.latestVersion, undefined);
});

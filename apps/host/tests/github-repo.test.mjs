import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepo, cloneArgs, tokenEnv, cloneFailure } from '../server/github-repo.mjs';

test('a repository is accepted as owner/name, as an address, and with or without .git', () => {
  const same = { owner: 'earenbaz80', repo: 'Nostroma', name: 'Nostroma', url: 'https://github.com/earenbaz80/Nostroma.git' };
  for (const input of [
    'earenbaz80/Nostroma',
    '  earenbaz80/Nostroma  ',
    'https://github.com/earenbaz80/Nostroma',
    'https://github.com/earenbaz80/Nostroma.git',
    'https://www.github.com/earenbaz80/Nostroma/',
    'git@github.com:earenbaz80/Nostroma.git',
    'ssh://git@github.com/earenbaz80/Nostroma',
  ]) assert.deepEqual(parseRepo(input), same, input);
});

test('anything that is not a github repository is refused before git runs', () => {
  for (const input of ['', '   ', 'Nostroma', 'github.com/earenbaz80/Nostroma', 'https://gitlab.com/a/b', '../etc/passwd', 'a/b/c', 'owner/', '/owner/repo', 'earenbaz80/Nostroma?tab=readme']) {
    assert.equal(parseRepo(input), null, JSON.stringify(input));
  }
  assert.equal(parseRepo(null), null);
  assert.equal(parseRepo(undefined), null);
});

test('the clone is shallow, single-branch and runs in the folder the host picked', () => {
  const repo = parseRepo('earenbaz80/Nostroma');
  assert.deepEqual(cloneArgs(repo, 'C:\\Users\\me\\Documents\\Nostroma\\Projects\\Nostroma'), [
    'clone', '--depth', '1', '--single-branch', 'https://github.com/earenbaz80/Nostroma.git', 'C:\\Users\\me\\Documents\\Nostroma\\Projects\\Nostroma',
  ]);
});

test('the token travels in the environment, never in the address or the arguments', () => {
  assert.deepEqual(tokenEnv(''), {});
  assert.deepEqual(tokenEnv(null), {});
  const env = tokenEnv('ghp_example');
  assert.equal(env.GIT_CONFIG_COUNT, '1');
  assert.equal(env.GIT_CONFIG_KEY_0, 'http.https://github.com/.extraheader');
  const decoded = Buffer.from(env.GIT_CONFIG_VALUE_0.replace('AUTHORIZATION: basic ', ''), 'base64').toString('utf8');
  assert.equal(decoded, 'x-access-token:ghp_example');
  const repo = parseRepo('earenbaz80/Nostroma');
  assert.ok(!JSON.stringify(cloneArgs(repo, 'C:\\tmp\\Nostroma')).includes('ghp_example'), 'the token is not in argv');
});

test('a failed clone says what to do, in one plain sentence', () => {
  assert.equal(
    cloneFailure("remote: Repository not found.\nfatal: repository 'https://github.com/a/b.git/' not found"),
    'That repository is not on GitHub, or the token cannot see it.',
  );
  assert.match(cloneFailure("fatal: could not read Username for 'https://github.com': terminal prompts disabled"), /private\. Add a GitHub token/);
  assert.match(cloneFailure('remote: Permission to a/b.git denied to me.\nfatal: Authentication failed for \'https://github.com/a/b.git/\'', { hasToken: true }), /refused the token/);
  assert.equal(cloneFailure('fatal: destination path x already exists and is not an empty directory.'), 'A folder with that name is already there.');
  assert.match(cloneFailure('something else broke\n'), /^git could not clone the repository: something else broke$/);
  assert.equal(cloneFailure(''), 'git could not clone the repository.');
});

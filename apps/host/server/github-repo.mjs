/**
 * What someone pastes for a repository, and what git needs to clone it.
 *
 * Kept apart from the host so the parsing, the arguments, the token hand-off
 * and the failure sentences can be tested without a network or a git install.
 */

/** owner/name, a github.com address, or an ssh address, with or without .git or a trailing slash. */
export function parseRepo(input) {
  const text = String(input ?? '')
    .trim()
    .replace(/^git@github\.com:/i, '')
    .replace(/^ssh:\/\/git@github\.com\//i, '')
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const match = /^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})$/.exec(text);
  if (!match) return null;
  const [, owner, repo] = match;
  return { owner, repo, name: repo, url: `https://github.com/${owner}/${repo}.git` };
}

/**
 * A shallow clone is enough to open and edit a repository, and it keeps years
 * of history off the disk.
 */
export function cloneArgs(repo, dir) {
  return ['clone', '--depth', '1', '--single-branch', repo.url, dir];
}

/**
 * The token reaches git through the environment, not the address and not the
 * arguments: a process list would show it otherwise, and an address would be
 * written into .git/config.
 */
export function tokenEnv(token) {
  if (!token) return {};
  const header = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: header,
  };
}

/** git's own words, turned into one sentence that says what to do next. */
export function cloneFailure(stderr, { hasToken = false } = {}) {
  const text = String(stderr ?? '');
  if (/Authentication failed|could not read Username|terminal prompts disabled|returned error: 403|HTTP 403/i.test(text)) {
    return hasToken
      ? 'GitHub refused the token. Check that it is still valid and can read this repository.'
      : 'That repository is private. Add a GitHub token in Settings to clone it.';
  }
  if (/Repository not found|not found|does not exist|returned error: 404|HTTP 404/i.test(text)) {
    return 'That repository is not on GitHub, or the token cannot see it.';
  }
  if (/already exists and is not an empty directory/i.test(text)) {
    return 'A folder with that name is already there.';
  }
  if (/ENOENT|not recognized|command not found/i.test(text)) {
    return 'Git is not installed on this computer.';
  }
  const line = text
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.startsWith('Cloning into'))
    .pop();
  return line ? `git could not clone the repository: ${line}` : 'git could not clone the repository.';
}

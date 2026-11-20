/**
 * Where the Chromium binary the probes drive actually lives.
 *
 * The probes launched a fixed macOS cache path, so on Windows and Linux they
 * printed "No cached Chromium found" and every runtime gate (contrast, measure,
 * luminance, motion) was skipped rather than run. Resolution is now a single
 * place with the same order everywhere:
 *
 *   1. STRATA_CHROME — an explicit override, for a CI image or a second Chrome
 *   2. a Playwright browser cache: `playwright-core install chromium` puts one
 *      in the usual cache directory for the platform, and Playwright's own
 *      PLAYWRIGHT_BROWSERS_PATH moves that directory
 *   3. an installed browser: Chrome, Edge, Chromium or Brave
 *
 * `requireChromium` exits with the harness message the scripts already used, so
 * a machine with no browser at all still fails loudly instead of silently
 * passing a gate.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { envVar } from '../server/env-compat.mjs';

const CACHE_ROOTS = [
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  join(homedir(), '.cache', 'ms-playwright'), // Linux
  join(homedir(), 'Library', 'Caches', 'ms-playwright'), // macOS
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : '', // Windows
].filter((root) => root && existsSync(root));

// Where a build puts its binary, relative to the build directory. The full
// browser comes first, then the headless shell that `--only-shell` installs.
const FULL_LAYOUTS = [
  'chrome-linux/chrome',
  'chrome-linux64/chrome',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-win/chrome.exe',
];

const SHELL_LAYOUTS = [
  'chrome-headless-shell-linux64/chrome-headless-shell',
  'chrome-linux/headless_shell',
  'chrome-headless-shell-mac/chrome-headless-shell',
  'chrome-headless-shell-mac-arm64/chrome-headless-shell',
  'chrome-headless-shell-win64/chrome-headless-shell.exe',
];

function cachedBrowsers() {
  const found = [];
  for (const root of CACHE_ROOTS) {
    const builds = readdirSync(root)
      .filter((name) => name.startsWith('chromium-') || name.startsWith('chromium_headless_shell-'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const build of builds) {
      const layouts = build.startsWith('chromium-') ? FULL_LAYOUTS : SHELL_LAYOUTS;
      for (const layout of layouts) {
        const candidate = join(root, build, layout);
        if (existsSync(candidate)) found.push(candidate);
      }
    }
  }
  return found;
}

const INSTALLED = [
  // Windows
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  // Brave ships as a snap on Debian and Ubuntu
  '/snap/bin/brave',
  '/usr/bin/brave-browser',
];

export function findChromium() {
  const candidates = [envVar('CHROME'), ...cachedBrowsers(), ...INSTALLED].filter(Boolean);
  return candidates.find((path) => existsSync(path)) ?? null;
}

export function requireChromium() {
  const path = findChromium();
  if (!path) {
    console.error('No Chromium found. Set STRATA_CHROME, or install Chrome, Edge or Chromium.');
    process.exit(2);
  }
  return path;
}

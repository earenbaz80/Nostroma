/** One short headless render of the Skills page and the New skill dialog (closed when done).  NOSTROMA_URL, SHOTS */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { envVar } from '../server/env-compat.mjs';
import { anchors, skipOnboarding } from './ui-anchors.mjs';
const BASE = envVar('URL'), SHOTS = resolve(process.env.SHOTS ?? 'skills-shots');
mkdirSync(SHOTS, { recursive: true });
const chrome = process.env.CHROME ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${BASE}/`);
  await skipOnboarding(page, { timeout: 8000 });
  await page.getByText('Skills', { exact: true }).first().click();
  await page.waitForSelector('.skills-page', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, '01-skills-list.png') });
  await page.getByRole('button', { name: 'New skill' }).click();
  await page.locator(anchors.skills.field('name')).fill('Folder helper');
  await page.locator(anchors.skills.field('description')).fill('Opens a folder for you');
  await page.getByRole('tab', { name: 'Instructions' }).click();
  await page.locator('.skill-instructions').fill('Open the Downloads folder, then the Documents folder, and say which two you opened.');
  await page.screenshot({ path: join(SHOTS, '02-new-skill-dialog.png') });
  await page.getByRole('button', { name: 'Save skill' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, '03-after-save.png') });
  console.log('rendered', await page.locator('.skill-row').allInnerTexts().then(r => r.map(t => t.split('\n')[0]).join(' | ')));
} finally { await browser.close(); }

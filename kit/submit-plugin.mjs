#!/usr/bin/env node
/**
 * NotesBridge → OpenAI plugin submission automation.
 *
 * Drives platform.openai.com/plugins → Create plugin → "With MCP", fills the
 * form from LISTING.md, runs Scan Tools, and STOPS before "Submit for review"
 * so you can eyeball it. Re-run with SUBMIT=1 to also click Submit.
 *
 * PREREQUISITE (manual, one-time): developer identity verification must be
 * complete. If the "Complete identity verification" gate appears, this script
 * prints instructions and polls until the create form becomes reachable.
 *
 * Reuses the chrome-bridge agent Chrome (CDP on 127.0.0.1:9222), same as the
 * connector kit. Config (DEMO password, NB_SERVER) is read from ../.env.local.
 *
 * NOTE: the submission form is gated by identity verification, so this script's
 * field selectors are best-effort/defensive (label + placeholder + text
 * matching). On the first real run, watch it and it will print exactly what to
 * set for any field it can't fill automatically.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const KIT_DIR = '/Users/isaiahdupree/Software/notesbridge/kit';
const SHOTS = path.join(KIT_DIR, 'screenshots');
const ENV_FILE = '/Users/isaiahdupree/Software/notesbridge/.env.local';
const ICON = '/Users/isaiahdupree/Software/notesbridge/assets/icon-512.png';
const LAUNCHER = '/Users/isaiahdupree/Documents/Chrome/chrome-bridge/chrome-launcher.sh';
const CDP = 'http://127.0.0.1:9222';
const SUBMIT = process.env.SUBMIT === '1';

const env = Object.fromEntries(
  fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const NB = (env.NB_SERVER || 'https://notesbridge.vercel.app').replace(/\/+$/, '');

// --- the submission values (kept in sync with LISTING.md) ---
const LISTING = {
  mcpUrl: `${NB}/mcp`,
  name: 'NotesBridge',
  description:
    "NotesBridge connects ChatGPT to the notes on your Mac. Search and read any note, create new ones, append to lists, or rewrite drafts — all from a chat. Your notes never live on our servers: every action is executed on your own Mac by a small open-source agent you install with one command (npx apple-notes-agent), and the relay only carries each request for the seconds it's in flight. Write actions are always confirmed by you in ChatGPT before they happen. Open source (MIT) and self-hostable.",
  website: NB,
  privacy: `${NB}/privacy`,
  support: `${NB}/support`,
  demoEmail: 'reviewer@notesbridge.demo',
  demoPassword: env.DEMO_PASSWORD || '(set DEMO_PASSWORD in .env.local)',
  icon: ICON,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[submit ${new Date().toTimeString().slice(0, 8)}]`, ...a);
function loud(lines) {
  const bar = '='.repeat(70);
  console.log(`\n${bar}\n  ACTION NEEDED:\n`);
  for (const l of [].concat(lines)) console.log(`    ${l}`);
  console.log(`\n  Script keeps polling and resumes automatically.\n${bar}\n`);
}
let n = 0;
const shot = async (page, label) => {
  n += 1;
  const f = path.join(SHOTS, `submit-${String(n).padStart(2, '0')}-${label}.png`);
  try { await page.bringToFront().catch(() => {}); await page.screenshot({ path: f }); log('shot ->', f); } catch {}
};
async function waitFor(fn, { timeoutMs = 0, intervalMs = 3000, desc = 'condition' } = {}) {
  const start = Date.now();
  for (;;) {
    let v; try { v = await fn(); } catch { v = false; }
    if (v) return v;
    if (timeoutMs && Date.now() - start > timeoutMs) throw new Error(`timeout: ${desc}`);
    await sleep(intervalMs);
  }
}

async function cdpAlive() { try { return (await fetch(`${CDP}/json/version`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } }
async function connect() {
  if (!(await cdpAlive())) {
    log('CDP down — launching agent Chrome...');
    spawn('/bin/zsh', [LAUNCHER, 'agent'], { detached: true, stdio: 'ignore' }).unref();
    await waitFor(cdpAlive, { intervalMs: 1500, desc: 'CDP' });
  }
  const b = await puppeteer.connect({ browserURL: CDP, defaultViewport: null, protocolTimeout: 180000 });
  log('connected to Chrome', await b.version());
  return b;
}

// --- defensive field helpers (label / placeholder / aria text matching) ---
async function fillField(page, matchers, value) {
  const ok = await page.evaluate((matchers, value) => {
    const lc = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const root = document.querySelector('[role="dialog"]') || document.body;
    const setVal = (el) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      el.focus(); setter ? setter.call(el, value) : (el.value = value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    };
    for (const m of matchers) {
      const needle = lc(m);
      // aria-label / placeholder
      for (const el of root.querySelectorAll('input, textarea')) {
        const hint = lc(el.getAttribute('aria-label')) + ' ' + lc(el.placeholder) + ' ' + lc(el.name);
        if (hint.includes(needle)) { setVal(el); return true; }
      }
      // <label> association
      for (const lab of root.querySelectorAll('label')) {
        if (!lc(lab.textContent).includes(needle)) continue;
        let input = lab.htmlFor ? document.getElementById(lab.htmlFor) : lab.querySelector('input,textarea');
        if (!input) { let a = lab; for (let i = 0; i < 3 && a && !input; i++) { a = a.parentElement; input = a?.querySelector('input,textarea'); } }
        if (input) { setVal(input); return true; }
      }
    }
    return false;
  }, matchers, value);
  log(`fill ${JSON.stringify(matchers[0])}: ${ok ? 'set' : 'NOT FOUND — set manually to: ' + value}`);
  return ok;
}
async function clickText(page, matchers, exact = false) {
  const res = await page.evaluate((matchers, exact) => {
    const lc = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const root = document.querySelector('[role="dialog"]') || document.body;
    for (const m of matchers) {
      const needle = lc(m);
      const el = [...root.querySelectorAll('button,[role="button"],[role="tab"],[role="radio"],a,label')]
        .find((e) => exact ? lc(e.textContent) === needle : lc(e.textContent).includes(needle));
      if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return m; }
    }
    return null;
  }, matchers, exact);
  if (res) log(`clicked "${res}"`);
  return !!res;
}
async function createFormReachable(page) {
  return page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const t = (dlg?.innerText || document.body.innerText || '').toLowerCase();
    if (/identity verification|verified developer identity/.test(t)) return false;
    return /server url|scan tools|new app|mcp server/.test(t) && (dlg?.querySelectorAll('input').length || 0) > 0;
  }).catch(() => false);
}
async function identityGate(page) {
  return page.evaluate(() => /identity verification|verified developer identity/i.test(document.body.innerText || '')).catch(() => false);
}

async function openCreateForm(page) {
  await page.goto('https://platform.openai.com/plugins', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await sleep(2500);
  // Create plugin
  const pos = await page.evaluate(() => { const el = [...document.querySelectorAll('button')].filter((e) => /create plugin/i.test(e.textContent || '')).pop(); const r = el?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
  if (pos) { await page.mouse.click(pos.x, pos.y); await sleep(1200); }
  // With MCP
  const mcp = await page.evaluate(() => { const e = [...document.querySelectorAll('[role="menuitem"]')].find((x) => /with mcp/i.test(x.textContent || '')); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
  if (mcp) { await page.mouse.click(mcp.x, mcp.y); await sleep(2500); }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  log('config:', JSON.stringify({ mcpUrl: LISTING.mcpUrl, name: LISTING.name, demoEmail: LISTING.demoEmail }));
  const browser = await connect();
  const page = await browser.newPage();

  // login check
  await page.goto('https://platform.openai.com/plugins', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await sleep(2500);
  if (await page.evaluate(() => /login/i.test(location.href))) {
    loud(['Log in to platform.openai.com in the Chrome window (Continue with Google).', 'Polling until you are signed in...']);
    await waitFor(async () => !(await page.evaluate(() => /login/i.test(location.href))), { intervalMs: 5000, desc: 'login' });
  }
  log('signed in to platform.openai.com');

  // open create form; handle the identity gate
  await openCreateForm(page);
  await shot(page, 'create-open');
  if ((await identityGate(page)) && !(await createFormReachable(page))) {
    loud([
      'Developer identity verification is required before you can create a plugin.',
      'In the open window: Create plugin → With MCP → click "Continue" on the',
      'identity dialog, and finish verification (individual OR business — plugin',
      'submission needs the business/developer tier). This uses your ID/business',
      'documents and can only be done by you.',
      'When it is complete, this script continues automatically.',
    ]);
    await waitFor(async () => { await openCreateForm(page); return createFormReachable(page); }, { intervalMs: 20000, desc: 'create form reachable' });
  }
  log('create form reachable — filling');
  await shot(page, 'create-form');

  // fill connection
  await fillField(page, ['name', 'custom tool'], LISTING.name);
  await fillField(page, ['description'], LISTING.description);
  await fillField(page, ['server url', 'https://example.com/sse', 'mcp server url', 'sse'], LISTING.mcpUrl);
  await sleep(1500);
  // authentication: OAuth
  await clickText(page, ['OAuth'], true);
  await sleep(800);
  await shot(page, 'connection-filled');

  // Scan Tools (discovers the 8 tools + OAuth settings from the /.well-known metadata)
  if (await clickText(page, ['Scan Tools', 'Scan tools', 'Scan'])) {
    log('scanning tools — waiting for discovery...');
    await sleep(8000);
    await shot(page, 'after-scan');
  } else {
    log('Scan Tools button not found — click it manually after the URL is entered.');
  }

  // logo upload (best-effort)
  try {
    const fileInput = await page.$('input[type="file"]');
    if (fileInput && fs.existsSync(LISTING.icon)) { await fileInput.uploadFile(LISTING.icon); log('uploaded icon', LISTING.icon); await sleep(1500); }
    else log('logo file input not found — upload assets/icon-512.png manually.');
  } catch (e) { log('logo upload skipped:', e.message); }

  // listing details (field names vary; best-effort + printed fallbacks)
  await fillField(page, ['company', 'website', 'company url', 'legal'], LISTING.website);
  await fillField(page, ['privacy'], LISTING.privacy);
  await fillField(page, ['support', 'contact'], LISTING.support);
  await shot(page, 'details-filled');

  // report + stop before submit
  console.log('\n--- SUBMISSION VALUES (fill any field the script could not) ---');
  for (const [k, v] of Object.entries(LISTING)) if (k !== 'icon') console.log(`  ${k}: ${v}`);
  console.log('  reviewer demo login:', LISTING.demoEmail, '/', LISTING.demoPassword);
  console.log('  test prompts + expected responses: see LISTING.md');

  if (SUBMIT) {
    loud(['SUBMIT=1 set — clicking "Submit for review" in 5s. Ctrl-C to abort.']);
    await sleep(5000);
    await clickText(page, ['Submit for review', 'Submit']);
    await sleep(3000);
    await shot(page, 'submitted');
    log('submitted (verify in the dashboard).');
  } else {
    loud([
      'Form filled. REVIEW every field in the open window (esp. description,',
      'demo credentials, and the discovered tools), then click "Submit for review"',
      'yourself — or re-run with SUBMIT=1 to auto-click submit.',
    ]);
  }
  browser.disconnect();
}

main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });

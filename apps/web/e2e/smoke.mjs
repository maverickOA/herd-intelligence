// M1 end-to-end smoke test: drives a real browser through sign-in, onboarding,
// farms and pens, invitations, roles, tenant isolation and sign-out.
//
// Needs three confirmed accounts in the target Supabase project (owner, worker,
// outsider) sharing one password, and the app running (npm run build && npm start).
//   E2E_BASE_URL   default http://localhost:3000
//   E2E_PREFIX     account prefix, default "e2e" -> e2e-owner@example.invalid, ...
//   E2E_PASSWORD   required
//   E2E_CHROMIUM   optional path to a Chromium binary (else Playwright's own)
// Run: node apps/web/e2e/smoke.mjs   (re-runnable against the same accounts)
import { chromium as pw } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const PW = process.env.E2E_PASSWORD;
if (!PW) throw new Error('Set E2E_PASSWORD');
const P = process.env.E2E_PREFIX ?? 'e2e';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await pw.launch({ executablePath: process.env.E2E_CHROMIUM || undefined, headless: true });
const consoleErrors = [];
let step = 'start';
const ok = (msg) => console.log(`  ✓ ${msg}`);
async function stepDo(name, fn) {
  step = name;
  console.log(`• ${name}`);
  await fn();
}
function expect(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  ok(msg);
}

async function newUser(email, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, baseURL: BASE });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[${email}] ${m.text()}`));
  page.on('pageerror', (e) => consoleErrors.push(`[${email}] pageerror ${e.message}`));
  return { ctx, page };
}

async function login(page, email, password = PW) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// Wait for React's post-submit form reset before typing into a field again.
async function settledFill(locator, value) {
  for (let i = 0; i < 50 && (await locator.inputValue()) !== ''; i++) await new Promise((r) => setTimeout(r, 100));
  await locator.fill(value);
}

const toast = (page, text) => page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 15000 });

let orgId, mainFarmId, annexFarmId, inviteLink;
const R = Date.now().toString(36).slice(-4);

try {
  const anon = await newUser('anon');
  await stepDo('Signed-out visitors are sent to sign in', async () => {
    await anon.page.goto('/');
    expect(anon.page.url().startsWith(`${BASE}/login`), 'root redirects to /login');
    await anon.page.goto('/o/00000000-0000-0000-0000-000000000000/farms');
    expect(anon.page.url().includes('/login?next=%2Fo%2F'), 'protected page redirects with next=');
    await anon.page.screenshot({ path: `${SHOTS}01-login-mobile.png`, fullPage: true });
  });

  await stepDo('Sign-up form validates before sending anything', async () => {
    await anon.page.goto('/signup');
    await anon.page.getByRole('button', { name: 'Create account' }).click();
    await anon.page.getByText('Name must be at least 2 characters').waitFor();
    await anon.page.getByText('Enter a valid email address').waitFor();
    expect(true, 'shows field errors for empty sign-up');
  });

  const owner = await newUser('owner');
  await stepDo('Owner: wrong password is refused clearly', async () => {
    await login(owner.page, `${P}-owner@example.invalid`, 'not-the-password');
    await owner.page.getByText('Email or password is incorrect.').waitFor();
    expect(true, 'friendly error for bad credentials');
  });

  let reuse = false;
  await stepDo('Owner: signs in (onboarding if no organization yet)', async () => {
    await login(owner.page, `${P}-owner@example.invalid`);
    await owner.page.waitForURL(/\/onboarding$|\/o\/[0-9a-f-]{36}$/);
    reuse = owner.page.url().includes('/o/');
    if (reuse) { orgId = owner.page.url().split('/o/')[1]; ok(`reusing organization from earlier run ${orgId}`); return; }
    expect(true, 'redirected to /onboarding');
    await owner.page.screenshot({ path: `${SHOTS}02-onboarding-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: creates the organization and first farm', async () => {
    if (reuse) { await owner.page.getByRole('heading', { name: 'E2E Test Farms Ltd' }).waitFor(); ok('organization already exists'); return; }
    await owner.page.getByLabel('Organization name').fill('E2E Test Farms Ltd');
    await owner.page.getByLabel('First farm or location').fill('E2E Main');
    await owner.page.getByRole('button', { name: 'Create organization' }).click();
    await owner.page.waitForURL(/\/o\/[0-9a-f-]{36}$/);
    orgId = owner.page.url().split('/o/')[1];
    await owner.page.getByRole('heading', { name: 'E2E Test Farms Ltd' }).waitFor();
    expect(await owner.page.getByText('Owner', { exact: true }).filter({ visible: true }).first().isVisible(), 'home shows role Owner');
    expect(await owner.page.getByText('Get set up').isVisible(), 'setup checklist shown');
    await owner.page.screenshot({ path: `${SHOTS}03-home-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: adds, edits and archives pens', async () => {
    await owner.page.goto(`/o/${orgId}/farms`);
    await owner.page.getByRole('heading', { name: 'Farms', exact: true }).waitFor();
    await owner.page.getByRole('link', { name: /E2E Main/ }).click();
    await owner.page.waitForURL(/\/farms\/[0-9a-f-]{36}$/);
    mainFarmId = owner.page.url().split('/farms/')[1];

    await owner.page.getByLabel('Name', { exact: true }).fill(`Pen A ${R}`);
    await owner.page.getByLabel('Type').selectOption('kidding');
    await owner.page.getByLabel('Capacity').fill('20');
    await owner.page.getByRole('button', { name: 'Add pen' }).click();
    await toast(owner.page, `Added Pen A ${R}.`);
    await owner.page.getByText(`Pen A ${R}`, { exact: true }).waitFor();
    await owner.page.getByText('Kidding pen · up to 20 head').first().waitFor();
    expect(true, 'pen added and listed');

    await settledFill(owner.page.getByLabel('Name', { exact: true }), `pen a ${R}`);
    await owner.page.getByRole('button', { name: 'Add pen' }).click();
    await toast(owner.page, 'A pen with that name already exists on this farm.');
    expect(true, 'duplicate pen name refused with a clear message');

    await owner.page.getByRole('button', { name: `Edit Pen A ${R}` }).click();
    const editName = owner.page.locator('li form').getByLabel('Name', { exact: true });
    await editName.fill(`Pen A1 ${R}`);
    await owner.page.getByRole('button', { name: 'Save', exact: true }).click();
    await toast(owner.page, 'Pen saved.');
    await owner.page.getByText(`Pen A1 ${R}`, { exact: true }).waitFor();
    expect(true, 'pen renamed');

    await settledFill(owner.page.getByLabel('Name', { exact: true }), `Pen B ${R}`);
    await owner.page.getByRole('button', { name: 'Add pen' }).click();
    await toast(owner.page, `Added Pen B ${R}.`);
    owner.page.once('dialog', (d) => d.accept());
    await owner.page.getByRole('button', { name: `Archive Pen B ${R}` }).click();
    await toast(owner.page, `Archived Pen B ${R}.`);
    await owner.page.getByText(`Pen B ${R}`, { exact: true }).waitFor({ state: 'detached' });
    expect(true, 'pen archived and hidden');
    await owner.page.screenshot({ path: `${SHOTS}04-farm-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: adds a second farm', async () => {
    await owner.page.goto(`/o/${orgId}/farms`);
    await owner.page.getByLabel('Farm name').fill(`E2E Annex ${R}`);
    await owner.page.getByRole('button', { name: 'Add farm' }).click();
    await owner.page.waitForURL(/\/farms\/[0-9a-f-]{36}$/);
    annexFarmId = owner.page.url().split('/farms/')[1];
    expect(annexFarmId !== mainFarmId, 'annex farm created');
  });

  await stepDo('Owner: invites a worker to E2E Main only', async () => {
    await owner.page.goto(`/o/${orgId}/team`);
    await owner.page.getByLabel('Their email address').fill(`${P}-worker@example.invalid`);
    await owner.page.getByLabel('Role').selectOption('worker');
    await owner.page.getByRole('checkbox', { name: 'E2E Main' }).check();
    await owner.page.getByRole('button', { name: 'Create invitation link' }).click();
    await owner.page.getByText('Invitation ready', { exact: true }).waitFor();
    inviteLink = await owner.page.getByLabel('Invitation link').inputValue();
    expect(/\/invite\/[0-9a-f]{48}$/.test(inviteLink), 'invitation link generated');
    const wa = await owner.page.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href');
    expect(wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes(inviteLink), 'WhatsApp share link carries the invite');
    await owner.page.screenshot({ path: `${SHOTS}05-invite-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: updates profile and sees it saved', async () => {
    await owner.page.goto(`/o/${orgId}/settings`);
    await owner.page.getByLabel('Phone (optional)').fill('08012345678');
    await owner.page.getByRole('button', { name: 'Save my details' }).click();
    await owner.page.getByText('Your details are saved.').waitFor();
    expect(true, 'profile saved');
  });

  await stepDo('Owner: worker access is active (resets earlier runs)', async () => {
    await owner.page.goto(`/o/${orgId}/team`);
    const card = owner.page.locator('li', { hasText: 'E2E Worker' });
    if ((await card.count()) && (await card.getByText('Access paused').count())) {
      await card.getByRole('button', { name: 'Manage' }).click();
      await card.getByRole('button', { name: 'Restore access' }).click();
      await toast(owner.page, 'Access restored.');
      ok('restored access left paused by an earlier run');
    } else ok('nothing to reset');
  });

  const worker = await newUser('worker');
  await stepDo('Worker: signs in, opens the invite and joins', async () => {
    await login(worker.page, `${P}-worker@example.invalid`);
    await worker.page.waitForURL(/\/onboarding$|\/o\/[0-9a-f-]{36}$/);
    if (worker.page.url().endsWith(orgId)) {
      ok('worker already joined in an earlier run (acceptance was tested then)');
    } else {
      await worker.page.goto(inviteLink.replace(/^https?:\/\/[^/]+/, ''));
      await worker.page.getByRole('button', { name: 'Accept invitation' }).click();
      await worker.page.waitForURL(`**/o/${orgId}`);
    }
    expect(await worker.page.getByText('Farm worker').filter({ visible: true }).first().isVisible(), 'worker lands in the org as Farm worker');
  });

  await stepDo('Worker: sees only the assigned farm and no management controls', async () => {
    await worker.page.goto(`/o/${orgId}/farms`);
    expect(await worker.page.getByRole('link', { name: /E2E Main/ }).isVisible(), 'sees E2E Main');
    expect((await worker.page.getByRole('link', { name: /E2E Annex/ }).count()) === 0, 'does not see E2E Annex');
    expect((await worker.page.getByText('Add a farm').count()) === 0, 'no add-farm form');
    await worker.page.goto(`/o/${orgId}/farms/${mainFarmId}`);
    expect((await worker.page.getByText('Add a pen').count()) === 0, 'no add-pen form');
    expect((await worker.page.getByRole('button', { name: /Edit Pen/ }).count()) === 0, 'no pen edit buttons');
    await worker.page.goto(`/o/${orgId}/farms/${annexFarmId}`);
    expect(await worker.page.getByText('Not found').isVisible(), 'annex farm by URL shows Not found');
    await worker.page.goto(`/o/${orgId}/team`);
    expect((await worker.page.getByText('Invite someone').count()) === 0, 'no invite form for workers');
  });

  const outsider = await newUser('outsider', { width: 1280, height: 800 });
  await stepDo('Outsider: cannot see the organization by URL or reuse the invite', async () => {
    await login(outsider.page, `${P}-outsider@example.invalid`);
    await outsider.page.waitForURL('**/onboarding');
    await outsider.page.goto(`/o/${orgId}`);
    expect(await outsider.page.getByText('Not found').isVisible(), 'org home shows Not found');
    await outsider.page.goto(`/o/${orgId}/farms/${mainFarmId}`);
    expect(await outsider.page.getByText('Not found').isVisible(), 'farm by URL shows Not found');
    await outsider.page.goto(inviteLink.replace(/^https?:\/\/[^/]+/, ''));
    await outsider.page.getByRole('button', { name: 'Accept invitation' }).click();
    await outsider.page.getByText(/not valid|different email/).waitFor();
    expect(true, 'used invitation refused for another account');
  });

  await stepDo('Owner: pauses the worker, who loses access at once', async () => {
    await owner.page.goto(`/o/${orgId}/team`);
    const card = owner.page.locator('li', { hasText: 'E2E Worker' });
    await card.getByRole('button', { name: 'Manage' }).click();
    owner.page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'Pause access' }).click();
    await toast(owner.page, 'Access paused.');
    await worker.page.goto(`/o/${orgId}`);
    expect(await worker.page.getByText('Not found').isVisible(), 'paused worker sees Not found');
    await owner.page.reload();
    const again = owner.page.locator('li', { hasText: 'E2E Worker' });
    await again.getByRole('button', { name: 'Manage' }).click();
    await again.getByRole('button', { name: 'Restore access' }).click();
    await toast(owner.page, 'Access restored.');
    await worker.page.goto(`/o/${orgId}/farms`);
    expect(await worker.page.getByRole('link', { name: /E2E Main/ }).isVisible(), 'restored worker sees the farm again');
  });

  await stepDo('Desktop layout and sign-out', async () => {
    const desk = await newUser('owner-desktop', { width: 1280, height: 800 });
    await login(desk.page, `${P}-owner@example.invalid`);
    await desk.page.waitForURL(`**/o/${orgId}`);
    await desk.page.screenshot({ path: `${SHOTS}06-home-desktop.png`, fullPage: true });
    await desk.page.goto(`/o/${orgId}/team`);
    await desk.page.screenshot({ path: `${SHOTS}07-team-desktop.png`, fullPage: true });
    await desk.page.getByRole('button', { name: 'Your account' }).first().click();
    await desk.page.getByRole('menuitem', { name: 'Sign out' }).click();
    await desk.page.waitForURL('**/login');
    await desk.page.goto(`/o/${orgId}`);
    expect(desk.page.url().includes('/login'), 'signed out: org page needs sign-in again');
  });

  console.log(`\nALL STEPS PASSED. orgId=${orgId}`);
} catch (e) {
  console.error(`\nFAILED at step: ${step}\n${e.stack ?? e}`);
  for (const [i, c] of browser.contexts().entries()) for (const [j, pg] of c.pages().entries()) {
    try { console.error(`  page ${i}.${j}: ${pg.url()}`); await pg.screenshot({ path: `${SHOTS}fail-${i}-${j}.png`, fullPage: true }); } catch {}
  }
  process.exitCode = 1;
} finally {
  if (consoleErrors.length) console.log(`\nBrowser console errors (${consoleErrors.length}):\n${consoleErrors.slice(0, 15).join('\n')}`);
  await browser.close();
}

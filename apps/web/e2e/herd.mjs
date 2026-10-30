// M3 end-to-end test: registering animals, ancestors from papers, parents,
// family tree, editing, QR tags, worker limits and tenant isolation.
//
// Same accounts and environment variables as smoke.mjs (run that first once so
// the test organization, farm "E2E Main" and the worker's access exist).
// Run: node apps/web/e2e/herd.mjs   (re-runnable; uses fresh tags each run)
import { chromium as pw } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const PW = process.env.E2E_PASSWORD;
if (!PW) throw new Error('Set E2E_PASSWORD');
const P = process.env.E2E_PREFIX ?? 'e2e';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const R = Date.now().toString(36).slice(-4).toUpperCase();

const browser = await pw.launch({ executablePath: process.env.E2E_CHROMIUM || undefined, headless: true });
let step = 'start';
const ok = (m) => console.log(`  ✓ ${m}`);
const expect = (c, m) => {
  if (!c) throw new Error(`Assertion failed: ${m}`);
  ok(m);
};
async function stepDo(name, fn) {
  step = name;
  console.log(`• ${name}`);
  await fn();
}
async function user(email, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/o\/[0-9a-f-]{36}$|\/onboarding$/);
  return page;
}
const toast = (page, text) => page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 15000 });
const idFromUrl = (page) => page.url().split('?')[0].split('/').pop();
async function noOverflow(page, label) {
  const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
  expect(r.s <= r.w, `no sideways scrolling on ${label} (${r.s}px in ${r.w}px)`);
}

async function register(page, orgId, f) {
  await page.goto(`/o/${orgId}/herd/new`);
  if (f.origin) await page.getByRole('radio', { name: new RegExp(f.origin) }).check();
  if (f.tag) await page.getByLabel(/^(Farm tag|Tag \(if any\))$/).fill(f.tag);
  if (f.name) await page.getByLabel('Name (optional)').fill(f.name);
  await page.getByRole('radio', { name: f.sex, exact: true }).check();
  if (f.breed) await page.getByLabel('Breed', { exact: true }).selectOption({ label: f.breed });
  if (f.birth) await page.getByLabel('Birth date', { exact: true }).fill(f.birth);
  if (f.farm !== null) await page.getByLabel('Farm', { exact: true }).selectOption({ label: f.farm ?? 'E2E Main' });
  if (f.estimated) await page.getByLabel('This date is an estimate').check();
  if (f.founder) await page.getByLabel(/Treat as a founder/).check();
  if (f.sire) await page.getByLabel('Sire', { exact: true }).selectOption({ label: f.sire });
  if (f.dam) await page.getByLabel('Dam', { exact: true }).selectOption({ label: f.dam });
  if (f.price) await page.getByLabel(/^Price/).fill(f.price);
  if (f.seller) await page.getByLabel('Bought from').fill(f.seller);
  await page.getByRole('button', { name: /^(Register animal|Add and link as)/ }).click();
}

let orgId, doeId, kidId;

try {
  const owner = await user(`${P}-owner@example.invalid`);
  orgId = owner.url().split('/o/')[1];

  await stepDo('Owner: Herd tab and empty-or-list view', async () => {
    await owner.getByRole('link', { name: 'Herd', exact: true }).last().click();
    await owner.waitForURL(`**/o/${orgId}/herd`);
    await owner.getByRole('heading', { name: 'Herd', exact: true }).waitFor();
    expect(true, 'herd page opens from the bottom bar');
  });

  await stepDo('Owner: registers a bought doe with purchase details', async () => {
    await register(owner, orgId, { origin: 'Bought', tag: `D-${R}`, name: 'Amina', sex: 'Doe', breed: 'Boer', birth: '2024-03-01', estimated: true, price: '85,000', seller: 'Oja Oba market' });
    await owner.waitForURL(/\/herd\/[0-9a-f-]{36}\?saved=registered/);
    doeId = idFromUrl(owner);
    await owner.getByText('Animal registered.').waitFor();
    expect(await owner.getByRole('heading', { name: `D-${R} · Amina` }).isVisible(), 'profile shows tag and name');
    expect(await owner.getByText(/About 1 Mar 2024/).isVisible(), 'estimated birth date shown as "About"');
    expect(await owner.getByText('Boer').first().isVisible(), 'breed shown');
    expect((await owner.getByLabel(/^Price/).inputValue()) === '85000', 'purchase price saved (commas accepted)');
    expect(await owner.getByText('Bought and registered').isVisible(), 'timeline records the registration');
    await noOverflow(owner, 'animal profile');
    await owner.screenshot({ path: `${SHOTS}m3-01-profile-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: duplicate tags are refused on the field', async () => {
    await register(owner, orgId, { origin: 'Bought', tag: `d-${R}`, sex: 'Doe' });
    await owner.getByText('Another animal already has this tag').waitFor();
    expect(true, 'case-insensitive duplicate tag shows a field error');
  });

  await stepDo('Owner: registers a founder buck and a second doe', async () => {
    await register(owner, orgId, { origin: 'Bought', tag: `B-${R}`, sex: 'Buck', breed: 'Kalahari Red', founder: true });
    await owner.waitForURL(/saved=registered/);
    expect(await owner.getByText('Founder', { exact: true }).isVisible(), 'founder badge shown');
    await register(owner, orgId, { origin: 'Bought', tag: `M-${R}`, sex: 'Doe', birth: '2021-01-01', estimated: true });
    await owner.waitForURL(/saved=registered/);
    ok('second doe registered');
  });

  await stepDo('Owner: adds the doe’s sire from the seller’s papers', async () => {
    await owner.goto(`/o/${orgId}/herd/${doeId}`);
    await owner.getByRole('link', { name: 'From papers' }).first().click();
    await owner.getByText(/Adding the sire of/).waitFor();
    await owner.getByLabel('Name (optional)').fill(`Papers Sire ${R}`);
    await owner.getByLabel('Registration no. (optional)').fill(`REG-${R}`);
    await owner.getByRole('button', { name: 'Add and link as sire' }).click();
    await owner.waitForURL(new RegExp(`/herd/${doeId}\\?saved=ancestor`));
    await owner.getByText('Ancestor added and linked.').waitFor();
    expect(await owner.getByRole('link', { name: `Papers Sire ${R}` }).first().isVisible(), 'sire from papers linked on the profile');
  });

  await stepDo('Owner: sets the doe’s dam from the herd', async () => {
    await owner.getByRole('button', { name: 'Choose dam' }).click();
    await owner.getByLabel('Dam', { exact: true }).selectOption({ label: `M-${R}` });
    await owner.getByLabel('How do you know?').selectOption('observed');
    await owner.getByRole('button', { name: 'Save dam' }).click();
    await toast(owner, 'Dam saved.');
    await owner.getByRole('link', { name: `M-${R}` }).first().waitFor();
    expect(await owner.getByText('2 of 14 ancestors recorded').isVisible(), 'family tree counts 2 known ancestors');
  });

  await stepDo('Owner: registers a kid with both parents; tree reaches grandparents', async () => {
    await register(owner, orgId, { origin: 'Born on the farm', tag: `K-${R}`, sex: 'Buck', birth: '2026-09-15', sire: `B-${R}`, dam: `D-${R} · Amina` });
    await owner.waitForURL(/saved=registered/);
    kidId = idFromUrl(owner);
    expect(await owner.getByText('Growing', { exact: true }).isVisible(), 'kids default to Growing');
    expect(await owner.getByText('4 of 14 ancestors recorded').isVisible(), 'tree: 2 parents + 2 grandparents via the dam');
    expect(await owner.getByText('Founder line').first().isVisible(), 'founder buck’s unknown parents shown as founder line');
    await owner.goto(`/o/${orgId}/herd/${doeId}`);
    expect(await owner.getByRole('link', { name: new RegExp(`K-${R}`) }).isVisible(), 'kid appears under the doe’s offspring');
    await owner.goto(`/o/${orgId}/herd/${kidId}`);
    await owner.screenshot({ path: `${SHOTS}m3-02-kid-tree-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: edits status; the timeline records it', async () => {
    await owner.getByRole('link', { name: 'Edit' }).click();
    await owner.getByLabel('Status', { exact: true }).selectOption('breeding');
    await owner.getByRole('button', { name: 'Save changes' }).click();
    await owner.waitForURL(/saved=updated/);
    expect(await owner.getByText('Status changed from Growing to Breeding').isVisible(), 'status change on the timeline');
  });

  await stepDo('Owner: QR tag and scanning', async () => {
    await owner.getByRole('link', { name: 'QR tag' }).click();
    await owner.getByRole('img', { name: /QR code for/ }).waitFor();
    const svg = await owner.locator('[role=img] svg').count();
    expect(svg === 1, 'tag page renders a QR code');
    await owner.goto(`/a/${kidId}`);
    await owner.waitForURL(`**/o/${orgId}/herd/${kidId}`);
    expect(true, 'scan link opens the animal for the owner');
  });

  await stepDo('Owner: list, search and ancestors view', async () => {
    await owner.goto(`/o/${orgId}/herd?q=${R}`);
    const rows = await owner.locator('main ul li').count();
    expect(rows >= 4, `search finds this run's animals (${rows})`);
    await owner.goto(`/o/${orgId}/herd?view=records`);
    expect(await owner.getByText(`Papers Sire ${R}`).isVisible(), 'papers ancestor listed under Ancestors on record');
    await owner.goto(`/o/${orgId}/herd?view=herd`);
    expect((await owner.getByText(`Papers Sire ${R}`).count()) === 0, 'papers ancestor not counted in the herd');
    await noOverflow(owner, 'herd list');
    await owner.screenshot({ path: `${SHOTS}m3-03-herd-mobile.png`, fullPage: true });
  });

  const worker = await user(`${P}-worker@example.invalid`);
  await stepDo('Worker: sees the animals but cannot edit pedigree or see prices', async () => {
    await worker.goto(`/o/${orgId}/herd/${doeId}`);
    await worker.getByRole('heading', { name: `D-${R} · Amina` }).waitFor();
    expect((await worker.getByRole('link', { name: 'Edit' }).count()) === 0, 'no Edit button');
    expect((await worker.getByRole('button', { name: /Choose|Change/ }).count()) === 0, 'no parent editing');
    expect((await worker.getByText('Purchase details').count()) === 0, 'purchase price hidden');
    expect(await worker.getByRole('link', { name: `Papers Sire ${R}` }).first().isVisible(), 'records-only ancestors visible org-wide');
  });

  await stepDo('Worker: can register an animal, without pedigree or price fields', async () => {
    await worker.goto(`/o/${orgId}/herd/new`);
    expect((await worker.getByRole('radio', { name: /Ancestor from records only/ }).count()) === 0, 'no records-only option');
    expect((await worker.getByText('Parents (if known)').count()) === 0, 'no parent pickers');
    expect((await worker.getByText('Purchase details').count()) === 0, 'no price fields');
    await register(worker, orgId, { origin: 'Born on the farm', tag: `W-${R}`, sex: 'Doe' });
    await worker.waitForURL(/saved=registered/);
    ok('worker registered a kid');
  });

  const outsider = await user(`${P}-outsider@example.invalid`, { width: 1280, height: 800 });
  await stepDo('Outsider: QR link and herd URL reveal nothing', async () => {
    await outsider.goto(`/a/${kidId}`);
    expect(await outsider.getByText('Not found').isVisible(), 'scanned tag shows Not found');
    await outsider.goto(`/o/${orgId}/herd/${doeId}`);
    expect(await outsider.getByText('Not found').isVisible(), 'animal URL shows Not found');
  });

  await stepDo('Desktop screenshot', async () => {
    const desk = await user(`${P}-owner@example.invalid`, { width: 1280, height: 900 });
    await desk.goto(`/o/${orgId}/herd/${kidId}`);
    await desk.screenshot({ path: `${SHOTS}m3-04-kid-desktop.png`, fullPage: true });
    ok('captured');
  });

  console.log(`\nALL HERD STEPS PASSED. run=${R}`);
} catch (e) {
  console.error(`\nFAILED at step: ${step}\n${e.stack ?? e}`);
  for (const [i, c] of browser.contexts().entries()) for (const [j, pg] of c.pages().entries()) {
    try {
      console.error(`  page ${i}.${j}: ${pg.url()}`);
      await pg.screenshot({ path: `${SHOTS}m3-fail-${i}-${j}.png`, fullPage: true });
    } catch {}
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}

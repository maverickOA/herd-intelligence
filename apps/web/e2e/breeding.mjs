// M4 end-to-end test: breeding checks (run by the live "breeding" Edge
// Function), ranking, matings with overrides, pregnancy checks, kidding with
// twins, uncertain paternity, the breeding policy, worker limits and isolation.
//
// Same accounts and environment variables as smoke.mjs and herd.mjs.
// Run: node apps/web/e2e/breeding.mjs   (re-runnable; fresh tags each run)
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
  page.setDefaultTimeout(30000);
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/o\/[0-9a-f-]{36}$|\/onboarding$/);
  return page;
}
const toast = (page, text) => page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 20000 });
const idFromUrl = (page) => page.url().split('?')[0].split('/').pop();
async function noOverflow(page, label) {
  const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
  expect(r.s <= r.w, `no sideways scrolling on ${label} (${r.s}px in ${r.w}px)`);
}
const byId = (page, id) => page.locator(`[id="${id}"]`);

async function register(page, orgId, f) {
  await page.goto(`/o/${orgId}/herd/new`);
  await page.getByRole('radio', { name: new RegExp(f.origin ?? 'Bought') }).check();
  await page.getByLabel(/^(Farm tag|Tag \(if any\))$/).fill(f.tag);
  await page.getByRole('radio', { name: f.sex, exact: true }).check();
  if (f.breed) await page.getByLabel('Breed', { exact: true }).selectOption({ label: f.breed });
  if (f.birth) await page.getByLabel('Birth date', { exact: true }).fill(f.birth);
  await page.getByLabel('Farm', { exact: true }).selectOption({ label: 'E2E Main' });
  if (f.founder) await page.getByLabel(/Treat as a founder/).check();
  if (f.sire) await page.getByLabel('Sire', { exact: true }).selectOption({ label: f.sire });
  if (f.dam) await page.getByLabel('Dam', { exact: true }).selectOption({ label: f.dam });
  await page.getByRole('button', { name: 'Register animal' }).click();
  await page.waitForURL(/saved=registered/);
  return idFromUrl(page);
}

/** Fill the mating form, run the check, and return the page ready to record. */
async function startMating(page, orgId, { doe, bucks, method = 'hand' }) {
  await page.goto(`/o/${orgId}/breeding/mate`);
  await page.getByLabel('Doe', { exact: true }).selectOption({ label: doe });
  if (method === 'pasture') {
    await page.getByLabel('How').selectOption('pasture');
    for (const b of bucks) await page.getByRole('checkbox', { name: b, exact: true }).check();
  } else {
    await page.getByLabel('Buck', { exact: true }).selectOption({ label: bucks[0] });
  }
  await page.getByRole('button', { name: /^Check (this pairing|these pairings)$/ }).click();
  await page.getByRole('region', { name: 'Breeding check results' }).waitFor({ timeout: 30000 });
}

const T = { buck: `B-${R}`, buck2: `C-${R}`, doe: `D-${R}`, daughter: `F-${R}`, doe3: `G-${R}`, kidA: `KA-${R}`, kidB: `KB-${R}`, kidP: `KP-${R}` };
let orgId, restrictedAssessment, lowMating, kidPId;

try {
  const owner = await user(`${P}-owner@example.invalid`);
  orgId = owner.url().split('/o/')[1];

  await stepDo('Owner: sets up a small herd with a father and daughter', async () => {
    await register(owner, orgId, { tag: T.buck, sex: 'Buck', breed: 'Boer', founder: true });
    await register(owner, orgId, { tag: T.buck2, sex: 'Buck', breed: 'Boer', founder: true });
    await register(owner, orgId, { tag: T.doe, sex: 'Doe', breed: 'Boer', founder: true });
    await register(owner, orgId, { tag: T.doe3, sex: 'Doe', founder: true });
    await register(owner, orgId, { origin: 'Born on the farm', tag: T.daughter, sex: 'Doe', birth: '2025-01-10', sire: T.buck, dam: T.doe });
    ok('5 animals registered');
  });

  await stepDo('Owner: Breeding tab, with the advisor reminder', async () => {
    await owner.goto(`/o/${orgId}`);
    await owner.getByRole('link', { name: 'Breeding', exact: true }).last().click();
    await owner.waitForURL(`**/o/${orgId}/breeding`);
    await owner.getByRole('heading', { name: 'Breeding', exact: true }).waitFor();
    expect(await owner.getByText('Risk thresholds not yet confirmed by an advisor').isVisible(), 'advisor confirmation reminder shown');
    await noOverflow(owner, 'breeding home');
    await owner.screenshot({ path: `${SHOTS}m4-01-breeding-home-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: father × daughter is restricted, with the reason spelled out', async () => {
    await owner.goto(`/o/${orgId}/breeding/check`);
    await owner.getByLabel('Buck').selectOption({ label: T.buck });
    await owner.getByLabel('Doe').selectOption({ label: T.daughter });
    await owner.getByRole('button', { name: 'Check pairing' }).click();
    await owner.waitForURL(/\/breeding\/assessments\/[0-9a-f-]{36}$/, { timeout: 30000 });
    restrictedAssessment = idFromUrl(owner);
    expect(await owner.getByText('Restricted by farm breeding policy').first().isVisible(), 'classified as restricted');
    expect(await owner.getByText('25% (1/4)').isVisible(), 'expected kid COI 25% with the exact fraction');
    expect(await owner.getByText(/Father and daughter/).first().isVisible(), 'relationship named');
    expect(await owner.getByText('blocked by your policy').first().isVisible(), 'blocked relationship flagged');
    expect((await owner.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-/).count()) === 0, 'no raw ids shown');
    expect(await owner.getByText('Saved exactly as calculated').isVisible(), 'record of the check shown');
    expect((await owner.getByText(/\bsafe\b/i).count()) === 0, 'never says "safe"');
    await noOverflow(owner, 'assessment');
    await owner.screenshot({ path: `${SHOTS}m4-02-restricted-mobile.png`, fullPage: true });
  });

  await stepDo('Owner: ranking puts the unrelated buck first', async () => {
    await owner.goto(`/o/${orgId}/breeding/rank`);
    await owner.getByLabel('Doe').selectOption({ label: T.daughter });
    await owner.getByRole('button', { name: 'Rank bucks' }).click();
    await owner.waitForURL(/rank\?doe=/);
    const items = owner.locator('ol > li');
    await items.first().waitFor({ timeout: 30000 });
    const texts = await items.allInnerTexts();
    const iC = texts.findIndex((t) => t.includes(T.buck2));
    const iB = texts.findIndex((t) => t.includes(T.buck));
    expect(iC >= 0 && iB > iC, `${T.buck2} ranks above ${T.buck}`);
    expect(texts[iB].includes('Restricted'), 'her sire is ranked as restricted');
    await noOverflow(owner, 'ranking');
  });

  const worker = await user(`${P}-worker@example.invalid`);

  await stepDo('Worker: cannot approve a restricted pairing', async () => {
    await startMating(worker, orgId, { doe: T.daughter, bucks: [T.buck] });
    expect(await worker.getByText(/Only an owner or a manager of this farm can approve it/).isVisible(), 'told who can approve');
    expect((await worker.getByRole('button', { name: 'Record mating' }).count()) === 0, 'no record button');
  });

  await stepDo('Worker: records a low-risk hand mating', async () => {
    await startMating(worker, orgId, { doe: T.doe, bucks: [T.buck2] });
    expect(await worker.getByText('Low known risk').isVisible(), 'check result shown before saving');
    await worker.getByLabel('Date').fill('2026-05-01');
    await worker.getByRole('button', { name: 'Record mating' }).click();
    await worker.waitForURL(/\/breeding\/matings\/[0-9a-f-]{36}\?saved=mating/, { timeout: 30000 });
    lowMating = idFromUrl(worker);
    expect(await worker.getByText('Mating recorded with its breeding check.').isVisible(), 'mating saved');
    expect(await worker.getByText(/1 May 2026/).first().isVisible(), 'mating date shown');
    expect(await worker.getByText(/28 Sept? 2026/).first().isVisible(), 'estimated due date (150 days) shown');
  });

  await stepDo('Owner: approves the restricted mating with a written reason', async () => {
    await startMating(owner, orgId, { doe: T.daughter, bucks: [T.buck] });
    await owner.getByLabel('Date').fill('2026-05-02');
    await owner.getByLabel('Reason for going ahead').fill('Planned line-breeding trial; kids kept for meat only');
    await owner.getByLabel(/I have read the breeding check/).check();
    await owner.getByRole('button', { name: 'Record mating' }).click();
    await owner.waitForURL(/saved=mating/, { timeout: 30000 });
    expect(await owner.getByText('Approved with a reason').isVisible(), 'override recorded on the mating');
    await owner.getByRole('link', { name: 'Check', exact: true }).click();
    await owner.getByText('Planned line-breeding trial; kids kept for meat only').waitFor();
    expect(true, 'reason shown on the saved check');
  });

  await stepDo('Worker: pregnancy check marks the doe pregnant', async () => {
    await worker.goto(`/o/${orgId}/breeding/matings/${lowMating}`);
    await worker.getByLabel('Checked on').fill('2026-06-15');
    await worker.getByLabel('Result').selectOption('pregnant');
    await worker.getByLabel(/Due date from the scan/).fill('2026-09-27');
    await worker.getByRole('button', { name: 'Save pregnancy check' }).click();
    await toast(worker, 'Pregnancy check saved.');
    await worker.reload();
    expect(await worker.getByText('Pregnant', { exact: true }).first().isVisible(), 'mating shows pregnant');
    await worker.goto(`/o/${orgId}/breeding`);
    const due = worker.locator('section', { has: worker.getByRole('heading', { name: 'Due to kid' }) });
    expect(await due.getByText(new RegExp(T.doe)).first().isVisible(), 'doe listed under Due to kid');
    expect(await due.getByText(/from the scan/).first().isVisible(), 'due date from the scan');
  });

  await stepDo('Worker: records twins; kids get dam and sire', async () => {
    await worker.goto(`/o/${orgId}/breeding/matings/${lowMating}`);
    await worker.getByRole('link', { name: 'Record kidding' }).click();
    await worker.getByLabel('Kidded on').fill('2026-09-27');
    await worker.getByLabel(/Number of kids/).selectOption('2');
    await byId(worker, 'kid0.sex').selectOption('male');
    await byId(worker, 'kid0.tag').fill(T.kidA);
    await byId(worker, 'kid0.weightKg').fill('3.1');
    await byId(worker, 'kid1.sex').selectOption('female');
    await byId(worker, 'kid1.tag').fill(T.kidB);
    expect((await worker.getByLabel("Kids' breed").inputValue()) !== '', 'breed defaults to the parents’ shared breed');
    await noOverflow(worker, 'kidding form');
    await worker.screenshot({ path: `${SHOTS}m4-03-kidding-form-mobile.png`, fullPage: true });
    await worker.getByRole('button', { name: 'Record kidding' }).click();
    await worker.waitForURL(/\/breeding\/kiddings\/[0-9a-f-]{36}\?saved=1/, { timeout: 30000 });
    expect(await worker.getByText('2 kids registered with their parents').isVisible(), 'kidding saved');
    await worker.getByRole('link', { name: new RegExp(T.kidA) }).click();
    await worker.getByRole('heading', { name: T.kidA }).waitFor();
    expect(await worker.getByRole('link', { name: T.buck2 }).first().isVisible(), 'kid’s sire linked');
    expect(await worker.getByRole('link', { name: T.doe }).first().isVisible(), 'kid’s dam linked');
    await worker.goto(`/o/${orgId}/herd`);
    expect(await worker.getByText(T.doe, { exact: true }).isVisible(), 'doe still in the herd list');
  });

  await stepDo('Owner: several bucks with one doe → kids list possible sires', async () => {
    await startMating(owner, orgId, { doe: T.doe3, bucks: [T.buck, T.buck2], method: 'pasture' });
    await owner.getByLabel('Bucks put in on').fill('2026-04-01');
    await owner.getByLabel(/Bucks taken out on/).fill('2026-04-20');
    await owner.getByRole('button', { name: 'Record mating' }).click();
    await owner.waitForURL(/saved=mating/, { timeout: 30000 });
    expect(await owner.getByText('Bucks (father uncertain)').isVisible(), 'mating shows uncertain father');
    await owner.getByRole('link', { name: 'Record kidding' }).click();
    await owner.getByLabel('Kidded on').fill('2026-09-01');
    await byId(owner, 'kid0.sex').selectOption('female');
    await byId(owner, 'kid0.tag').fill(T.kidP);
    await owner.getByRole('button', { name: 'Record kidding' }).click();
    await owner.waitForURL(/saved=1/, { timeout: 30000 });
    await owner.getByRole('link', { name: new RegExp(T.kidP) }).click();
    await owner.getByRole('heading', { name: T.kidP }).waitFor();
    kidPId = idFromUrl(owner);
    expect(await owner.getByText(/Father uncertain\. Possible sires: .*(B-|C-)/).isVisible(), 'possible sires listed on the kid');
  });

  await stepDo('Owner: checks use the worst case for an uncertain father', async () => {
    await owner.goto(`/o/${orgId}/breeding/check`);
    await owner.getByLabel('Buck').selectOption({ label: T.buck });
    await owner.getByLabel('Doe').selectOption({ label: T.kidP });
    await owner.getByRole('button', { name: 'Check pairing' }).click();
    await owner.waitForURL(/\/breeding\/assessments\//, { timeout: 30000 });
    expect(await owner.getByText('Possibly restricted by farm breeding policy').first().isVisible(), 'possibly restricted');
    expect(await owner.getByText('Worst case (uncertain sire)').isVisible(), 'worst case figure shown');
  });

  await stepDo('Owner: records the advisor’s confirmation in the policy', async () => {
    await owner.goto(`/o/${orgId}/breeding/policy`);
    await owner.getByLabel('Breeding advisor').fill('Dr E2E Advisor');
    await owner.getByLabel('Confirmed these values on').fill('2026-10-01');
    await owner.getByRole('button', { name: 'Save policy' }).click();
    await toast(owner, 'Breeding policy saved.');
    await owner.reload();
    expect(await owner.getByText('Confirmed by Dr E2E Advisor').isVisible(), 'confirmation shown');
    await owner.getByLabel('Restricted from (%)').fill('5');
    await owner.getByRole('button', { name: 'Save policy' }).click();
    await owner.getByText('Must not be above the maximum').waitFor();
    expect(true, 'thresholds out of order are refused on the field');
    await noOverflow(owner, 'policy');
  });

  await stepDo('Worker: sees the policy read-only', async () => {
    await worker.goto(`/o/${orgId}/breeding/policy`);
    await worker.getByText('Confirmed by Dr E2E Advisor').waitFor();
    expect(await worker.getByText(/parent and offspring, full siblings, half siblings/).isVisible(), 'blocked relationships listed');
    expect((await worker.getByRole('button', { name: 'Save policy' }).count()) === 0, 'no save button');
  });

  await stepDo('Owner: changing a threshold clears the advisor confirmation', async () => {
    await owner.goto(`/o/${orgId}/breeding/policy`);
    await owner.getByLabel('Minimum completeness (%)').fill('75');
    await owner.getByRole('button', { name: 'Save policy' }).click();
    await toast(owner, 'the advisor confirmation was cleared');
    await owner.reload();
    await owner.getByLabel('Minimum completeness (%)').fill('70');
    await owner.getByRole('button', { name: 'Save policy' }).click();
    await toast(owner, 'Breeding policy saved.');
    await owner.reload();
    expect(await owner.getByText('Not yet confirmed by a breeding advisor').isVisible(), 'back to unconfirmed after a threshold change');
  });

  const outsider = await user(`${P}-outsider@example.invalid`, { width: 1280, height: 800 });
  await stepDo('Outsider: breeding records are not found', async () => {
    await outsider.goto(`/o/${orgId}/breeding/assessments/${restrictedAssessment}`);
    expect(await outsider.getByText('Not found').isVisible(), 'assessment URL shows Not found');
    await outsider.goto(`/o/${orgId}/breeding/matings/${lowMating}`);
    expect(await outsider.getByText('Not found').isVisible(), 'mating URL shows Not found');
  });

  await stepDo('Desktop: assessment and breeding home', async () => {
    const desk = await user(`${P}-owner@example.invalid`, { width: 1280, height: 800 });
    await desk.goto(`/o/${orgId}/breeding/assessments/${restrictedAssessment}`);
    await desk.getByText('The figures').waitFor();
    await desk.screenshot({ path: `${SHOTS}m4-04-assessment-desktop.png`, fullPage: true });
    await desk.goto(`/o/${orgId}/herd/${kidPId}`);
    await desk.getByRole('heading', { name: 'Breeding' }).waitFor();
    await desk.goto(`/o/${orgId}/breeding`);
    await desk.screenshot({ path: `${SHOTS}m4-05-breeding-desktop.png`, fullPage: true });
    ok('desktop screenshots saved');
  });

  console.log('\nAll M4 breeding checks passed.');
} catch (e) {
  console.error(`\n✗ Failed during: ${step}\n${e.stack ?? e}`);
  for (const ctx of browser.contexts()) {
    for (const [i, p] of ctx.pages().entries()) {
      try {
        await p.screenshot({ path: `${SHOTS}m4-failure-${i}.png`, fullPage: true });
      } catch {}
    }
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}

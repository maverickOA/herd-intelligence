/**
 * M4 breeding: policy, assessments (engine output stored only by the service
 * role and re-checked by the database), matings with overrides, pregnancy
 * checks and kidding. The engine runs through the same code the Edge Function
 * uses (packages/breeding-service), on the snapshot breeding_pedigree() returns.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assessmentRow,
  handle,
  type AssessmentRow,
  type PedigreeSnapshot,
  type ServiceResponse,
} from '../../breeding-service/src/index.js';
import { as, denied, signUp, startDb, type TestDb, type User } from './db.js';

let db: TestDb;
let alice: User, bob: User, carol: User, dave: User, vic: User;
let orgA: string, orgB: string, farmA1: string, farmA2: string;
const ids: Record<string, string> = {};

const rlsBlocked = /row-level security|permission denied/;

async function animal(user: User, key: string, values: Record<string, unknown>) {
  const v = { org_id: orgA, farm_id: farmA1, origin: 'purchased', tag: key, ...values };
  const cols = Object.keys(v);
  const r = await as(db, user,
    `insert into public.animals (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(v));
  ids[key] = r.rows[0].id;
  return ids[key]!;
}

const setParent = (child: string, role: 'sire' | 'dam', parent: string | null, confidence = 'observed') =>
  as(db, alice, `select public.set_parent($1, $2, $3, $4)`, [ids[child], role, parent && ids[parent], confidence]);

const snapshot = async (user: User, animals: string[], withBucks = false): Promise<PedigreeSnapshot> =>
  (await as(db, user, `select public.breeding_pedigree($1::uuid[], $2) as s`, [animals, withBucks])).rows[0].s;

/** Service-role insert, as the Edge Function does. */
async function saveRow(row: AssessmentRow): Promise<string> {
  const cols = Object.keys(row);
  const vals = Object.values(row).map((v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v));
  const r = await db.admin.query(
    `insert into public.breeding_assessments (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    vals,
  );
  return r.rows[0].id;
}

/** The Edge Function's flow for one user. */
const service = (user: User, body: unknown): Promise<ServiceResponse> =>
  handle(body, {
    userId: user.id,
    getPedigree: (animalIds, withBucks) => snapshot(user, animalIds, withBucks),
    saveAssessment: saveRow,
  });

async function check(user: User, buck: string, doe: string) {
  const r = await service(user, { action: 'assess', buckId: ids[buck], doeId: ids[doe], purpose: 'mating' });
  if (r.action !== 'assess') throw new Error('expected assess');
  return r;
}

const mate = (user: User, doe: string, sires: { sire: string; assessmentId: string }[], extra: {
  method?: string; reason?: string | null; ack?: boolean; started?: string;
} = {}) =>
  as(db, user, `select public.record_mating($1, $2, $3::date, null, $4::jsonb, $5, $6) as id`, [
    ids[doe],
    extra.method ?? 'hand',
    extra.started ?? '2026-06-01',
    JSON.stringify(sires.map((s) => ({ sire_id: ids[s.sire], assessment_id: s.assessmentId }))),
    extra.reason ?? null,
    extra.ack ?? false,
  ]);

beforeAll(async () => {
  db = await startDb();
  alice = await signUp(db, 'alice@greensummit.test', 'Alice Owner');
  bob = await signUp(db, 'bob@otherfarm.test', 'Bob Other');
  carol = await signUp(db, 'carol@greensummit.test', 'Carol Worker');
  dave = await signUp(db, 'dave@greensummit.test', 'Dave Manager');
  vic = await signUp(db, 'vic@vets.test', 'Vic Vet');

  orgA = (await as(db, alice, `select public.create_organization('Green Summit Farms', 'Ilorin') as id`)).rows[0].id;
  orgB = (await as(db, bob, `select public.create_organization('Other Farm Ltd', 'Other 1') as id`)).rows[0].id;
  farmA1 = (await as(db, alice, `select id from public.farms where org_id = $1`, [orgA])).rows[0].id;
  farmA2 = (await as(db, alice, `insert into public.farms (org_id, name) values ($1, 'Annex') returning id`, [orgA])).rows[0].id;
  for (const [u, role, farm] of [[dave, 'manager', farmA1], [carol, 'worker', farmA1], [vic, 'vet', farmA2]] as const) {
    const token = (await as(db, alice, `select public.create_invitation($1, $2, $3, array[$4]::uuid[]) as t`, [orgA, u.email, role, farm])).rows[0].t;
    await as(db, u, `select public.accept_invitation($1)`, [token]);
  }

  // Founders on the main farm.
  await animal(alice, 'B1', { sex: 'male', is_declared_founder: true, birth_date: '2022-01-01' });
  await animal(alice, 'D1', { sex: 'female', is_declared_founder: true, birth_date: '2022-02-01' });
  await animal(alice, 'D9', { sex: 'female', is_declared_founder: true, birth_date: '2022-02-01' });
  // D2 is B1's daughter: B1 x D2 is parent-offspring.
  await animal(alice, 'D2', { sex: 'female', birth_date: '2024-01-10', origin: 'born_on_farm' });
  await setParent('D2', 'sire', 'B1');
  await setParent('D2', 'dam', 'D1');
  // A buck on the annex (Carol can't see it) sired both B5 and D5 on the main farm.
  await animal(alice, 'X', { sex: 'male', farm_id: farmA2, is_declared_founder: true, birth_date: '2021-01-01' });
  await animal(alice, 'B5', { sex: 'male', birth_date: '2024-03-01' });
  await animal(alice, 'D5', { sex: 'female', birth_date: '2024-04-01' });
  await setParent('B5', 'sire', 'X');
  await setParent('B5', 'dam', 'D9');
  await setParent('D5', 'sire', 'X');
  await setParent('D5', 'dam', 'D1');
  // No papers, not declared founders: nothing known.
  await animal(alice, 'B3', { sex: 'male' });
  await animal(alice, 'D3', { sex: 'female' });
  // Another founder buck for multi-sire matings.
  await animal(alice, 'B4', { sex: 'male', is_declared_founder: true, birth_date: '2022-05-01' });
  // Something in org B.
  await as(db, bob, `insert into public.animals (org_id, farm_id, tag, sex, origin) values ($1, (select id from public.farms where org_id = $1), 'OB-1', 'female', 'purchased')`, [orgB]);
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

describe('Breeding policy', () => {
  it('every organization gets the default goat policy, readable by members only', async () => {
    const p = await as(db, carol, `select low_band_max::float8 as low, high_band_min::float8 as high, max_coi::float8 as max,
      min_completeness::float8 as pci, generations, blocked_relationships, allow_founder_assumption from public.breeding_policies`);
    expect(p.rows).toEqual([{ low: 0.03125, high: 0.0625, max: 0.125, pci: 0.7, generations: 3,
      blocked_relationships: ['parent-offspring', 'full-siblings', 'half-siblings'], allow_founder_assumption: true }]);
    expect((await as(db, bob, `select * from public.breeding_policies where org_id = $1`, [orgA])).rowCount).toBe(0);
  });

  it('only owners change it; thresholds must stay in order', async () => {
    const upd = `update public.breeding_policies set advisor_name = 'Dr Ade', advisor_confirmed_on = '2026-10-01' where org_id = $1`;
    expect((await as(db, dave, upd, [orgA])).rowCount).toBe(0);
    expect((await as(db, alice, upd, [orgA])).rowCount).toBe(1);
    expect(await denied(db, alice, `update public.breeding_policies set low_band_max = 0.2 where org_id = $1`, [orgA])).toMatch(/check constraint/);
    expect(await denied(db, alice, `update public.breeding_policies set org_id = $2 where org_id = $1`, [orgA, orgB])).toMatch(/permission denied/);
  });

  it('changing a threshold clears the advisor confirmation', async () => {
    await as(db, alice, `update public.breeding_policies set min_completeness = 0.75 where org_id = $1`, [orgA]);
    const r = await as(db, alice, `select advisor_confirmed_on, advisor_name from public.breeding_policies where org_id = $1`, [orgA]);
    expect(r.rows[0]).toEqual({ advisor_confirmed_on: null, advisor_name: 'Dr Ade' });
    await as(db, alice, `update public.breeding_policies set min_completeness = 0.7 where org_id = $1`, [orgA]);
  });
});

describe('Pedigree for the engine', () => {
  it('includes ancestors on farms the user cannot see, without their details', async () => {
    const s = await snapshot(carol, [ids.B5!, ids.D5!]);
    const x = s.animals.find((a) => a.id === ids.X)!;
    expect(x).toMatchObject({ visible: false, label: null, birthDate: null, breedId: null, status: null, sex: 'male' });
    expect(s.animals.find((a) => a.id === ids.B5)).toMatchObject({ visible: true, label: 'B5', sireId: ids.X });
    expect(s.policy).toMatchObject({ maxCoi: 0.125, generations: 3 });
  });

  it('refuses animals the user cannot see or that belong to another organization', async () => {
    expect(await denied(db, carol, `select public.breeding_pedigree(array[$1]::uuid[])`, [ids.X])).toMatch(/not found/);
    expect(await denied(db, bob, `select public.breeding_pedigree(array[$1]::uuid[])`, [ids.D1])).toMatch(/not found/);
    const ob = (await as(db, bob, `select id from public.animals where tag = 'OB-1'`)).rows[0].id;
    expect(await denied(db, alice, `select public.breeding_pedigree(array[$1, $2]::uuid[])`, [ids.B1, ob])).toMatch(/not found/);
  });

  it('lists only bucks the user can see and that can breed', async () => {
    const s = await snapshot(carol, [ids.D1!], true);
    expect(new Set(s.bucks)).toEqual(new Set([ids.B1, ids.B5, ids.B3, ids.B4]));
    const a = await snapshot(alice, [ids.D1!], true);
    expect(a.bucks).toContain(ids.X);
  });
});

describe('Assessments', () => {
  it('signed-in users cannot write assessments, only read them', async () => {
    expect(await denied(db, alice, `insert into public.breeding_assessments (org_id) values ($1)`, [orgA])).toMatch(rlsBlocked);
    const r = await check(alice, 'B1', 'D9');
    expect(await denied(db, alice, `delete from public.breeding_assessments where id = $1`, [r.assessmentId])).toMatch(rlsBlocked);
    expect(await denied(db, alice, `update public.breeding_assessments set classification = 'low' where id = $1`, [r.assessmentId])).toMatch(rlsBlocked);
  });

  it('unrelated declared founders: low known risk, stored with the policy and pedigree revision', async () => {
    const r = await check(carol, 'B4', 'D9');
    expect(r.assessment.classification.code).toBe('low');
    const row = (await as(db, carol, `select classification, known_coi::float8 as coi, requested_by, uses_founder_assumption,
      pedigree_revision, engine_version from public.breeding_assessments where id = $1`, [r.assessmentId])).rows[0];
    expect(row).toMatchObject({ classification: 'low', coi: 0, requested_by: carol.id, uses_founder_assumption: true, engine_version: '1.0.0' });
    expect(Number(row.pedigree_revision)).toBeGreaterThan(0);
  });

  it('half siblings through a sire on a farm Carol cannot see are still restricted', async () => {
    const r = await check(carol, 'B5', 'D5');
    expect(r.assessment.classification.code).toBe('restricted');
    expect(r.assessment.knownCoi.exact).toBe('1/8');
    expect(r.assessment.relationships[0]!.code).toBe('half-siblings');
    // The hidden sire appears only by id, never by tag.
    expect(JSON.stringify(r.assessment)).not.toContain('"X"');
  });

  it('missing pedigree is never low risk', async () => {
    const r = await check(alice, 'B3', 'D3');
    expect(r.assessment.classification.code).toBe('insufficient');
  });

  it('the database rejects a forged or out-of-date result even from the service role', async () => {
    const s = await snapshot(alice, [ids.B1!, ids.D2!]);
    const { assess } = await import('../../breeding-service/src/index.js');
    const a = assess(s, ids.B1!, ids.D2!);
    expect(a.classification.code).toBe('restricted');
    const good = assessmentRow(s, a, 'check', alice.id);
    await expect(saveRow({ ...good, classification: 'low', requires_override: false })).rejects.toThrow(/less strict/);
    await expect(saveRow({ ...good, classification: 'elevated', requires_override: false, relationships: [] }))
      .rejects.toThrow(/less strict/);
    await expect(saveRow({ ...good, policy: { ...good.policy, maxCoi: 0.5 } })).rejects.toThrow(/out-of-date breeding policy/);
    await expect(saveRow({ ...good, policy_version: good.policy_version - 1 })).rejects.toThrow(/out-of-date/);
    await expect(saveRow({ ...good, requested_by: bob.id })).rejects.toThrow(/not a member/);
    await expect(saveRow({ ...good, doe_id: ids.B4! })).rejects.toThrow(/buck with a doe/);
    expect(await saveRow(good)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a blocked relationship stays restricted even when the COI is under the maximum', async () => {
    await as(db, alice, `update public.breeding_policies set max_coi = 0.25 where org_id = $1`, [orgA]);
    try {
      const { assess } = await import('../../breeding-service/src/index.js');
      const s = await snapshot(alice, [ids.B5!, ids.D5!]);
      const a = assess(s, ids.B5!, ids.D5!);
      expect(a.classifiedCoi.value).toBeLessThan(0.25);
      expect(a.classification.code).toBe('restricted');
      const row = assessmentRow(s, a, 'check', alice.id);
      await expect(saveRow({ ...row, classification: 'high', requires_override: false })).rejects.toThrow(/less strict/);
    } finally {
      await as(db, alice, `update public.breeding_policies set max_coi = 0.125 where org_id = $1`, [orgA]);
    }
  });

  it('ranking puts documented low-risk bucks first and restricted ones last', async () => {
    const r = await service(alice, { action: 'rank', doeId: ids.D2 });
    if (r.action !== 'rank') throw new Error('expected rank');
    const order = r.result.ranked.map((x) => [x.buckId, x.classification.code]);
    // B4, the annex buck X and B5 (son of X and D9) are unrelated to D2: low risk, ranked first.
    expect(new Set(order.slice(0, 3).map(([id, c]) => `${id}:${c}`)))
      .toEqual(new Set([ids.B4, ids.X, ids.B5].map((id) => `${id}:low`)));
    expect(order.at(-1)).toEqual([ids.B1, 'restricted']);
    expect(order.find(([id]) => id === ids.B3)?.[1]).toBe('insufficient');
  });

  it('other organizations see none of it', async () => {
    expect((await as(db, bob, `select * from public.breeding_assessments`)).rowCount).toBe(0);
    await expect(service(bob, { action: 'assess', buckId: ids.B1, doeId: ids.D1, purpose: 'check' })).rejects.toThrow(/not found/);
  });
});

describe('Matings', () => {
  let lowMating: string;

  it('a worker records a low-risk mating; both animals get a timeline entry', async () => {
    const r = await check(carol, 'B4', 'D9');
    lowMating = (await mate(carol, 'D9', [{ sire: 'B4', assessmentId: r.assessmentId }])).rows[0].id;
    const ev = await as(db, carol, `select animal_id, summary from public.animal_events where event_type = 'mating' order by animal_id`);
    expect(ev.rows.map((e) => e.summary).sort()).toEqual(['Mated with B4 (hand mating)', 'Mated with D9 (hand mating)']);
    const m = await as(db, carol, `select outcome, method, farm_id from public.mating_events where id = $1`, [lowMating]);
    expect(m.rows[0]).toEqual({ outcome: 'awaiting_check', method: 'hand', farm_id: farmA1 });
  });

  it('a check is single-person and goes stale when the pedigree changes', async () => {
    const r = await check(alice, 'B4', 'D1');
    expect(await denied(db, carol, `select public.record_mating($1, 'hand', '2026-06-01', null, $2::jsonb)`,
      [ids.D1, JSON.stringify([{ sire_id: ids.B4, assessment_id: r.assessmentId }])])).toMatch(/out of date/);
    await animal(alice, 'P1', { sex: 'male', origin: 'pedigree_only', farm_id: null });
    await setParent('B3', 'sire', 'P1', 'reported');
    expect(await denied(db, alice, `select public.record_mating($1, 'hand', '2026-06-01', null, $2::jsonb)`,
      [ids.D1, JSON.stringify([{ sire_id: ids.B4, assessment_id: r.assessmentId }])])).toMatch(/out of date/);
  });

  it('a check must be for the same buck and doe', async () => {
    const r = await check(carol, 'B4', 'D5');
    expect(await denied(db, carol, `select public.record_mating($1, 'hand', '2026-06-01', null, $2::jsonb)`,
      [ids.D1, JSON.stringify([{ sire_id: ids.B4, assessment_id: r.assessmentId }])])).toMatch(/Run the breeding check/);
  });

  it('a restricted pairing needs an owner or farm manager and a written reason', async () => {
    const byCarol = await check(carol, 'B1', 'D2');
    expect(byCarol.assessment.classification.code).toBe('restricted');
    expect(await denied(db, carol, `select public.record_mating($1, 'hand', '2026-06-01', null, $2::jsonb, 'Because I said so', true)`,
      [ids.D2, JSON.stringify([{ sire_id: ids.B1, assessment_id: byCarol.assessmentId }])])).toMatch(/Only an owner or a manager/);

    const r = await check(dave, 'B1', 'D2');
    const sires = [{ sire: 'B1', assessmentId: r.assessmentId }];
    expect(await mate(dave, 'D2', sires, { ack: true }).catch((e) => e.message)).toMatch(/reason of at least 10/);
    expect(await mate(dave, 'D2', sires, { reason: 'too short', ack: true }).catch((e) => e.message)).toMatch(/reason of at least 10/);
    expect(await mate(dave, 'D2', sires, { reason: 'Planned line-breeding trial agreed with Dr Ade' }).catch((e) => e.message))
      .toMatch(/Confirm that you have read/);
    const id = (await mate(dave, 'D2', sires, { reason: 'Planned line-breeding trial agreed with Dr Ade', ack: true })).rows[0].id;
    const o = await as(db, alice, `select o.reason, o.approver_role, o.approved_by from public.mating_event_sires s
      join public.assessment_overrides o on o.id = s.override_id where s.mating_id = $1`, [id]);
    expect(o.rows[0]).toEqual({ reason: 'Planned line-breeding trial agreed with Dr Ade', approver_role: 'manager', approved_by: dave.id });
    const ev = await as(db, alice, `select summary from public.animal_events where animal_id = $1 and event_type = 'mating'`, [ids.D2]);
    expect(ev.rows[0].summary).toMatch(/restricted pairing approved with a reason/);
  });

  it('an insufficient-pedigree pairing needs the warning acknowledged', async () => {
    const r = await check(carol, 'B3', 'D3');
    expect(r.assessment.classification.code).toBe('insufficient');
    expect(await mate(carol, 'D3', [{ sire: 'B3', assessmentId: r.assessmentId }]).catch((e) => e.message)).toMatch(/Confirm that you have read/);
    const id = (await mate(carol, 'D3', [{ sire: 'B3', assessmentId: r.assessmentId }], { ack: true })).rows[0].id;
    expect((await as(db, carol, `select risk_acknowledged from public.mating_events where id = $1`, [id])).rows[0].risk_acknowledged).toBe(true);
  });

  it('several bucks only when running with the herd; records-only bucks only for AI', async () => {
    const a = await check(carol, 'B4', 'D1');
    const b = await check(carol, 'B5', 'D1');
    const sires = [{ sire: 'B4', assessmentId: a.assessmentId }, { sire: 'B5', assessmentId: b.assessmentId }];
    expect(await mate(carol, 'D1', sires).catch((e) => e.message)).toMatch(/one buck/);
    ids.M_multi = (await mate(carol, 'D1', sires, { method: 'pasture', ack: b.assessment.classification.code !== 'low' && b.assessment.classification.code !== 'elevated' })).rows[0].id;
    const p = await check(alice, 'P1', 'D5');
    expect(await mate(alice, 'D5', [{ sire: 'P1', assessmentId: p.assessmentId }], { ack: true }).catch((e) => e.message)).toMatch(/only AI/);
  });

  it('nobody outside the farm or organization can record or see matings', async () => {
    const r = await check(alice, 'B4', 'D9');
    expect(await denied(db, vic, `select public.record_mating($1, 'hand', '2026-06-01', null, $2::jsonb)`,
      [ids.D9, JSON.stringify([{ sire_id: ids.B4, assessment_id: r.assessmentId }])])).toMatch(/not found|permission/);
    expect(await denied(db, bob, `select public.record_mating($1, 'hand', '2026-06-01', null, '[]'::jsonb)`, [ids.D9])).toMatch(/not found/);
    expect((await as(db, bob, `select * from public.mating_events`)).rowCount).toBe(0);
    expect((await as(db, vic, `select * from public.mating_events`)).rowCount).toBe(0);
    expect(await denied(db, alice, `insert into public.mating_events (org_id, farm_id, dam_id, method, started_on) values ($1, $2, $3, 'hand', '2026-06-01')`,
      [orgA, farmA1, ids.D9])).toMatch(rlsBlocked);
  });

  it('dates and sexes are checked', async () => {
    const r = await check(carol, 'B4', 'D9');
    expect(await mate(carol, 'D9', [{ sire: 'B4', assessmentId: r.assessmentId }], { started: '2099-01-01' }).catch((e) => e.message)).toMatch(/future/);
    expect(await denied(db, carol, `select public.record_mating($1, 'hand', '2026-06-01', null, $2::jsonb)`,
      [ids.B4, JSON.stringify([{ sire_id: ids.B4, assessment_id: r.assessmentId }])])).toMatch(/not a doe/);
  });

  it('pregnancy check: positive marks the doe pregnant; she cannot be mated again until resolved', async () => {
    await as(db, carol, `select public.record_pregnancy_check($1, $2, '2026-07-15', 'ultrasound', 'pregnant', '2026-10-28')`, [ids.D9, lowMating]);
    const d = await as(db, carol, `select status from public.animals where id = $1`, [ids.D9]);
    expect(d.rows[0].status).toBe('pregnant');
    expect((await as(db, carol, `select outcome from public.mating_events where id = $1`, [lowMating])).rows[0].outcome).toBe('pregnant');
    const r = await check(carol, 'B4', 'D9');
    expect(await mate(carol, 'D9', [{ sire: 'B4', assessmentId: r.assessmentId }]).catch((e) => e.message)).toMatch(/recorded as pregnant/);
    expect(await denied(db, carol, `select public.record_pregnancy_check($1, $2, '2026-05-01', 'observation', 'unsure')`, [ids.D9, lowMating])).toMatch(/before the mating/);
    expect(await denied(db, bob, `select public.record_pregnancy_check($1, null, '2026-07-15', 'observation', 'unsure')`, [ids.D9])).toMatch(/not found/);
  });
});

describe('Kidding', () => {
  it('twins from a single-sire mating are registered with dam and sire', async () => {
    const m = (await as(db, carol, `select id from public.mating_events where dam_id = $1`, [ids.D9])).rows[0].id;
    const birth = (await as(db, carol, `select public.register_birth($1, $2, '2026-10-28', $3::jsonb) as id`, [ids.D9, m, JSON.stringify([
      { alive: true, sex: 'male', tag: 'K-001', weight_kg: 3.2 },
      { alive: true, sex: 'female', tag: 'K-002' },
      { alive: false, sex: 'female' },
    ])])).rows[0].id;
    const kids = await as(db, carol, `select a.tag, a.status, a.origin, a.birth_date::text, a.farm_id,
        (select parent_id from public.animal_parentage p where p.child_id = a.id and p.role = 'sire' and p.is_current) as sire,
        (select parent_id from public.animal_parentage p where p.child_id = a.id and p.role = 'dam' and p.is_current) as dam
      from public.animals a where a.tag like 'K-00%' order by a.tag`);
    expect(kids.rows).toEqual([
      { tag: 'K-001', status: 'growing', origin: 'born_on_farm', birth_date: '2026-10-28', farm_id: farmA1, sire: ids.B4, dam: ids.D9 },
      { tag: 'K-002', status: 'growing', origin: 'born_on_farm', birth_date: '2026-10-28', farm_id: farmA1, sire: ids.B4, dam: ids.D9 },
    ]);
    const off = await as(db, carol, `select position, born_alive, birth_weight_kg::float8 as w from public.birth_offspring where birth_id = $1 order by position`, [birth]);
    expect(off.rows).toEqual([{ position: 1, born_alive: true, w: 3.2 }, { position: 2, born_alive: true, w: null }, { position: 3, born_alive: false, w: null }]);
    expect((await as(db, carol, `select status from public.animals where id = $1`, [ids.D9])).rows[0].status).toBe('nursing');
    expect((await as(db, carol, `select outcome from public.mating_events where id = $1`, [m])).rows[0].outcome).toBe('kidded');
    const ev = await as(db, carol, `select summary from public.animal_events where animal_id = $1 and event_type = 'kidding'`, [ids.D9]);
    expect(ev.rows[0].summary).toBe('Kidded: 2 live kids (1 buck, 1 doe), 1 stillborn');
    expect(await denied(db, carol, `select public.register_birth($1, $2, '2026-10-29', '[{"alive":true,"sex":"male","tag":"K-009"}]'::jsonb)`, [ids.D9, m])).toMatch(/already has a kidding/);
  });

  it('kids from a mating with several bucks get candidate sires, and the worst case counts', async () => {
    const m = ids.M_multi!;
    await as(db, carol, `select public.register_birth($1, $2, '2026-10-30', '[{"alive":true,"sex":"female","tag":"K-010"}]'::jsonb)`, [ids.D1, m]);
    const kid = (await as(db, carol, `select id from public.animals where tag = 'K-010'`)).rows[0].id;
    ids['K-010'] = kid;
    const c = await as(db, carol, `select sire_id from public.animal_candidate_sires where child_id = $1 order by sire_id`, [kid]);
    expect(c.rows.map((r) => r.sire_id).sort()).toEqual([ids.B4, ids.B5].sort());
    // B5 x K-010: if B5 is her sire, it's parent-offspring.
    const r = await check(alice, 'B5', 'K-010');
    expect(r.assessment.classification).toMatchObject({ code: 'restricted', possible: true });
    expect(r.assessment.worstCaseCoi?.exact).toBe('1/4');
    // Recording the sire settles it.
    await setParent('K-010', 'sire', 'B4', 'dna');
    expect((await as(db, carol, `select * from public.animal_candidate_sires where child_id = $1`, [kid])).rowCount).toBe(0);
  });

  it('workers cannot register kids on other farms, and live kids need a sex and a tag or name', async () => {
    expect(await denied(db, carol, `select public.register_birth($1, null, '2026-10-01', '[{"alive":true,"sex":"male"}]'::jsonb)`, [ids.D2])).toMatch(/tag or a name/);
    expect(await denied(db, carol, `select public.register_birth($1, null, '2026-10-01', '[{"alive":true,"tag":"Z"}]'::jsonb)`, [ids.D2])).toMatch(/buck or doe/);
    await animal(alice, 'DA', { sex: 'female', farm_id: farmA2 });
    expect(await denied(db, carol, `select public.register_birth($1, null, '2026-10-01', '[{"alive":true,"sex":"male","tag":"Z"}]'::jsonb)`, [ids.DA])).toMatch(/not found/);
    // Vic (vet on the annex) can record kidding there.
    await as(db, vic, `select public.register_birth($1, null, '2026-10-01', '[{"alive":true,"sex":"male","tag":"KA-1"}]'::jsonb)`, [ids.DA]);
  });

  it('tags must stay unique', async () => {
    expect(await denied(db, carol, `select public.register_birth($1, null, '2026-10-01', '[{"alive":true,"sex":"male","tag":"K-001"}]'::jsonb)`, [ids.D3])).toMatch(/animals_org_tag_key|duplicate/);
  });
});

/**
 * M3 herd registry: who can see and record animals, and the pedigree rules
 * the database enforces regardless of what the app sends.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, denied, signUp, startDb, type TestDb, type User } from './db.js';

let db: TestDb;
let alice: User, bob: User, carol: User, dave: User, vic: User;
let orgA: string, orgB: string, farmA1: string, farmA2: string, farmB1: string;

const rlsBlocked = /row-level security|permission denied/;

async function animal(user: User, values: Record<string, unknown>): Promise<string> {
  const cols = Object.keys(values);
  const params = Object.values(values);
  const r = await as(
    db,
    user,
    `insert into public.animals (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    params,
  );
  return r.rows[0].id;
}

const setParent = (user: User, child: string, role: 'sire' | 'dam', parent: string | null, confidence = 'reported') =>
  as(db, user, `select public.set_parent($1, $2, $3, $4) as id`, [child, role, parent, confidence]);

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
  farmB1 = (await as(db, bob, `select id from public.farms where org_id = $1`, [orgB])).rows[0].id;

  for (const [u, role, farm] of [[dave, 'manager', farmA1], [carol, 'worker', farmA1], [vic, 'vet', farmA2]] as const) {
    const token = (await as(db, alice, `select public.create_invitation($1, $2, $3, array[$4]::uuid[]) as t`, [orgA, u.email, role, farm])).rows[0].t;
    await as(db, u, `select public.accept_invitation($1)`, [token]);
  }
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

describe('Reference data', () => {
  it('goat species and shared breeds are readable by any signed-in user', async () => {
    const s = await as(db, carol, `select gestation_days, birth_term from public.species where code = 'goat'`);
    expect(s.rows[0]).toEqual({ gestation_days: 150, birth_term: 'kidding' });
    const b = await as(db, bob, `select count(*)::int as n from public.breeds where org_id is null`);
    expect(b.rows[0].n).toBeGreaterThanOrEqual(10);
  });

  it('owners add custom breeds for their own organization only; workers cannot', async () => {
    await as(db, alice, `insert into public.breeds (org_id, species_code, name) values ($1, 'goat', 'GSF Line A')`, [orgA]);
    expect((await as(db, bob, `select * from public.breeds where name = 'GSF Line A'`)).rowCount).toBe(0);
    expect(await denied(db, carol, `insert into public.breeds (org_id, species_code, name) values ($1, 'goat', 'Worker breed')`, [orgA])).toMatch(rlsBlocked);
  });
});

describe('Registering animals', () => {
  it('a worker can register an animal on an assigned farm, not elsewhere', async () => {
    await animal(carol, { org_id: orgA, farm_id: farmA1, tag: 'W-001', sex: 'female', origin: 'purchased' });
    expect(await denied(db, carol, `insert into public.animals (org_id, farm_id, tag, sex, origin) values ($1, $2, 'W-002', 'female', 'purchased')`, [orgA, farmA2])).toMatch(rlsBlocked);
  });

  it('pedigree-only ancestors need an owner or manager, and are visible org-wide', async () => {
    expect(await denied(db, carol, `insert into public.animals (org_id, name, sex, origin) values ($1, 'Seller sire', 'male', 'pedigree_only')`, [orgA])).toMatch(rlsBlocked);
    await animal(dave, { org_id: orgA, name: 'Papers Sire', sex: 'male', origin: 'pedigree_only' });
    // Vic (vet on the annex) sees pedigree-only records too.
    expect((await as(db, vic, `select * from public.animals where name = 'Papers Sire'`)).rowCount).toBe(1);
  });

  it('a vet sees animals on assigned farms but cannot register them', async () => {
    await animal(alice, { org_id: orgA, farm_id: farmA2, tag: 'ANX-1', sex: 'male', origin: 'purchased' });
    expect((await as(db, vic, `select tag from public.animals where tag = 'ANX-1'`)).rowCount).toBe(1);
    expect((await as(db, vic, `select tag from public.animals where tag = 'W-001'`)).rowCount).toBe(0);
    expect(await denied(db, vic, `insert into public.animals (org_id, farm_id, tag, sex, origin) values ($1, $2, 'V-1', 'male', 'purchased')`, [orgA, farmA2])).toMatch(rlsBlocked);
  });

  it('tags are unique within an organization (ignoring case), not across organizations', async () => {
    expect(await denied(db, alice, `insert into public.animals (org_id, farm_id, tag, sex, origin) values ($1, $2, 'w-001', 'male', 'purchased')`, [orgA, farmA1])).toMatch(/duplicate key|animals_org_tag_key/);
    await animal(bob, { org_id: orgB, farm_id: farmB1, tag: 'W-001', sex: 'male', origin: 'purchased' });
  });

  it('farm animals need a farm; pedigree-only records must not have one', async () => {
    expect(await denied(db, alice, `insert into public.animals (org_id, tag, sex, origin) values ($1, 'NOFARM', 'male', 'purchased')`, [orgA])).toMatch(/check constraint/);
    expect(await denied(db, alice, `insert into public.animals (org_id, farm_id, name, sex, origin) values ($1, $2, 'X', 'male', 'pedigree_only')`, [orgA, farmA1])).toMatch(/check constraint/);
  });

  it('a pen must belong to the animal’s farm', async () => {
    const penA2 = (await as(db, alice, `insert into public.pens (org_id, farm_id, name) values ($1, $2, 'Annex pen') returning id`, [orgA, farmA2])).rows[0].id;
    expect(await denied(db, alice, `insert into public.animals (org_id, farm_id, pen_id, tag, sex, origin) values ($1, $2, $3, 'WRONGPEN', 'male', 'purchased')`, [orgA, farmA1, penA2])).toMatch(/foreign key/);
  });

  it('birth dates cannot be in the future', async () => {
    expect(await denied(db, alice, `insert into public.animals (org_id, farm_id, tag, sex, origin, birth_date) values ($1, $2, 'FUTURE', 'male', 'purchased', current_date + 3)`, [orgA, farmA1])).toMatch(/future/);
  });

  it('only owners and farm managers edit records; workers cannot', async () => {
    expect((await as(db, carol, `update public.animals set name = 'Renamed' where tag = 'W-001' and org_id = $1`, [orgA])).rowCount).toBe(0);
    expect((await as(db, dave, `update public.animals set name = 'Daisy' where tag = 'W-001' and org_id = $1`, [orgA])).rowCount).toBe(1);
    expect(await denied(db, alice, `update public.animals set origin = 'pedigree_only' where tag = 'W-001'`)).toMatch(/permission denied/);
  });

  it('another organization sees and touches none of it', async () => {
    expect((await as(db, bob, `select * from public.animals where org_id = $1`, [orgA])).rowCount).toBe(0);
    expect((await as(db, bob, `update public.animals set name = 'x' where org_id = $1`, [orgA])).rowCount).toBe(0);
    expect(await denied(db, bob, `insert into public.animals (org_id, farm_id, tag, sex, origin) values ($1, $2, 'PLANT', 'male', 'purchased')`, [orgA, farmA1])).toMatch(rlsBlocked);
  });
});

describe('Pedigree rules', () => {
  let grandsire: string, granddam: string, sire: string, dam: string, kid: string, doeKid: string;

  beforeAll(async () => {
    const mk = (tag: string, sex: string, birth: string | null, estimated = false) =>
      animal(alice, { org_id: orgA, farm_id: farmA1, tag, sex, origin: 'purchased', birth_date: birth, birth_date_estimated: estimated });
    grandsire = await mk('P-GS', 'male', '2019-01-10');
    granddam = await mk('P-GD', 'female', '2019-02-10');
    sire = await mk('P-S', 'male', '2021-03-01');
    dam = await mk('P-D', 'female', '2021-04-01');
    kid = await mk('P-K', 'male', '2023-05-01');
    doeKid = await mk('P-K2', 'female', '2023-05-01');
  });

  it('sets parents and records them on both timelines', async () => {
    await setParent(alice, sire, 'sire', grandsire, 'observed');
    await setParent(alice, sire, 'dam', granddam);
    await setParent(alice, kid, 'sire', sire);
    await setParent(alice, kid, 'dam', dam);
    const links = await as(db, alice, `select role, confidence from public.animal_parentage where child_id = $1 and is_current order by role`, [sire]);
    // Enum order: sire before dam.
    expect(links.rows).toEqual([{ role: 'sire', confidence: 'observed' }, { role: 'dam', confidence: 'reported' }]);
    const childEvents = await as(db, alice, `select summary from public.animal_events where animal_id = $1 and event_type = 'parent_set'`, [kid]);
    expect(childEvents.rows.map((r) => r.summary)).toEqual(expect.arrayContaining(['Sire recorded: P-S (reported by previous owner)']));
    const parentEvents = await as(db, alice, `select summary from public.animal_events where animal_id = $1 and event_type = 'offspring'`, [sire]);
    expect(parentEvents.rows.map((r) => r.summary)).toContain('Recorded as sire of P-K');
  });

  it('rejects a female sire, a male dam and self-parenting, with plain messages', async () => {
    expect(await denied(db, alice, `select public.set_parent($1, 'sire', $2)`, [doeKid, dam])).toMatch(/P-D is female, so it cannot be a sire/);
    expect(await denied(db, alice, `select public.set_parent($1, 'dam', $2)`, [doeKid, sire])).toMatch(/P-S is male, so it cannot be a dam/);
    expect(await denied(db, alice, `select public.set_parent($1, 'sire', $1)`, [kid])).toMatch(/own parent|check constraint/);
  });

  it('rejects circular ancestry (a grandson as his grandsire’s sire)', async () => {
    // Give the grandsire an estimated birth date so the birth-order rule doesn't fire first.
    await as(db, alice, `update public.animals set birth_date_estimated = true where id = $1`, [grandsire]);
    expect(await denied(db, alice, `select public.set_parent($1, 'sire', $2)`, [grandsire, kid])).toMatch(/own ancestor/);
    await as(db, alice, `update public.animals set birth_date_estimated = false where id = $1`, [grandsire]);
  });

  it('rejects a parent born after the child when both dates are exact; allows estimates', async () => {
    const late = await animal(alice, { org_id: orgA, farm_id: farmA1, tag: 'P-LATE', sex: 'male', origin: 'purchased', birth_date: '2024-01-01' });
    expect(await denied(db, alice, `select public.set_parent($1, 'sire', $2)`, [doeKid, late])).toMatch(/born on or after/);
    await as(db, alice, `update public.animals set birth_date_estimated = true where id = $1`, [late]);
    await setParent(alice, doeKid, 'sire', late, 'assumed');
    await setParent(alice, doeKid, 'sire', null);
  });

  it('a parent cannot come from another organization', async () => {
    const bobs = (await as(db, bob, `select id from public.animals where org_id = $1 limit 1`, [orgB])).rows[0].id;
    expect(await denied(db, alice, `select public.set_parent($1, 'sire', $2)`, [doeKid, bobs])).toMatch(/foreign key|violates/);
    expect(await denied(db, bob, `select public.set_parent($1, 'sire', $2)`, [doeKid, bobs])).toMatch(/permission/);
  });

  it('workers cannot change parents', async () => {
    expect(await denied(db, carol, `select public.set_parent($1, 'dam', $2)`, [doeKid, dam])).toMatch(/permission/);
  });

  it('changing a parent keeps the old link as history and bumps the pedigree revision', async () => {
    const before = (await as(db, alice, `select revision from public.pedigree_revisions where org_id = $1`, [orgA])).rows[0].revision;
    const other = await animal(alice, { org_id: orgA, name: 'Seller Buck', sex: 'male', origin: 'pedigree_only' });
    await setParent(alice, kid, 'sire', other, 'reported');
    const rows = await as(db, alice, `select parent_id, is_current, ended_at is not null as ended from public.animal_parentage where child_id = $1 and role = 'sire' order by created_at`, [kid]);
    expect(rows.rows).toEqual([
      { parent_id: sire, is_current: false, ended: true },
      { parent_id: other, is_current: true, ended: false },
    ]);
    const after = (await as(db, alice, `select revision from public.pedigree_revisions where org_id = $1`, [orgA])).rows[0].revision;
    expect(BigInt(after)).toBeGreaterThan(BigInt(before));
    // Same parent again only updates confidence; no new history row.
    await setParent(alice, kid, 'sire', other, 'observed');
    const n = (await as(db, alice, `select count(*)::int as n from public.animal_parentage where child_id = $1 and role = 'sire'`, [kid])).rows[0].n;
    expect(n).toBe(2);
  });

  it('editing an animal cannot break links it is part of', async () => {
    // P-GS is still the current sire of P-S; turning it female must fail.
    expect(await denied(db, alice, `update public.animals set sex = 'female' where id = $1`, [grandsire])).toMatch(/cannot be a sire/);
    // P-S is no longer anyone's current sire (replaced in the previous test), so the same edit is allowed.
    await as(db, alice, `update public.animals set sex = 'female' where id = $1`, [sire]);
    await as(db, alice, `update public.animals set sex = 'male' where id = $1`, [sire]);
    // Moving the kid's birth before its dam's must fail.
    expect(await denied(db, alice, `update public.animals set birth_date = '2020-01-01' where id = $1`, [kid])).toMatch(/born on or after/);
  });

  it('two current sires are impossible even with direct inserts', async () => {
    expect(await denied(db, alice, `insert into public.animal_parentage (org_id, child_id, parent_id, role) values ($1, $2, $3, 'sire')`, [orgA, kid, grandsire])).toMatch(/duplicate key|current_key/);
  });

  it('pedigree links of hidden animals stay hidden', async () => {
    expect((await as(db, bob, `select * from public.animal_parentage where org_id = $1`, [orgA])).rowCount).toBe(0);
    expect((await as(db, vic, `select * from public.animal_parentage where child_id = $1`, [kid])).rowCount).toBe(0);
    expect((await as(db, bob, `select * from public.animal_events where org_id = $1`, [orgA])).rowCount).toBe(0);
  });
});

describe('Purchase details and timeline', () => {
  it('purchase price is visible to owners and farm managers, not workers', async () => {
    const id = await animal(alice, { org_id: orgA, farm_id: farmA1, tag: 'BUY-1', sex: 'female', origin: 'purchased', is_declared_founder: true });
    await as(db, alice, `insert into public.animal_acquisitions (animal_id, org_id, acquired_on, source, price, currency_code) values ($1, $2, '2026-10-01', 'Oja Oba market', 85000, 'NGN')`, [id, orgA]);
    expect((await as(db, dave, `select price from public.animal_acquisitions where animal_id = $1`, [id])).rows[0].price).toBe('85000.00');
    expect((await as(db, carol, `select * from public.animal_acquisitions where animal_id = $1`, [id])).rowCount).toBe(0);
    expect(await denied(db, carol, `insert into public.animal_acquisitions (animal_id, org_id, price, currency_code) values ($1, $2, 1, 'NGN')`, [id, orgA])).toMatch(rlsBlocked);
    // An acquisition can't be filed under another organization's id.
    expect(await denied(db, bob, `insert into public.animal_acquisitions (animal_id, org_id, price, currency_code) values ($1, $2, 1, 'NGN')`, [id, orgB])).toMatch(/row-level security|foreign key/);
  });

  it('records registration, status changes and moves on the timeline', async () => {
    const pen = (await as(db, alice, `insert into public.pens (org_id, farm_id, name) values ($1, $2, 'Kidding A') returning id`, [orgA, farmA1])).rows[0].id;
    const id = await animal(alice, { org_id: orgA, farm_id: farmA1, tag: 'TL-1', sex: 'female', origin: 'born_on_farm' });
    await as(db, alice, `update public.animals set status = 'pregnant', pen_id = $2 where id = $1`, [id, pen]);
    const ev = await as(db, carol, `select event_type, summary from public.animal_events where animal_id = $1 order by id`, [id]);
    expect(ev.rows).toEqual([
      { event_type: 'registered', summary: 'Born on the farm and registered' },
      { event_type: 'status', summary: 'Status changed from Active to Pregnant' },
      { event_type: 'moved', summary: 'Moved to Kidding A' },
    ]);
    expect(await denied(db, alice, `insert into public.animal_events (org_id, animal_id, event_type, summary) values ($1, $2, 'x', 'y')`, [orgA, id])).toMatch(/permission denied/);
  });
});

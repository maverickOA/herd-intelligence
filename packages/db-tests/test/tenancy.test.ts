/**
 * M1 exit criterion: a user in organization A cannot read or write any
 * organization B row by id, API call or URL change. Plus role rules,
 * invitations, owner protection, audit and sync columns.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, denied, signUp, startDb, type TestDb, type User } from './db.js';

let db: TestDb;
let alice: User, bob: User, carol: User, dave: User, erin: User, vic: User;
let orgA: string, orgB: string;
let farmA1: string, farmA2: string, farmB1: string;
let penB1: string;

const rlsBlocked = /row-level security|permission denied/;

beforeAll(async () => {
  db = await startDb();
  alice = await signUp(db, 'alice@greensummit.test', 'Alice Owner');
  bob = await signUp(db, 'bob@otherfarm.test', 'Bob Other');
  carol = await signUp(db, 'carol@greensummit.test', 'Carol Worker');
  dave = await signUp(db, 'dave@greensummit.test', 'Dave Manager');
  erin = await signUp(db, 'erin@nowhere.test');
  vic = await signUp(db, 'vic@vets.test', 'Vic Vet');

  orgA = (await as(db, alice, `select public.create_organization('Green Summit Farms', 'Ilorin Main') as id`)).rows[0].id;
  orgB = (await as(db, bob, `select public.create_organization('Other Farm Ltd', 'Other Farm 1') as id`)).rows[0].id;
  farmA1 = (await as(db, alice, `select id from public.farms where org_id = $1`, [orgA])).rows[0].id;
  farmA2 = (await as(db, alice, `insert into public.farms (org_id, name) values ($1, 'Kulende Annex') returning id`, [orgA])).rows[0].id;
  farmB1 = (await as(db, bob, `select id from public.farms where org_id = $1`, [orgB])).rows[0].id;
  penB1 = (await as(db, bob, `insert into public.pens (org_id, farm_id, name) values ($1, $2, 'B pen 1') returning id`, [orgB, farmB1])).rows[0].id;

  // Alice invites Dave (manager, farm A1), Carol (worker, farm A1) and Vic (vet, farm A2).
  for (const [u, role, farm] of [[dave, 'manager', farmA1], [carol, 'worker', farmA1], [vic, 'vet', farmA2]] as const) {
    const token = (await as(db, alice, `select public.create_invitation($1, $2, $3, array[$4]::uuid[]) as t`, [orgA, u.email, role, farm])).rows[0].t;
    await as(db, u, `select public.accept_invitation($1)`, [token]);
  }
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

describe('Creating an organization', () => {
  it('makes the caller its owner and creates the first farm', async () => {
    const r = await as(db, alice, `select role from public.memberships where org_id = $1 and user_id = $2`, [orgA, alice.id]);
    expect(r.rows[0].role).toBe('owner');
    const o = await as(db, alice, `select currency_code, timezone, country_code from public.organizations where id = $1`, [orgA]);
    expect(o.rows[0]).toEqual({ currency_code: 'NGN', timezone: 'Africa/Lagos', country_code: 'NG' });
  });

  it('cannot be done by inserting directly, or by anonymous callers', async () => {
    expect(await denied(db, alice, `insert into public.organizations (name) values ('Sneaky')`)).toMatch(rlsBlocked);
    expect(await denied(db, null, `select public.create_organization('Anon farm')`)).toMatch(/permission denied/);
  });

  it('creates a profile automatically at sign-up', async () => {
    const r = await as(db, alice, `select full_name from public.profiles where id = $1`, [alice.id]);
    expect(r.rows[0].full_name).toBe('Alice Owner');
  });
});

describe('Tenant isolation (org A vs org B)', () => {
  it('Bob sees none of org A, even by exact id', async () => {
    for (const [sql, id] of [
      [`select * from public.organizations where id = $1`, orgA],
      [`select * from public.farms where id = $1`, farmA1],
      [`select * from public.farms where org_id = $1`, orgA],
      [`select * from public.memberships where org_id = $1`, orgA],
      [`select * from public.farm_assignments where org_id = $1`, orgA],
      [`select * from public.pens where org_id = $1`, orgA],
      [`select * from public.invitations where org_id = $1`, orgA],
      [`select * from public.audit_log where org_id = $1`, orgA],
    ] as const) {
      expect((await as(db, bob, sql, [id])).rowCount, sql).toBe(0);
    }
  });

  it('a full table scan by Bob returns only org B rows', async () => {
    const orgs = await as(db, bob, `select id from public.organizations`);
    expect(orgs.rows.map((r) => r.id)).toEqual([orgB]);
    const farms = await as(db, bob, `select org_id from public.farms`);
    expect(farms.rows.every((r) => r.org_id === orgB)).toBe(true);
  });

  it('Bob cannot change org A rows by id (updates silently match nothing)', async () => {
    expect((await as(db, bob, `update public.organizations set name = 'Hacked' where id = $1`, [orgA])).rowCount).toBe(0);
    expect((await as(db, bob, `update public.farms set name = 'Hacked' where id = $1`, [farmA1])).rowCount).toBe(0);
    expect((await as(db, bob, `delete from public.memberships where org_id = $1`, [orgA])).rowCount).toBe(0);
    const name = await as(db, alice, `select name from public.organizations where id = $1`, [orgA]);
    expect(name.rows[0].name).toBe('Green Summit Farms');
  });

  it('Bob cannot create rows inside org A', async () => {
    expect(await denied(db, bob, `insert into public.farms (org_id, name) values ($1, 'Planted farm')`, [orgA])).toMatch(rlsBlocked);
    expect(await denied(db, bob, `insert into public.pens (org_id, farm_id, name) values ($1, $2, 'Planted pen')`, [orgA, farmA1])).toMatch(rlsBlocked);
    expect(await denied(db, bob, `select public.create_invitation($1, 'x@y.test', 'owner')`, [orgA])).toMatch(/Only an owner/);
  });

  it('a pen cannot mix one org id with another org farm, even for an owner', async () => {
    // Bob owns org B but points a pen at Alice's farm: blocked by RLS or by the composite foreign key.
    expect(await denied(db, bob, `insert into public.pens (org_id, farm_id, name) values ($1, $2, 'Mixed')`, [orgB, farmA1])).toMatch(
      /row-level security|foreign key/,
    );
    // Even with full privileges the database refuses the mismatch.
    await expect(
      db.admin.query(`insert into public.pens (org_id, farm_id, name) values ($1, $2, 'Mixed by admin')`, [orgB, farmA1]),
    ).rejects.toThrow(/foreign key/);
  });

  it('Bob cannot move his own pen into org A', async () => {
    expect(await denied(db, bob, `update public.pens set org_id = $1 where id = $2`, [orgA, penB1])).toMatch(/permission denied/);
  });

  it('anonymous callers see nothing at all', async () => {
    for (const t of ['organizations', 'farms', 'pens', 'memberships', 'profiles', 'invitations', 'audit_log']) {
      expect(await denied(db, null, `select * from public.${t}`)).toMatch(/permission denied/);
    }
  });

  it('platform_admins is invisible to clients', async () => {
    expect(await denied(db, alice, `select * from public.platform_admins`)).toMatch(/permission denied/);
  });
});

describe('Roles inside one organization', () => {
  it('worker sees only the assigned farm', async () => {
    const r = await as(db, carol, `select id from public.farms`);
    expect(r.rows.map((x) => x.id)).toEqual([farmA1]);
  });

  it('vet sees only the assigned farm', async () => {
    const r = await as(db, vic, `select id from public.farms`);
    expect(r.rows.map((x) => x.id)).toEqual([farmA2]);
  });

  it('worker cannot create farms or pens, edit farms, or change the organization', async () => {
    expect(await denied(db, carol, `insert into public.farms (org_id, name) values ($1, 'Worker farm')`, [orgA])).toMatch(rlsBlocked);
    expect(await denied(db, carol, `insert into public.pens (org_id, farm_id, name) values ($1, $2, 'Worker pen')`, [orgA, farmA1])).toMatch(rlsBlocked);
    expect((await as(db, carol, `update public.farms set name = 'Renamed' where id = $1`, [farmA1])).rowCount).toBe(0);
    expect((await as(db, carol, `update public.organizations set name = 'Renamed' where id = $1`, [orgA])).rowCount).toBe(0);
  });

  it('worker cannot promote themself', async () => {
    expect((await as(db, carol, `update public.memberships set role = 'owner' where user_id = $1`, [carol.id])).rowCount).toBe(0);
    const r = await as(db, alice, `select role from public.memberships where user_id = $1`, [carol.id]);
    expect(r.rows[0].role).toBe('worker');
  });

  it('manager manages pens on the assigned farm only', async () => {
    const pen = await as(db, dave, `insert into public.pens (org_id, farm_id, name, pen_type) values ($1, $2, 'Kidding pen', 'kidding') returning id`, [orgA, farmA1]);
    expect(pen.rowCount).toBe(1);
    expect(await denied(db, dave, `insert into public.pens (org_id, farm_id, name) values ($1, $2, 'Annex pen')`, [orgA, farmA2])).toMatch(rlsBlocked);
    expect((await as(db, dave, `update public.farms set address = 'Kulende, Ilorin' where id = $1`, [farmA1])).rowCount).toBe(1);
    expect((await as(db, dave, `update public.farms set address = 'x' where id = $1`, [farmA2])).rowCount).toBe(0);
  });

  it('manager cannot create farms or assign people', async () => {
    expect(await denied(db, dave, `insert into public.farms (org_id, name) values ($1, 'Manager farm')`, [orgA])).toMatch(rlsBlocked);
    const mid = (await as(db, alice, `select id from public.memberships where user_id = $1`, [carol.id])).rows[0].id;
    expect(
      await denied(db, dave, `insert into public.farm_assignments (org_id, membership_id, farm_id) values ($1, $2, $3)`, [orgA, mid, farmA2]),
    ).toMatch(rlsBlocked);
  });

  it('owner can assign a farm; the worker then sees it', async () => {
    const mid = (await as(db, alice, `select id from public.memberships where user_id = $1`, [carol.id])).rows[0].id;
    await as(db, alice, `insert into public.farm_assignments (org_id, membership_id, farm_id) values ($1, $2, $3)`, [orgA, mid, farmA2]);
    const r = await as(db, carol, `select id from public.farms order by name`);
    expect(r.rowCount).toBe(2);
    await as(db, alice, `delete from public.farm_assignments where membership_id = $1 and farm_id = $2`, [mid, farmA2]);
    expect((await as(db, carol, `select id from public.farms`)).rowCount).toBe(1);
  });

  it('members see teammates’ profiles; outsiders do not', async () => {
    const r = await as(db, carol, `select full_name from public.profiles where id = $1`, [alice.id]);
    expect(r.rows[0].full_name).toBe('Alice Owner');
    expect((await as(db, bob, `select * from public.profiles where id = $1`, [alice.id])).rowCount).toBe(0);
    expect((await as(db, carol, `update public.profiles set full_name = 'X' where id = $1`, [alice.id])).rowCount).toBe(0);
    expect((await as(db, carol, `update public.profiles set phone = '08000000000' where id = $1`, [carol.id])).rowCount).toBe(1);
  });

  it('suspended members lose access immediately', async () => {
    await as(db, alice, `update public.memberships set status = 'suspended' where user_id = $1 and org_id = $2`, [vic.id, orgA]);
    expect((await as(db, vic, `select * from public.farms`)).rowCount).toBe(0);
    expect((await as(db, vic, `select * from public.organizations`)).rowCount).toBe(0);
    await as(db, alice, `update public.memberships set status = 'active' where user_id = $1 and org_id = $2`, [vic.id, orgA]);
    expect((await as(db, vic, `select * from public.farms`)).rowCount).toBe(1);
  });
});

describe('Invitations', () => {
  it('only the invited email can accept, once, before expiry', async () => {
    const token = (await as(db, alice, `select public.create_invitation($1, 'erin@nowhere.test', 'worker', array[$2]::uuid[]) as t`, [orgA, farmA1])).rows[0].t as string;
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    // Wrong person.
    expect(await denied(db, bob, `select public.accept_invitation($1)`, [token])).toMatch(/different email/);
    // Wrong token.
    expect(await denied(db, erin, `select public.accept_invitation('nope')`)).toMatch(/not valid/);
    // Right person.
    const org = (await as(db, erin, `select public.accept_invitation($1) as org`, [token])).rows[0].org;
    expect(org).toBe(orgA);
    expect((await as(db, erin, `select id from public.farms`)).rows.map((r) => r.id)).toEqual([farmA1]);
    // Reuse.
    expect(await denied(db, erin, `select public.accept_invitation($1)`, [token])).toMatch(/not valid/);
  });

  it('expired and revoked invitations fail', async () => {
    const stranger = await signUp(db, 'late@farm.test');
    const t1 = (await as(db, alice, `select public.create_invitation($1, 'late@farm.test', 'worker', array[$2]::uuid[]) as t`, [orgA, farmA1])).rows[0].t;
    await db.admin.query(`update public.invitations set expires_at = now() - interval '1 minute' where email = 'late@farm.test' and accepted_at is null and revoked_at is null`);
    expect(await denied(db, stranger, `select public.accept_invitation($1)`, [t1])).toMatch(/not valid/);

    const t2 = (await as(db, alice, `select public.create_invitation($1, 'late@farm.test', 'worker', array[$2]::uuid[]) as t`, [orgA, farmA1])).rows[0].t;
    await as(db, alice, `update public.invitations set revoked_at = now() where email = 'late@farm.test' and revoked_at is null and accepted_at is null`);
    expect(await denied(db, stranger, `select public.accept_invitation($1)`, [t2])).toMatch(/not valid/);
  });

  it('a new invitation replaces the open one for the same person', async () => {
    const t1 = (await as(db, alice, `select public.create_invitation($1, 'twice@farm.test', 'worker', array[$2]::uuid[]) as t`, [orgA, farmA1])).rows[0].t;
    await as(db, alice, `select public.create_invitation($1, 'twice@farm.test', 'worker', array[$2]::uuid[]) as t`, [orgA, farmA1]);
    const twice = await signUp(db, 'twice@farm.test');
    expect(await denied(db, twice, `select public.accept_invitation($1)`, [t1])).toMatch(/not valid/);
  });

  it('rejects farms from another organization and farm-less staff invitations', async () => {
    expect(await denied(db, alice, `select public.create_invitation($1, 'q@farm.test', 'worker', array[$2]::uuid[])`, [orgA, farmB1])).toMatch(
      /belong to this organization/,
    );
    expect(await denied(db, alice, `select public.create_invitation($1, 'q@farm.test', 'worker')`, [orgA])).toMatch(/at least one farm/);
  });

  it('stores only a hash of the token', async () => {
    const r = await db.admin.query(`select token_hash from public.invitations limit 1`);
    expect(r.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    const log = await db.admin.query(`select count(*)::int as n from public.audit_log where table_name = 'invitations' and (after ? 'token_hash' or before ? 'token_hash')`);
    expect(log.rows[0].n).toBe(0);
  });
});

describe('Owner protection', () => {
  it('the last owner cannot be removed, demoted or leave', async () => {
    expect(await denied(db, alice, `update public.memberships set role = 'manager' where user_id = $1 and org_id = $2`, [alice.id, orgA])).toMatch(
      /at least one active owner/,
    );
    expect(await denied(db, alice, `delete from public.memberships where user_id = $1 and org_id = $2`, [alice.id, orgA])).toMatch(
      /at least one active owner/,
    );
  });

  it('with a second owner, the first can step down', async () => {
    await as(db, alice, `update public.memberships set role = 'owner' where user_id = $1 and org_id = $2`, [dave.id, orgA]);
    await as(db, alice, `update public.memberships set role = 'manager' where user_id = $1 and org_id = $2`, [alice.id, orgA]);
    expect((await as(db, alice, `select role from public.memberships where user_id = $1 and org_id = $2`, [alice.id, orgA])).rows[0].role).toBe('manager');
    // Restore.
    await as(db, dave, `update public.memberships set role = 'owner' where user_id = $1 and org_id = $2`, [alice.id, orgA]);
    await as(db, alice, `update public.memberships set role = 'manager' where user_id = $1 and org_id = $2`, [dave.id, orgA]);
  });

  it('deleting a whole organization (service role) still cascades', async () => {
    const tmp = await signUp(db, 'tmp@farm.test');
    const org = (await as(db, tmp, `select public.create_organization('Temp Org', 'Temp Farm') as id`)).rows[0].id;
    await db.admin.query(`delete from public.organizations where id = $1`, [org]);
    const left = await db.admin.query(`select count(*)::int as n from public.memberships where org_id = $1`, [org]);
    expect(left.rows[0].n).toBe(0);
  });
});

describe('Audit and sync columns', () => {
  it('records who changed what; only owners can read it', async () => {
    await as(db, alice, `update public.farms set name = 'Ilorin Main Farm' where id = $1`, [farmA1]);
    const r = await as(db, alice, `select actor, action, before->>'name' as before, after->>'name' as after from public.audit_log where record_id = $1 and action = 'update' order by id desc limit 1`, [farmA1]);
    expect(r.rows[0]).toEqual({ actor: alice.id, action: 'update', before: 'Ilorin Main', after: 'Ilorin Main Farm' });
    expect((await as(db, carol, `select * from public.audit_log`)).rowCount).toBe(0);
    expect(await denied(db, alice, `insert into public.audit_log (action, table_name) values ('insert', 'farms')`)).toMatch(/permission denied/);
    expect(await denied(db, alice, `delete from public.audit_log`)).toMatch(/permission denied/);
  });

  it('every update bumps version and row_seq', async () => {
    const before = (await as(db, alice, `select version, row_seq from public.farms where id = $1`, [farmA2])).rows[0];
    await as(db, alice, `update public.farms set address = 'Annex road' where id = $1`, [farmA2]);
    const after = (await as(db, alice, `select version, row_seq, updated_by from public.farms where id = $1`, [farmA2])).rows[0];
    expect(after.version).toBe(before.version + 1);
    expect(BigInt(after.row_seq)).toBeGreaterThan(BigInt(before.row_seq));
    expect(after.updated_by).toBe(alice.id);
  });

  it('clients cannot write version, row_seq or audit columns', async () => {
    expect(await denied(db, alice, `update public.farms set version = 99 where id = $1`, [farmA2])).toMatch(/permission denied/);
    expect(await denied(db, alice, `update public.farms set row_seq = 1 where id = $1`, [farmA2])).toMatch(/permission denied/);
    expect(await denied(db, alice, `update public.farms set created_by = $2 where id = $1`, [farmA2, bob.id])).toMatch(/permission denied/);
  });

  it('device-generated ids are accepted (offline-first)', async () => {
    const id = '0192f3c4-5b6a-7c8d-9e0f-1a2b3c4d5e6f';
    const r = await as(db, alice, `insert into public.pens (id, org_id, farm_id, name) values ($1, $2, $3, 'Offline pen') returning id`, [id, orgA, farmA1]);
    expect(r.rows[0].id).toBe(id);
  });
});

describe('Database hygiene', () => {
  it('every public table has RLS enabled', async () => {
    const r = await db.admin.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(r.rows).toEqual([]);
  });

  it('every foreign key column is indexed', async () => {
    const r = await db.admin.query(`
      select conrelid::regclass::text as tbl, a.attname as col
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
         and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])`);
    expect(r.rows).toEqual([]);
  });

  it('no SECURITY DEFINER function in public is executable by anon', async () => {
    const r = await db.admin.query(`
      select p.proname from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.prosecdef
         and has_function_privilege('anon', p.oid, 'execute')`);
    expect(r.rows).toEqual([]);
  });
});

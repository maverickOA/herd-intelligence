/**
 * Test harness: a throwaway Postgres 17 with the Supabase shim and every
 * migration applied, plus helpers to run SQL as a specific signed-in user.
 */
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { chownSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const migrationsDir = join(root, 'supabase', 'migrations');

export interface TestDb {
  admin: pg.Client;
  stop: () => Promise<void>;
}

export interface User {
  id: string;
  email: string;
}

export async function startDb(): Promise<TestDb> {
  const dataDir = join(here, '..', `.pgdata-${process.pid}-${Date.now()}`);
  mkdirSync(dataDir, { recursive: true });
  // When tests run as root (CI containers), Postgres runs as the "postgres" user and must own its data dir.
  if (process.getuid?.() === 0) {
    const uid = Number(execSync('id -u postgres').toString().trim());
    const gid = Number(execSync('id -g postgres').toString().trim());
    chownSync(dataDir, uid, gid);
  }
  const port = 55000 + Math.floor(Math.random() * 5000);
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('herd');
  const admin = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'herd' });
  await admin.connect();

  await admin.query(readFileSync(join(here, '..', 'sql', 'local-supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await admin.query(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }

  return {
    admin,
    stop: async () => {
      await admin.end();
      await server.stop();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Sign up a user the way Supabase Auth would (inserting into auth.users). */
export async function signUp(db: TestDb, email: string, fullName?: string): Promise<User> {
  const id = randomUUID();
  await db.admin.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    email,
    JSON.stringify(fullName ? { full_name: fullName } : {}),
  ]);
  return { id, email };
}

/**
 * Run one statement as a signed-in user (or anon when user is null), exactly as
 * PostgREST does: SET ROLE plus request.jwt.claims, in its own transaction.
 */
export async function as(
  db: TestDb,
  user: User | null,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  const c = db.admin;
  await c.query('begin');
  try {
    await c.query(`set local role ${user ? 'authenticated' : 'anon'}`);
    const claims = user
      ? { sub: user.id, email: user.email, role: 'authenticated' }
      : { role: 'anon' };
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const res = await c.query(sql, params);
    await c.query('commit');
    return res;
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
}

/** Expect a statement to fail; returns the Postgres error message. */
export async function denied(db: TestDb, user: User | null, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await as(db, user, sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`Expected failure but statement succeeded: ${sql}`);
}

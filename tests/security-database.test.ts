import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const tx = "33333333-3333-4333-8333-333333333333";
const session = "44444444-4444-4444-8444-444444444444";
const lease = "55555555-5555-4555-8555-555555555555";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}'),('${other}');`);
  const baseline = (await readFile("supabase/schema.sql", "utf8")).replace('create extension if not exists "pgcrypto";', "");
  await db.exec(baseline);
  for (const file of ["20260609140000_gmail_oauth_tokens.sql", "20260517100000_powens_users_restore.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec(`grant usage on schema public to authenticated,service_role;
    grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
    insert into public.transactions(id,user_id,date,label,category,amount,company) values('${tx}','${owner}','2026-10-11','A','Divers',1,'Bank');
    insert into public.import_sessions(id,user_id,format) values('${session}','${owner}','generic');`);
  for (const file of ["20261011081900_private_integration_secrets.sql", "20261011081906_sync_jobs_and_agent_access.sql", "20261011083434_expense_note_upsert_ownership.sql", "20261011092330_bankin_pilote_snapshots.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
}, 30_000);
afterAll(async () => { await db.close(); });

it("denies secrets and all privileged RPCs to browser roles", async () => {
  for (const role of ["anon","authenticated"]) {
    await db.exec(`set role ${role};`);
    try {
      await expect(db.query("select * from private.gmail_oauth_tokens")).rejects.toThrow();
      await expect(db.query("select * from private.powens_users")).rejects.toThrow();
      await expect(db.query(`select public.integration_secret_read('${owner}','gmail')`)).rejects.toThrow();
      await expect(db.query(`select public.agent_authorize('${"a".repeat(64)}','${lease}')`)).rejects.toThrow();
      await expect(db.query(`select public.integration_job_acquire('${owner}','qonto','${lease}')`)).rejects.toThrow();
    } finally { await db.exec("reset role;"); }
  }
});
it("allows the backend store but rejects plaintext writes", async () => {
  await db.exec("set role service_role;");
  try {
    await expect(db.query(`select public.integration_secret_write('${owner}','gmail','{"refresh_token":"plain"}')`)).rejects.toThrow();
    await db.query(`select public.integration_secret_write('${owner}','gmail','{"refresh_token":"enc:v1:test"}')`);
    const result = await db.query<{ value: { refresh_token: string } }>(`select public.integration_secret_read('${owner}','gmail') as value`);
    expect(result.rows[0].value.refresh_token).toBe("enc:v1:test");
    const absent = await db.query<{ value: unknown }>(`select public.integration_secret_read('${other}','gmail') as value`);
    expect(absent.rows[0].value).toBeNull();
  } finally { await db.exec("reset role;"); }
});
it("denies cross-user transaction and import-session references", async () => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${other}';`);
  try {
    await expect(db.query(`insert into public.expense_notes(user_id,transaction_id,tag) values('${other}','${tx}','note_de_frais')`)).rejects.toThrow();
    await expect(db.query(`insert into public.transactions(user_id,date,label,category,amount,company,import_session_id)
      values('${other}','2026-10-11','A','Divers',1,'Bank','${session}')`)).rejects.toThrow();
  } finally { await db.exec("reset role;"); }
});
it("enforces a single synchronization lease and cooldown", async () => {
  await db.exec("set role service_role;");
  try {
    const claim = () => db.query<{ value: boolean }>(`select public.integration_job_acquire('${owner}','qonto','${lease}') as value`);
    expect((await claim()).rows[0].value).toBe(true);
    expect((await claim()).rows[0].value).not.toBe(true);
    await db.query(`select public.integration_job_release('${owner}','qonto','${lease}')`);
    expect((await claim()).rows[0].value).not.toBe(true);
  } finally { await db.exec("reset role;"); }
});
it("enforces agent expiry, quotas, cooldown, audit and immediate revocation", async () => {
  await db.exec("set role service_role;");
  try {
    const hash = "a".repeat(64);
    const created = await db.query<{ id: string }>(`select public.agent_grant_create('${owner}','test','${hash}') as id`);
    const id = created.rows[0].id;
    const authorize = () => db.query<{ value: { user_id: string } | null }>(`select public.agent_authorize('${hash}','${lease}') as value`);
    expect((await authorize()).rows[0].value?.user_id).toBe(owner);
    expect((await authorize()).rows[0].value).toBeNull();
    await db.exec(`update private.agent_grants set last_used_at=null,used_calls=max_calls where id='${id}';`);
    expect((await authorize()).rows[0].value).toBeNull();
    await db.exec(`update private.agent_grants set last_used_at=null,used_calls=0,expires_at=now()-interval '1 second' where id='${id}';`);
    expect((await authorize()).rows[0].value).toBeNull();
    await db.exec(`update private.agent_grants set expires_at=now()+interval '1 hour' where id='${id}';`);
    await db.query(`select public.agent_grant_revoke('${id}')`);
    expect((await authorize()).rows[0].value).toBeNull();
    const completion = await db.query<{ active: boolean }>(`select public.agent_complete('${id}','${lease}','success') as active`);
    expect(completion.rows[0].active).toBe(false);
    const audit = await db.query<{ outcome: string }>(`select outcome from private.agent_audit where grant_id='${id}'`);
    expect(audit.rows[0].outcome).toBe("revoked");
  } finally { await db.exec("reset role;"); }
});

it("allows repeated owner tag upserts and denies reassignment to another user or transaction", async () => {
  const foreignTx = "66666666-6666-4666-8666-666666666666";
  await db.exec(`insert into public.transactions(id,user_id,date,label,category,amount,company)
    values('${foreignTx}','${other}','2026-10-11','B','Divers',1,'Bank');`);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';`);
  let noteId: string;
  try {
    const upsert = () => db.query<{id:string}>(`insert into public.expense_notes(transaction_id,tag)
      values('${tx}','repas_client') on conflict(user_id,transaction_id,tag)
      do update set tag=excluded.tag returning id;`);
    noteId = (await upsert()).rows[0].id;
    expect((await upsert()).rows[0].id).toBe(noteId);
    await expect(db.query(`update public.expense_notes set user_id='${other}' where id='${noteId}'`)).rejects.toThrow();
    await expect(db.query(`update public.expense_notes set transaction_id='${foreignTx}' where id='${noteId}'`)).rejects.toThrow();
  } finally { await db.exec("reset role;"); }
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${other}';`);
  try {
    const result = await db.query(`update public.expense_notes set tag='note_de_frais' where id='${noteId!}' returning id`);
    expect(result.rows).toEqual([]);
  } finally { await db.exec("reset role;"); }
});

it("isolates Bankin snapshots and denies anonymous reads, cross-owner writes and deletion", async () => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';`);
  try {
    await db.query(`insert into public.bankin_pilote_snapshots(user_id,snapshot) values ('${owner}','{"version":1}')`);
    expect((await db.query(`select * from public.bankin_pilote_snapshots`)).rows).toHaveLength(1);
    await expect(db.query(`insert into public.bankin_pilote_snapshots(user_id,snapshot) values ('${other}','{}')`)).rejects.toThrow();
    await expect(db.query(`update public.bankin_pilote_snapshots set user_id='${other}' where user_id='${owner}'`)).rejects.toThrow();
    await expect(db.query(`delete from public.bankin_pilote_snapshots`)).rejects.toThrow();
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    expect((await db.query(`select * from public.bankin_pilote_snapshots`)).rows).toHaveLength(0);
    expect((await db.query(`update public.bankin_pilote_snapshots set snapshot='{}' where user_id='${owner}' returning user_id`)).rows).toHaveLength(0);
  } finally { await db.exec("reset role;"); }
  await db.exec("set role anon;");
  try { await expect(db.query("select * from public.bankin_pilote_snapshots")).rejects.toThrow(); }
  finally { await db.exec("reset role;"); }
});

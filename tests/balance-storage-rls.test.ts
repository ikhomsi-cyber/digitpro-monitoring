import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('applies the balance migration and enforces owner isolation, mailbox isolation and CAS leases',async()=>{
 const db=new PGlite();const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(await readFile('supabase/migrations/20261101072458_bankin_balance_history.sql','utf8'));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';insert into public.bankin_balance_sync(user_id,gmail_account,mailbox_key,snapshot) values('${owner}','primary','${'a'.repeat(64)}','{}'),('${owner}','secondary','${'b'.repeat(64)}','{}');`);
  expect((await db.query('select * from public.bankin_balance_sync')).rows).toHaveLength(2);
  expect((await db.query(`update public.bankin_balance_sync set revision=1 where gmail_account='primary' and revision=0 returning revision`)).rows).toHaveLength(1);
  expect((await db.query(`update public.bankin_balance_sync set revision=1 where gmail_account='primary' and revision=0 returning revision`)).rows).toHaveLength(0);
  await expect(db.exec(`update public.bankin_balance_sync set user_id='${other}'`)).rejects.toThrow();
  await db.exec(`set request.jwt.claim.sub='${other}';`);expect((await db.query('select * from public.bankin_balance_sync')).rows).toHaveLength(0);
  await expect(db.exec(`insert into public.bankin_balance_sync(user_id,gmail_account,mailbox_key,snapshot) values('${owner}','primary','${'c'.repeat(64)}','{}')`)).rejects.toThrow();
  expect((await db.query('delete from public.bankin_balance_sync returning user_id')).rows).toHaveLength(0);
  await db.exec('reset role;set role anon;');await expect(db.query('select * from public.bankin_balance_sync')).rejects.toThrow();
 }finally{await db.close();}
},30000);

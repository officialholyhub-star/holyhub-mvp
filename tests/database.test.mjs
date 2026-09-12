import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('real SQL migrations enforce ownership, moderation and public visibility', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
  `);
  for (const name of ['001_stage1_foundation.sql', '002_business_discovery.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const admin = '33333333-3333-4333-8333-333333333333';
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, '{}'), ($4, '{}')", [owner, JSON.stringify({ full_name: 'A'.repeat(120), role: 'admin' }), other, admin]);
  await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [admin]);
  async function asUser(user, fn) {
    await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
    try { return await fn(); } finally { await db.exec('reset role'); }
  }
  const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
  const insert = id => rows(`insert into businesses (owner_id,name,category,location,summary,description,website_url,faith_confirmed) values ($1,'Grace Studio','Art & Creators','London','Thoughtful art for your home.','A Christian-owned studio making thoughtful art for your home.','https://example.com',true) returning *`, [id]);
  const current = async () => (await rows('select * from businesses'))[0];
  let business;

  await t.test('signups create bounded profiles and only the customer role', async () => {
    assert.equal((await rows('select full_name from profiles where id=$1', [owner]))[0].full_name.length, 100);
    assert.deepEqual((await rows('select role from user_roles where user_id=$1', [owner])).map(r => r.role), ['customer']);
    assert.equal((await asUser(null, () => rows('select * from profiles'))).length, 0);
    await assert.rejects(asUser(owner, () => db.query("insert into user_roles (user_id,role) values ($1,'admin')", [owner])), /permission denied/i);
    await assert.rejects(asUser(owner, () => db.query("update profiles set account_status='active' where id=$1", [owner])), /permission denied/i);
  });
  await t.test('only owner can submit and one profile per owner is enforced', async () => {
    await assert.rejects(asUser(null, () => insert(owner)), /permission denied/i);
    await assert.rejects(asUser(owner, () => insert(other)), /row-level security/i);
    business = (await asUser(owner, () => insert(owner)))[0];
    assert.equal(business.status, 'pending');
    await assert.rejects(asUser(owner, () => insert(owner)), /duplicate key/i);
  });
  await t.test('pending listings are private and cannot be self-approved', async () => {
    assert.equal((await asUser(null, () => rows('select * from businesses'))).length, 0);
    assert.equal((await asUser(other, () => rows('select * from businesses'))).length, 0);
    assert.equal((await asUser(other, () => rows("update businesses set name='Hijacked' returning id"))).length, 0);
    await assert.rejects(asUser(owner, () => db.exec("update businesses set status='approved'")), /permission denied/i);
    await assert.rejects(asUser(owner, () => db.query("select review_business($1,'approved',$2)", [business.id, business.updated_at])), /Not authorised/i);
    await assert.rejects(asUser(owner, () => db.query('update businesses set owner_id=$1', [other])), /permission denied/i);
  });
  await t.test('admin approval publishes listing and grants lister role', async () => {
    assert.equal((await asUser(admin, () => rows("select review_business($1,'approved',$2) as ok", [business.id, business.updated_at])))[0].ok, true);
    assert.equal((await asUser(null, () => rows('select * from businesses'))).length, 1);
    assert.equal((await rows("select role from user_roles where user_id=$1 and role='lister'", [owner])).length, 1);
  });
  await t.test('owner edits require review again; stale approvals cannot win', async () => {
    const before = await current();
    await asUser(owner, () => db.exec("update businesses set name='Grace Studio Updated'"));
    assert.equal((await current()).status, 'pending');
    assert.equal((await asUser(null, () => rows('select * from businesses'))).length, 0);
    assert.equal((await asUser(admin, () => rows("select review_business($1,'approved',$2) as ok", [before.id, before.updated_at])))[0].ok, false);
  });
  await t.test('rejected listing can be resubmitted even without changing text', async () => {
    let item = await current();
    await asUser(admin, () => rows("select review_business($1,'rejected',$2)", [item.id, item.updated_at]));
    assert.equal((await current()).status, 'rejected');
    await asUser(owner, () => db.exec('update businesses set name=name'));
    item = await current();
    assert.equal(item.status, 'pending');
    await asUser(admin, () => rows("select review_business($1,'approved',$2)", [item.id, item.updated_at]));
  });
  await t.test('suspended businesses vanish; suspended users and admins lose write access', async () => {
    await db.query("update profiles set account_status='suspended' where id=$1", [owner]);
    assert.equal((await asUser(null, () => rows('select * from businesses'))).length, 0);
    assert.equal((await asUser(owner, () => rows("update businesses set name='Blocked' returning id"))).length, 0);
    await db.query("update profiles set account_status='suspended' where id=$1", [admin]);
    const item = await current();
    await assert.rejects(asUser(admin, () => rows("select review_business($1,'approved',$2)", [item.id, item.updated_at])), /Not authorised/i);
  });
});

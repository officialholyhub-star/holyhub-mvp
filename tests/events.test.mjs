import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceDatabase } from './helpers/database.mjs';
import { validateEvent } from '../lib/events.ts';

const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const customer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const values = {name:'Community gathering',organiser:'Local Christian community',location:'London',schedule:'Every first Friday, 7–9pm UK time',description:'A public gathering for Christian creators, local businesses and their community.',website_url:'https://example.com/event'};
const form = (changes = {}) => { const result = new FormData(); for (const [key,value] of Object.entries({...values,...changes})) result.set(key,value); return result; };

test('event validation retains input and rejects missing, oversized or unsafe public details', () => {
  assert.equal(validateEvent(form()).data.website_url, 'https://example.com/event');
  for (const change of [{name:'x'},{organiser:''},{location:'x'},{schedule:'soon'},{description:'short'},{name:'x'.repeat(121)},{website_url:'javascript:alert(1)'},{website_url:'https://user:password@example.com'},{website_url:'http://localhost'},{website_url:'https://example.com/'+'x'.repeat(500)}]) {
    const result = validateEvent(form(change)); assert.ok(result.error); assert.equal(result.data,undefined); assert.ok(result.values);
  }
  assert.equal(validateEvent(form({name:'  Community gathering  '})).data.name,values.name);
});

test('events are empty by default and only active administrators can create or change them', async t => {
  const {db,as}=await marketplaceDatabase();t.after(()=>db.close());
  assert.equal((await as(null,tx=>tx.query('select * from events'))).rows.length,0);
  await db.query("insert into auth.users(id) values($1),($2)",[admin,customer]);
  await db.query("insert into user_roles(user_id,role) values($1,'admin')",[admin]);
  await assert.rejects(as(null,tx=>tx.query('select save_event($1)',[values])),/permission denied/i);
  await assert.rejects(as(customer,tx=>tx.query('select save_event($1)',[values])),/authorised/i);
  await assert.rejects(as(admin,tx=>tx.query("insert into events(name) values('Bypass')")),/permission denied/i);
  await assert.rejects(as(admin,tx=>tx.query('select save_event($1)',[{...values,website_url:'javascript:alert(1)'}])),/check constraint/i);
  await db.query("update profiles set account_status='suspended' where id=$1",[admin]);
  await assert.rejects(as(admin,tx=>tx.query('select save_event($1)',[values])),/authorised/i);
});

test('admin event drafts, publication, stale-review protection, editing and archiving are enforced in SQL', async t => {
  const {db,as}=await marketplaceDatabase();t.after(()=>db.close());
  await db.query('insert into auth.users(id) values($1),($2)',[admin,customer]);
  await db.query("insert into user_roles(user_id,role) values($1,'admin')",[admin]);
  const id=(await as(admin,tx=>tx.query('select save_event($1) as id',[{...values,status:'published'}]))).rows[0].id;
  const get=async()=>(await as(admin,tx=>tx.query('select *,updated_at::text as revision from events where id=$1',[id]))).rows[0];
  const current=await get();assert.equal(current.status,'draft');
  assert.equal((await as(null,tx=>tx.query('select * from events'))).rows.length,0);
  await assert.rejects(as(customer,tx=>tx.query("select set_event_status($1,'published',$2)",[id,current.revision])),/authorised/i);
  await assert.rejects(as(admin,tx=>tx.query("update events set status='published' where id=$1",[id])),/permission denied/i);
  assert.equal((await as(admin,tx=>tx.query("select set_event_status($1,'published',$2) as ok",[id,current.revision]))).rows[0].ok,true);
  assert.equal((await as(null,tx=>tx.query('select * from events'))).rows.length,1);
  assert.equal((await as(admin,tx=>tx.query("select set_event_status($1,'archived',$2) as ok",[id,current.revision]))).rows[0].ok,false);
  const published=await get();
  await assert.rejects(as(admin,tx=>tx.query('select save_event($1)',[{...values,id,expected_updated_at:current.revision,name:'Stale replacement'}])),/changed/i);
  await as(admin,tx=>tx.query('select save_event($1)',[{...values,id,expected_updated_at:published.revision,name:'Updated community gathering'}]));
  assert.equal((await get()).status,'draft');assert.equal((await as(null,tx=>tx.query('select * from events'))).rows.length,0);
  const edited=await get();
  await as(admin,tx=>tx.query("select set_event_status($1,'published',$2)",[id,edited.revision]));
  const republished=await get();
  await as(admin,tx=>tx.query("select set_event_status($1,'archived',$2)",[id,republished.revision]));
  assert.equal((await as(null,tx=>tx.query('select * from events'))).rows.length,0);
  assert.equal((await get()).status,'archived');
  assert.equal((await db.query("select count(*)::int as n from audit_log where entity_id=$1 and actor_id=$2",[id,admin])).rows[0].n,5);
});

test('production readiness requires event row-level security', async t => {
  const {db,as}=await marketplaceDatabase();t.after(()=>db.close());
  const health=async()=>(await as(null,tx=>tx.query('select launch_readiness() as result'))).rows[0].result;
  assert.equal((await health()).schema_version,8);assert.equal((await health()).schema_ready,true);
  await db.exec('alter table public.events disable row level security');
  assert.equal((await health()).schema_ready,false);
});

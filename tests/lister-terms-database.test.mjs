import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const enabled = process.env.HOLYHUB_DISPOSABLE_TERMS_DB === '1';
const migration = fs.readdirSync('supabase/migrations').filter(n => n.endsWith('_bind_lister_terms_acceptance.sql'));
const uid = '11111111-1111-4111-8111-111111111111';
const hash = 'a'.repeat(64);

test('atomic Terms acceptance in a self-created isolated disposable PostgreSQL', { skip: !enabled }, async t => {
  assert.equal(migration.length, 1);
  const container = `holyhub-terms-disposable-${randomUUID()}`;
  const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const sql = source => docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-Atq', '-v', 'ON_ERROR_STOP=1'], source);
  const asLister = source => `begin; set local role authenticated; select set_config('test.uid','${uid}',true); select set_config('test.lister','yes',true); ${source}; commit;`;
  const asyncSql = source => new Promise(resolve => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-Atq', '-v', 'ON_ERROR_STOP=1']);
    let out = '', err = ''; p.stdout.on('data', b => { out += b; }); p.stderr.on('data', b => { err += b; }); p.on('close', code => resolve({ code, out, err })); p.stdin.end(source);
  });
  // Never consume DATABASE_URL, project credentials, existing containers or host volumes.
  docker(['run', '-d', '--rm', '--name', container, '--network', 'none', '--label', 'holyhub.disposable-terms-test=true', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17', 'postgres']);
  try {
    const info = JSON.parse(docker(['inspect', container]))[0];
    assert.equal(info.HostConfig.NetworkMode, 'none'); assert.equal(info.HostConfig.Binds, null);
    assert.equal(info.Config.Labels['holyhub.disposable-terms-test'], 'true');
    for (let i = 0; ; i++) { try { docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break; } catch { if (i > 200) throw new Error('Disposable DB did not start'); await new Promise(r => setTimeout(r, 100)); } }
    sql(`create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function private.has_role(text) returns boolean language sql as $$ select coalesce(current_setting('test.lister',true),'')='yes' $$;
      grant usage on schema auth,private to authenticated;
      create table public.profiles(id uuid primary key); insert into public.profiles values('${uid}');`);
    sql(fs.readFileSync('supabase/migrations/20261017204000_c9_lister_terms_acceptance_gate.sql', 'utf8').split('-- Public/customer reads')[0]);
    sql(fs.readFileSync('supabase/migrations/20261018010000_audit_readiness_hardening.sql', 'utf8').split('-- Public seller/trader details')[0]);
    sql(fs.readFileSync(`supabase/migrations/${migration[0]}`, 'utf8'));
    await t.test('exactly one bound RPC remains; permissions retained', () => {
      assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='accept_current_lister_terms'"), '1');
      assert.equal(sql("select to_regprocedure('public.accept_current_lister_terms(text)') is null"), 't');
      for (const role of ['anon', 'service_role']) assert.equal(sql(`select has_function_privilege('${role}','public.accept_current_lister_terms(text,text,text)','execute')`), 'f');
      assert.equal(sql("select has_function_privilege('authenticated','public.accept_current_lister_terms(text,text,text)','execute')"), 't');
    });
    await t.test('no active version fails closed', () => assert.throws(() => sql(asLister(`select public.accept_current_lister_terms('v1','${hash}')`))));
    // Synthetic contract fixture exists only inside this network-isolated container.
    sql(`insert into public.lister_terms_versions(version,status,content_sha256,activated_at) values('v1','active','${hash}',now())`);
    await t.test('reject mismatched version/hash and nulls without evidence', () => {
      for (const args of [`'v0','${hash}'`, `'v1','${'b'.repeat(64)}'`, `null,'${hash}'`, "'v1',null", `'v1','${hash}',null`]) assert.throws(() => sql(asLister(`select public.accept_current_lister_terms(${args})`)));
      assert.equal(sql('select count(*) from public.lister_terms_acceptances'), '0');
    });
    await t.test('authenticated non-lister and missing user are rejected', () => {
      assert.throws(() => sql(`begin; set local role authenticated; select public.accept_current_lister_terms('v1','${hash}'); commit;`));
      assert.throws(() => sql(`begin; set local role authenticated; select set_config('test.uid','${uid}',true); select public.accept_current_lister_terms('v1','${hash}'); commit;`));
    });
    await t.test('repeated exact acceptance preserves timestamp/hash/source', () => {
      sql(asLister(`select public.accept_current_lister_terms('v1','${hash}')`));
      const before = sql('select row_to_json(a) from public.lister_terms_acceptances a');
      sql(asLister(`select public.accept_current_lister_terms('v1','${hash}')`));
      assert.equal(sql('select row_to_json(a) from public.lister_terms_acceptances a'), before);
      assert.throws(() => sql("update public.lister_terms_versions set content_sha256=repeat('b',64) where version='v1'"));
    });
    await t.test('rotation committed while acceptance waits rejects stale displayed contract', async () => {
      const rotation = asyncSql(`begin; update public.lister_terms_versions set status='retired' where version='v1'; insert into public.lister_terms_versions(version,status,content_sha256,activated_at) values('v2','active',repeat('b',64),now()); select pg_sleep(1); commit;`);
      // Wait for the rotation transaction to hold its write lock, without timing assumptions.
      for (let i = 0; ; i++) {
        if (sql("select exists(select 1 from pg_locks where relation='public.lister_terms_versions'::regclass and mode='RowExclusiveLock' and granted)") === 't') break;
        if (i > 100) throw new Error('Rotation lock not observed'); await new Promise(r => setTimeout(r, 10));
      }
      const acceptance = asyncSql(asLister(`select public.accept_current_lister_terms('v1','${hash}')`));
      assert.equal((await rotation).code, 0);
      const result = await acceptance; assert.notEqual(result.code, 0); assert.match(result.err, /no longer current/);
      assert.equal(sql("select count(*) from public.lister_terms_acceptances where terms_version='v2'"), '0');
    });
    await t.test('acceptance lock prevents retirement until evidence transaction finishes', async () => {
      const acceptance = asyncSql(asLister(`select public.accept_current_lister_terms('v2',repeat('b',64)); select pg_sleep(1)`));
      for (let i = 0; ; i++) {
        if (sql("select exists(select 1 from pg_locks where relation='public.lister_terms_versions'::regclass and mode='ShareLock' and granted)") === 't') break;
        if (i > 100) throw new Error('Acceptance lock not observed'); await new Promise(r => setTimeout(r, 10));
      }
      assert.throws(() => sql("begin; set local lock_timeout='100ms'; update public.lister_terms_versions set status='retired' where version='v2'; commit;"));
      assert.equal((await acceptance).code, 0);
      assert.equal(sql("select count(*) from public.lister_terms_acceptances where terms_version='v2'"), '1');
    });
  } finally { docker(['rm', '-f', container]); }
});

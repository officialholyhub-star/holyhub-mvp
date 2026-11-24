import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const guard = loadTypescript("lib/crm/db/runtime-identity.ts");
const client = fs.readFileSync("lib/crm/db/client.ts","utf8");

test("approved sandbox API role is accepted only with correct environment",()=>{
  assert.doesNotThrow(()=>guard.assertCrmRuntimeIdentity({
    db_environment:"sandbox",db_role:"hh_crm_api_runtime",login_role:"hh_crm_api_runtime",
  },"sandbox"));
});

test("owner, readonly and migrator roles cannot be used as API runtime",()=>{
  for(const role of ["holyhub_crm_owner","hh_crm_readonly_runtime","hh_crm_migrator_runtime","neon_superuser"]){
    assert.throws(()=>guard.assertCrmRuntimeIdentity({
      db_environment:"sandbox",db_role:role,login_role:role,
    },"sandbox"),/unexpected database login role/);
  }
});

test("SET ROLE impersonation and missing login identity are denied",()=>{
  for(const login of [null,undefined,"holyhub_crm_owner","hh_crm_migrator_runtime"]){
    assert.throws(()=>guard.assertCrmRuntimeIdentity({
      db_environment:"sandbox",db_role:"hh_crm_api_runtime",login_role:login,
    },"sandbox"),/unexpected database login role/);
  }
});

test("missing or production environment marker fails closed",()=>{
  for(const marker of [undefined,null,"production","local"]){
    assert.throws(()=>guard.assertCrmRuntimeIdentity({
      db_environment:marker,db_role:"hh_crm_api_runtime",login_role:"hh_crm_api_runtime",
    },"sandbox"),/environment marker/);
  }
});

test("production access is never silently activated by changing the runtime flag",()=>{
  assert.throws(()=>guard.assertCrmRuntimeIdentity({
    db_environment:"production",db_role:"hh_crm_api_runtime",login_role:"hh_crm_api_runtime",
  },"production"),/not activated/);
});

test("CRM verifies database identity from the same query as environment marker",()=>{
  assert.match(client,/assertCrmRuntimeIdentity\(result\.rows\[0\], expected\)/);
  assert.match(client,/current_user::text AS db_role/);
  assert.match(client,/session_user::text AS login_role/);
  assert.match(client,/crm_config\.system_settings/);
  assert.doesNotMatch(client,/NEXT_PUBLIC_|getCrmPool\(\)\.query\(data\.sql/);
});

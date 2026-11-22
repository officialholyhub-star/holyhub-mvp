import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const journal=JSON.parse(fs.readFileSync("db/crm/migrations/meta/_journal.json","utf8"));
const schema=JSON.parse(fs.readFileSync("db/crm/migrations/meta/0001_snapshot.json","utf8"));
const auth=fs.readFileSync("lib/crm/auth.ts","utf8");
const db=fs.readFileSync("lib/crm/db/client.ts","utf8");
const env=fs.readFileSync("lib/crm/env.ts","utf8");
const operator=fs.readFileSync("lib/crm/services/operator.ts","utf8");

test("2B baseline: committed migration files and journal are in stable, verifiable order",()=>{
  const tags=["0000_old_microchip","0001_n18_safety_retention"];
  assert.deepEqual(journal.entries.map(e=>e.tag),tags);
  assert.deepEqual(journal.entries.map(e=>e.idx),[0,1]);
  assert.equal(Object.keys(schema.tables).length,34);
  for(const e of journal.entries){
    const bytes=fs.readFileSync(`db/crm/migrations/${e.tag}.sql`);
    const hash=createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash.length,64);
    assert.ok(Number.isInteger(e.when)&&e.when>0);
  }
});

test("2B security: CRM requires an existing authenticated internal user, never bootstraps identity on read",()=>{
  assert.match(auth,/requireUser\(\)/);
  assert.match(auth,/eq\(internalUsers\.authProvider, "supabase"\)/);
  assert.match(auth,/eq\(internalUsers\.authSubject, user\.id\)/);
  assert.match(auth,/if \(!crmUser \|\| !crmUser\.active\)/);
  assert.doesNotMatch(auth,/\.update\(internalUsers\)|getSandboxAdminAuthSubject|CRM_SANDBOX_ADMIN_AUTH_SUBJECT/);
});

test("2B security: secrets are server-only and the database has a strict sandbox marker",()=>{
  assert.match(db,/assertCrmDatabaseEnvironment/);
  assert.match(db,/crm_config\.system_settings/);
  assert.match(env,/import "server-only"/);
  assert.match(env,/process\.env\.CRM_DATABASE_URL/);
  assert.doesNotMatch(env,/NEXT_PUBLIC_CRM|NEXT_PUBLIC_DATABASE_URL/);
  assert.match(operator,/syntheticOnly\(\)/);
});

test("2B safety: CRM operator code has no sending or generic SQL endpoint",()=>{
  assert.match(operator,/isFictionalRoute/);
  assert.match(operator,/isFictionalOrganisation/);
  assert.doesNotMatch(operator,/sendMail|sendEmail|transport\.send|query\(data\.sql/);
});

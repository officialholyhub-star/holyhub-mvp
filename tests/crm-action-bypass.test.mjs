import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const legacyRoute = fs.readFileSync("app/api/crm/actions/route.ts","utf8");
const operatorRoute = fs.readFileSync("app/api/crm/operate/route.ts","utf8");
const operator = fs.readFileSync("lib/crm/services/operator.ts","utf8");
const parse = loadTypescript("lib/crm/tools/request-contract.ts").parseCrmBoundedRequest;

test("legacy action endpoint goes through authenticated, bounded synthetic-only operator",()=>{
  assert.match(legacyRoute,/requireCrmUser\(\["crm_admin", "crm_operator"\]\)/);
  assert.match(legacyRoute,/parseCrmBoundedRequest\(/);
  assert.match(legacyRoute,/operation: "createAction"/);
  assert.match(legacyRoute,/runOperatorMutation\(/);
  assert.doesNotMatch(legacyRoute,/createCrmAction\(|executeSql|query\(|sendEmail|sendMail/);
});

test("legacy action route cannot accept an actor, unknown email fields or arbitrary commands",()=>{
  for(const data of [
    {relationshipId:"00000000-0000-0000-0000-000000000001",actionType:"reply",title:"Example test",actor:"Alea"},
    {relationshipId:"00000000-0000-0000-0000-000000000001",actionType:"reply",title:"Example test",crmRole:"crm_admin"},
    {relationshipId:"00000000-0000-0000-0000-000000000001",actionType:"reply",title:"Example test",recipient:"real@example.com"},
    {relationshipId:"00000000-0000-0000-0000-000000000001",actionType:"reply",title:"Example test",sql:"INSERT ..."},
  ]) assert.throws(()=>parse({operation:"createAction",data}),/Unrecognised/);
  assert.equal(parse({operation:"createAction",data:{
    relationshipId:"00000000-0000-0000-0000-000000000001",actionType:"reply",title:"Example follow up",
  }}).operation,"createAction");
});

test("new synthetic actions have two awaited audit writes before commit",()=>{
  const creation=operator.slice(operator.indexOf('case "createAction":'),operator.indexOf('case "completeAction":'));
  assert.match(creation,/return withTx\(async c=>\{/);
  assert.match(creation,/INSERT INTO crm\.actions/);
  assert.match(creation,/await audit\(c,"action",String\(row.id\),actor,"record_created"/);
  assert.match(creation,/await activity\(c,actor,"action_created"/);
  assert.ok(creation.indexOf('await audit(c,"action"') < creation.indexOf('await activity(c,actor,"action_created"'));
  assert.match(operator,/await client\.query\("BEGIN"\)/);
  assert.match(operator,/await client\.query\("COMMIT"\)/);
  assert.match(operator,/await client\.query\("ROLLBACK"\)/);
});

test("duplicate action retries remain idempotent and do not generate a second audit",()=>{
  const creation=operator.slice(operator.indexOf('case "createAction":'),operator.indexOf('case "completeAction":'));
  assert.match(creation,/if\(existing\) \{[\s\S]*?return \{\.\.\.existing,replayed:true\};/);
  assert.ok(creation.indexOf("if(existing)") < creation.indexOf('await audit(c,"action"'));
  assert.match(legacyRoute,/status: replayed \? 200 : 201/);
});

test("old and new CRM action API are not direct dispatch or generic SQL endpoints",()=>{
  assert.match(operatorRoute,/runOperatorMutation/);
  assert.doesNotMatch(legacyRoute,/sendEmail|sendMail|bulkSend|scheduleEmail|executeSql/);
  assert.doesNotMatch(operatorRoute,/sendEmail|sendMail|bulkSend|scheduleEmail|executeSql/);
});

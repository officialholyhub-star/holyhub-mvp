import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const policy=loadTypescript("lib/crm/safety/fictional-targets.ts");
const operator=fs.readFileSync("lib/crm/services/operator.ts","utf8");
const actions=fs.readFileSync("lib/crm/services/actions.ts","utf8");
const relationships=fs.readFileSync("lib/crm/services/relationships.ts","utf8");

test("fictional-only entity rules include existing approved synthetic fixtures",()=>{
  assert.equal(policy.isFictionalContactName("Jordan Example"),true);
  assert.equal(policy.isFictionalContactName("Taylor Sample"),true);
  assert.equal(policy.isFictionalContactName("Example New Contact"),true);
  assert.equal(policy.isFictionalContactName("Real Customer"),false);
  assert.equal(policy.isSyntheticOrigin("synthetic"),true);
  assert.equal(policy.isSyntheticOrigin("synthetic_api_test"),true);
  assert.equal(policy.isSyntheticOrigin("n18_synthetic_2a"),true);
  assert.equal(policy.isSyntheticOrigin("gmail"),false);
  assert.equal(policy.isSyntheticOrigin("hubspot"),false);
  assert.equal(policy.isFictionalOrganisationKey("brand.example"),true);
  assert.equal(policy.isFictionalOrganisationKey("brand.co.uk"),false);
});

test("sandbox operator verifies pre-existing targets before editing",()=>{
  assert.match(operator,/case "saveOrganisation":[\s\S]*?if\(id\)await assertFictionalOrganisationRecord\(c,id\)/);
  assert.match(operator,/case "saveContact":[\s\S]*?if\(id\)await assertFictionalContactRecord\(c,id\)/);
  assert.match(operator,/case "saveRoute":[\s\S]*?if\(id\)await assertFictionalRouteRecord\(c,id\)/);
  assert.match(operator,/await assertFictionalRelationshipRecord\(c,relationshipId\)/);
  assert.match(operator,/if\(existing\) \{\s*await assertFictionalActionRecord\(c,String\(existing.id\)\)/);
});

test("sandbox safety controls require fictional target and don't clear live-derived controls",()=>{
  assert.match(operator,/await assertFictionalSafetyRecord\(c,id\)/);
  assert.match(operator,/if\(routeId\)\{\s*await assertFictionalRouteRecord\(c,routeId\)/);
  assert.match(operator,/if\(contactId\)await assertFictionalContactRecord\(c,contactId\)/);
  assert.match(operator,/await assertFictionalActionRecord\(c,id\)/);
});

test("stage transitions and action completion check targets inside the write transaction",()=>{
  assert.match(actions,/syntheticTargetOnly = false/);
  assert.match(actions,/if \(syntheticTargetOnly\) \{[\s\S]*?isSyntheticOrigin\(existing.source\)[\s\S]*?isFictionalOrganisation/);
  assert.match(relationships,/if \(input.source === "n18_synthetic_2a"\) \{[\s\S]*?isFictionalOrganisation/);
  assert.match(operator,/completeCrmAction\(validId\(data.id\)!,actor,true\)/);
});

test("synthetic-target checks do not enable external sends or real-data import",()=>{
  assert.doesNotMatch(operator,/sendMail|sendEmail|bulkSend|importContacts|DELETE FROM crm/);
});

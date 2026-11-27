import assert from "node:assert/strict";
import test from "node:test";
import {loadTypescript} from "./helpers/load-typescript.mjs";
const {assessOutreachFixture: assess}=loadTypescript("lib/crm/safety/outreach-preflight.ts");
const base={route:"person@brand.test",organisationKey:"brand.test",jurisdiction:"UK",subscriber:"corporate",classificationEvidence:"synthetic registered company evidence",legalRoute:"corporate_b2b",legalEvidence:"synthetic lawful basis and PECR record",privacyAndOptOut:"clear",suppressionCoverage:"clear",gmailHistory:"clear",crmHistory:"clear",tallyHistory:"clear",duplicateCheck:"clear",routeHealth:"clear",templateApproval:"clear"};
const control=(change={})=>({status:"active",scopeType:"route",safetyType:"failed_route",channel:"email",purpose:"marketing",routeNormalisedValue:"person@brand.test",organisationKey:null,organisationId:null,contactId:null,...change});
test("fully evidenced corporate fixture passes screening but cannot send",()=>{const r=assess(base,[]);assert.equal(r.screening,"SYNTHETIC_SCREEN_PASS");assert.equal(r.sendAllowed,false);});
test("missing evidence and individual/unknown or international classifications fail closed",()=>{
  for(const change of [{subscriber:"unknown"},{subscriber:"individual"},{jurisdiction:"international"},{jurisdiction:"unknown"},{classificationEvidence:" "},{legalEvidence:""},{organisationKey:""},{route:"person@actual.com"},{route:"bad"}]){
    const r=assess({...base,...change},[]);assert.equal(r.screening,"HOLD");assert.equal(r.sendAllowed,false);
  }
  for(const legalRoute of ["consent","soft_opt_in"])assert.equal(assess({...base,subscriber:"individual",legalRoute},[]).screening,"SYNTHETIC_SCREEN_PASS");
});
test("every unknown or blocked evidence source prevents screening pass",()=>{
  for(const key of ["privacyAndOptOut","suppressionCoverage","gmailHistory","crmHistory","tallyHistory","duplicateCheck","routeHealth","templateApproval"])for(const value of ["unknown","blocked",undefined]){
    assert.equal(assess({...base,[key]:value},[]).screening,"HOLD",key);
  }
  assert.equal(assess(base,null).screening,"HOLD");
});
test("permanent objections and ten failed routes hold, including unlinked routes",()=>{
  const objection=control({safetyType:"marketing_objection",scopeType:"organisation",organisationKey:"brand.test",routeNormalisedValue:null});
  assert.ok(assess(base,[objection]).reasons.includes("marketing_objection"));
  const controls=Array.from({length:10},(_,i)=>control({routeNormalisedValue:"failed"+i+"@brand.test",contactId:i<5?"synthetic-"+i:null}));
  for(let i=0;i<10;i++){const r=assess({...base,route:" FAILED"+i+"@BRAND.TEST "},controls);assert.equal(r.screening,"HOLD");assert.ok(r.reasons.includes("failed_route"));assert.equal(r.sendAllowed,false);}
});
test("a cleared failed route does not override an active objection",()=>{
  const r=assess(base,[control({status:"cleared"}),control({safetyType:"marketing_objection"})]);assert.equal(r.screening,"HOLD");assert.ok(r.reasons.includes("marketing_objection"));
});

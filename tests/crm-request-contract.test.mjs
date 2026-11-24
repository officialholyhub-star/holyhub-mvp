import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const boundary=loadTypescript("lib/crm/tools/request-contract.ts");
const route=fs.readFileSync("app/api/crm/operate/route.ts","utf8");

test("N18 bounded API accepts one named, synthetic CRUD instruction only",()=>{
  const result=boundary.parseCrmBoundedRequest({
    operation:"saveOrganisation",
    data:{name:"Example Sample Clothing",domain:"sample.example",category:"apparel"},
  });
  assert.equal(result.operation,"saveOrganisation");
  assert.equal(result.data.name,"Example Sample Clothing");
});

test("N18 ChatGPT-facing contract rejects bulk sends and arbitrary SQL",()=>{
  for(const operation of ["sendEmail","bulkSend","scheduleEmails","executeSql","deleteSafety","importContacts",""]) {
    assert.throws(()=>boundary.parseCrmBoundedRequest({operation,data:{}}),/not permitted/);
  }
});

test("N18 caller cannot assert an actor, privilege, consent or mailbox in top-level or data",()=>{
  const spoofed=[
    {operation:"createAction",data:{title:"Example follow-up"},actorId:"00000000-0000-0000-0000-000000000001"},
    {operation:"saveOrganisation",data:{name:"Example A",actorInternalUserId:"spoof"}},
    {operation:"saveOrganisation",data:{name:"Example A",email:"real@example.com"}},
    {operation:"saveContact",data:{name:"Example A",crmRole:"crm_admin"}},
    {operation:"applySafety",data:{reason:"test",clearAllSafety:true}},
    {operation:"createAction",data:{title:"Example A",recipients:["real@example.com"]}},
    {operation:"completeAction",data:{id:"00000000-0000-0000-0000-000000000001"},authSubject:"override"},
    {operation:"saveOrganisation",data:{name:"Example A","__proto__":"spoof"}},
  ];
  for(const value of spoofed.slice(0,7)) {
    assert.throws(()=>boundary.parseCrmBoundedRequest(value),/Unrecognised/);
  }
  assert.throws(()=>boundary.parseCrmBoundedRequest(JSON.parse('{"operation":"saveOrganisation","data":{"name":"Example A","__proto__":null}}')),/Unrecognised/);
});

test("N18 reject malformed or multi-step payloads",()=>{
  for(const body of [null,[],{},42, {operation:"saveContact",data:[]},
    {operation:"saveContact",data:null}, {operation:"saveContact",data:{},operations:[]},
    {operation:"saveContact",data:{},metadata:{actor:"Alea"}}]) {
    assert.throws(()=>boundary.parseCrmBoundedRequest(body));
  }
});

test("N18 route always derives actor from verified CRM session, not caller body",()=>{
  assert.match(route,/requireCrmUser\(\["crm_admin","crm_operator"\]\)/);
  assert.match(route,/parseCrmBoundedRequest\(await request\.json\(\)\)/);
  assert.match(route,/runOperatorMutation\(fields\.operation,fields\.data,crmUser\.id,crmUser\.crmRole\)/);
  assert.match(route,/fields\.operation==="clearSafety"&&crmUser\.crmRole!=="crm_admin"/);
  assert.doesNotMatch(route,/fields\.actor|data\.actor|sendMail|sendEmail|dispatch/);
});

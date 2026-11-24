import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

let sessionSubject = "synthetic-operator-a";
let databaseAvailable = true;
let databaseReads = 0;
const internalUsers = {
  authProvider: "authProvider",
  authSubject: "authSubject",
};
const roster = [
  {id:"synthetic-crm-user-a",displayName:"Example Operator A",authProvider:"supabase",
    authSubject:"synthetic-operator-a",crmRole:"crm_operator",active:true},
  {id:"synthetic-crm-user-b",displayName:"Example Viewer B",authProvider:"supabase",
    authSubject:"synthetic-operator-b",crmRole:"crm_viewer",active:true},
  {id:"synthetic-crm-user-inactive",displayName:"Example Inactive C",authProvider:"supabase",
    authSubject:"synthetic-operator-c",crmRole:"crm_admin",active:false},
  {id:"synthetic-crm-user-unbound",displayName:"Example Unbound D",authProvider:"supabase",
    authSubject:null,crmRole:"crm_admin",active:true},
];
const mockDb = {
  select(){
    databaseReads++;
    return {
      from(table){
        assert.equal(table,internalUsers);
        return {
          where(predicate){
            const vals=Object.fromEntries(predicate.clauses.map(x=>[x.column,x.value]));
            return {
              async limit(n){
                assert.equal(n,1);
                const record=roster.find(u=>u.authProvider===vals.authProvider&&u.authSubject===vals.authSubject);
                return record?[record]:[];
              },
            };
          },
        };
      },
    };
  },
};
const auth = loadTypescript("lib/crm/auth.ts",{
  "drizzle-orm":{
    eq:(column,value)=>({column,value}),
    and:(...clauses)=>({clauses}),
  },
  "@/lib/auth/require-user":{
    requireUser:async()=>{
      if(!sessionSubject) throw new Error("No verified Supabase session");
      return {user:{id:sessionSubject}};
    },
  },
  "@/lib/crm/db/client":{
    assertCrmDatabaseEnvironment:async()=>{
      if(!databaseAvailable) throw new Error("Unverified CRM database runtime");
    },
    getCrmDb:()=>mockDb,
  },
  "@/lib/crm/db/schema":{internalUsers},
});

function reset(subject){
  sessionSubject=subject;
  databaseAvailable=true;
  databaseReads=0;
}

test("synthetic operator A is bound only to A's verified session subject",async()=>{
  reset("synthetic-operator-a");
  const result=await auth.requireCrmUser(["crm_operator"]);
  assert.equal(result.user.id,"synthetic-operator-a");
  assert.equal(result.crmUser.id,"synthetic-crm-user-a");
  assert.equal(result.crmUser.crmRole,"crm_operator");
  assert.equal(databaseReads,1);
});

test("synthetic viewer B cannot inherit operator A's write role",async()=>{
  reset("synthetic-operator-b");
  await assert.rejects(auth.requireCrmUser(["crm_operator"]),(err)=>{
    assert.equal(err.name,"CrmAuthorizationError");
    assert.match(err.message,/role does not permit/);
    return true;
  });
  const read=await auth.requireCrmUser(["crm_viewer"]);
  assert.equal(read.crmUser.id,"synthetic-crm-user-b");
  assert.equal(read.user.id,"synthetic-operator-b");
});

test("unregistered and inactive synthetic sessions are denied",async()=>{
  reset("synthetic-unknown-user");
  await assert.rejects(auth.requireCrmUser(["crm_admin","crm_operator","crm_viewer"]),/not authorised/);
  reset("synthetic-operator-c");
  await assert.rejects(auth.requireCrmUser(["crm_admin"]),/not authorised/);
});

test("a staff record with no Supabase subject cannot be used by another session",async()=>{
  reset("synthetic-operator-d");
  await assert.rejects(auth.requireCrmUser(["crm_admin"]),/not authorised/);
});

test("missing verified session and unverified database environment fail closed",async()=>{
  reset(null);
  await assert.rejects(auth.requireCrmUser(["crm_operator"]),/No verified Supabase session/);
  assert.equal(databaseReads,0);
  reset("synthetic-operator-a");
  databaseAvailable=false;
  await assert.rejects(auth.requireCrmUser(["crm_operator"]),/Unverified CRM database runtime/);
  assert.equal(databaseReads,0);
});

test("CRM source only reads its existing staff binding; it never creates one on login",()=>{
  const source=fs.readFileSync("lib/crm/auth.ts","utf8");
  assert.match(source,/eq\(internalUsers\.authProvider, "supabase"\)/);
  assert.match(source,/eq\(internalUsers\.authSubject, user\.id\)/);
  assert.doesNotMatch(source,/\.insert\(internalUsers\)|\.update\(internalUsers\)/);
});

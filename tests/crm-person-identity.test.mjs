import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

let sessionSubject = "synthetic-operator-a";
let databaseAvailable = true;
let databaseReads = 0;
let aalCurrent = "aal2";
let aalNext = "aal2";
let mfaNetworkError = null;
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
      return {user:{id:sessionSubject},supabase:{auth:{mfa:{
        getAuthenticatorAssuranceLevel:async()=>({
          data:mfaNetworkError?null:{currentLevel:aalCurrent,nextLevel:aalNext},
          error:mfaNetworkError,
        }),
      }}}};
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
  aalCurrent="aal2";
  aalNext="aal2";
  mfaNetworkError=null;
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

test("unverified MFA, un-enrolled and un-challenged staff are denied before any DB query",async()=>{
  for(const [current,next] of [["aal1","aal1"],["aal1","aal2"],[null,null]]){
    reset("synthetic-operator-a");
    aalCurrent=current;
    aalNext=next;
    await assert.rejects(auth.requireCrmUser(["crm_operator"]),/verified MFA session/);
    assert.equal(databaseReads,0);
  }
});

test("stale AAL2 claims after MFA unenrolment are denied",async()=>{
  reset("synthetic-operator-a");
  aalCurrent="aal2";
  aalNext="aal1";
  await assert.rejects(auth.requireCrmUser(["crm_operator"]),/verified MFA session/);
  assert.equal(databaseReads,0);
});

test("MFA network/provider errors fail closed instead of falling back to login alone",async()=>{
  reset("synthetic-operator-a");
  mfaNetworkError=new Error("MFA provider unavailable");
  await assert.rejects(auth.requireCrmUser(["crm_operator"]),/verified MFA session/);
  assert.equal(databaseReads,0);
});

test("role binding is evaluated only after the validated MFA assurance check",()=>{
  const source=fs.readFileSync("lib/crm/auth.ts","utf8");
  assert.match(source,/supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(source,/aal\.currentLevel !== "aal2" \|\| aal\.nextLevel !== "aal2"/);
  assert.ok(source.indexOf("getAuthenticatorAssuranceLevel()")<source.indexOf("getCrmDb()"));
});

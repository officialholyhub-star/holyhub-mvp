import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';
function fixture({version='2026-10-01T00:00:00Z',race=false,roleError=null,authError=false}={}) {
 const row={id:'app',user_id:'applicant',status:'pending',updated_at:version};const updates=[];const roles=[];
 const admin={from(table){
  if(table==='user_roles')return {upsert:async (values,options)=>{assert.equal(options.ignoreDuplicates,true);assert.equal(options.onConflict,"user_id,role");roles.push(values);return {error:roleError};}};
  assert.equal(table,'lister_applications');const filters=[];let values;
  const execute=()=>{
   if(!values)return {data:{...row},error:null};
   if(race)row.updated_at='2026-10-02T00:00:00Z';
   updates.push({values,filters});
   if(!filters.every(([key,value])=>row[key]===value))return {data:null,error:null};
   Object.assign(row,values);return {data:{id:row.id},error:null};
  };
  const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},update(next){values=next;return query;},maybeSingle:async()=>execute(),then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}};
  return query;
 }};
 const {reviewListerApplication}=loadTypescript('app/admin/applications/actions.ts',{
  'next/navigation':{redirect:path=>{throw new Error(path);}},'next/cache':{revalidatePath(){}},
  '@/lib/auth/require-user':{requireRole:async role=>{assert.equal(role,'admin');if(authError)throw new Error('Admin required');}},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
 });
 return {review:reviewListerApplication,row,updates,roles};
}
function form(decision='approve',version='2026-10-01T00:00:00Z') {
 const data=new FormData();for(const [key,value] of Object.entries({application_id:'app',application_version:version,decision,rejection_reason:'More detail please'}))data.set(key,value);return data;
}
test('current application can still be approved and granted the lister role',async()=>{
 const f=fixture();await assert.rejects(f.review(form()),/Application%20approved/);assert.equal(f.row.status,'approved');assert.equal(f.roles.length,1);assert.equal(f.roles[0].user_id,'applicant');assert.equal(f.roles[0].role,'lister');
 assert.ok(f.updates[0].filters.some(([key,value])=>key==='updated_at'&&value==='2026-10-01T00:00:00Z'));
});
test('current application can still be returned for changes without granting access',async()=>{
 const f=fixture();await assert.rejects(f.review(form('reject')),/returned%20for%20changes/);assert.equal(f.row.status,'rejected');assert.equal(f.row.rejection_reason,'More detail please');assert.equal(f.roles.length,0);
});
test('stale admin page cannot approve or reject edited details',async()=>{
 for(const decision of ['approve','reject']){const f=fixture({version:'2026-10-02T00:00:00Z'});await assert.rejects(f.review(form(decision)),/application%20has%20changed/);assert.equal(f.updates.length,0);assert.equal(f.roles.length,0);assert.equal(f.row.status,'pending');}
});
test('an edit racing the review update cannot grant a role or overwrite pending details',async()=>{
 const f=fixture({race:true});await assert.rejects(f.review(form()),/changed%20during%20review/);assert.equal(f.row.status,'pending');assert.equal(f.roles.length,0);
});
test('failed role grant retains the existing approval rollback flow',async()=>{
 const f=fixture({roleError:{code:'failure'}});await assert.rejects(f.review(form()),/access could not be granted/);assert.equal(f.row.status,'pending');assert.equal(f.updates.length,2);
 assert.ok(f.updates[1].filters.some(([key,value])=>key==='status'&&value==='approved'));
});
test('missing version and non-admin requests cannot review applications',async()=>{
 const f=fixture();await assert.rejects(f.review(form('approve','')),/could not be completed/);assert.equal(f.updates.length,0);
 const denied=fixture({authError:true});await assert.rejects(denied.review(form()),/Admin required/);assert.equal(denied.roles.length,0);
});

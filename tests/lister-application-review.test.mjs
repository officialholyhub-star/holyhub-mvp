import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';

const legalProfile = (extra = {}) => ({
  user_id: 'applicant', legal_name: 'Fixture Seller', entity_type: 'sole_trader',
  address_line1: '1 Test Road', address_line2: null, city: 'London', postcode: 'E1 1AA', country: 'GB',
  service_address_line1: null, service_address_line2: null, service_address_city: null, service_address_postcode: null, service_address_country: null,
  contact_email: 'seller@example.test', contact_phone: null,
  registration_number: null, registration_jurisdiction: null, registered_office_line1: null, registered_office_line2: null,
  registered_office_city: null, registered_office_postcode: null, registered_office_country: null, vat_number: null,
  verification_status: 'pending', verification_note: null, verified_at: null, verified_by: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...extra,
});

function fixture({version='2026-10-01T00:00:00Z',race=false,roleError=null,authError=false,legal=legalProfile()}={}) {
  const row={id:'app',user_id:'applicant',status:'pending',updated_at:version};
  const seller={...legal}; const updates=[]; const roles=[]; const legalUpdates=[];
  function rowBuilder(target, table) {
    const filters=[]; let values; let operation='read';
    const execute=()=>{
      if (operation==='read') return {data:{...target},error:null};
      if (table==='lister_applications' && race && updates.length===0) row.updated_at='2026-10-02T00:00:00Z';
      const matches=filters.every(([key,value])=>target[key]===value);
      if (table==='lister_applications') updates.push({values,filters}); else legalUpdates.push({values,filters});
      if (!matches) return {data:null,error:null};
      Object.assign(target,values); return {data:{id:target.id,user_id:target.user_id},error:null};
    };
    const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},update(next){values=next;operation='update';return query;},maybeSingle:async()=>execute(),then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}};
    return query;
  }
  const admin={from(table){
    if(table==='user_roles') return {upsert:async (values,options)=>{assert.equal(options.ignoreDuplicates,true);assert.equal(options.onConflict,'user_id,role');roles.push(values);return {error:roleError};}};
    if(table==='lister_applications') return rowBuilder(row,table);
    if(table==='seller_legal_profiles') return rowBuilder(seller,table);
    throw new Error(`Unexpected table ${table}`);
  }};
  const {reviewListerApplication}=loadTypescript('app/admin/applications/actions.ts',{
    'next/navigation':{redirect:path=>{throw new Error(path);}},'next/cache':{revalidatePath(){}},
    '@/lib/auth/require-user':{requireRole:async role=>{assert.equal(role,'admin');if(authError)throw new Error('Admin required');return {user:{id:'admin'}};}},
    '@/lib/supabase/admin':{createAdminClient:()=>admin},
  });
  return {review:reviewListerApplication,row,seller,updates,roles,legalUpdates};
}
function form(decision='approve',version='2026-10-01T00:00:00Z',note='Independent seller identity checks completed') {
  const data=new FormData();
  for(const [key,value] of Object.entries({application_id:'app',application_version:version,decision,rejection_reason:'More detail please',verification_note:note})) data.set(key,value);
  return data;
}

test('current application can be approved, verified with evidence and granted the lister role',async()=>{
  const f=fixture(); await assert.rejects(f.review(form()),/Application%20approved/);
  assert.equal(f.row.status,'approved'); assert.equal(f.seller.verification_status,'verified');
  assert.equal(f.seller.verification_note,'Independent seller identity checks completed'); assert.equal(f.seller.verified_by,'admin');
  assert.equal(f.roles.length,1); assert.equal(f.roles[0].user_id,'applicant'); assert.equal(f.roles[0].role,'lister');
  assert.ok(f.updates[0].filters.some(([key,value])=>key==='updated_at'&&value==='2026-10-01T00:00:00Z'));
});
test('approval requires recorded verification evidence',async()=>{
  const f=fixture(); await assert.rejects(f.review(form('approve',undefined,'short')),/Record%20the%20verification%20evidence/);
  assert.equal(f.row.status,'pending'); assert.equal(f.roles.length,0); assert.equal(f.legalUpdates.length,0);
});
test('current application can still be returned for changes without granting access',async()=>{
  const f=fixture(); await assert.rejects(f.review(form('reject')),/returned%20for%20changes/);
  assert.equal(f.row.status,'rejected'); assert.equal(f.row.rejection_reason,'More detail please'); assert.equal(f.roles.length,0); assert.equal(f.seller.verification_status,'rejected');
});
test('stale admin page cannot approve or reject edited details',async()=>{
  for(const decision of ['approve','reject']){const f=fixture({version:'2026-10-02T00:00:00Z'});await assert.rejects(f.review(form(decision)),/application%20has%20changed/);assert.equal(f.updates.length,0);assert.equal(f.roles.length,0);assert.equal(f.row.status,'pending');}
});
test('an edit racing the review update cannot grant a role or overwrite pending details',async()=>{
  const f=fixture({race:true}); await assert.rejects(f.review(form()),/changed%20during%20review/); assert.equal(f.row.status,'pending'); assert.equal(f.roles.length,0);
});
test('failed role grant retains the existing approval rollback flow',async()=>{
  const f=fixture({roleError:{code:'failure'}}); await assert.rejects(f.review(form()),/access could not be granted/); assert.equal(f.row.status,'pending'); assert.equal(f.updates.length,2);
  assert.ok(f.updates[1].filters.some(([key,value])=>key==='status'&&value==='approved'));
  assert.equal(f.seller.verification_status,'pending');
});
test('missing version and non-admin requests cannot review applications',async()=>{
  const f=fixture(); await assert.rejects(f.review(form('approve','')),/could not be completed/); assert.equal(f.updates.length,0);
  const denied=fixture({authError:true}); await assert.rejects(denied.review(form()),/Admin required/); assert.equal(denied.roles.length,0);
});

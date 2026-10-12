import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTypescript } from './helpers/load-typescript.mjs';
const require = createRequire(import.meta.url);
const categories = ['Apparel','Bookmarks','Gifts','Books','Jewellery','Home & Living','Arts'];
const saved = (status='rejected', extra={}) => ({id:'existing',user_id:'fixture',business_name:'Saved brand',contact_name:'Saved contact',email:'saved@example.test',website_or_social:'@savedbrand',description:'Saved description',category_type:'Books',status,rejection_reason:'Please improve the description',reviewed_at:'2026-10-01T00:00:00Z',created_at:'2026-09-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z',...extra});
function fixture({applications=[],readError=null,saveError=null,race=false}={}) {
 const rows=applications.map(row=>({...row})); const inserts=[]; const updates=[]; const queries=[]; let adminCalls=0;
 function builder(privileged=false) {
  const filters=[]; let values; let descending=false; let limit; let operation='read';
  const query={
   select(){return query;},eq(key,value){filters.push([key,value]);return query;},in(key,values){filters.push([key,values]);return query;},
   order(){descending=true;return query;},limit(value){limit=value;return query;},
   insert(values){assert.equal(privileged,false);inserts.push(values);if(!saveError)rows.push(saved('pending',{...values,id:'new'}));return Promise.resolve({error:saveError});},
   update(next){assert.equal(privileged,true);values=next;operation='update';return query;},
   async maybeSingle(){
    queries.push({operation,filters});
    if(operation==='read' && readError)return {data:null,error:readError};
    if(operation==='update' && race)rows[0].status='approved';
    let found=rows.filter(row=>filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));
    if(descending)found.sort((a,b)=>b.created_at.localeCompare(a.created_at));
    if(limit)found=found.slice(0,limit);
    if(operation==='update') {
     updates.push({values,filters});
     if(saveError)return {data:null,error:saveError};
     found.forEach(row=>Object.assign(row,values));
    }
    return {data:found[0]?{...found[0]}:null,error:null};
   },
  }; return query;
 }
 const supabase={from:table=>{assert.equal(table,'lister_applications');return builder();}};
 const dependencies={
  'next/navigation':{redirect:path=>{throw new Error(path);}},
  'next/cache':{revalidatePath(){}},
  '@/lib/auth/require-user':{requireUser:async()=>({user:{id:'fixture'},supabase})},
  '@/lib/supabase/admin':{createAdminClient:()=>{adminCalls++;return {from:table=>{assert.equal(table,'lister_applications');return builder(true);}};}},
 };
 const {submitListerApplication}=loadTypescript('app/lister/apply/actions.ts',dependencies);
 return {rows,inserts,updates,queries,supabase,submit:submitListerApplication,adminCalls:()=>adminCalls};
}
function form(category='Books', application) {
 const data=new FormData();
 for(const [key,value] of Object.entries({business_name:'Updated brand',contact_name:'Alex',email:'alex@example.test',description:'Updated description',category_type:category,accept_lister_terms:'on'}))data.set(key,value);
 if(application){data.set('application_id',application.id);data.set('application_version',application.updated_at);}
 return data;
}
function loadComponent(file, dependencies) {
 const exports={};
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>name in dependencies?dependencies[name]:require(name)});
 return exports;
}
async function renderApplication(application, readError, params={}) {
 const f=fixture({applications:application?[application]:[],readError});
 const dependencies={
  '@/components/draft-form':{DraftForm:'form',ClearDraft:()=>null},
  'next/link':{default:props=>React.createElement('a',props),__esModule:true},
  '@/lib/auth/require-user':{requireUser:async()=>({user:{id:'fixture',email:'alex@example.test'},supabase:{from:table=>table==='profiles'?{select(){return this;},eq(){return this;},single:async()=>({data:{full_name:'Alex'}})}:f.supabase.from(table)}})},
  '@/lib/product-categories':loadTypescript('lib/product-categories.ts'),
  '@/lib/lister-applications':loadTypescript('lib/lister-applications.ts'),
  '@/components/application-category-field':loadComponent('components/application-category-field.tsx',{'@/components/draft-form':{FormRecovery:()=>null},'@/lib/form-drafts':{readDraft:()=>null},'@/lib/product-categories':loadTypescript('lib/product-categories.ts'),'@/lib/application-categories':loadTypescript('lib/application-categories.ts')}),
  './actions':{submitListerApplication:async()=>{}},
 };
 const exports={};
 const source=ts.transpileModule(readFileSync('app/lister/apply/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>name in dependencies?dependencies[name]:require(name)});
 return renderToStaticMarkup(await exports.default({searchParams:Promise.resolve(params)}));
}
test('new/rejected applications render the exact dropdown and rejected details are prefilled',async()=>{
 for(const application of [null,saved()]) {
  const html=await renderApplication(application);
  const select=html.match(/<select[^>]*name="category_type"[\s\S]*?<\/select>/)?.[0];
  assert.ok(select);assert.doesNotMatch(html,/<input[^>]*name="category_type"/);
  assert.deepEqual([...select.matchAll(/<option[^>]*value="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&')),[...categories,'__other__']);
  assert.match(html,/Website or social media link \(optional\)/);
  if(application){assert.match(html,/value="Saved brand"/);assert.match(html,/Saved description/);assert.match(html,/Save &amp; resubmit application/);assert.match(html,/name="application_version"/);}
 }
});
test('pending/approved applications show saved details without edit or submit controls',async()=>{
 for(const status of ['pending','approved']) {
  const html=await renderApplication(saved(status));
  assert.doesNotMatch(html,/<form|name="category_type"/);assert.match(html,/Your saved application/);assert.match(html,/Saved brand/);
 }
});
test('legacy rejected category is preserved and optional missing link displays blank',async()=>{
 const html=await renderApplication(saved('rejected',{category_type:'clothes',website_or_social:'Not provided'}));
 assert.match(html,/<option value="clothes" selected="">clothes \(current category\)<\/option>/);
 assert.match(html,/name="website_or_social"[^>]*value=""/);
});
test('lookup errors never render a new application form',async()=>{assert.doesNotMatch(await renderApplication(null,{code:'503'}),/<form/);});
test('new submissions accept fixed categories and leave links optional',async()=>{
 for(const category of categories){const f=fixture();await assert.rejects(f.submit(form(category)),/submitted%20for%20review/);assert.equal(f.inserts[0].category_type,category);assert.equal(f.adminCalls(),0);}
 for(const category of ['','clothes','Art','marketing']){const f=fixture();await assert.rejects(f.submit(form(category)),/Complete%20the%20description/);assert.equal(f.inserts.length,0);}
});
test('rejected application is updated in place, reset to pending and cannot be submitted twice',async()=>{
 const application=saved();const f=fixture({applications:[application]});
 await assert.rejects(f.submit(form('Arts',application)),/resubmitted%20for%20review/);
 assert.equal(f.inserts.length,0);assert.equal(f.rows.length,1);assert.equal(f.rows[0].id,application.id);assert.equal(f.rows[0].created_at,application.created_at);
 assert.equal(f.rows[0].status,'pending');assert.equal(f.rows[0].reviewed_at,null);assert.equal(f.rows[0].rejection_reason,null);assert.equal(f.rows[0].description,'Updated description');
 for(const [key,value] of [['id',application.id],['user_id','fixture'],['status','rejected'],['updated_at',application.updated_at]])assert.ok(f.updates[0].filters.some(filter=>filter[0]===key && filter[1]===value));
 await assert.rejects(f.submit(form('Books',application)),/Refresh%20this%20page/);assert.equal(f.updates.length,1);
});
test('approved applications remain locked, even with forged form values',async()=>{
 const f=fixture({applications:[saved('approved')]});await assert.rejects(f.submit(form('Arts',saved())),/already%20been%20approved/);assert.equal(f.adminCalls(),0);assert.equal(f.inserts.length,0);assert.equal(f.updates.length,0);
});
test('pending applications have an edit button and a prefilled edit form',async()=>{
 const view=await renderApplication(saved('pending'));assert.match(view,/href="\/lister\/apply\?edit=1"[^>]*>Edit application/);
 const edit=await renderApplication(saved('pending'),null,{edit:'1'});assert.match(edit,/<form/);assert.match(edit,/value="Saved brand"/);assert.match(edit,/>Save changes<\/button>/);assert.match(edit,/name="application_version"/);
 const approved=await renderApplication(saved('approved'),null,{edit:'1'});assert.doesNotMatch(approved,/<form|Edit application/);
});
test('pending edits update the same record and remain under review',async()=>{
 const application=saved('pending');const f=fixture({applications:[application]});await assert.rejects(f.submit(form('Arts',application)),/changes%20have%20been%20saved/);
 assert.equal(f.inserts.length,0);assert.equal(f.rows.length,1);assert.equal(f.rows[0].id,application.id);assert.equal(f.rows[0].created_at,application.created_at);assert.equal(f.rows[0].status,'pending');assert.equal(f.rows[0].category_type,'Arts');assert.ok(f.rows[0].updated_at!==application.updated_at);
 assert.ok(f.updates[0].filters.some(([key,value])=>key==='status'&&value==='pending'));
 await assert.rejects(f.submit(form('Books',application)),/Refresh%20this%20page/);assert.equal(f.updates.length,1);
});
test('active applications take priority over historical rejected records',async()=>{
 const f=fixture({applications:[saved('approved'),saved('rejected',{id:'newer',created_at:'2026-10-01T00:00:00Z'})]});await assert.rejects(f.submit(form()),/already%20been%20approved/);assert.equal(f.inserts.length,0);
});
test('stale or foreign application ids and versions never trigger privileged updates',async()=>{
 for(const application of [saved('rejected',{id:'foreign'}),saved('rejected',{updated_at:'old'}),undefined]){const f=fixture({applications:[saved()]});await assert.rejects(f.submit(form('Books',application)),/Refresh%20this%20page/);assert.equal(f.adminCalls(),0);assert.equal(f.inserts.length,0);}
});
test('saved legacy category can be retained, but another arbitrary category cannot be substituted',async()=>{
 const application=saved('rejected',{category_type:'clothes'});const f=fixture({applications:[application]});await assert.rejects(f.submit(form('marketing',application)),/Complete%20the%20description/);await assert.rejects(f.submit(form('clothes',application)),/resubmitted%20for%20review/);
});
test('concurrent review or failed reads never cause duplicate inserts or false success',async()=>{
 const application=saved();const raced=fixture({applications:[application],race:true});await assert.rejects(raced.submit(form('Books',application)),/changed%20during%20submission/);assert.equal(raced.rows[0].status,'approved');assert.equal(raced.inserts.length,0);
 const failed=fixture({readError:{code:'503'}});await assert.rejects(failed.submit(form()),/load%20your%20existing/);assert.equal(failed.adminCalls(),0);assert.equal(failed.inserts.length,0);
 const duplicate=fixture({saveError:{code:'23505'}});await assert.rejects(duplicate.submit(form()),/active%20application%20under%20review/);
});
test('another user’s application cannot be updated or used to create a duplicate',async()=>{
 const application=saved('rejected',{user_id:'other-user'});const f=fixture({applications:[application]});
 await assert.rejects(f.submit(form('Books',application)),/find%20that%20application/);
 assert.equal(f.adminCalls(),0);assert.equal(f.inserts.length,0);assert.equal(f.rows[0].description,application.description);
});
test('authentication is required before lookup or privileged client creation',async()=>{
 const {submitListerApplication}=loadTypescript('app/lister/apply/actions.ts',{
  'next/navigation':{redirect:()=>{}},'next/cache':{revalidatePath(){}},
  '@/lib/auth/require-user':{requireUser:async()=>{throw new Error('Sign in required');}},
  '@/lib/supabase/admin':{createAdminClient:()=>{throw new Error('Must not be called');}},
 });
 await assert.rejects(submitListerApplication(form()),/Sign in required/);
});

test('Other category text is saved and restored for pending and rejected applications',async()=>{
 for(const status of ['pending','rejected']) {
  const application=saved(status);const f=fixture({applications:[application]});const data=form('__other__',application);data.set('suggested_category','  Candles & scents  ');
  await assert.rejects(f.submit(data),status==='pending'?/changes%20have%20been%20saved/:/resubmitted%20for%20review/);
  assert.equal(f.rows[0].category_type,'Other: Candles & scents');assert.equal(f.rows[0].status,'pending');assert.equal(f.inserts.length,0);
  assert.equal(f.rows.length,1);assert.equal(f.rows[0].id,application.id);
  const html=await renderApplication(saved(status,{category_type:f.rows[0].category_type}),null,{edit:'1'});
  assert.match(html,/<option value="__other__" selected="">Other \/ Suggest another category<\/option>/);assert.match(html,/name="suggested_category"[^>]*value="Candles &amp; scents"/);
  const query={select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:f.rows,error:null}),in:async()=>({data:[]})};
  const {default:AdminPage}=loadComponent('app/admin/applications/page.tsx',{
   '@/lib/read-all-rows':loadTypescript('lib/read-all-rows.ts'),
   '@/components/draft-form':{DraftForm:'form',ClearDraft:()=>null},
   './actions':{reviewListerApplication:async()=>{}},
   '@/lib/auth/require-user':{requireRole:async role=>{assert.equal(role,'admin');return {user:{id:'admin-fixture'},supabase:{from:()=>query}};}},
   '@/lib/application-categories':loadTypescript('lib/application-categories.ts'),
   '@/components/account-lister-brand':{AccountListerBrand:()=>null},
   './page.module.css':{default:{},__esModule:true},
   'next/link':{default:props=>React.createElement('a',props),__esModule:true},
  });
  const adminHtml=renderToStaticMarkup(await AdminPage({searchParams:Promise.resolve({})}));
  assert.match(adminHtml,/<dt>Selected category:<\/dt><dd>Other<\/dd>/);
  assert.match(adminHtml,/<dt>Suggested category:<\/dt><dd>Candles &amp; scents<\/dd>/);
 }
});
test('server edit privilege failures are not reported as an applicant permission failure',async()=>{
 const application=saved('pending');const f=fixture({applications:[application],saveError:{code:'42501'}});
 await assert.rejects(f.submit(form('Books',application)),/contact%20HolyHub%20support/);
 assert.equal(f.rows[0].description,application.description);assert.equal(f.inserts.length,0);
 const first=fixture({saveError:{code:'42501'}});
 await assert.rejects(first.submit(form()),/You%20do%20not%20have%20permission/);
});
test('suggestions are validated against the existing category field length',async()=>{
 for(const suggestion of ['', '   ', 'a'.repeat(94), 'bad\ncategory']) {
  const f=fixture();const data=form('__other__');data.set('suggested_category',suggestion);await assert.rejects(f.submit(data),/Complete%20the%20description/);assert.equal(f.inserts.length,0);
 }
 const f=fixture();const data=form('__other__');data.set('suggested_category','a'.repeat(93));await assert.rejects(f.submit(data),/submitted%20for%20review/);assert.equal(f.inserts[0].category_type.length,100);
});

// Real /lister/apply page and category component, with fixture auth/data and no live writes.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTypescript } from './helpers/load-typescript.mjs';
const require=createRequire(import.meta.url);
const browserRequire=createRequire('/tmp/holyhub-ux-browser/package.json');
const {build}=browserRequire('esbuild');const {chromium}=browserRequire('playwright');
const output='/tmp/holyhub-application-browser';mkdirSync(output,{recursive:true});
function loadComponent(file,dependencies) {
 const exports={};const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>name in dependencies?dependencies[name]:require(name)});return exports;
}
const {ApplicationCategoryField}=loadComponent('components/application-category-field.tsx',{'@/lib/product-categories':loadTypescript('lib/product-categories.ts'),'@/lib/application-categories':loadTypescript('lib/application-categories.ts')});
const saved={id:'existing',business_name:'Saved brand',contact_name:'Alex',email:'alex@example.test',description:'Saved description',category_type:'Books',website_or_social:'@brand',status:'pending',updated_at:'2026-10-01T00:00:00Z',rejection_reason:'Add more details'};
let application=saved;
const {default:Page}=loadComponent('app/lister/apply/page.tsx',{
 'next/link':{default:props=>React.createElement('a',props),__esModule:true},
 '@/lib/lister-applications':{getListerApplication:async()=>({application,error:null})},
 '@/lib/auth/require-user':{requireUser:async()=>({user:{id:'fixture'},supabase:{from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{full_name:'Alex'}})})}})},
 './actions':{submitListerApplication:async()=>{}},
 '@/components/application-category-field':{ApplicationCategoryField:props=>React.createElement('div',{id:'category-root','data-saved':props.savedCategory??''},React.createElement(ApplicationCategoryField,props))},
});
const bundle=await build({stdin:{contents:`import React from 'react'; import {hydrateRoot} from 'react-dom/client'; import {ApplicationCategoryField} from './components/application-category-field'; const el=document.getElementById('category-root'); if(el)hydrateRoot(el,<ApplicationCategoryField savedCategory={el.dataset.saved}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic'});
writeFileSync(`${output}/category.js`,bundle.outputFiles[0].text);
const css=['app/globals.css','app/visual-polish.css'].map(file=>readFileSync(file,'utf8')).join('\n');
const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1193/chrome-linux/chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.route('https://holyhub.fixture/**',async route=>{
  const url=new URL(route.request().url());const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))}));
  await route.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="page-shell">${html}</main></body></html>`});
 });
 for(const width of [320,390,768,1024,1440]) {
  await page.setViewportSize({width,height:1000});application=saved;
  await page.goto('https://holyhub.fixture/lister/apply');assert.equal(await page.locator('form').count(),0);
  await page.getByRole('link',{name:'Edit application',exact:true}).click();await page.waitForURL('**/lister/apply?edit=1');await page.addScriptTag({path:`${output}/category.js`});
  assert.equal(await page.getByLabel('Business/brand name').inputValue(),'Saved brand');
  const category=page.getByLabel('Product/category type');
  assert.deepEqual(await category.locator('option').allTextContents(),['Choose a category','Apparel','Bookmarks','Gifts','Books','Jewellery','Home & Living','Arts','Other / Suggest another category']);
  await category.selectOption('__other__');const suggestion=page.getByLabel('Suggested category',{exact:true});await suggestion.waitFor({state:'visible'});
  assert.equal(await suggestion.evaluate(el=>el.checkValidity()),false);await suggestion.fill('Candles & scents');
  await category.selectOption('Arts');assert.equal(await suggestion.count(),0);await category.selectOption('__other__');assert.equal(await suggestion.inputValue(),'Candles & scents');
  const data=await page.locator('form').evaluate(el=>Object.fromEntries(new FormData(el)));assert.equal(data.application_id,'existing');assert.equal(data.category_type,'__other__');assert.equal(data.suggested_category,'Candles & scents');
  assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`${output}/pending-edit-${width}.png`,fullPage:true});
  application={...saved,status:'rejected',category_type:'Other: Candles'};await page.goto('https://holyhub.fixture/lister/apply');await page.addScriptTag({path:`${output}/category.js`});assert.equal(await page.getByLabel('Suggested category',{exact:true}).inputValue(),'Candles');assert.equal(await page.getByRole('button',{name:'Save & resubmit application',exact:true}).count(),1);
  application={...saved,status:'approved'};await page.goto('https://holyhub.fixture/lister/apply?edit=1');assert.equal(await page.locator('form').count(),0);assert.equal(await page.getByRole('link',{name:'Edit application',exact:true}).count(),0);
  console.log(`PASS ${width}px: pending edit link/form, fixed and suggested categories, saved values, rejected resubmission, approved lock, no overflow`);
 }
} finally {await browser.close();}

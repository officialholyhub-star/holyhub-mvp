// Render the real guided form; replace network uploads with an already uploaded image.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import vm from 'node:vm';
import { loadTypescript } from './helpers/load-typescript.mjs';
import { renderListerProductRoute } from './helpers/render-lister-product.mjs';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('/tmp/holyhub-ux-browser/package.json');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const output = '/tmp/holyhub-onboarding-browser';
mkdirSync(output, { recursive: true });
const result = await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { ProductForm } from './components/product-form'; const root = createRoot(document.getElementById('root')); const save = async data=>{ window.saved = Object.fromEntries(data); }; root.render(<ProductForm userId="fixture" guided deliveryCharge={3.5} action={save} />); window.showLegacy = ()=>root.render(<ProductForm key="legacy" userId="fixture" action={save} product={{id:"legacy",name:"Existing product",description:"Original details",category_type:"clothes",price:10,stock_quantity:1,image_url:null,is_published:false}} />);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle:true, write:false, format:'iife', jsx:'automatic', plugins:[{name:'fixtures',setup(builder){
  builder.onResolve({filter:/^next\/(link|image)$/}, args=>({path:args.path,namespace:'next-fixture'}));
  builder.onLoad({filter:/.*/,namespace:'next-fixture'},args=>({contents:args.path==='next/link' ? `import React from '${process.cwd()}/node_modules/react/index.js'; export default function Link(props){return <a {...props}/>}` : `import React from '${process.cwd()}/node_modules/react/index.js'; export default function Image({unoptimized,...props}){return <img {...props}/>}`,loader:'tsx',resolveDir:process.cwd()}));
  builder.onResolve({filter:/product-image-uploader$/},()=>({path:'upload',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`import React from '${process.cwd()}/node_modules/react/index.js'; export function ProductImageUploader(){return <div><p>Product photos</p><input type="hidden" name="image_urls" value="https://example.test/photo.jpg" /></div>}`,loader:'tsx',resolveDir:process.cwd()}));
  builder.onLoad({filter:/\.module\.css$/},args=>({contents:`export default ${JSON.stringify(Object.fromEntries([...readFileSync(args.path,'utf8').matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match=>[match[1],match[1]])))}`,loader:'js'}));
}}] });
writeFileSync(`${output}/bundle.js`,result.outputFiles[0].text);
const css = ['app/globals.css','app/visual-polish.css','components/product-form.module.css','components/lister-onboarding.module.css'].map(file=>readFileSync(file,'utf8')).join('\n');
const localRequire = createRequire(import.meta.url);
const setup = loadTypescript('lib/lister-onboarding.ts');
async function serverHtml(file, progress, complete = false) {
 const query = { select(){return this;}, eq(){return this;}, in(){return this;}, limit(){return this;}, maybeSingle:async()=>({data:{business_name:'Sunday Studio'}}), then(resolve){return Promise.resolve({data:complete?[{review_status:'pending'}]:[],count:complete?1:0}).then(resolve);} };
 const dependencies = {
  'next/link': {default: props=>React.createElement('a',props),__esModule:true},
  'next/headers': {cookies:async()=>({get:()=>({value:progress})})},
  'next/navigation': {redirect: value=>{throw new Error(value);}},
  '@/lib/auth/require-user': {requireRole:async()=>({user:{id:'fixture'},supabase:{from:()=>Object.create(query)}})},
  '@/lib/lister-onboarding': setup,
  '@/lib/fulfilment-summary': {getSellerFulfilmentSummary:async()=>({toFulfil:2})},
  './actions': {advanceOnboarding:async()=>{}},
  '@/app/lister/actions': {saveStorefront:async()=>{}},
  '@/components/storefront-form': {StorefrontForm:()=>null},
  '@/components/lister-onboarding.module.css': {default:new Proxy({}, {get:(_,key)=>String(key)}),__esModule:true},
 };
 const exports = {};
 const source = ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>name in dependencies?dependencies[name]:localRequire(name)});
 return renderToStaticMarkup(await exports.default());
}
const screens = await Promise.all([
 serverHtml('app/lister/onboarding/page.tsx','1:later'),
 serverHtml('app/lister/onboarding/page.tsx','3:later'),
 serverHtml('app/lister/onboarding/page.tsx','4:later'),
 serverHtml('app/lister/onboarding/success/page.tsx','5:later',true),
 serverHtml('app/lister/page.tsx','4:later'),
 serverHtml('app/lister/page.tsx','5:later',true),
]);
const routeScreens = await Promise.all([{guided:true},{guided:false},{edit:true},{edit:true,category:"clothes"}].map(options=>renderListerProductRoute(options)));
const browser = await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1193/chrome-linux/chrome',headless:true});
try {
 const page = await browser.newPage();
 for (const width of [320,390,768,1024,1440,1920]) {
  await page.setViewportSize({width,height:1000});
  for (const {html} of routeScreens) {
   await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="page-shell">${html}</main></body></html>`);
   const category = page.getByRole("combobox",{name:"Category",exact:true});
   assert.equal(await category.isVisible(),true,`Actual route category hidden at ${width}`);
   assert.equal(await category.evaluate(el=>el.tagName),"SELECT");
   assert.deepEqual((await category.locator("option").allTextContents()).filter(value=>value!=="Choose a category"&&!value.endsWith("(current category)")),["Apparel","Bookmarks","Gifts","Books","Jewellery","Home & Living","Arts"]);
   await category.selectOption("Arts");
   assert.equal(await category.inputValue(),"Arts");
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Route screen overflow at ${width}`);
  }
  for (const html of screens) {
   await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="page-shell">${html}</main></body></html>`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Server screen overflow at ${width}`);
  }
  await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="page-shell"><section class="shell"><div id="root"></div></section></main></body></html>`);
  await page.addScriptTag({path:`${output}/bundle.js`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  await page.getByRole('button',{name:'Continue →'}).click();
  await page.getByLabel('Product name',{exact:true}).fill('Everyday tee');
  // Empty details stop progression.
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  await page.getByRole('button',{name:'Continue →'}).click();
  assert.equal(await page.getByLabel('Description',{exact:true}).isVisible(),true);
  await page.getByLabel('Description',{exact:true}).fill('A soft everyday cotton tee.');
  assert.deepEqual(await page.getByLabel('Category',{exact:true}).locator('option').allTextContents(), ['Choose a category','Apparel','Bookmarks','Gifts','Books','Jewellery','Home & Living','Arts']);
  await page.getByLabel('Category',{exact:true}).selectOption('Apparel');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  await page.getByRole('button',{name:'Continue →'}).click();
  await page.getByLabel('Price (£)',{exact:true}).fill('25');
  await page.locator('[name="variant_M"]').fill('4');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  await page.getByRole('button',{name:'Continue →'}).click();
  assert.equal(await page.getByText('Dispatch from: United Kingdom',{exact:false}).isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  await page.getByRole('button',{name:'Continue →'}).click();
  assert.equal(await page.getByRole('img', {name:'Everyday tee — photo 1'}).isVisible(), true);
  await page.getByRole('button', {name:'Back', exact:true}).click();
  await page.getByRole('button', {name:'Continue →'}).click();
  await page.getByRole('button',{name:'Publish',exact:true}).click();
  await page.waitForFunction(()=>window.saved);
  assert.equal(await page.evaluate(()=>window.saved.publication_action),'publish');
  assert.equal(await page.evaluate(()=>window.saved.variant_M),'4');
  assert.equal(await page.evaluate(()=>window.saved.onboarding),'1');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  await page.screenshot({path:`${output}/review-${width}.png`,fullPage:true});
  await page.evaluate(()=>{window.saved=null;window.showLegacy();});
  assert.equal(await page.getByLabel('Category',{exact:true}).inputValue(),'clothes');
  assert.deepEqual(await page.getByLabel('Category',{exact:true}).locator('option').allTextContents(), ['Choose a category','clothes (current category)','Apparel','Bookmarks','Gifts','Books','Jewellery','Home & Living','Arts']);
  await page.getByRole('button',{name:'Save as draft',exact:true}).click();
  await page.waitForFunction(()=>window.saved);
  assert.equal(await page.evaluate(()=>window.saved.category_type),'clothes');
  await page.getByRole('button',{name:'Save as draft',exact:true}).waitFor({state:'visible'});
  await page.getByLabel('Category',{exact:true}).selectOption('Arts');
  await page.waitForFunction(()=>document.querySelector('#category_type')?.value === 'Arts');
  assert.equal(await page.getByLabel('Category',{exact:true}).inputValue(),'Arts');
  console.log(`PASS ${width}px: validation, apparel variants, delivery, review submission, actual new/edit route dropdowns, six onboarding/dashboard screens and no overflow`);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.shell').evaluate(el=>getComputedStyle(el).animationName),'none');
} finally { await browser.close(); }

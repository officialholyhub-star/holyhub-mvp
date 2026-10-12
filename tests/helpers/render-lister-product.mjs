import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const styles = new Proxy({}, { get: (_, key) => String(key) });
export async function renderListerProductRoute({ edit = false, category = 'Books', guided = true } = {}) {
 const product = { id:'fixture-product', name:'Existing book', description:'A book to keep', category_type:category, price:12, stock_quantity:2, image_url:null, is_published:false, product_images:[], product_variants:[] };
 const queries = [];
 const supabase = { from(table) {
  const query = { table, filters:[] }; queries.push(query);
  const result = {data:table === 'products' ? product : {user_id:'fixture-lister',delivery_charge:0},count:guided?0:1,error:null};
  const builder = {select(){return builder;},eq(key,value){query.filters.push([key,value]);return builder;},in(){return builder;},maybeSingle:async()=>result,then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
  return builder;
 } };
 const dependencies = {
  '@/lib/auth/require-user': {requireRole:async role=>{if(role!=='lister')throw new Error('Expected lister role');return {user:{id:'fixture-lister'},supabase};}},
  '@/app/lister/actions': {createProduct:async()=>{},updateProduct:async()=>{}},
  '@/app/lister/onboarding/actions': {advanceOnboarding:async()=>{}},
  '@/components/product-image-uploader': {ProductImageUploader:()=>React.createElement('div',null,'Photo upload fixture')},
  'next/link': {default:props=>React.createElement('a',props),__esModule:true},
  'next/navigation': {notFound(){throw new Error('Not found');}},
 };
 const cache = new Map();
 function load(file) {
  if(cache.has(file))return cache.get(file);
  const exports = {}; cache.set(file,exports);
  const code = ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{
   if(name in dependencies)return dependencies[name];
   if(name.endsWith('.module.css'))return {default:styles,__esModule:true};
   if(name.startsWith('@/') || name.startsWith('.')) {
    const base = name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);
    return load([`${base}.tsx`,`${base}.ts`].find(existsSync));
   }
   return require(name);
  },console,URL,FormData});
  return exports;
 }
 const file = edit?'app/lister/products/[id]/edit/page.tsx':'app/lister/products/new/page.tsx';
 const Page = load(path.resolve(file)).default;
 const tree = await Page({params:Promise.resolve({id:product.id}),searchParams:Promise.resolve({})});
 return {html:renderToStaticMarkup(tree),queries};
}

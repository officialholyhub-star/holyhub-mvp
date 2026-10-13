// Actual client components, synthetic data only; no Supabase/Stripe connections.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/tmp/holyhub-ux-browser/package.json');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const root = process.cwd();
const bundle = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {BasketView} from './components/basket-view';import {AddToBasketButton} from './components/add-to-basket-button';const root=createRoot(document.getElementById('root'));window.showBasket=()=>root.render(<BasketView/>);window.showCard=(stock)=>root.render(<AddToBasketButton id="new" name="New book" price={4} currency="GBP" listerId="seller" listerName="Shop" deliveryOption="free" deliveryCharge={0} stockQuantity={stock} showQuantity={false}/>);window.showBasket();`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [{ name: 'offline-fixtures', setup(b) {
  b.onResolve({ filter: /^next\/(link|image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  b.onResolve({ filter: /lib\/supabase\/client$/ }, () => ({ path: 'db', namespace: 'fixture' }));
  b.onResolve({ filter: /app\/checkout\/actions$/ }, () => ({ path: 'checkout', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: root, contents: args.path === 'db' ? `export function createClient(){return {from(){const q={select(){return q},in(){return q},eq(){return q},then(resolve,reject){return (window.failLoad?Promise.reject(new Error('offline')):Promise.resolve({data:structuredClone(window.products),error:null})).then(resolve,reject)}};return q}}}` : args.path === 'checkout' ? `export async function startCheckout(){window.checkoutCount=(window.checkoutCount||0)+1}` : `import React from '${root}/node_modules/react/index.js';export default function Component({unoptimized,...props}){return React.createElement('${args.path === 'next/link' ? 'a' : 'img'}',props)}` }));
} }] });
const browser = await chromium.launch({ executablePath: '/home/codespace/.cache/ms-playwright/chromium-1193/chrome-linux/chrome', headless: true, timeout: 15000 });
try {
 const page = await browser.newPage();
 page.setDefaultTimeout(10000);
 page.on("pageerror", error => console.error("Browser error:", error.message));
 await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><div id="root"></div></body></html>' }));
 await page.goto('https://holyhub.test/');
 const css = ['app/globals.css','app/visual-polish.css'].map(f=>readFileSync(f,'utf8')).join('\n');
 await page.addStyleTag({content:css});
 await page.evaluate(() => {
  const item=id=>({id,name:id==='stock'?'Sold book':id==='price'?'Changed book':'Good book',price:10,currency:'GBP',listerId:'seller',listerName:'Shop',quantity:1,deliveryOption:'free',deliveryCharge:0,imageUrl:null,stockQuantity:5});
  localStorage.setItem('holyhub-basket',JSON.stringify(['stock','price','good'].map(item)));
  window.products=['stock','price','good'].map(id=>({id,name:id,price:id==='price'?12:10,currency:'GBP',category_type:'Books',stock_quantity:id==='stock'?0:5,product_variants:[],image_url:null,product_images:[],lister_storefronts:{delivery_option:'free',delivery_charge:0,delivery_country:'GB'}}));
 });
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByText('Sold book is now out of stock.',{exact:true}).waitFor();
 assert.equal(await page.locator('.basket-row-warning').count(),2);
 await page.getByText('The price of Changed book has changed from £10.00 to £12.00.',{exact:true}).waitFor();
 await page.locator('input[name=accept_terms]').check();
 await page.getByRole('button',{name:'Proceed to secure checkout'}).click();
 await page.getByText('Please review the highlighted items before checkout.').waitFor();
 assert.equal(await page.evaluate(()=>window.checkoutCount||0),0);
 await page.locator('.basket-row').filter({hasText:'Sold book'}).getByRole('button',{name:'Remove from basket'}).click();
 await page.getByRole('button',{name:'Use updated information'}).click();
 assert.equal(await page.locator('.basket-row-warning').count(),0);
 await page.getByRole('button',{name:'Proceed to secure checkout'}).click();
 await page.waitForFunction(()=>window.checkoutCount===1);
 // The real action redirects; our returning fixture instead lets React reset the form.
 await page.waitForFunction(()=>!document.querySelector('input[name=accept_terms]').checked);
 // A change after the first render must be caught again on submit.
 await page.evaluate(()=>{window.products.find(p=>p.id==='good').stock_quantity=0;});
 await page.locator('input[name=accept_terms]').check();
 await page.getByRole('button',{name:'Proceed to secure checkout'}).click();
 await page.getByText('Good book is now out of stock.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.checkoutCount),1);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Basket overflows ${width}`);}
 await page.evaluate(()=>{window.failLoad=true;});
 await page.locator('input[name=accept_terms]').check();
 await page.getByRole('button',{name:'Proceed to secure checkout'}).click();
 await page.getByText("We couldn't check your basket. Please try again.").waitFor();
 assert.equal(await page.evaluate(()=>window.checkoutCount),1);
 await page.evaluate(()=>{window.failLoad=false;window.products.find(p=>p.id==='good').stock_quantity=2;});
 await page.locator('.basket-row').filter({hasText:'Good book'}).locator('input[type=number]').fill('3');
 await page.locator('input[name=accept_terms]').check();
 await page.getByRole('button',{name:'Proceed to secure checkout'}).click();
 await page.getByText('Only 2 available. Your basket currently has 3.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Update to 2',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('holyhub-basket')).find(i=>i.id==='good').quantity),2);
 assert.equal(await page.locator('.basket-row-warning').count(),0);
 await page.evaluate(()=>window.showCard(3));
 await page.getByRole('button',{name:'Add to basket',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Increase quantity'}).count(),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('holyhub-basket')).find(i=>i.id==='new').quantity),1);
 await page.evaluate(()=>window.showCard(0));
 assert.equal(await page.getByRole('button',{name:'Out of stock'}).isDisabled(),true);
 console.log('PASS actual BasketView: targeted warnings, explicit review/removal, pre-submit refresh, failure blocking, mobile widths; marketplace add-one and stock guard. No live services.');
} finally {await browser.close();}

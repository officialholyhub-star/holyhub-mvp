import assert from 'node:assert/strict';
import test from 'node:test';
import { renderListerProductRoute } from './helpers/render-lister-product.mjs';
const categories = ['Apparel','Bookmarks','Gifts','Books','Jewellery','Home & Living','Arts'];
for (const options of [{guided:true},{guided:false},{edit:true}]) {
 test(`actual ${options.edit?'edit':'new'} route renders a visible category dropdown (${options.guided?'guided':'standard'})`,async()=>{
  const {html,queries}=await renderListerProductRoute(options);
  assert.match(html,/<select[^>]*name="category_type"/);
  assert.doesNotMatch(html,/<input[^>]*name="category_type"/);
  const select=html.match(/<select[^>]*name="category_type"[\s\S]*?<\/select>/)[0];
  const values=[...select.matchAll(/<option[^>]*value="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&')).filter(Boolean);
  assert.deepEqual(values,categories);
  // Category precedes the first hidden fieldset in the guided initial render.
  if(options.guided)assert.ok(html.indexOf(select)<html.indexOf('<fieldset'));
  if(options.edit)assert.ok(queries.some(query=>query.filters.some(([key,value])=>key==='lister_user_id'&&value==='fixture-lister')));
 });
}
test('actual edit route retains an existing legacy category without modifying its record',async()=>{
 const {html}=await renderListerProductRoute({edit:true,category:'clothes'});
 assert.match(html,/<option value="clothes" selected="">clothes \(current category\)<\/option>/);
});

test('editing preloads saved stock and offers explicit actions without a second stock prompt',async()=>{
 const {html}=await renderListerProductRoute({edit:true});
 assert.match(html,/<input[^>]*name="stock_quantity"[^>]*value="2"/);
 for(const value of ['draft','publish','archive'])assert.match(html,new RegExp(`<button(?=[^>]*name="publication_action")(?=[^>]*value="${value}")[^>]*>`));
 assert.doesNotMatch(html,/type="checkbox"|publish-stock-quantity|<dialog/);
});

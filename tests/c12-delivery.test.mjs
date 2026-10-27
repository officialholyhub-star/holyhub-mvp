import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypescript } from './helpers/load-typescript.mjs';
import { load, render } from './helpers/render-progress.mjs';
const { deliveryPostcode, readDeliveryAddress } = loadTypescript('lib/delivery-territory.ts');
const productId='11111111-1111-4111-8111-111111111111',sellerId='22222222-2222-4222-8222-222222222222';
const userId='33333333-3333-4333-8333-333333333333';
const product={id:productId,name:'Trusted product',price:10,currency:'GBP',lister_user_id:sellerId,is_published:true,review_status:'approved',category_type:'Books',stock_quantity:5,product_variants:[]};
const brand={user_id:sellerId,business_name:'Trusted brand',delivery_option:'free',delivery_country:'GB'};
const address={delivery_recipient_name:'Recipient',delivery_address_line1:'10 Real Road',delivery_address_line2:'Flat 2',delivery_city:'London',delivery_postcode:'SW1A 1AA',delivery_country:'GB'};
const plain=x=>JSON.parse(JSON.stringify(x));
function form(overrides={}) {
 const data=new FormData();for(const [k,v] of Object.entries({accept_terms:'on',basket:JSON.stringify([{id:productId,quantity:1}]),...address,...overrides}))data.set(k,v);return data;
}
function harness({ready=true,identity=true,authenticated=true,unavailable=false}={}){
 const writes=[],stripeCalls=[],interest=new Map();let authCalls=0;
 function from(table){let inserted=false;const q={select(){return q;},in(){return q;},eq(){return q;},
  insert(value){inserted=true;writes.push({table,value:plain(value)});return q;},
  upsert(value,options){const key=`${value.user_id}:${value.postcode_area}:${value.demand_key}`;interest.set(key,plain(value));writes.push({table,value:plain(value),options});return q;},
  single:async()=>({data:{id:'checkout-a'},error:null}),
  then(resolve,reject){return Promise.resolve({data:table==='products'?[product]:table==='lister_storefronts'?[brand]:table==='seller_legal_profiles'?(identity?[{user_id:sellerId,verification_status:'verified',updated_at:'version-a'}]:[]):inserted?{id:'checkout-a'}:null,error:unavailable?{code:'offline'}:null}).then(resolve,reject);}};return q;}
 const db={from,rpc:async()=>({data:ready,error:null})};
 const dependencies={
  'next/navigation':{redirect:url=>{throw new Error(`redirect:${url}`);}},'next/cache':{revalidatePath(){}},'next/headers':{headers:async()=>new Headers()},
  '@/lib/auth/require-user':{requireUser:async()=>{authCalls++;if(!authenticated)throw new Error('Authentication required');return {supabase:db,user:{id:userId,email:'account@example.test'}};}},
  '@/lib/supabase/admin':{createAdminClient:()=>db},
  '@/lib/seller-legal':{SELLER_LEGAL_FIELDS:'*',sellerLegalProfileComplete:()=>identity},
  '@/lib/checkout-origin':{checkoutRedirectUrls:()=>({success_url:'https://holyhub.test/success',cancel_url:'https://holyhub.test/cancel'})},
  '@/lib/stripe':{getStripe:()=>({checkout:{sessions:{create:async args=>{stripeCalls.push(plain(args));return {id:'cs_mock',url:'https://stripe.test/pay'};},expire:async()=>{throw new Error('Unexpected expiry');}}}})},
 };
 return {writes,stripeCalls,interest,dependencies,get authCalls(){return authCalls;},
  checkout:loadTypescript('app/checkout/actions.ts',dependencies).startCheckout,
  request:loadTypescript('app/shipping/northern-ireland/actions.ts',dependencies).requestNorthernIrelandShipping};
}
for(const [country,postcode] of [['England','SW1A 1AA'],['Scotland','EH1 1YZ'],['Wales','CF10 1EP'],['Scotland islands','ZE1 0AA'],['England letter suffix','EC1R 1BB']])
test(`C12 ${country} postcode validates and reaches mocked Stripe with trusted snapshot`,async()=>{
 const h=harness();await assert.rejects(h.checkout(form({delivery_postcode:postcode})),/redirect:https:\/\/stripe.test\/pay/);
 assert.equal(h.stripeCalls.length,1);assert.equal(h.stripeCalls[0].shipping_address_collection,undefined);
 assert.equal(h.stripeCalls[0].metadata.holyhub_commission,'50');
 const snapshot=h.writes.find(x=>x.table==='checkout_sessions').value;
 assert.equal(snapshot.delivery_address.delivery_postcode,postcode);assert.equal(snapshot.user_id,userId);
 assert.equal(snapshot.delivery_address.delivery_country,'GB');
});
for(const postcode of ['BT7 1NN','bt71nn','GY1 1AA','JE2 3AA','IM1 1AA','BF1 0AA','GX11 1AA','ZZ1 1AA','12345','SW1A','SW1A 1CI','SW1A\n1AA'])
test(`C12 rejects unsupported/invalid ${JSON.stringify(postcode)} before Stripe`,async()=>{
 const h=harness();await assert.rejects(h.checkout(form({delivery_postcode:postcode})),/redirect:\/basket\?error=/);
 assert.equal(h.stripeCalls.length,0);assert.equal(h.writes.length,0);
});
test('C12 NI rejection is clear; viewing/rejection does not record demand',async()=>{
 const h=harness();await assert.rejects(h.checkout(form({delivery_postcode:'BT7 1NN'})),error=>decodeURIComponent(error.message).includes('Northern Ireland delivery isn’t available yet.'));
 assert.equal(h.interest.size,0);assert.equal(h.writes.length,0);
});
test('C12 duplicate and forged country/postcode/basket fields cannot bypass the server gate',async()=>{
 for(const [key,value] of [['delivery_postcode','BT7 1NN'],['delivery_country','GB'],['basket','[]'],['accept_terms','on']]){
  const h=harness(),data=form();data.append(key,value);await assert.rejects(h.checkout(data));assert.equal(h.stripeCalls.length,0);
 }
 for(const [key,value] of [['delivery_country','IE'],['delivery_address_line1',''],['delivery_recipient_name',''],['delivery_city','Belfast\nSW1A 1AA']]){
  const h=harness();await assert.rejects(h.checkout(form({[key]:value})));assert.equal(h.stripeCalls.length,0);
 }
});
test('C12 normalizes supported postcode and does not accept a forged address JSON override',async()=>{
 const h=harness();await assert.rejects(h.checkout(form({delivery_postcode:' sw1a1aa ',delivery_address:JSON.stringify({...address,delivery_postcode:'BT7 1NN'})})),/stripe.test/);
 assert.equal(h.writes.find(x=>x.table==='checkout_sessions').value.delivery_address.delivery_postcode,'SW1A 1AA');
 const data=form();data.delete('delivery_postcode');assert.equal(readDeliveryAddress(data),null);
});
for(const option of [{ready:false},{identity:false},{authenticated:false}])
test(`C12 preserves existing checkout readiness/identity/auth gate ${JSON.stringify(option)}`,async()=>{
 const h=harness(option);await assert.rejects(h.checkout(form()));assert.equal(h.stripeCalls.length,0);
});
function demand(overrides={}){return form({postcode_area:'BT7',...overrides});}
test('C12 explicit NI request stores account, broad district and authoritative product/seller demand only',async()=>{
 const h=harness();const data=demand({basket:JSON.stringify([{id:productId,quantity:1,name:'Forged product',listerId:'forged',listerName:'Forged seller'}]),
  delivery_postcode:'BT7 1NN',delivery_address_line1:'SECRET NI ADDRESS',notification_email:'not-opted@example.test',user_id:'forged'});
 await assert.rejects(h.request(data),/requested=yes/);
 assert.equal(h.stripeCalls.length,0);const row=h.writes[0].value;
 assert.deepEqual(Object.keys(row).sort(),['demand_items','demand_key','notification_email','postcode_area','user_id']);
 assert.equal(row.user_id,userId);assert.equal(row.postcode_area,'BT7');assert.equal(row.notification_email,null);
 assert.deepEqual(row.demand_items,[{product_id:productId,product_name:'Trusted product',seller_user_id:sellerId,seller_brand:'Trusted brand',quantity:1,variant_id:null,variant_size:null}]);
 assert.doesNotMatch(JSON.stringify(row),/SECRET|BT7 1NN|forged|not-opted/);
});
test('C12 records email only on explicit notification opt-in and deduplicates repeat demand',async()=>{
 const h=harness();for(let i=0;i<2;i++)await assert.rejects(h.request(demand({notify:'on',notification_email:'notify@example.test'})),/requested=yes/);
 assert.equal(h.interest.size,1);assert.equal([...h.interest.values()][0].notification_email,'notify@example.test');
 const bad=harness();await assert.rejects(bad.request(demand({notify:'on',notification_email:'not an email'})));assert.equal(bad.writes.length,0);
});
test('C12 forged/duplicate NI fields, full postcode and unauthenticated requests cannot record demand',async()=>{
 for(const area of ['SW1A','BT7 1NN','BT0','BT100','BT7 SECRET ADDRESS']){const h=harness();await assert.rejects(h.request(demand({postcode_area:area})));assert.equal(h.writes.length,0);}
 const h=harness();const data=demand();data.append('postcode_area','BT8');await assert.rejects(h.request(data));assert.equal(h.writes.length,0);
 const blocked=harness({authenticated:false});await assert.rejects(blocked.request(demand()));assert.equal(blocked.writes.length,0);
});
test('C12 NI route renders optional opt-in and browsing route without writing a request',async()=>{
 const h=harness();const page=load('app/shipping/northern-ireland/page.tsx',h.dependencies).default;
 const html=render(await page({searchParams:Promise.resolve({area:'BT7'})}));
 assert.match(html,/Request Northern Ireland shipping/);assert.match(html,/does not enable delivery/);assert.match(html,/optional/);assert.match(html,/Continue browsing/);
 assert.doesNotMatch(html,/name="notification_email"/);assert.equal(h.writes.length,0);assert.equal(h.stripeCalls.length,0);
});
test('C12 postcode distinction does not treat Crown Dependencies or foreign areas as supported',()=>{
 assert.equal(deliveryPostcode('BT7 1NN').outward,'BT7');
 for(const p of ['GY1 1AA','IM1 1AA','JE1 1AA'])assert.equal(deliveryPostcode(p).territory,'unsupported');
});

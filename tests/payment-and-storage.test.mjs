import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import sharp from 'sharp';
import { verifyStripeEvent } from '../lib/payments/verify.ts';
import { sanitiseImage } from '../lib/image-upload.ts';
import { marketplaceDatabase } from './helpers/database.mjs';
import { seedMarketplace } from './fixtures/marketplace-seed.mjs';

test('Stripe signatures reject tampering, wrong secrets and expired deliveries',()=>{
 const stripe=new Stripe('sk_test_offline_only'),secret='whsec_offline_test_only';
 const payload=JSON.stringify({id:'evt_example',object:'event',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_example'}}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.equal(verifyStripeEvent(payload,signature,secret).id,'evt_example');
 assert.throws(()=>verifyStripeEvent(payload+' ',signature,secret));
 assert.throws(()=>verifyStripeEvent(payload,signature,'whsec_wrong'));
 assert.throws(()=>verifyStripeEvent(payload,stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:Math.floor(Date.now()/1000)-600}),secret));
});

test('image processing rejects disguised/oversized files and strips metadata',async()=>{
 const png=await sharp({create:{width:20,height:30,channels:3,background:'#96b5cd'}}).withMetadata().png().toBuffer();
 const result=await sanitiseImage(new File([png],'photo.png',{type:'image/png'}));
 const info=await sharp(result).metadata();assert.equal(info.format,'webp');assert.equal(info.exif,undefined);
 await assert.rejects(sanitiseImage(new File(['<svg/>'],'fake.png',{type:'image/png'})),/could not be read/);
 await assert.rejects(sanitiseImage(new File([new Uint8Array(5*1024*1024+1)],'big.png',{type:'image/png'})),/5 MB/);
 await assert.rejects(sanitiseImage(new File([png],'script.svg',{type:'image/svg+xml'})),/JPG, PNG or WebP/);
});

test('multi-seller settlement boundary, fees, appeals and private storage',async t=>{
 const context=await marketplaceDatabase(),{db,as}=context;t.after(()=>db.close());
 const [buyer,seller,admin,other]=await seedMarketplace(context,new Map());
 const rpc=(u,name,args=[])=>as(u,tx=>tx.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args));
 const products=(await db.query('select * from products order by created_at')).rows;
 const a=products.find(p=>p.name==='Hope art print'),b=products.find(p=>p.name==='Everyday tote');
 let order;
 await t.test('two sellers see only their allocation; buyer cannot see reserve/account records',async()=>{
  await rpc(buyer.id,'set_basket_item',[a.id,2]);await rpc(buyer.id,'set_basket_item',[b.id,1]);
  order=(await rpc(buyer.id,'prepare_order')).rows[0].result;
  assert.equal((await db.query('select subtotal_pence from orders where id=$1',[order])).rows[0].subtotal_pence,5800);
  const allocations=(await db.query('select * from seller_orders where order_id=$1',[order])).rows;
  assert.equal(allocations.length,2);assert.equal(allocations.reduce((sum,s)=>sum+s.commission_pence,0),290);
  assert.equal((await as(seller.id,tx=>tx.query('select * from seller_orders where order_id=$1',[order]))).rows.length,1);
  assert.equal((await as(buyer.id,tx=>tx.query('select * from seller_orders'))).rows.length,0);
  await assert.rejects(rpc(seller.id,'update_fulfillment',[allocations.find(s=>s.business_id===a.business_id).id,'dispatched','Tracking']),/Paid seller order unavailable/);
 });
 await t.test('verified test checkout is service-only, matched to server totals and idempotent',async()=>{
  const args=['evt_boundary','checkout.session.completed','cs_test_boundary',order,5800,'gbp'];
  await assert.rejects(rpc(buyer.id,'record_verified_checkout',args),/permission denied/);
  await db.query("update orders set status='awaiting_payment',payment_reference='cs_test_boundary' where id=$1",[order]);
  await assert.rejects(rpc('service','record_verified_checkout',[...args.slice(0,4),1,'gbp']),/does not match/);
  await assert.rejects(rpc('service','record_verified_checkout',[...args.slice(0,5),'usd']),/does not match/);
  assert.equal((await rpc('service','record_verified_checkout',args)).rows[0].result,true);
  assert.equal((await rpc('service','record_verified_checkout',args)).rows[0].result,false);
  assert.equal((await rpc('service','record_verified_checkout',['evt_second',...args.slice(1)])).rows[0].result,false);
  assert.equal((await db.query("select * from audit_log where entity_id=$1 and action='payment.verified'",[order])).rows.length,1);
  const allocations=(await db.query('select * from seller_orders where order_id=$1',[order])).rows;
  assert.equal(allocations.find(s=>s.business_id===a.business_id).reserve_pence,513);
  assert.ok(allocations.every(s=>s.payment_status==='paid'&&s.transferred_pence===0));
  const allocation=allocations.find(s=>s.business_id===a.business_id);
  await rpc(seller.id,'update_fulfillment',[allocation.id,'dispatched','Demo tracking reference']);
  const delivery=(await as(buyer.id,tx=>tx.query('select * from order_delivery($1)',[order]))).rows;
  assert.equal(delivery.find(d=>d.seller_order_id===allocation.id).tracking_note,'Demo tracking reference');
  assert.equal(Object.hasOwn(delivery[0],'reserve_pence'),false);
  await assert.rejects(as(other.id,tx=>tx.query('select * from order_delivery($1)',[order])),/Order unavailable/);
 });
 await t.test('published image access follows moderation; another seller cannot upload to it',async()=>{
  const image=(await db.query('select path from product_images where product_id=$1',[a.id])).rows[0];
  assert.equal((await as(null,tx=>tx.query('select * from storage.objects where name=$1',[image.path]))).rows.length,1);
  await assert.rejects(as(other.id,tx=>tx.query("insert into storage.objects(bucket_id,name) values('product-images',$1)",[`${other.id}/${a.id}/${randomUUID()}.webp`])),/row-level security/);
  await rpc(admin.id,'admin_marketplace',['product_moderation',a.id,{status:'hidden'}]);
  assert.equal((await as(null,tx=>tx.query('select * from storage.objects where name=$1',[image.path]))).rows.length,0);
  await rpc(admin.id,'admin_marketplace',['product_moderation',a.id,{status:'visible'}]);
 });
 await t.test('eleventh product cannot bypass the 20p listing fee',async()=>{
  const values={name:'Extra print',description:'A thoughtful art print made for your home.',category:'Art & Prints',price_pence:500,stock:5,delivery_info:'Delivery details for this test product.'};let extra;
  for(let i=0;i<9;i++){extra=(await rpc(seller.id,'save_product',[values])).rows[0].result;await db.query('insert into product_images(product_id,path) values($1,$2)',[extra,`${seller.id}/${extra}/test.webp`]);}
  assert.equal((await rpc(seller.id,'set_product_status',[extra,'published'])).rows[0].result,'fee_due');
  const fee=(await as(seller.id,tx=>tx.query('select * from listing_fees where product_id=$1',[extra]))).rows[0];assert.equal(fee.amount_pence,20);assert.equal(fee.status,'due');
  await assert.rejects(as(seller.id,tx=>tx.query("update listing_fees set status='paid' where product_id=$1",[extra])),/permission denied/);
  assert.equal((await as(null,tx=>tx.query('select * from products where id=$1',[extra]))).rows.length,0);
 });
 await t.test('refund evidence is private, preserved, and appeals respect configured limits',async()=>{
  const item=(await db.query('select * from order_items where order_id=$1 and product_id=$2',[order,a.id])).rows[0];
  const id=(await rpc(buyer.id,'request_refund',[item.id,{reason:'damaged',explanation:'The print arrived with a large tear through the centre.',requested_pence:1800,contacted_seller:true,desired_resolution:'Refund the damaged print.'}])).rows[0].result;
  const path=`${buyer.id}/${id}/${randomUUID()}.webp`;
  await as(buyer.id,tx=>tx.query("insert into storage.objects(bucket_id,name) values('refund-evidence',$1)",[path]));
  await rpc(buyer.id,'register_image',['evidence',id,path]);
  for(const actor of [buyer.id,seller.id,admin.id])assert.equal((await as(actor,tx=>tx.query('select * from storage.objects where name=$1',[path]))).rows.length,1);
  for(const actor of [null,other.id])assert.equal((await as(actor,tx=>tx.query('select * from storage.objects where name=$1',[path]))).rows.length,0);
  assert.equal((await as(buyer.id,tx=>tx.query('delete from storage.objects where name=$1 returning name',[path]))).rows.length,0);
  await rpc(admin.id,'decide_refund',[id,'partially_approved',900,'The evidence supports a partial refund for the affected print.']);
  await rpc(buyer.id,'appeal_refund',[id,'The entire print is damaged and cannot be used as intended.']);
  await rpc(admin.id,'decide_refund',[id,'approved',1800,'The additional evidence supports the full requested refund.']);
  await assert.rejects(rpc(seller.id,'appeal_refund',[id,'Please consider the seller evidence in another appeal.']),/not available/);
  const r=(await db.query('select * from refund_cases where id=$1',[id])).rows[0];assert.equal(r.appeal_count,1);assert.equal(r.payment_status,'pending');
 });
});

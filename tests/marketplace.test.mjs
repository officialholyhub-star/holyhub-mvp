import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceDatabase } from './helpers/database.mjs';

test('marketplace money, ownership, publishing and refund state transitions',async t=>{
 const {db,as}=await marketplaceDatabase(); t.after(()=>db.close());
 const buyer='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', seller='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', other='cccccccc-cccc-4ccc-8ccc-cccccccccccc', admin='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 for(const id of [buyer,seller,other,admin]) await db.query('insert into auth.users(id) values($1)',[id]);
 await db.query("insert into user_roles(user_id,role) values($1,'admin')",[admin]);
 const b=(await db.query("insert into businesses(owner_id,name,category,location,summary,description,website_url,faith_confirmed) values($1,'Grace Studio','Art & Creators','Online','Art inspired by faith.','A Christian business making thoughtful art for your home.','https://example.com',true) returning *",[seller])).rows[0];
 const values={name:'Hope print',description:'A thoughtful print for a welcoming home.',category:'Art & Prints',price_pence:1999,stock:5,delivery_info:'Delivery information will be confirmed before checkout.'};
 const rpc=(user,name,args=[])=>as(user,tx=>tx.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args));
 const product=(await rpc(seller,'save_product',[values])).rows[0].result;
 await t.test('drafts are private and approval is required before publishing',async()=>{
   assert.equal((await as(null,tx=>tx.query('select * from products'))).rows.length,0);
   await assert.rejects(rpc(seller,'set_product_status',[product,'published']),/application must be approved/);
   await assert.rejects(rpc(buyer,'save_product',[{...values,id:product}]),/Apply to become a lister/);
   await assert.rejects(as(seller,tx=>tx.query("update products set price_pence=1")),/permission denied/);
   await rpc(admin,'review_business',[b.id,'approved',b.updated_at]);
   await assert.rejects(rpc(seller,'set_product_status',[product,'published']),/at least one product image/);
   await db.query('insert into product_images(product_id,path) values($1,$2)',[product,`${seller}/${product}/test.jpg`]);
   await rpc(seller,'set_product_status',[product,'published']);
   assert.equal((await as(null,tx=>tx.query('select * from products'))).rows.length,1);
 });
 await t.test('basket validates stock and cannot be edited by another customer',async()=>{
   await rpc(buyer,'set_basket_item',[product,2]);
   await assert.rejects(rpc(buyer,'set_basket_item',[product,6]),/no longer available/);
   assert.equal((await as(other,tx=>tx.query('select * from basket_items'))).rows.length,0);
 });
 let order,item,caseId;
 await t.test('order prices and commission are calculated inside the database, never paid by the browser',async()=>{
   order=(await rpc(buyer,'prepare_order')).rows[0].result;
   const o=(await db.query('select * from orders where id=$1',[order])).rows[0];
   assert.equal(o.subtotal_pence,3998); assert.equal(o.status,'draft'); assert.equal(o.paid_at,null);
   item=(await db.query('select * from order_items where order_id=$1',[order])).rows[0];
   assert.equal(item.commission_pence,200);
   assert.equal((await as(other,tx=>tx.query('select * from order_items'))).rows.length,0);
   assert.equal((await as(seller,tx=>tx.query('select * from orders'))).rows.length,0);
   assert.equal((await as(seller,tx=>tx.query('select * from order_items'))).rows.length,1);
   await assert.rejects(as(buyer,tx=>tx.exec("update orders set status='paid'")),/permission denied/);
 });
 const questionnaire={reason:'damaged',explanation:'The print arrived with a large tear across the middle.',requested_pence:1999,contacted_seller:true,desired_resolution:'Please refund the damaged print.'};
 await t.test('only paid order owners can request a refund',async()=>{
   await assert.rejects(rpc(buyer,'request_refund',[item.id,questionnaire]),/only for paid orders/);
   await db.query("update orders set status='paid',paid_at=now() where id=$1",[order]); // isolated fixture, never a production UI action
   await assert.rejects(rpc(other,'request_refund',[item.id,questionnaire]),/unavailable/);
   caseId=(await rpc(buyer,'request_refund',[item.id,questionnaire])).rows[0].result;
   await assert.rejects(rpc(buyer,'request_refund',[item.id,questionnaire]),/duplicate key/);
   assert.equal((await as(other,tx=>tx.query('select * from refund_cases'))).rows.length,0);
 });
 await t.test('seller response and human admin decisions do not execute payments',async()=>{
   await rpc(seller,'respond_refund',[caseId,'We have reviewed the photos and agree the print arrived damaged.']);
   await assert.rejects(rpc(seller,'decide_refund',[caseId,'approved',1999,'We approve this refund based on the evidence.']),/Not authorised/);
   await assert.rejects(rpc(admin,'decide_refund',[caseId,'approved',4000,'The requested refund is supported by the evidence.']),/amount does not match/);
   await rpc(admin,'decide_refund',[caseId,'approved',1999,'Both parties agree that the print arrived damaged.']);
   const r=(await db.query('select * from refund_cases where id=$1',[caseId])).rows[0];
   assert.equal(r.status,'approved'); assert.equal(r.payment_status,'pending'); assert.equal(r.appeal_deadline,null);
   await assert.rejects(rpc(buyer,'appeal_refund',[caseId,'I would like a different outcome for this refund.']),/not available/);
 });
 await t.test('admin policy and moderation are protected and audited',async()=>{
   await assert.rejects(rpc(buyer,'admin_marketplace',['product_moderation',product,{status:'hidden'}]),/Not authorised/);
   await rpc(admin,'admin_marketplace',['product_moderation',product,{status:'hidden'}]);
   assert.equal((await as(null,tx=>tx.query('select * from products'))).rows.length,0);
   assert.equal((await as(buyer,tx=>tx.query('select * from audit_log'))).rows.length,0);
   assert.ok((await as(admin,tx=>tx.query('select * from audit_log'))).rows.length>0);
 });
});

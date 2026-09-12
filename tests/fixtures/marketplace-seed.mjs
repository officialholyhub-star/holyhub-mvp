// Fictional, in-memory data only. This file is never imported by the deployed app.
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
export const demoPassword = 'HolyHub-demo-2026!';
export async function seedMarketplace({db,as},objects) {
 const accounts = ['customer','seller','admin','second-seller'].map((name,index)=>({id:`${index+1}1111111-1111-4111-8111-111111111111`,email:`${name}@holyhub.test`,name:`Demo ${name}`}));
 for (const u of accounts) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[u.id,{full_name:u.name}]);
 await db.query("insert into user_roles(user_id,role) values($1,'admin')",[accounts[2].id]);
 // Explicit demonstration values, NOT the production defaults or agreed commercial policy.
 await db.exec("update platform_settings set listing_allowance_mode='lifetime',new_reserve_bps=1500,new_reserve_days=14,appeal_days=7,appeal_limit=1");
 const productIds=[];
 const designs=[['Hope art print','Art & Prints',1800,'#d8e8f1','HOPE'],['Grace journal','Books & Stationery',1400,'#f1dcde','GRACE'],['Everyday tote','Clothing & Accessories',2200,'#e9e3d8','GROW'],['Peace greeting cards','Art & Prints',800,'#dfe9e0','PEACE']];
 for(const [index,account] of [accounts[1],accounts[3]].entries()) {
  const business=(await db.query("insert into businesses(owner_id,name,category,location,summary,description,website_url,faith_confirmed) values($1,$2,'Art & Creators','United Kingdom · demo','Thoughtful creations inspired by faith.','A fictional Christian-owned studio, included only to demonstrate the HolyHub marketplace.','https://example.com',true) returning *",[account.id,index?'Good Things Studio · demo':'Grace & Paper · demo'])).rows[0];
  await as(accounts[2].id,tx=>tx.query("select review_business($1,'approved',$2)",[business.id,business.updated_at]));
  for (const [name,category,price,bg,word] of designs.slice(index*2,index*2+2)) {
   const product=(await as(account.id,tx=>tx.query('select save_product($1) as id',[{name,description:`${name}, thoughtfully made with faith at its heart. This is a fictional demonstration product and cannot be purchased.`,category,price_pence:price,stock:20,delivery_info:'Demonstration only. Shipping arrangements must be confirmed before live checkout.'}]))).rows[0].id;
   const path=`${account.id}/${product}/${randomUUID()}.webp`;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700"><rect width="700" height="700" fill="${bg}"/><ellipse cx="350" cy="585" rx="192" ry="25" fill="#26353b" opacity=".08"/><g transform="rotate(-7 350 350)"><rect x="175" y="128" width="350" height="440" rx="9" fill="#fffaf1"/><rect x="195" y="148" width="310" height="400" rx="3" fill="none" stroke="#ad9270" stroke-width="2"/><path d="M285 350q65-130 130 0M300 350q50-90 100 0" fill="none" stroke="#9db4a0" stroke-width="10"/><text x="350" y="417" text-anchor="middle" font-family="Georgia" font-size="43" fill="#485d66">${word}</text><text x="350" y="465" text-anchor="middle" font-family="sans-serif" font-size="12" letter-spacing="3" fill="#79858b">FICTIONAL DEMO PRODUCT</text></g></svg>`;
   objects.set(`product-images/${path}`,await sharp(Buffer.from(svg)).webp().toBuffer());
   await as(account.id,tx=>tx.query("insert into storage.objects(bucket_id,name) values('product-images',$1)",[path]));
   await as(account.id,tx=>tx.query("select register_image('product',$1,$2)",[product,path]));
   await as(account.id,tx=>tx.query("select set_product_status($1,'published')",[product]));productIds.push(product);
  }
 }
 // A simulated, verified test order allows refund and seller journeys to be explored locally.
 for(const id of [productIds[0],productIds[2]])await as(accounts[0].id,tx=>tx.query('select set_basket_item($1,1)',[id]));
 const order=(await as(accounts[0].id,tx=>tx.query('select prepare_order() as id'))).rows[0].id;
 await db.query("update orders set status='awaiting_payment',payment_reference='cs_test_local_demo' where id=$1",[order]);
 await as('service',tx=>tx.query("select record_verified_checkout('evt_local_demo','checkout.session.completed','cs_test_local_demo',$1,4000,'gbp')",[order]));
 await db.exec('delete from basket_items');
 return accounts;
}

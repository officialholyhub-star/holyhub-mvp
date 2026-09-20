import { getChatGPTUser } from "@/app/chatgpt-auth";
import { bindings, one, stmt, member, isAdmin, businessCategories, productCategories, type Business, type Product, type Member } from "@/lib/data";
import { text, choice, number, price, website, sanitisePng } from "@/lib/validation";

export const dynamic = "force-dynamic";
const stale = "This record changed in another window. Refresh before trying again.";
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const fail = (error: string, status=400) => Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
async function boundedForm(request: Request) {
  if(Number(request.headers.get("content-length"))>5_000_000)throw new Error("This upload is too large.");
  const reader=request.body?.getReader();if(!reader)throw new Error("No form was received.");
  const parts: Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5_000_000){await reader.cancel();throw new Error("This upload is too large.");}parts.push(value);}
  return new Response(new Blob(parts as BlobPart[]),{headers:{"content-type":request.headers.get("content-type")||""}}).formData();
}
async function changed(sql:string,...args:unknown[]) { const row=await stmt(sql+" RETURNING id",...args).first<{id:string}>();if(!row)throw new Error(stale);return row.id; }

export async function POST(request: Request) {
  const origin=request.headers.get("origin");
  if(!origin || origin!==new URL(request.url).origin || request.headers.get("sec-fetch-site")==="cross-site")return fail("Please submit this form from HolyHub.",403);
  const identity=await getChatGPTUser(); if(!identity)return fail("Please sign in with ChatGPT, then try again.",401);
  let redirect="/account";
  try {
    const user=await member(), form=await boundedForm(request), action=text(form,"action",1,60), admin=isAdmin(user.email);
    const rateKey=`${user.id}:${action}:${now().slice(0,10)}`;
    const rate=await stmt("INSERT INTO hh_limits(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<100 RETURNING count",rateKey).first();
    if(!rate)return fail("You’ve made many changes today. Please try again tomorrow or contact HolyHub.",429);
    const recordId=()=>text(form,"id",1,100), version=()=>number(form,"version",1_000_000);
    const audit=async(target:string)=>{await stmt("INSERT INTO hh_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",id(),user.id,action,target,now()).run();};
    const ownBusiness=()=>one<Business>("SELECT * FROM hh_businesses WHERE owner_id=?",user.id);
    const ownProduct=async()=>{const p=await one<Product>("SELECT p.* FROM hh_products p JOIN hh_businesses b ON b.id=p.business_id WHERE p.id=? AND b.owner_id=? AND b.status!='suspended'",recordId(),user.id);if(!p)throw new Error("Product not found or unavailable.");return p;};
    if(action==="profile.save") {
      await stmt("UPDATE hh_members SET name=? WHERE id=? AND suspended=0",text(form,"name",1,100),user.id).run();
    } else if(action==="business.save") {
      if(form.get("faith")!=="yes")throw new Error("Please confirm the Christian business statement.");
      const values=[text(form,"name",2,100),choice(form,"category",businessCategories),text(form,"location",2,120),text(form,"summary",10,240),text(form,"description",30,4000),website(form)];
      const business=await ownBusiness();
      if(business){if(business.status==="suspended")throw new Error("Contact HolyHub before changing a suspended business.");await changed("UPDATE hh_businesses SET name=?,category=?,location=?,summary=?,description=?,website=?,status='pending',review_note='',version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? AND status!='suspended'",...values,now(),business.id,user.id,version());await audit(business.id);}
      else {const businessId=id();await stmt("INSERT INTO hh_businesses(id,owner_id,name,category,location,summary,description,website,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",businessId,user.id,...values,now(),now()).run();await audit(businessId);}
      redirect="/account/business";
    } else if(action==="product.save") {
      const business=await ownBusiness();if(!business||business.status==="suspended")throw new Error("Create your business profile first.");
      const values=[text(form,"name",2,120),text(form,"description",20,4000),choice(form,"category",productCategories),price(form),number(form,"stock",999999),text(form,"delivery_info",10,1500)];
      if(form.get("id")){const product=await ownProduct();await changed("UPDATE hh_products SET name=?,description=?,category=?,price_pence=?,stock=?,delivery_info=?,status='draft',version=version+1,updated_at=? WHERE id=? AND business_id=? AND version=? AND EXISTS(SELECT 1 FROM hh_businesses WHERE id=hh_products.business_id AND owner_id=? AND status!='suspended')",...values,now(),product.id,business.id,version(),user.id);redirect=`/seller/products/${product.id}`;}
      else {const productId=id();await changed("INSERT INTO hh_products(id,business_id,name,description,category,price_pence,stock,delivery_info,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM hh_products WHERE business_id=?)<100",productId,business.id,...values,now(),now(),business.id);redirect=`/seller/products/${productId}`;}
    } else if(action==="product.status") {
      const product=await ownProduct(), status=choice(form,"status",["draft","published","archived"]);
      const restriction=status==="published"?" AND moderation_status='visible' AND EXISTS(SELECT 1 FROM hh_businesses WHERE id=hh_products.business_id AND status='approved' AND owner_id=?) AND EXISTS(SELECT 1 FROM hh_photos WHERE product_id=hh_products.id)":" AND EXISTS(SELECT 1 FROM hh_businesses WHERE id=hh_products.business_id AND status!='suspended' AND owner_id=?)";
      try{await changed("UPDATE hh_products SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?"+restriction,status,now(),product.id,version(),user.id);}catch{throw new Error("Publishing needs an approved business, an uploaded photo and a visible product. Refresh if this record changed.");}
      redirect=`/seller/products/${product.id}`;
    } else if(action==="photo.upload") {
      const product=await ownProduct();if(product.status!=="draft")throw new Error("Save this product as a draft before changing photos.");
      const file=form.get("photo");if(!(file instanceof File))throw new Error("Choose a photo.");
      const bytes=await sanitisePng(file), photoId=id(), key=`holyhub/products/${product.id}/${photoId}.png`;
      await bindings().BUCKET.put(key,bytes,{httpMetadata:{contentType:"image/png"}});
      try{await changed("INSERT INTO hh_photos(id,product_id,object_key,created_at) SELECT ?,?,?,? WHERE (SELECT count(*) FROM hh_photos WHERE product_id=?)<5 AND EXISTS(SELECT 1 FROM hh_products p JOIN hh_businesses b ON b.id=p.business_id WHERE p.id=? AND p.status='draft' AND b.owner_id=? AND b.status!='suspended')",photoId,product.id,key,now(),product.id,product.id,user.id);}catch{await bindings().BUCKET.delete(key);throw new Error("Up to five photos are allowed. Refresh if the product changed.");}
      redirect=`/seller/products/${product.id}`;
    } else if(action==="photo.remove") {
      const product=await ownProduct();if(product.status!=="draft")throw new Error("Save as draft before removing photos.");
      const photoId=text(form,"photo_id",1,100);
      const removed=await stmt("DELETE FROM hh_photos WHERE id=? AND product_id=? AND EXISTS(SELECT 1 FROM hh_products WHERE id=? AND status='draft') RETURNING object_key",photoId,product.id,product.id).first<{object_key:string}>();
      if(removed)await bindings().BUCKET.delete(removed.object_key);
      redirect=`/seller/products/${product.id}`;
    } else {
      if(!admin)return fail("Only HolyHub administrators can do this.",403);
      if(action==="business.review") {
        const target=recordId(), status=choice(form,"status",["approved","rejected","suspended"]), note=text(form,"review_note",1,1000);
        await changed("UPDATE hh_businesses SET status=?,review_note=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM hh_members WHERE id=hh_businesses.owner_id AND suspended=0)",status,note,now(),target,version());
        await stmt("INSERT INTO hh_notifications(id,user_id,message,created_at) SELECT ?,owner_id,?,? FROM hh_businesses WHERE id=?",id(),`Your business is ${status}. ${note}`,now(),target).run();await audit(target);redirect="/admin";
      } else if(action==="product.moderate") {
        const target=recordId();await changed("UPDATE hh_products SET moderation_status=?,version=version+1,updated_at=? WHERE id=? AND version=?",choice(form,"moderation_status",["visible","hidden"]),now(),target,version());await audit(target);redirect="/admin/products";
      } else if(action==="member.suspend") {
        const target=await one<Member>("SELECT * FROM hh_members WHERE id=?",recordId());if(!target||target.id===user.id||isAdmin(target.email))throw new Error("This administrator account cannot be suspended here.");
        await changed("UPDATE hh_members SET suspended=? WHERE id=?",number(form,"suspended",1),target.id);await audit(target.id);redirect="/admin/members";
      } else if(action==="event.save") {
        const values=[text(form,"name",2,120),text(form,"organiser",2,120),text(form,"location",2,160),text(form,"schedule",5,400),text(form,"description",20,4000),website(form)];if(!values[5])throw new Error("An organiser or booking website is required.");
        let target:string;
        if(form.get("id")){target=recordId();await changed("UPDATE hh_events SET name=?,organiser=?,location=?,schedule=?,description=?,website=?,status='draft',version=version+1,updated_at=? WHERE id=? AND version=?",...values,now(),target,version());}
        else{target=id();await stmt("INSERT INTO hh_events(id,name,organiser,location,schedule,description,website,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",target,...values,now(),now()).run();}
        await audit(target);redirect=`/admin/events/${target}`;
      } else if(action==="event.status") {
        const target=recordId();await changed("UPDATE hh_events SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?",choice(form,"status",["draft","published","archived"]),now(),target,version());await audit(target);redirect=`/admin/events/${target}`;
      } else return fail("Unknown action.");
    }
    if(request.headers.get("accept")?.includes("application/json"))return Response.json({redirect:redirect+"?saved=1"},{headers:{"Cache-Control":"no-store"}});
    return Response.redirect(new URL(redirect+"?saved=1",request.url),303);
  } catch(error) {
    console.error("HolyHub action failed",error instanceof Error?error.message:"Unknown failure");
    const message=error instanceof Error?error.message:"";
    return fail(/D1_|SQLITE|constraint|database|binding|R2_|fetch failed/i.test(message)?"We couldn’t save this change. Your information is still in the form; please try again.":message||"Unable to save. Please try again.");
  }
}

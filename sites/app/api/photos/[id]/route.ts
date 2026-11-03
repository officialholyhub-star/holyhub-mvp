import { getChatGPTUser } from "@/app/chatgpt-auth";
import { bindings, one, isAdmin } from "@/lib/data";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 try {
  const photo=await one<{object_key:string;owner_id:string;status:string;moderation_status:string;business_status:string;suspended:number}>("SELECT i.object_key,b.owner_id,p.status,p.moderation_status,b.status business_status,m.suspended FROM hh_photos i JOIN hh_products p ON p.id=i.product_id JOIN hh_businesses b ON b.id=p.business_id JOIN hh_members m ON m.id=b.owner_id WHERE i.id=?",id);
  if(!photo)return new Response("Not found",{status:404});
  const user=await getChatGPTUser(),viewer=user?await one<{suspended:number}>("SELECT suspended FROM hh_members WHERE id=?",user.userId):null;
  const publicPhoto=photo.status==="published"&&photo.moderation_status==="visible"&&photo.business_status==="approved"&&!photo.suspended;
  const authorised=user&&viewer&&!viewer.suspended&&(user.userId===photo.owner_id||isAdmin(user.email));
  if(!publicPhoto&&!authorised)return new Response("Not found",{status:404,headers:{"Cache-Control":"no-store"}});
  const object=await bindings().BUCKET.get(photo.object_key);if(!object)return new Response("Not found",{status:404});
  return new Response(object.body,{headers:{"Content-Type":"image/png","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cache-Control":"private, no-store"}});
 }catch{return new Response("Temporarily unavailable",{status:503,headers:{"Cache-Control":"no-store"}});}
}

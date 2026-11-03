"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/businesses";
import { readText,friendlyError } from "@/lib/marketplace";
import { sanitiseImage } from "@/lib/image-upload";
async function upload(form:FormData,kind:"product"|"evidence"){
 const {supabase,user}=await requireUser();const id=readText(form,"id");if(!isUuid(id))redirect("/account?error=Invalid%20upload.");const path=kind==="product"?`/seller/products/${id}`:`/refunds/${id}`;
 const {data:target,error:targetError}=await supabase.from(kind==="product"?"products":"refund_cases").select("id").eq("id",id).maybeSingle();if(targetError||!target)redirect(`${path}?error=This%20record%20is%20unavailable.`);
 let message:string|undefined;const file=form.get("image");let bytes:Buffer|undefined;
 if(!(file instanceof File))message="Choose an image.";else try{bytes=await sanitiseImage(file);}catch(error){message=error instanceof Error?error.message:"Invalid image.";}
 if(message||!bytes)redirect(`${path}?error=${encodeURIComponent(message??"Invalid image.")}`);
 const objectPath=`${user.id}/${id}/${randomUUID()}.webp`;const bucket=kind==="product"?"product-images":"refund-evidence";
 const {error}=await supabase.storage.from(bucket).upload(objectPath,bytes,{contentType:"image/webp",upsert:false});
 if(error)redirect(`${path}?error=We%20couldn%E2%80%99t%20upload%20that%20image.%20Please%20try%20again.`);
 const {error:registerError}=await supabase.rpc("register_image",{image_kind:kind,target_id:id,object_path:objectPath});
 if(registerError){await supabase.storage.from(bucket).remove([objectPath]);redirect(`${path}?error=${encodeURIComponent(friendlyError(registerError))}`);}
 revalidatePath(path);revalidatePath("/products","layout");redirect(`${path}?message=Image%20uploaded.`);
}
export async function uploadProductImage(form:FormData){return upload(form,"product");}
export async function uploadRefundEvidence(form:FormData){return upload(form,"evidence");}

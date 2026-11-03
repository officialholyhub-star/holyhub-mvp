import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/businesses";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const fallback=()=>NextResponse.redirect(new URL("/product-placeholder.svg",request.url));if(!isUuid(id))return fallback();
 const supabase=await createClient();let query=supabase.from("product_images").select("path").eq("product_id",id).order("created_at").limit(1);const image=request.nextUrl.searchParams.get("image");if(image&&isUuid(image))query=query.eq("id",image);const {data,error}=await query.maybeSingle();if(error||!data)return fallback();const {data:signed}=await supabase.storage.from("product-images").createSignedUrl(data.path,60);if(!signed)return fallback();return NextResponse.redirect(signed.signedUrl,{headers:{"Cache-Control":"private, no-store"}});
}

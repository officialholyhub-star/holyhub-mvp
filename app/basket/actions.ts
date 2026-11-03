"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/businesses";
import { friendlyError,readText } from "@/lib/marketplace";
export async function updateBasket(form:FormData){const id=readText(form,"id"),intent=readText(form,"intent");const {supabase}=await requireUser(isUuid(id)?`/products/${id}`:"/basket");const qty=readText(form,"quantity");if(!isUuid(id)||!/^\d{1,2}$/.test(qty))redirect("/basket?error=Invalid%20quantity.");const {error}=await supabase.rpc(intent==="add"?"add_basket_item":"set_basket_item",{product_id:id,quantity:Number(qty)});revalidatePath("/basket");redirect(`/basket?${error?"error":"message"}=${encodeURIComponent(error?friendlyError(error):Number(qty)===0?"Item removed.":"Basket updated.")}`);}
export async function reviewBasket(){const {supabase}=await requireUser("/basket");const {data,error}=await supabase.rpc("prepare_order");if(error)redirect(`/basket?error=${encodeURIComponent(friendlyError(error))}`);redirect(`/checkout/${data}`);}

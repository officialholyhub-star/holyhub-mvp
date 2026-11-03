"use server";
import { requireSeller } from "@/lib/seller";
import { readText,friendlyError } from "@/lib/marketplace";
import { isUuid } from "@/lib/businesses";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function updateFulfillment(form:FormData){const {supabase}=await requireSeller();const id=readText(form,"id");if(!isUuid(id))redirect("/seller/orders");const {error}=await supabase.rpc("update_fulfillment",{seller_order_id:id,new_status:readText(form,"status"),tracking:readText(form,"tracking")});revalidatePath("/seller/orders");redirect(`/seller/orders?${error?"error":"message"}=${encodeURIComponent(error?friendlyError(error):"Fulfilment updated.")}`);}

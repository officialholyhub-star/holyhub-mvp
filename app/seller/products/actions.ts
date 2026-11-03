"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/seller";
import { friendlyError, readText, validateProduct, type ProductState } from "@/lib/marketplace";
import { isUuid } from "@/lib/businesses";
export async function saveProduct(_previous: ProductState,form: FormData): Promise<ProductState> {
 const {supabase}=await requireSeller(); const result=validateProduct(form);
 if(!result.data) return {error:result.error,values:result.values};
 const id=readText(form,"id"); if(id && !isUuid(id)) return {error:"Invalid product.",values:result.values};
 const {data,error}=await supabase.rpc("save_product",{product_data:{...result.data,...(id?{id}:{})}});
 if(error) return {error:friendlyError(error),values:result.values};
 revalidatePath("/products","layout"); revalidatePath("/seller/products");
 redirect(`/seller/products/${data}?message=Product%20saved.`);
}
export async function changeProductStatus(form: FormData) {
 const {supabase}=await requireSeller();const id=readText(form,"id"),status=readText(form,"status");
 if(!isUuid(id) || !["published","draft","archived"].includes(status)) redirect("/seller/products?error=Invalid%20product.");
 const {data,error}=await supabase.rpc("set_product_status",{product_id:id,new_status:status});
 const message=error?friendlyError(error):data==="fee_due"?"This listing needs its listing fee paid. Fee collection is not connected yet; no payment has been taken.":"Product status updated.";
 revalidatePath("/products","layout");revalidatePath("/seller/products");
 redirect(`/seller/products/${id}?${error||data==="fee_due"?"error":"message"}=${encodeURIComponent(message)}`);
}

import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";
import type { Business } from "@/lib/businesses";
export async function requireSeller() {
 const context=await requireUser("/seller");
 const {data,error}=await context.supabase.from("businesses").select("*").eq("owner_id",context.user.id).maybeSingle();
 if(error) throw new Error("Storefront unavailable");
 if(!data) redirect("/account/business");
 return {...context,business:data as Business};
}

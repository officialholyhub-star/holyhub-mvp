"use server";
import { requireUser } from "@/lib/auth/require-user";
import { revalidatePath } from "next/cache";
export async function markRead(){const {supabase}=await requireUser();const {error}=await supabase.rpc("mark_notifications_read");if(error)throw new Error("Could not mark notifications read");revalidatePath("/notifications");}

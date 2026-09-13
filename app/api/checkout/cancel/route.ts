import { NextResponse } from "next/server";
import { isUuid } from "@/lib/businesses";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("order") ?? "";
  if (!isUuid(orderId)) return NextResponse.redirect(new URL("/basket?error=Checkout%20was%20cancelled.", request.url));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(`/checkout/${orderId}`)}`, request.url));
  await supabase.rpc("release_checkout", { order_id: orderId, release_state: "cancelled" });
  return NextResponse.redirect(new URL(`/checkout/${orderId}?cancelled=1`, request.url));
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth/site-url";

export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/login?error=This%20HolyHub%20account%20is%20currently%20unavailable.%20Please%20contact%20HolyHub.", await getSiteUrl()));
}

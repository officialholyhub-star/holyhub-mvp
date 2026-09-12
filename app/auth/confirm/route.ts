import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { getSiteUrl } from "@/lib/auth/site-url";

const allowedTypes: string[] = ["email", "signup", "recovery", "invite", "magiclink", "email_change"] satisfies EmailOtpType[];
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const tokenHash = search.get("token_hash");
  const type = search.get("type");
  const next = type === "recovery" ? "/auth/reset-password" : safeNextPath(search.get("next"));
  const origin = await getSiteUrl();
  if (tokenHash && type && allowedTypes.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/auth/login?error=That%20confirmation%20link%20is%20invalid%20or%20has%20expired.", origin));
}

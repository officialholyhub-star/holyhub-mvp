import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/account", "/lister", "/admin"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const needsAuth = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`)
  );

  if (needsAuth && !isSignedIn) {
    const url = request.nextUrl.clone();
    const next = url.pathname + url.search;
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("message", "Please log in to continue.");
    url.searchParams.set("next", next);
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    return redirected;
  }

  return response;
}

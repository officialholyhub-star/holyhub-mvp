import { type NextRequest, NextResponse } from "next/server";
import { isPlacesConfigured, mapChurchSuggestions } from "@/lib/church-places";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!isPlacesConfigured(apiKey)) return NextResponse.json({ available: false, suggestions: [] });

  let body: { input?: unknown; sessionToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : "";
  if (input.length < 3 || input.length > 120 || !/^[a-zA-Z0-9-]{16,128}$/.test(sessionToken)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey!,
      },
      body: JSON.stringify({
        input,
        sessionToken,
        includedPrimaryTypes: ["church"],
        includedRegionCodes: ["gb"],
        languageCode: "en-GB",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Google Places autocomplete returned an error", { status: response.status });
      return NextResponse.json({ available: true, error: "search_unavailable" }, { status: 502 });
    }

    const payload: unknown = await response.json();
    return NextResponse.json({ available: true, suggestions: mapChurchSuggestions(payload) });
  } catch {
    return NextResponse.json({ available: true, error: "search_unavailable" }, { status: 502 });
  }
}
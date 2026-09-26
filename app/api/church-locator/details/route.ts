import { type NextRequest, NextResponse } from "next/server";
import { isPlacesConfigured, mapChurchPlaceDetails } from "@/lib/church-places";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!isPlacesConfigured(apiKey)) return NextResponse.json({ available: false }, { status: 503 });

  let body: { placeId?: unknown; sessionToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const placeId = typeof body.placeId === "string" ? body.placeId : "";
  const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : "";
  if (!/^[a-zA-Z0-9_-]{5,255}$/.test(placeId) || !/^[a-zA-Z0-9-]{16,128}$/.test(sessionToken)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set("sessionToken", sessionToken);
    const response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey!,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,types",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Google Places details returned an error", { status: response.status });
      return NextResponse.json({ available: true, error: "details_unavailable" }, { status: 502 });
    }

    const location = mapChurchPlaceDetails(await response.json(), placeId);
    if (!location || !location.placeTypes.includes("church")) {
      return NextResponse.json({ available: true, error: "church_not_found" }, { status: 404 });
    }
    return NextResponse.json({ available: true, location });
  } catch {
    return NextResponse.json({ available: true, error: "details_unavailable" }, { status: 502 });
  }
}
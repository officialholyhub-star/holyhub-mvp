"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mapManualChurchLocation } from "@/lib/church-places";
import { requireUser } from "@/lib/auth/require-user";

export type ChurchProfileFormState = { error: string };

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function coordinate(value: string, minimum: number, maximum: number) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : NaN;
}

export async function saveChurchProfile(_previousState: ChurchProfileFormState, formData: FormData): Promise<ChurchProfileFormState> {
  const churchName = clean(formData.get("church_name"));
  const formattedAddress = clean(formData.get("formatted_address"));
  const postcode = clean(formData.get("postcode"));
  const city = clean(formData.get("city"));
  const country = clean(formData.get("country"));
  const googlePlaceId = clean(formData.get("google_place_id"));
  const latitudeValue = clean(formData.get("latitude"));
  const longitudeValue = clean(formData.get("longitude"));
  let placeTypes: string[] = [];

  if (googlePlaceId) {
    try {
      const parsed: unknown = JSON.parse(clean(formData.get("place_types")) || "[]");
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || item.length > 80)) {
        return { error: "Choose a valid church location or enter it manually." };
      }
      placeTypes = parsed;
    } catch {
      return { error: "Choose a valid church location or enter it manually." };
    }
  }

  const { supabase, user } = await requireUser();
  let churchLocation;

  if (googlePlaceId) {
    const latitude = coordinate(latitudeValue, -90, 90);
    const longitude = coordinate(longitudeValue, -180, 180);
    if (!/^[a-zA-Z0-9_-]{5,255}$/.test(googlePlaceId) || !placeTypes.includes("church") || !churchName || churchName.length > 200 || !formattedAddress || formattedAddress.length > 500 || postcode.length > 30 || city.length > 120 || !country || country.length > 100 || Number.isNaN(latitude) || Number.isNaN(longitude) || ((latitude === null) !== (longitude === null))) {
      return { error: "Choose a valid church location or enter it manually." };
    }
    churchLocation = { churchName, formattedAddress, postcode, city, country, latitude, longitude, googlePlaceId, placeTypes };
  } else {
    churchLocation = mapManualChurchLocation({ churchName, formattedAddress, postcode, city, country });
    if (!churchLocation) return { error: "Enter a church name, address and country. Postcode and town/city are optional." };
  }

  const { error } = await supabase.from("church_profiles").upsert({
    owner_user_id: user.id,
    church_name: churchLocation.churchName,
    formatted_address: churchLocation.formattedAddress,
    postcode: churchLocation.postcode,
    city: churchLocation.city,
    country: churchLocation.country,
    latitude: churchLocation.latitude,
    longitude: churchLocation.longitude,
    google_place_id: churchLocation.googlePlaceId,
    place_types: churchLocation.placeTypes,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_user_id" });

  if (error) {
    if (error.code === "23505") return { error: "This church already has a HolyHub profile. Please contact support if you need access to it." };
    console.error("Church profile save failed", { code: error.code, message: error.message });
    return { error: "We couldn't save your church location. Please try again." };
  }

  revalidatePath("/account");
  revalidatePath("/churches/profile");
  redirect("/account?message=Church%20location%20saved.");
}
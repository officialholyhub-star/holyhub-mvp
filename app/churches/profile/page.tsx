import Link from "next/link";
import { ChurchLocationForm } from "@/components/church-location-form";
import { saveChurchProfile } from "@/app/churches/profile/actions";
import { requireUser } from "@/lib/auth/require-user";
import { isPlacesConfigured } from "@/lib/church-places";

export const dynamic = "force-dynamic";

export default async function ChurchProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase
    .from("church_profiles")
    .select("church_name, formatted_address, postcode, city, country, latitude, longitude, google_place_id, place_types")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const initialLocation = profile ? {
    churchName: profile.church_name,
    formattedAddress: profile.formatted_address,
    postcode: profile.postcode,
    city: profile.city,
    country: profile.country,
    latitude: profile.latitude,
    longitude: profile.longitude,
    googlePlaceId: profile.google_place_id,
    placeTypes: profile.place_types,
  } : null;

  return (
    <section className="auth-wrap">
      <div className="card">
        <div className="card-header">
          <p className="eyebrow">HolyHub churches</p>
          <h1>Church location</h1>
          <p>Find and save the location for your church profile.</p>
        </div>
        {error ? (
          <p className="notice notice-error" role="alert">We couldn&apos;t load your church profile. Refresh the page to try again before saving.</p>
        ) : (
          <ChurchLocationForm
            action={saveChurchProfile}
            initialLocation={initialLocation}
            locatorAvailable={isPlacesConfigured(process.env.GOOGLE_PLACES_API_KEY)}
            isDevelopment={process.env.NODE_ENV === "development"}
          />
        )}
        <Link className="button button-quiet form-back" href="/account">Back to account</Link>
      </div>
    </section>
  );
}
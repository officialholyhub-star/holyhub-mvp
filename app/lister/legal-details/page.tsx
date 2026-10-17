import { requireRole } from "@/lib/auth/require-user";
import { SELLER_LEGAL_FIELDS, type SellerLegalProfile } from "@/lib/seller-legal";
import { SellerLegalFields } from "@/components/seller-legal-fields";
import { saveSellerLegalProfile } from "@/app/lister/apply/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SellerLegalDetailsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const { data, error } = await supabase.from("seller_legal_profiles").select(SELLER_LEGAL_FIELDS).eq("user_id", user.id).maybeSingle();
  const profile = data as SellerLegalProfile | null;

  return <section className="auth-wrap lister-application">
    <div className="card">
      <div className="card-header">
        <p className="eyebrow">Your HolyHub shop</p>
        <h1>Seller legal details</h1>
        <p>Keep the legal seller information HolyHub uses for customer disclosures and order records accurate.</p>
      </div>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {error && <p className="notice notice-error" role="alert">We couldn’t load your seller details. Please refresh before making changes.</p>}
      {!error && profile?.verification_status === "verified" && <p className="notice notice-success">Seller details verified. If you change them, they will need review again before customer sales can continue.</p>}
      {!error && profile?.verification_status === "pending" && <p className="notice notice-info">Seller details are waiting for HolyHub review.</p>}
      {!error && profile?.verification_status === "rejected" && <p className="notice notice-error">Changes needed. {profile.verification_note ?? "Please check your seller details and submit them again."}</p>}
      {!error && <form className="form" action={saveSellerLegalProfile}>
        <SellerLegalFields profile={profile} defaultEmail={user.email ?? ""} />
        <button className="button button-primary" type="submit">Save seller details</button>
      </form>}
      <Link className="button button-quiet form-back" href="/lister">Back to lister space</Link>
    </div>
  </section>;
}

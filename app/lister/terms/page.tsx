import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { acceptListerTerms } from "./actions";

export const dynamic = "force-dynamic";

type CurrentTerms = {
  version: string;
  content_sha256: string;
  published_path: string;
  activated_at: string;
};

export default async function ListerTermsAcceptancePage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; onboarding?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const currentResult = await supabase.rpc("get_current_lister_terms");
  const current = (Array.isArray(currentResult.data) ? currentResult.data[0] : null) as CurrentTerms | null;

  let accepted = false;
  let acceptanceError = false;
  if (current) {
    const acceptance = await supabase.from("lister_terms_acceptances")
      .select("terms_version, terms_sha256, accepted_at")
      .eq("user_id", user.id)
      .eq("terms_version", current.version)
      .eq("terms_sha256", current.content_sha256)
      .maybeSingle();
    accepted = Boolean(acceptance.data);
    acceptanceError = Boolean(acceptance.error);
  }

  return <section className="auth-wrap">
    <div className="card">
      <p className="eyebrow">Seller activation</p>
      <h1>Lister Terms</h1>
      <p>HolyHub records the exact version accepted before customer sales are enabled.</p>
      {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
      {params.message && <p className="notice notice-success" role="status">{params.message}</p>}
      {(currentResult.error || acceptanceError) && <p className="notice notice-error" role="alert">We couldn&apos;t check your Lister Terms status. Please refresh before continuing.</p>}

      {!currentResult.error && !current && <div className="notice notice-info">
        <strong>Final Lister Terms are still being reviewed.</strong>
        <p>You can continue preparing your shop, but customer sales remain unavailable until the final reviewed version is published and accepted.</p>
      </div>}

      {current && accepted && <div className="notice notice-success" role="status">
        <strong>Current Lister Terms accepted.</strong>
        <p>Version {current.version}</p>
      </div>}

      {current && !currentResult.error && !accepted && !acceptanceError && <form action={acceptListerTerms} className="form">
        <input type="hidden" name="terms_version" value={current.version} />
        <input type="hidden" name="terms_sha256" value={current.content_sha256} />
        <p><strong>Current version:</strong> {current.version}</p>
        <p><strong>Content SHA-256:</strong> <code>{current.content_sha256}</code></p>
        <p><Link className="text-link" href={current.published_path} target="_blank">Read the Lister Terms</Link></p>
        <label className="checkbox-row"><input type="checkbox" name="accept_terms" required /><span>I have read and agree to the current HolyHub Lister Terms.</span></label>
        <button className="button button-primary" type="submit">Accept Lister Terms</button>
      </form>}

      <div className="button-row">{params.onboarding === "1" && <Link className="button button-quiet" href="/lister/onboarding">Return to onboarding</Link>}<Link className="button button-quiet" href="/lister">Back to seller dashboard</Link><Link className="text-link" href="/lister-terms">View Lister Terms</Link></div>
    </div>
  </section>;
}

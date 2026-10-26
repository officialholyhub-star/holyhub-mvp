import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminMfaIdentity } from "@/lib/auth/require-user";
import { adminNextPath, getAdminMfaState, mfaPath } from "@/lib/auth/admin-mfa";
import { MfaForm } from "../mfa-form";

export default async function AdminMfaSetup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = adminNextPath((await searchParams).next ?? null);
  const { supabase } = await requireAdminMfaIdentity();
  const state = await getAdminMfaState(supabase);
  if (state.factors.length && !state.isAal2) redirect(mfaPath("challenge", next));
  return <section className="auth-wrap"><div className="card">
    <div className="card-header"><h2>Secure your admin account</h2>
      <p>{state.isAal2 ? "Add and verify a backup authenticator." : "Admin access requires an authenticator app."}</p></div>
    <MfaForm next={next} factors={[]} setup />
    <p>No longer have your authenticator? Contact the HolyHub founder for a manual identity review. Email or password reset alone cannot unlock admin access.</p>
    <Link className="text-link" href="/account">Return to your account</Link>
  </div></section>;
}

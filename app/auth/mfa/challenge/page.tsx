import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminMfaIdentity } from "@/lib/auth/require-user";
import { adminNextPath, getAdminMfaState, mfaPath } from "@/lib/auth/admin-mfa";
import { MfaForm } from "../mfa-form";

export default async function AdminMfaChallenge({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = adminNextPath((await searchParams).next ?? null);
  const { supabase } = await requireAdminMfaIdentity();
  const state = await getAdminMfaState(supabase);
  if (state.isAal2) redirect(next);
  if (!state.factors.length) redirect(mfaPath("setup", next));
  return <section className="auth-wrap"><div className="card">
    <div className="card-header"><h2>Enter the code from your authenticator app</h2><p>Verify your session to continue to HolyHub admin.</p></div>
    <MfaForm next={next} factors={state.factors.map(({ id, friendly_name }) => ({ id, friendly_name }))} />
    <p>You can select a verified backup authenticator. If all devices are lost, contact the HolyHub founder for a manual identity review.</p>
    <Link className="text-link" href="/account">Return to your account</Link>
  </div></section>;
}

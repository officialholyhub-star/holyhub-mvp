import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { getAdminMfaState } from "@/lib/auth/admin-mfa";

export default async function AdminSecurity() {
  const { supabase } = await requireRole("admin");
  const { factors } = await getAdminMfaState(supabase);
  return <section className="auth-wrap"><div className="card">
    <div className="card-header"><h2>Admin account security</h2><p>This session has completed MFA.</p></div>
    <p>{factors.length} verified authenticator{factors.length === 1 ? "" : "s"}. Keep a backup on a separate secure device.</p>
    <Link className="button button-primary" href="/auth/mfa/setup?next=%2Fadmin%2Fsecurity">Add a backup authenticator</Link>
    <p>Authenticator removal and lost-device recovery require manual review. Never share setup keys or codes with support.</p>
    <Link className="text-link" href="/admin">Return to admin</Link>
  </div></section>;
}

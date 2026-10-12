import { requireUser } from "@/lib/auth/require-user";
import { AccountDeletionRequest } from "@/components/account-deletion-request";
export default async function DeleteAccountPage() {
  const { user } = await requireUser();
  return <section className="auth-wrap"><div className="card"><h1>Delete account</h1><p>You can permanently close your HolyHub account. Personal account data will be deleted where possible. HolyHub may retain order, payment, tax, legal or other records where legitimately required.</p><p>If you have a lister shop, unresolved orders, payouts, refunds and other fulfilment obligations must be resolved before the shop closes, so customers and payments are protected. Historical completed orders alone do not prevent account closure. Deletion does not cancel orders or issue refunds.</p><AccountDeletionRequest accountId={user.id} /></div></section>;
}

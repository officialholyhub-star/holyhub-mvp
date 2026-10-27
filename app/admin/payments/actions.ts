"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { toPence } from "@/lib/checkout-pricing";
import { getStripe } from "@/lib/stripe";
import { hydratePaymentOrder, runPaymentQueue } from "@/lib/payment-operations";
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
export async function managePayments(data: FormData) {
  const { user } = await requireRole("admin");
  const admin = createAdminClient();
  const action = value(data, "action");
  let message = "Payment action recorded.";
  try {
    if (action === "run") {
      const result = await runPaymentQueue(admin);
      message = `Processed ${result.processed}; held ${result.held}; needs review ${result.errors}.`;
    } else if (action === "account") {
      const accountId = value(data, "stripe_account_id");
      const account = await getStripe().accounts.retrieve(accountId);
      if (account.deleted || account.capabilities?.transfers !== "active") throw new Error("Account is not transfer ready.");
      // Account changes are explicit, reviewed operations. Never change the
      // destination of an already-reserved transfer.
      const saved = await admin.from("seller_payment_accounts").upsert({
        seller_user_id: value(data, "seller_user_id"), stripe_account_id: account.id,
        verified_by: user.id, verified_at: new Date().toISOString(),
      });
      if (saved.error) throw new Error("Account mapping failed.");
    } else if (action === "rebate") {
      if (value(data, "verified") !== "yes") throw new Error("Verification required.");
      const amount = toPence(value(data, "rebate_amount"));
      if (amount === null || amount <= 0) throw new Error("Invalid provider reimbursement amount.");
      const result = await admin.rpc("record_processing_fee_reimbursement", {
        p_refund_operation_id: value(data, "refund_operation_id"),
        p_provider_reference: value(data, "provider_reference"), p_amount: amount,
        p_evidence: value(data, "evidence"), p_verified_by: user.id,
      });
      if (result.error) throw new Error("Provider reimbursement could not be recorded.");
      message = "Provider reimbursement recorded. Review reconciliation exceptions before processing.";
    } else if (action === "refund") {
      if (value(data, "verified") !== "yes") throw new Error("Verification required.");
      const share = value(data, "fee_responsibility_bps");
      if (!/^(0|[1-9][0-9]{0,4})$/.test(share) || Number(share) > 10000) {
        throw new Error("Explicit integer processing-fee basis points required.");
      }
      const sellerOrderId = value(data, "seller_order_id");
      const portion = await admin.from("seller_orders").select("order_id").eq("id", sellerOrderId).single();
      if (portion.error) throw new Error("Seller portion not found.");
      // Failure to obtain the fee must not prevent recording a properly due
      // refund. Transfer/recovery accounting remains held until evidence arrives.
      try { await hydratePaymentOrder(portion.data.order_id, admin); } catch { /* Reconcile later. */ }
      const responsibility = value(data, "responsibility");
      if (!["seller", "holyhub"].includes(responsibility)) throw new Error("Verified responsibility is required.");
      const lines = [];
      for (const [key, submitted] of data.entries()) {
        if (!key.startsWith("item_amount_")) continue;
        const amount = toPence(String(submitted));
        if (amount === null) throw new Error("Invalid product refund amount.");
        const restore = Number(value(data, `restore_${key.slice("item_amount_".length)}`) || 0);
        if (amount > 0 || restore > 0) lines.push({ item_id: key.slice("item_amount_".length), amount, restore_quantity: restore });
      }
      const delivery = toPence(value(data, "delivery"));
      if (delivery === null) throw new Error("Invalid delivery refund amount.");
      const result = await admin.rpc("request_payment_refund", {
        p_seller_order_id: sellerOrderId, p_key: value(data, "request_key"),
        p_lines: lines, p_delivery: delivery,
        p_reason: value(data, "reason"), p_seller_responsible: responsibility === "seller",
        p_fee_responsibility_bps: Number(share),
      });
      if (result.error) throw new Error("Refund reservation failed.");
      message = "Refund queued. Run processing, then check its provider status.";
    } else throw new Error("Unknown action.");
  } catch {
    redirect("/admin/payments?error=Action%20could%20not%20be%20confirmed.%20Review%20the%20financial%20records%20before%20retrying.");
  }
  revalidatePath("/admin/payments");
  redirect(`/admin/payments?message=${encodeURIComponent(message)}`);
}

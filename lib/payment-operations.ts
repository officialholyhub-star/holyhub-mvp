import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

type Admin = ReturnType<typeof createAdminClient>;
type Operation = {
  id: string; kind: "transfer" | "refund" | "reversal" | "fee_credit_transfer"; amount: number;
  allocation_id: string; order_id: string; seller_user_id: string; payment_intent_id: string;
  status: string; stripe_id: string | null; lease_token: string;
  details: Record<string, string | number | boolean>;
};
async function rpc(admin: Admin, name: string, args: Record<string, unknown>) {
  const result = await admin.rpc(name, args);
  if (result.error) throw new Error(`Payment database operation failed: ${name}`);
  return result.data;
}
function objectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}
async function settle(admin: Admin, op: Operation, status: string, stripeId: string | null, failureCode: string | null = null, webhook = false) {
  await rpc(admin, "settle_payment_operation", {
    p_operation_id: op.id, p_token: webhook ? null : op.lease_token,
    p_status: status, p_stripe_id: stripeId, p_amount: op.amount, p_failure_code: failureCode,
  });
}

// The dependency boundary lets local tests exercise the actual worker without
// contacting Stripe or Supabase. Nothing starts automatically on module import.
export async function executePaymentOperation(id: string, admin = createAdminClient(), stripe = getStripe()) {
  const op = await rpc(admin, "claim_payment_operation", { p_operation_id: id }) as Operation | null;
  if (!op) return "held";
  const options = { idempotencyKey: `holyhub:c11:${op.id}` };
  const metadata = { holyhub_operation_id: op.id, holyhub_allocation_id: op.allocation_id,
    ...(op.kind === "fee_credit_transfer" ? {
      holyhub_kind: "fee_credit_transfer", holyhub_refund_operation_id: String(op.details.refund_operation_id),
      holyhub_credit_id: String(op.details.credit_id), holyhub_policy_version: String(op.details.policy_version),
    } : {}),
  };
  try {
    if (op.kind === "refund" && op.amount === 0) {
      await settle(admin, op, "succeeded", null);
    } else if (op.kind === "refund") {
      if (!op.payment_intent_id) throw new Error("Payment identity requires reconciliation.");
      const refund = await stripe.refunds.create({
        payment_intent: op.payment_intent_id, amount: op.amount, metadata,
      }, options);
      await settleRefund(op, refund, admin);
    } else if (op.kind === "transfer" || op.kind === "fee_credit_transfer") {
      if (op.amount === 0) {
        await settle(admin, op, "succeeded", null);
      } else {
        const account = await stripe.accounts.retrieve(String(op.details.destination));
        if (account.deleted || account.capabilities?.transfers !== "active") throw new Error("Seller transfers are not enabled.");
        const transfer = await stripe.transfers.create({
          amount: op.amount, currency: "gbp", destination: String(op.details.destination),
          ...(op.kind === "transfer" ? { source_transaction: String(op.details.charge) } : {}), transfer_group: `holyhub:${op.order_id}`, metadata,
        }, options);
        verifyTransfer(op, transfer);
        await settle(admin, op, "succeeded", transfer.id);
      }
    } else {
      const reversal = await stripe.transfers.createReversal(String(op.details.transfer_id), {
        amount: op.amount, metadata,
      }, options);
      if (reversal.amount !== op.amount || objectId(reversal.transfer) !== op.details.transfer_id) throw new Error("Reversal evidence mismatch.");
      await settle(admin, op, "succeeded", reversal.id);
    }
    return "processed";
  } catch (error) {
    if (op.kind === "fee_credit_transfer") {
      // Any uncertain outcome is reconciled against the original operation.
      // A second create is never automatically authorized for a fee credit.
      try { await settle(admin, op, "failed", op.stripe_id, "credit_outcome_requires_reconciliation"); } catch { /* Durable lease/queue remains visible. */ }
    }
    // Only a definitive provider refusal establishes unrecoverable seller funds.
    // Network errors and unknown outcomes retain their durable reservation/key.
    if (op.kind === "reversal" && error instanceof Stripe.errors.StripeInvalidRequestError
      && ["balance_insufficient", "insufficient_funds"].includes(error.code ?? "")) {
      await settle(admin, op, "failed", null, "seller_balance_insufficient");
      return "seller_debt";
    }
    throw new Error(`Payment operation ${op.id} requires retry or reconciliation.`);
  }
}
function verifyTransfer(op: Operation, transfer: Stripe.Transfer) {
  if (transfer.amount !== op.amount || transfer.currency !== "gbp"
    || objectId(transfer.destination) !== op.details.destination
    || (op.kind === "transfer" && objectId(transfer.source_transaction) !== op.details.charge)
    || (op.kind === "fee_credit_transfer" && (objectId(transfer.source_transaction) !== null
      || transfer.metadata.holyhub_kind !== "fee_credit_transfer"
      || transfer.metadata.holyhub_allocation_id !== op.allocation_id
      || transfer.metadata.holyhub_refund_operation_id !== op.details.refund_operation_id
      || transfer.metadata.holyhub_credit_id !== op.details.credit_id
      || transfer.metadata.holyhub_policy_version !== String(op.details.policy_version)))
    || transfer.metadata.holyhub_operation_id !== op.id) throw new Error("Transfer evidence mismatch.");
}
async function settleRefund(op: Operation, refund: Stripe.Refund, admin: Admin, webhook = false) {
  if (refund.amount !== op.amount || refund.currency !== "gbp" || objectId(refund.payment_intent) !== op.payment_intent_id
    || refund.metadata?.holyhub_operation_id !== op.id) throw new Error("Refund evidence mismatch.");
  const status = refund.status === "succeeded" ? "succeeded"
    : refund.status === "failed" || refund.status === "canceled" ? "failed" : "pending";
  await settle(admin, op, status, refund.id, status === "failed" ? "stripe_refund_failed" : null, webhook);
}

export async function hydratePaymentOrder(orderId: string, admin = createAdminClient(), stripe = getStripe()) {
  await rpc(admin, "sync_payment_order", { p_order_id: orderId });
  const payment = await admin.from("platform_payments").select("payment_intent_id,amount").eq("order_id", orderId).single();
  if (payment.error || !payment.data?.payment_intent_id) throw new Error("Payment identity unavailable.");
  const intent = await stripe.paymentIntents.retrieve(payment.data.payment_intent_id, { expand: ["latest_charge.balance_transaction"] });
  const charge = intent.latest_charge;
  if (intent.status !== "succeeded" || intent.currency !== "gbp" || intent.amount_received !== payment.data.amount
    || !charge || typeof charge === "string" || !charge.paid || charge.currency !== "gbp" || charge.amount !== payment.data.amount) {
    throw new Error("Paid charge evidence unavailable.");
  }
  const balance = typeof charge.balance_transaction === "string"
    ? await stripe.balanceTransactions.retrieve(charge.balance_transaction) : charge.balance_transaction;
  if (!balance) return; // Refunds may proceed; seller transfer still fails closed.
  await rpc(admin, "match_payment_charge", {
    p_order_id: orderId, p_intent: intent.id, p_charge: charge.id, p_amount: charge.amount, p_fee: balance.fee,
  });
}

// Operator-driven queue drain with paginated scans. No cron is installed.
export async function runPaymentQueue(admin = createAdminClient(), stripe = getStripe()) {
  const results = { processed: 0, held: 0, errors: 0 };
  const orders = await scanIds(async (start, end) => admin.from("orders").select("id").eq("order_status", "paid").order("created_at").order("id").range(start, end));
  for (const order of orders) {
    try { await hydratePaymentOrder(order.id, admin, stripe); } catch { results.errors++; }
  }
  const reconcilable = await scanIds(async (start, end) => admin.from("payment_operations").select("id").in("status", ["running", "pending", "attention"]).order("created_at").order("id").range(start, end));
  for (const op of reconcilable) {
    try { await reconcilePaymentOperation(op.id, admin, stripe); } catch { results.errors++; }
  }
  const unaccounted = await scanIds(async (start, end) => admin.from("payment_operations").select("id").eq("kind", "refund").eq("status", "succeeded").is("details->>accounted", null).order("id").range(start, end));
  for (const op of unaccounted) await rpc(admin, "account_payment_refund", { p_operation_id: op.id });
  // Scan separately from ordinary accounting: fee evidence may arrive later.
  const creditRefunds = await scanIds(async (start, end) => admin.from("payment_operations").select("id")
    .eq("kind", "refund").in("processing_fee_credit_policy_version", [1, 2])
    .order("created_at").order("id").range(start, end));
  for (const op of creditRefunds) {
    try { await rpc(admin, "reserve_processing_fee_credit", { p_refund_operation_id: op.id }); } catch { results.errors++; }
  }
  const stockIssues = await scanIds(async (start, end) => admin.from("refund_lines").select("id:operation_id").not("restoration_error", "is", null).order("operation_id").order("order_item_id").range(start, end));
  for (const id of new Set(stockIssues.map(line => line.id))) {
    await rpc(admin, "restore_payment_stock", { p_operation_id: id });
  }
  const portions = await scanIds(async (start, end) => admin.from("seller_orders").select("id").eq("fulfilment_status", "delivered").order("created_at").order("id").range(start, end));
  for (const portion of portions) {
    try { await rpc(admin, "reserve_seller_transfer", { p_seller_order_id: portion.id }); } catch { results.held++; }
  }
  const operations = await scanIds(async (start, end) => admin.from("payment_operations").select("id").in("status", ["queued", "running"]).order("created_at").order("id").range(start, end));
  for (const op of operations) {
    try { results[await executePaymentOperation(op.id, admin, stripe) === "held" ? "held" : "processed"]++; }
    catch { results.errors++; }
  }
  return results;
}

export async function processFinancialWebhook(event: Stripe.Event, admin = createAdminClient(), stripe = getStripe()) {
  const object = event.data.object as Stripe.Refund | Stripe.Transfer;
  const write = await admin.from("payment_webhook_events").upsert({
    stripe_event_id: event.id, event_type: event.type, stripe_object_id: object.id,
  }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
  if (write.error) throw new Error("Financial event recording unavailable.");
  const prior = await admin.from("payment_webhook_events").select("state").eq("stripe_event_id", event.id).single();
  if (prior.error) throw new Error("Financial event state unavailable.");
  if (prior.data.state === "processed") return;
  // Fetch current provider state: late/out-of-order events cannot downgrade a refund.
  const opId = object.metadata?.holyhub_operation_id;
  if (!opId) {
    // Manual/provider-originated financial changes cannot be silently reconciled.
    const result = await admin.from("payment_webhook_events").update({ state: "attention" }).eq("stripe_event_id", event.id);
    if (result.error) throw new Error("Financial event attention recording failed.");
    const intentId = object.object === "refund" ? objectId(object.payment_intent) : null;
    const chargeId = object.object === "transfer" ? objectId(object.source_transaction) : null;
    if (intentId || chargeId) {
      const hold = admin.from("platform_payments").update({ reconciliation_hold: true });
      const saved = intentId ? await hold.eq("payment_intent_id", intentId) : await hold.eq("charge_id", chargeId);
      if (saved.error) throw new Error("External adjustment hold failed.");
    }
    return;
  }
  const row = await admin.from("payment_operations").select("*").eq("id", opId).single();
  if (row.error) throw new Error("Financial operation not found.");
  const allocation = await admin.from("seller_allocations").select("order_id").eq("id", row.data.allocation_id).single();
  if (allocation.error) throw new Error("Financial allocation not found.");
  const payment = await admin.from("platform_payments").select("payment_intent_id").eq("order_id", allocation.data.order_id).single();
  if (payment.error) throw new Error("Financial payment not found.");
  const op = { ...row.data, order_id: allocation.data.order_id, payment_intent_id: payment.data.payment_intent_id } as Operation;
  if (event.type.startsWith("refund.") && op.kind === "refund") {
    await settleRefund(op, await stripe.refunds.retrieve(object.id), admin, true);
  } else if (event.type.startsWith("transfer.") && (op.kind === "transfer" || op.kind === "fee_credit_transfer")) {
    const transfer = await stripe.transfers.retrieve(object.id);
    verifyTransfer(op, transfer);
    await settle(admin, op, "succeeded", transfer.id, null, true);
    if (op.kind === "transfer" && !(await reconcileTransferReversals(op, transfer, admin, stripe))) {
      const attention = await admin.from("payment_webhook_events").update({ state: "attention" }).eq("stripe_event_id", event.id);
      if (attention.error) throw new Error("Reversal reconciliation acknowledgement failed.");
      return;
    }
  } else throw new Error("Financial event kind mismatch.");
  const result = await admin.from("payment_webhook_events").update({ state: "processed", processed_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
  if (result.error) throw new Error("Financial event acknowledgement unavailable.");
}

async function scanIds(fetchPage: (start: number, end: number) => PromiseLike<{ data: { id: string }[] | null; error: unknown }>) {
  const rows: { id: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchPage(offset, offset + 99);
    if (page.error || !page.data) throw new Error("Financial scan unavailable.");
    rows.push(...page.data);
    if (page.data.length < 100) return rows;
  }
}

// Recovery after a crash does not depend on Stripe retaining idempotency keys.
// Search provider objects by the durable operation metadata; absence never
// authorizes a second create beyond the retry horizon.
export async function reconcilePaymentOperation(id: string, admin = createAdminClient(), stripe = getStripe()) {
  const row = await admin.from("payment_operations").select("*").eq("id", id).single();
  if (row.error) throw new Error("Operation lookup failed.");
  const allocation = await admin.from("seller_allocations").select("order_id").eq("id", row.data.allocation_id).single();
  if (allocation.error) throw new Error("Allocation lookup failed.");
  const payment = await admin.from("platform_payments").select("payment_intent_id").eq("order_id", allocation.data.order_id).single();
  if (payment.error) throw new Error("Payment lookup failed.");
  const op = { ...row.data, order_id: allocation.data.order_id, payment_intent_id: payment.data.payment_intent_id } as Operation;
  if (op.kind === "refund") {
    const matches: Stripe.Refund[] = [];
    if (op.stripe_id) matches.push(await stripe.refunds.retrieve(op.stripe_id));
    else if (op.payment_intent_id) await stripe.refunds.list({ payment_intent: op.payment_intent_id, limit: 100 }).autoPagingEach(r => {
      if (r.metadata?.holyhub_operation_id === op.id) matches.push(r);
    });
    if (matches.length > 1) throw new Error("Duplicate provider refunds require review.");
    if (matches[0]) await settleRefund(op, matches[0], admin, true);
  } else if (op.kind === "transfer" || op.kind === "fee_credit_transfer") {
    if (op.amount === 0) return;
    const matches: Stripe.Transfer[] = [];
    if (op.stripe_id) matches.push(await stripe.transfers.retrieve(op.stripe_id));
    else await stripe.transfers.list({ transfer_group: `holyhub:${op.order_id}`, limit: 100 }).autoPagingEach(t => {
      if (t.metadata.holyhub_operation_id === op.id) matches.push(t);
    });
    if (matches.length > 1) throw new Error("Duplicate provider transfers require review.");
    if (matches[0]) {
      verifyTransfer(op, matches[0]); await settle(admin, op, "succeeded", matches[0].id, null, true);
      if (op.kind === "transfer") await reconcileTransferReversals(op, matches[0], admin, stripe);
    }
  } else {
    const matches: Stripe.TransferReversal[] = [];
    await stripe.transfers.listReversals(String(op.details.transfer_id), { limit: 100 }).autoPagingEach(r => {
      if (r.metadata?.holyhub_operation_id === op.id) matches.push(r);
    });
    if (matches.length > 1) throw new Error("Duplicate provider reversals require review.");
    const reversal = matches[0];
    if (reversal) {
      if (reversal.amount !== op.amount || objectId(reversal.transfer) !== op.details.transfer_id) throw new Error("Reversal mismatch.");
      await settle(admin, op, "succeeded", reversal.id, null, true);
    }
  }
}

async function reconcileTransferReversals(op: Operation, transfer: Stripe.Transfer, admin: Admin, stripe: Stripe) {
  if (!transfer.amount_reversed) return true;
  const known = await admin.from("payment_operations").select("id,status").eq("allocation_id", op.allocation_id).eq("kind", "reversal");
  if (known.error) throw new Error("Reversal ledger unavailable.");
  for (const reversal of known.data ?? []) {
    if (!["succeeded", "failed"].includes(reversal.status)) await reconcilePaymentOperation(reversal.id, admin, stripe);
  }
  const applied = await admin.from("payment_operations").select("amount").eq("allocation_id", op.allocation_id).eq("kind", "reversal").eq("status", "succeeded");
  if (applied.error) throw new Error("Reversal total unavailable.");
  const expected = (applied.data ?? []).reduce((sum, row) => sum + row.amount, 0);
  if (expected === transfer.amount_reversed) return true;
  const hold = await admin.from("platform_payments").update({ reconciliation_hold: true }).eq("order_id", op.order_id);
  if (hold.error) throw new Error("External reversal hold unavailable.");
  return false;
}

import { getStripe } from "@/lib/stripe";

export async function getStripeProcessingFee(paymentIntentId: string | null): Promise<number | null> {
  if (!paymentIntentId) throw new Error("Stripe payment intent is missing.");

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });

  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge) return null;

  const charge = typeof latestCharge === "string"
    ? await stripe.charges.retrieve(latestCharge, { expand: ["balance_transaction"] })
    : latestCharge;
  const balanceTransaction = charge.balance_transaction;
  if (!balanceTransaction) return null;

  const transaction = typeof balanceTransaction === "string"
    ? await stripe.balanceTransactions.retrieve(balanceTransaction)
    : balanceTransaction;

  if (!Number.isSafeInteger(transaction.fee) || transaction.fee < 0) {
    throw new Error("Stripe processing fee is invalid.");
  }

  return transaction.fee;
}

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

function toSafeInteger(value: unknown, fallback: number) {
  const amount = typeof value === "string" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  return Number.isSafeInteger(amount) ? amount : fallback;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const status = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
    ? "paid"
    : event.type === "checkout.session.expired"
      ? "cancelled"
      : event.type === "checkout.session.async_payment_failed"
        ? "failed"
      : null;
  if (!status) return NextResponse.json({ received: true });

  try {
    const admin = createAdminClient();
    const checkoutSessionRecord = await admin
      .from("checkout_sessions")
      .select("id, user_id, product_subtotal, delivery_total, amount_total, holyhub_commission, seller_amount_total, stripe_checkout_session_id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (checkoutSessionRecord.error) {
      console.error("Stripe checkout lookup failed", checkoutSessionRecord.error);
      return NextResponse.json({ error: "Could not load payment record." }, { status: 500 });
    }

    const update = {
      status,
      payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      updated_at: new Date().toISOString(),
      completed_at: status === "paid" ? new Date().toISOString() : null,
    };
    const { error: updateError } = await admin.from("checkout_sessions").update(update).eq("stripe_checkout_session_id", session.id);
    if (updateError) {
      console.error("Stripe checkout status update failed", updateError);
      return NextResponse.json({ error: "Could not record payment status." }, { status: 500 });
    }

    if (status !== "paid" || !checkoutSessionRecord.data) {
      return NextResponse.json({ received: true });
    }

    const productSubtotal = toSafeInteger(checkoutSessionRecord.data.product_subtotal, -1);
    const deliveryTotal = toSafeInteger(checkoutSessionRecord.data.delivery_total, -1);
    const expectedTotal = toSafeInteger(checkoutSessionRecord.data.amount_total, -1);
    const totalAmount = toSafeInteger(session.amount_total, -1);
    const holyhubCommission = toSafeInteger(checkoutSessionRecord.data.holyhub_commission, -1);
    const sellerAmountTotal = toSafeInteger(checkoutSessionRecord.data.seller_amount_total, -1);
    if ([productSubtotal, deliveryTotal, expectedTotal, totalAmount, holyhubCommission, sellerAmountTotal].some((amount) => amount < 0)
      || totalAmount !== expectedTotal
      || productSubtotal + deliveryTotal !== expectedTotal
      || holyhubCommission + sellerAmountTotal !== productSubtotal) {
      console.error("Stripe payment amount does not match the checkout snapshot.", { sessionId: session.id, totalAmount, expectedTotal });
      return NextResponse.json({ error: "Payment amount did not match the checkout record." }, { status: 500 });
    }

    const { data: existingOrder, error: orderLookupError } = await admin
      .from("orders")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (orderLookupError) {
      console.error("Order lookup failed", orderLookupError);
      return NextResponse.json({ error: "Could not verify order record." }, { status: 500 });
    }

    if (!existingOrder) {
      const { data: orderRecord, error: orderInsertError } = await admin
        .from("orders")
        .insert({
          user_id: checkoutSessionRecord.data.user_id,
          checkout_session_id: checkoutSessionRecord.data.id,
          stripe_checkout_session_id: session.id,
          order_status: "paid",
          fulfilment_status: "pending",
          currency: "GBP",
          product_subtotal: productSubtotal,
          delivery_total: deliveryTotal,
          total_amount: totalAmount,
          holyhub_commission: holyhubCommission,
          seller_amount_total: sellerAmountTotal,
          paid_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (orderInsertError || !orderRecord) {
        console.error("Order insert failed", orderInsertError);
        return NextResponse.json({ error: "Could not create order record." }, { status: 500 });
      }

      const { data: sessionItems, error: sessionItemsError } = await admin
        .from("checkout_session_items")
        .select("product_id, lister_user_id, product_name, unit_amount, quantity, line_total")
        .eq("checkout_session_id", checkoutSessionRecord.data.id);

      if (sessionItemsError) {
        console.error("Order item snapshot load failed", sessionItemsError);
        return NextResponse.json({ error: "Could not load order items." }, { status: 500 });
      }

      const { error: itemInsertError } = await admin.from("order_items").insert((sessionItems ?? []).map((item) => ({
        order_id: orderRecord.id,
        product_id: item.product_id,
        seller_user_id: item.lister_user_id,
        product_name: item.product_name,
        unit_amount: item.unit_amount,
        quantity: item.quantity,
        line_total: item.line_total,
      })));

      if (itemInsertError) {
        console.error("Order item insert failed", itemInsertError);
        return NextResponse.json({ error: "Could not create order items." }, { status: 500 });
      }

      const { data: sellerRows, error: sellerRowsError } = await admin
        .from("checkout_session_items")
        .select("lister_user_id, product_name, line_total, quantity, unit_amount")
        .eq("checkout_session_id", checkoutSessionRecord.data.id);

      if (sellerRowsError) {
        console.error("Seller order grouping failed", sellerRowsError);
        return NextResponse.json({ error: "Could not group seller orders." }, { status: 500 });
      }

      const { data: sellerDeliveryRows, error: sellerDeliveryError } = await admin
        .from("checkout_session_sellers")
        .select("lister_user_id, seller_business_name, delivery_total")
        .eq("checkout_session_id", checkoutSessionRecord.data.id);
      if (sellerDeliveryError) {
        console.error("Seller delivery snapshot load failed", sellerDeliveryError);
        return NextResponse.json({ error: "Could not load seller delivery snapshots." }, { status: 500 });
      }
      const sellerDeliveryById = new Map((sellerDeliveryRows ?? []).map((row) => [row.lister_user_id, row]));

      const groupedSellerRows = new Map<string, { sellerUserId: string; productSubtotal: number; deliveryTotal: number; totalAmount: number; sellerAmount: number; businessName: string }>();
      for (const row of sellerRows ?? []) {
        const sellerKey = row.lister_user_id;
        const business = sellerDeliveryById.get(sellerKey)?.seller_business_name ?? "HolyHub seller";
        const existing = groupedSellerRows.get(sellerKey) ?? {
          sellerUserId: sellerKey,
          productSubtotal: 0,
          deliveryTotal: 0,
          totalAmount: 0,
          sellerAmount: 0,
          businessName: business,
        };
        existing.productSubtotal += Number(row.line_total ?? 0);
        existing.totalAmount += Number(row.line_total ?? 0);
        groupedSellerRows.set(sellerKey, existing);
      }

      for (const [sellerId, seller] of groupedSellerRows) {
        const sellerDelivery = sellerDeliveryById.get(sellerId)?.delivery_total ?? 0;
        seller.deliveryTotal = toSafeInteger(sellerDelivery, 0);
        seller.totalAmount = seller.productSubtotal + seller.deliveryTotal;
        seller.sellerAmount = seller.productSubtotal - Math.round(seller.productSubtotal * 0.05);
      }

      for (const seller of Array.from(groupedSellerRows.values())) {
        const sellerDeliveryTotal = seller.deliveryTotal;
        const sellerTotal = seller.productSubtotal + sellerDeliveryTotal;
        const sellerCommission = Math.round(seller.productSubtotal * 0.05);
        const sellerNet = seller.productSubtotal - sellerCommission;
        const { error: sellerOrderInsertError } = await admin.from("seller_orders").insert({
          order_id: orderRecord.id,
          seller_user_id: seller.sellerUserId,
          seller_business_name: seller.businessName,
          product_subtotal: seller.productSubtotal,
          delivery_total: sellerDeliveryTotal,
          total_amount: sellerTotal,
          holyhub_commission: sellerCommission,
          seller_amount: sellerNet,
          order_status: "paid",
          fulfilment_status: "pending",
        });

        if (sellerOrderInsertError) {
          console.error("Seller order insert failed", sellerOrderInsertError);
          return NextResponse.json({ error: "Could not create seller order records." }, { status: 500 });
        }
      }
    }
  } catch (error) {
    console.error("Stripe webhook database handling failed", error);
    return NextResponse.json({ error: "Could not record payment status." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
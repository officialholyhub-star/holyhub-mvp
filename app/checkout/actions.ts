"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl, getStripe } from "@/lib/stripe";
import { MAX_BASKET_ITEMS, MAX_BASKET_QUANTITY } from "@/lib/basket";

type SubmittedItem = { id: unknown; quantity: unknown };

function checkoutError(message: string): never {
  redirect(`/basket?error=${encodeURIComponent(message)}`);
}

function toPence(value: string | number) {
  const normalized = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [pounds, pennies = ""] = normalized.split(".");
  const amount = Number(pounds) * 100 + Number(pennies.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function parseBasket(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_BASKET_ITEMS) return null;
  const items = parsed.map((item: SubmittedItem) => {
    const id = typeof item?.id === "string" ? item.id : "";
    const quantity = Number(item?.quantity);
    return /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_BASKET_QUANTITY
      ? { id, quantity }
      : null;
  });
  return items.every(Boolean) ? items as { id: string; quantity: number }[] : null;
}

export async function startCheckout(formData: FormData) {
  const basket = parseBasket(typeof formData.get("basket") === "string" ? formData.get("basket") as string : "");
  if (!basket) checkoutError("Your basket is invalid. Please review it and try again.");

  const { supabase, user } = await requireUser();
  const productIds = [...new Set(basket.map(({ id }) => id))];
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, price, currency, lister_user_id, is_published")
    .in("id", productIds)
    .eq("is_published", true);

  if (productError || !products || products.length !== productIds.length) {
    checkoutError("One or more products are no longer available. Please review your basket.");
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const lines = basket.map(({ id, quantity }) => {
    const product = productMap.get(id);
    const unitAmount = product ? toPence(product.price) : null;
    if (!product || product.currency !== "GBP" || unitAmount === null) return null;
    return { product, quantity, unitAmount, lineTotal: unitAmount * quantity };
  });
  if (lines.some((line) => !line)) checkoutError("One or more products have invalid pricing. Please review your basket.");

  const trustedLines = lines as { product: (typeof products)[number]; quantity: number; unitAmount: number; lineTotal: number }[];
  const amountTotal = trustedLines.reduce((total, line) => total + line.lineTotal, 0);
  if (!Number.isSafeInteger(amountTotal)) checkoutError("Your basket total is too large to process.");

  const stripe = getStripe();
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    const requestHeaders = await headers();
    const siteUrl = new URL(requestHeaders.get("origin") || getSiteUrl());
    if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
      throw new Error("Invalid checkout site origin.");
    }

    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: trustedLines.map(({ product, quantity, unitAmount }) => ({
        quantity,
        price_data: {
          currency: "gbp",
          unit_amount: unitAmount,
          product_data: { name: product.name },
        },
      })),
      customer_email: user.email ?? undefined,
      success_url: `${siteUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl.origin}/checkout/cancelled`,
      metadata: { holyhub_user_id: user.id },
    });
  } catch (error) {
    console.error("Stripe Checkout Session creation failed", error);
    checkoutError("We couldn't start checkout. Please try again.");
  }

  if (!session.url) checkoutError("Stripe did not return a checkout URL. Please try again.");

  const admin = createAdminClient();
  const { data: checkoutRecord, error: checkoutErrorResult } = await admin
    .from("checkout_sessions")
    .insert({
      user_id: user.id,
      stripe_checkout_session_id: session.id,
      amount_total: amountTotal,
      currency: "GBP",
    })
    .select("id")
    .single();

  if (checkoutErrorResult || !checkoutRecord) {
    console.error("Checkout session database insert failed", checkoutErrorResult);
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed", error); }
    checkoutError("We couldn't prepare your checkout. Please try again.");
  }

  const { error: itemsError } = await admin.from("checkout_session_items").insert(trustedLines.map(({ product, quantity, unitAmount, lineTotal }) => ({
    checkout_session_id: checkoutRecord.id,
    product_id: product.id,
    lister_user_id: product.lister_user_id,
    product_name: product.name,
    unit_amount: unitAmount,
    quantity,
    line_total: lineTotal,
    currency: "GBP",
  })));
  if (itemsError) {
    console.error("Checkout item snapshot insert failed", itemsError);
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed", error); }
    checkoutError("We couldn't prepare your checkout. Please try again.");
  }

  revalidatePath("/checkout/success");
  redirect(session.url);
}

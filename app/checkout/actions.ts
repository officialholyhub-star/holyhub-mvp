"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl, getStripe } from "@/lib/stripe";
import { MAX_BASKET_ITEMS, MAX_BASKET_QUANTITY } from "@/lib/basket";

type SubmittedItem = {
  id: unknown;
  quantity: unknown;
  listerId?: unknown;
  listerName?: unknown;
  deliveryOption?: unknown;
  deliveryCharge?: unknown;
};

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
    const listerId = typeof item?.listerId === "string" ? item.listerId : "";
    const listerName = typeof item?.listerName === "string" ? item.listerName.trim() : "";
    const deliveryOption = item?.deliveryOption === "flat" ? "flat" : "free";
    const deliveryCharge = Number(item?.deliveryCharge ?? 0);
    const quantity = Number(item?.quantity);
    const isValidItem = /^[0-9a-f-]{36}$/i.test(id)
      && /^[0-9a-f-]{36}$/i.test(listerId)
      && listerName.length > 0
      && Number.isInteger(quantity)
      && quantity >= 1
      && quantity <= MAX_BASKET_QUANTITY
      && Number.isFinite(deliveryCharge)
      && deliveryCharge >= 0;
    return isValidItem ? { id, quantity, listerId, listerName, deliveryOption, deliveryCharge } : null;
  });
  return items.every(Boolean) ? items as { id: string; quantity: number; listerId: string; listerName: string; deliveryOption: "free" | "flat"; deliveryCharge: number }[] : null;
}

export async function startCheckout(formData: FormData) {
  if (formData.get("accept_terms") !== "on") checkoutError("Please agree to the HolyHub terms before checkout.");
  const basket = parseBasket(typeof formData.get("basket") === "string" ? formData.get("basket") as string : "");
  if (!basket) checkoutError("Your basket is invalid. Please review it and try again.");

  const { supabase, user } = await requireUser();
  const productIds = [...new Set(basket.map(({ id }) => id))];
  const listerIds = [...new Set(basket.map(({ listerId }) => listerId))];
  const [{ data: products, error: productError }, { data: listerStorefronts, error: storefrontError }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, currency, lister_user_id, is_published, stock_quantity")
      .in("id", productIds)
      .eq("is_published", true),
    supabase
      .from("lister_storefronts")
      .select("user_id, business_name, delivery_option, delivery_charge, delivery_country")
      .in("user_id", listerIds),
  ]);

  if (productError || storefrontError || !products || products.length !== productIds.length || !listerStorefronts || listerStorefronts.length !== listerIds.length) {
    checkoutError("One or more products or seller settings are no longer available. Please review your basket.");
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const storefrontMap = new Map(listerStorefronts.map((storefront) => [storefront.user_id, storefront]));
  const lines = basket.map(({ id, quantity, listerId, deliveryOption, deliveryCharge }) => {
    const product = productMap.get(id);
    const storefront = storefrontMap.get(listerId);
    const unitAmount = product ? toPence(product.price) : null;
    if (!product || product.currency !== "GBP" || unitAmount === null) return null;
    if (product.stock_quantity < quantity) return null;
    if ((storefront?.delivery_country ?? "GB") !== "GB") return null;
    if (deliveryOption === "flat" && Number(storefront?.delivery_charge ?? deliveryCharge) !== Number(deliveryCharge)) return null;
    if (deliveryOption === "free" && Number(storefront?.delivery_charge ?? 0) !== 0) return null;
    return { product, quantity, unitAmount, lineTotal: unitAmount * quantity, listerId, deliveryOption, deliveryCharge: Number(storefront?.delivery_charge ?? deliveryCharge) };
  });
  if (lines.some((line) => !line)) checkoutError("One or more products are unavailable, out of stock, or have changed. Please review your basket.");

  const trustedLines = lines as { product: (typeof products)[number]; quantity: number; unitAmount: number; lineTotal: number; listerId: string; deliveryOption: "free" | "flat"; deliveryCharge: number }[];
  const productSubtotal = trustedLines.reduce((total, line) => total + line.lineTotal, 0);
  const deliveryGroups = new Map<string, number>();
  for (const line of trustedLines) {
    const charge = line.deliveryOption === "flat" ? line.deliveryCharge : 0;
    deliveryGroups.set(line.listerId, (deliveryGroups.get(line.listerId) ?? 0) + charge);
  }
  const deliveryTotal = Array.from(deliveryGroups.values()).reduce((sum, amount) => sum + amount, 0);
  const total = productSubtotal + deliveryTotal;
  if (!Number.isSafeInteger(productSubtotal) || !Number.isSafeInteger(deliveryTotal) || !Number.isSafeInteger(total)) checkoutError("Your basket total is too large to process.");

  const holyhubCommission = Math.round(productSubtotal * 0.05);
  const sellerAmount = productSubtotal - holyhubCommission;

  const stripe = getStripe();
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    const requestHeaders = await headers();
    const siteUrl = new URL(requestHeaders.get("origin") || getSiteUrl());
    if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
      throw new Error("Invalid checkout site origin.");
    }

    const lineItems = trustedLines.map(({ product, quantity, unitAmount }) => ({
      quantity,
      price_data: {
        currency: "gbp",
        unit_amount: unitAmount,
        product_data: { name: product.name },
      },
    }));
    const deliveryItems = Array.from(deliveryGroups.entries()).map(([listerId, charge]) => {
      const storefront = storefrontMap.get(listerId);
      const sellerName = storefront?.business_name ?? "HolyHub seller";
      return {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: charge,
          product_data: { name: `${sellerName} delivery` },
        },
      };
    }).filter((item) => item.price_data.unit_amount > 0);

    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [...lineItems, ...deliveryItems],
      customer_email: user.email ?? undefined,
      success_url: `${siteUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl.origin}/checkout/cancelled`,
      metadata: {
        holyhub_user_id: user.id,
        holyhub_product_subtotal: String(productSubtotal),
        holyhub_delivery_total: String(deliveryTotal),
        holyhub_commission: String(holyhubCommission),
        holyhub_seller_amount: String(sellerAmount),
      },
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
      amount_total: total,
      currency: "GBP",
      product_subtotal: productSubtotal,
      delivery_total: deliveryTotal,
      holyhub_commission: holyhubCommission,
      seller_amount_total: sellerAmount,
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

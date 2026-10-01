"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl, getStripe } from "@/lib/stripe";
import { MAX_BASKET_ITEMS, MAX_BASKET_QUANTITY } from "@/lib/basket";
import { calculateCheckoutTotals, calculateHolyHubCommission, toPence } from "@/lib/checkout-pricing";

type SubmittedItem = {
  id: unknown;
  quantity: unknown;
  variantId?: unknown;
};

function checkoutError(message: string): never {
  redirect(`/basket?error=${encodeURIComponent(message)}`);
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
    const variantId = typeof item?.variantId === "string" ? item.variantId : undefined;
    const quantity = Number(item?.quantity);
    const isValidItem = /^[0-9a-f-]{36}$/i.test(id)
      && Number.isInteger(quantity)
      && quantity >= 1
      && quantity <= MAX_BASKET_QUANTITY;
    return isValidItem && (!variantId || /^[0-9a-f-]{36}$/i.test(variantId)) ? { id, quantity, variantId } : null;
  });
  return items.every(Boolean) ? items as { id: string; quantity: number; variantId?: string }[] : null;
}

export async function startCheckout(formData: FormData) {
  if (formData.get("accept_terms") !== "on") checkoutError("Please agree to the HolyHub terms before checkout.");
  const basket = parseBasket(typeof formData.get("basket") === "string" ? formData.get("basket") as string : "");
  if (!basket) checkoutError("Your basket is invalid. Please review it and try again.");

  const { supabase, user } = await requireUser();
  const requestedQuantities = new Map<string, { id: string; quantity: number; variantId?: string }>();
  for (const item of basket) {
    const key = `${item.id}:${item.variantId ?? "base"}`;
    const quantity = (requestedQuantities.get(key)?.quantity ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > MAX_BASKET_QUANTITY) checkoutError("Your basket quantity is invalid. Please review it and try again.");
    requestedQuantities.set(key, { ...item, quantity });
  }
  const normalizedBasket = Array.from(requestedQuantities.values());
  const productIds = [...new Set(normalizedBasket.map(({ id }) => id))];
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, price, currency, lister_user_id, is_published, review_status, category_type, stock_quantity, product_variants(id, size, stock_quantity)")
    .in("id", productIds)
    .eq("is_published", true)
    .eq("review_status", "approved");

  if (productError || !products || products.length !== productIds.length) {
    checkoutError("One or more products or seller settings are no longer available. Please review your basket.");
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const listerIds = [...new Set(products.map(({ lister_user_id }) => lister_user_id))];
  const { data: listerStorefronts, error: storefrontError } = await supabase
    .from("lister_storefronts")
    .select("user_id, business_name, delivery_option, delivery_charge, delivery_country")
    .in("user_id", listerIds);
  if (storefrontError || !listerStorefronts || listerStorefronts.length !== listerIds.length) checkoutError("One or more products or seller settings are no longer available. Please review your basket.");
  const storefrontMap = new Map(listerStorefronts.map((storefront) => [storefront.user_id, storefront]));
  const lines = normalizedBasket.map(({ id, quantity, variantId }) => {
    const product = productMap.get(id);
    const listerId = product?.lister_user_id ?? "";
    const storefront = storefrontMap.get(listerId);
    const unitAmount = product ? toPence(product.price) : null;
    if (!product || product.currency !== "GBP" || unitAmount === null) return null;
    const variants = product.product_variants ?? [];
    const selectedVariant = variantId ? variants.find((variant) => variant.id === variantId) : null;
    if (product.review_status !== "approved" || !product.is_published) return null;
    if (product.category_type === "Apparel" && variants.length > 0 && !selectedVariant) return null;
    if (product.category_type !== "Apparel" && variantId) return null;
    if (selectedVariant ? selectedVariant.stock_quantity < quantity : product.stock_quantity < quantity) return null;
    if ((storefront?.delivery_country ?? "GB") !== "GB") return null;
    const lineTotal = unitAmount * quantity;
    const deliveryOption = storefront?.delivery_option === "flat" ? "flat" : "free";
    const deliveryAmount = deliveryOption === "flat" ? toPence(storefront?.delivery_charge ?? 0) : 0;
    if (!Number.isSafeInteger(lineTotal) || deliveryAmount === null) return null;
    return { product, quantity, unitAmount, lineTotal, listerId, deliveryAmount, variantId: selectedVariant?.id ?? null, variantSize: selectedVariant?.size ?? null };
  });
  if (lines.some((line) => !line)) checkoutError("One or more products are unavailable, out of stock, or have changed. Please review your basket.");

  const trustedLines = lines as { product: (typeof products)[number]; quantity: number; unitAmount: number; lineTotal: number; listerId: string; deliveryAmount: number; variantId: string | null; variantSize: string | null }[];
  const totals = calculateCheckoutTotals(trustedLines);
  if (!totals) checkoutError("Your basket total is too large to process.");
  const { productSubtotal, deliveryGroups, deliveryTotal, total } = totals;

  const holyhubCommission = calculateHolyHubCommission(productSubtotal);
  if (holyhubCommission === null) checkoutError("Your basket total is too large to process.");
  const sellerAmount = productSubtotal - holyhubCommission;

  const stripe = getStripe();
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    const requestHeaders = await headers();
    const siteUrl = new URL(requestHeaders.get("origin") || getSiteUrl());
    if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
      throw new Error("Invalid checkout site origin.");
    }

    const lineItems = trustedLines.map(({ product, quantity, unitAmount, variantSize }) => ({
      quantity,
      price_data: {
        currency: "gbp",
        unit_amount: unitAmount,
        product_data: { name: variantSize ? `${product.name} (${variantSize})` : product.name },
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

  const { error: sellerSnapshotError } = await admin.from("checkout_session_sellers").insert(Array.from(deliveryGroups.entries()).map(([listerId, deliveryAmount]) => ({
    checkout_session_id: checkoutRecord.id,
    lister_user_id: listerId,
    seller_business_name: storefrontMap.get(listerId)?.business_name ?? "HolyHub seller",
    delivery_total: deliveryAmount,
  })));
  if (sellerSnapshotError) {
    console.error("Checkout seller snapshot insert failed", sellerSnapshotError);
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed", error); }
    checkoutError("We couldn't prepare your checkout. Please try again.");
  }

  const { error: itemsError } = await admin.from("checkout_session_items").insert(trustedLines.map(({ product, quantity, unitAmount, lineTotal, variantId, variantSize }) => ({
    checkout_session_id: checkoutRecord.id,
    product_id: product.id,
    lister_user_id: product.lister_user_id,
    product_name: product.name,
    unit_amount: unitAmount,
    quantity,
    line_total: lineTotal,
    currency: "GBP",
    variant_id: variantId,
    variant_size: variantSize,
  })));
  if (itemsError) {
    console.error("Checkout item snapshot insert failed", itemsError);
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed", error); }
    checkoutError("We couldn't prepare your checkout. Please try again.");
  }

  revalidatePath("/checkout/success");
  redirect(session.url);
}

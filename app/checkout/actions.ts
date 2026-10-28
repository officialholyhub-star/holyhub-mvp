"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdultUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { checkoutRedirectUrls } from "@/lib/checkout-origin";
import { MAX_BASKET_ITEMS, MAX_BASKET_QUANTITY } from "@/lib/basket";
import { calculateCheckoutTotals, calculateHolyHubCommission, toPence } from "@/lib/checkout-pricing";
import { SELLER_LEGAL_FIELDS, sellerLegalProfileComplete, type SellerLegalProfile } from "@/lib/seller-legal";

type SubmittedItem = { id: unknown; quantity: unknown; variantId?: unknown };

function checkoutError(message: string): never {
  redirect(`/basket?error=${encodeURIComponent(message)}`);
}

function parseBasket(value: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_BASKET_ITEMS) return null;
  const items = parsed.map((item: SubmittedItem) => {
    const id = typeof item?.id === "string" ? item.id : "";
    const variantId = typeof item?.variantId === "string" ? item.variantId : undefined;
    const quantity = Number(item?.quantity);
    const isValidItem = /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_BASKET_QUANTITY;
    return isValidItem && (!variantId || /^[0-9a-f-]{36}$/i.test(variantId)) ? { id, quantity, variantId } : null;
  });
  return items.every(Boolean) ? items as { id: string; quantity: number; variantId?: string }[] : null;
}

export async function startCheckout(formData: FormData) {
  if (formData.get("accept_terms") !== "on") checkoutError("Please agree to the HolyHub terms before checkout.");
  const basket = parseBasket(typeof formData.get("basket") === "string" ? formData.get("basket") as string : "");
  if (!basket) checkoutError("Your basket is invalid. Please review it and try again.");

  const { supabase, user } = await requireAdultUser("/basket");
  const requestedQuantities = new Map<string, { id: string; quantity: number; variantId?: string }>();
  for (const item of basket) {
    const key = `${item.id}:${item.variantId ?? "base"}`;
    const quantity = (requestedQuantities.get(key)?.quantity ?? 0) + item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > MAX_BASKET_QUANTITY) checkoutError("Your basket quantity is invalid. Please review it and try again.");
    requestedQuantities.set(key, { ...item, quantity });
  }
  const normalizedBasket = Array.from(requestedQuantities.values());
  const productIds = [...new Set(normalizedBasket.map(({ id }) => id))];
  const { data: products, error: productError } = await supabase.from("products")
    .select("id, name, price, currency, lister_user_id, is_published, review_status, category_type, stock_quantity, product_variants(id, size, stock_quantity)")
    .in("id", productIds).eq("is_published", true).eq("review_status", "approved");
  if (productError || !products || products.length !== productIds.length) checkoutError("One or more products or seller settings are no longer available. Please review your basket.");

  const productMap = new Map(products.map((product) => [product.id, product]));
  const listerIds = [...new Set(products.map(({ lister_user_id }) => lister_user_id))];
  const { data: listerStorefronts, error: storefrontError } = await supabase.from("lister_storefronts")
    .select("user_id, business_name, delivery_option, delivery_charge, delivery_country").in("user_id", listerIds);
  if (storefrontError || !listerStorefronts || listerStorefronts.length !== listerIds.length) checkoutError("One or more products or seller settings are no longer available. Please review your basket.");
  const storefrontMap = new Map(listerStorefronts.map((storefront) => [storefront.user_id, storefront]));

  const admin = createAdminClient();
  const { data: legalRows, error: legalError } = await admin.from("seller_legal_profiles")
    .select(SELLER_LEGAL_FIELDS).in("user_id", listerIds).eq("verification_status", "verified");
  const legalProfiles = (legalRows ?? []) as SellerLegalProfile[];
  const legalMap = new Map(legalProfiles.map(profile => [profile.user_id, profile]));
  if (legalError || legalProfiles.length !== listerIds.length || legalProfiles.some(profile => !sellerLegalProfileComplete(profile))) {
    checkoutError("One or more sellers are not currently verified for customer sales. Please review your basket or try again later.");
  }

  const lines = normalizedBasket.map(({ id, quantity, variantId }) => {
    const product = productMap.get(id);
    const listerId = product?.lister_user_id ?? "";
    const storefront = storefrontMap.get(listerId);
    const unitAmount = product ? toPence(product.price) : null;
    if (!product || product.currency !== "GBP" || unitAmount === null || !legalMap.has(listerId)) return null;
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
    const redirectUrls = checkoutRedirectUrls(requestHeaders);
    const lineItems = trustedLines.map(({ product, quantity, unitAmount, variantSize }) => ({ quantity, price_data: { currency: "gbp", unit_amount: unitAmount, product_data: { name: variantSize ? `${product.name} (${variantSize})` : product.name } } }));
    const deliveryItems = Array.from(deliveryGroups.entries()).map(([listerId, charge]) => ({ quantity: 1, price_data: { currency: "gbp", unit_amount: charge, product_data: { name: `${storefrontMap.get(listerId)?.business_name ?? legalMap.get(listerId)?.legal_name ?? "Seller"} delivery` } } })).filter((item) => item.price_data.unit_amount > 0);
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [...lineItems, ...deliveryItems],
      customer_email: user.email ?? undefined,
      shipping_address_collection: { allowed_countries: ["GB"] },
      ...redirectUrls,
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

  const { data: currentLegalRows, error: currentLegalError } = await admin.from("seller_legal_profiles")
    .select("user_id, verification_status, updated_at").in("user_id", listerIds);
  const currentVersions = new Map((currentLegalRows ?? []).map(row => [row.user_id, row]));
  const identityChanged = currentLegalError || listerIds.some(id => {
    const before = legalMap.get(id);
    const current = currentVersions.get(id);
    return !before || !current || current.verification_status !== "verified" || current.updated_at !== before.updated_at;
  });
  if (identityChanged) {
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed after seller identity change", error); }
    checkoutError("A seller's verified details changed while checkout was being prepared. Please try again.");
  }

  const { data: checkoutRecord, error: checkoutErrorResult } = await admin.from("checkout_sessions").insert({
    user_id: user.id,
    stripe_checkout_session_id: session.id,
    amount_total: total,
    currency: "GBP",
    product_subtotal: productSubtotal,
    delivery_total: deliveryTotal,
    holyhub_commission: holyhubCommission,
    seller_amount_total: sellerAmount,
  }).select("id").single();
  if (checkoutErrorResult || !checkoutRecord) {
    console.error("Checkout session database insert failed", checkoutErrorResult);
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed after checkout insert failure", error); }
    checkoutError("We couldn't prepare your checkout. Please try again.");
  }

  const { error: sellerSnapshotError } = await admin.from("checkout_session_sellers").insert(Array.from(deliveryGroups.entries()).map(([listerId, deliveryAmount]) => {
    const legal = legalMap.get(listerId)!;
    return {
      checkout_session_id: checkoutRecord.id,
      lister_user_id: listerId,
      seller_business_name: storefrontMap.get(listerId)?.business_name ?? legal.legal_name,
      delivery_total: deliveryAmount,
      seller_legal_name: legal.legal_name,
      seller_entity_type: legal.entity_type,
      seller_address_line1: legal.address_line1,
      seller_address_line2: legal.address_line2,
      seller_city: legal.city,
      seller_postcode: legal.postcode,
      seller_country: legal.country,
      seller_service_address_line1: legal.service_address_line1,
      seller_service_address_line2: legal.service_address_line2,
      seller_service_address_city: legal.service_address_city,
      seller_service_address_postcode: legal.service_address_postcode,
      seller_service_address_country: legal.service_address_country,
      seller_contact_email: legal.contact_email,
      seller_contact_phone: legal.contact_phone,
      seller_registration_number: legal.registration_number,
      seller_registration_jurisdiction: legal.registration_jurisdiction,
      seller_registered_office_line1: legal.registered_office_line1,
      seller_registered_office_line2: legal.registered_office_line2,
      seller_registered_office_city: legal.registered_office_city,
      seller_registered_office_postcode: legal.registered_office_postcode,
      seller_registered_office_country: legal.registered_office_country,
      seller_vat_number: legal.vat_number,
      seller_identity_verified_at: legal.verified_at,
      seller_identity_profile_updated_at: legal.updated_at,
    };
  }));
  if (sellerSnapshotError) {
    console.error("Checkout seller snapshot insert failed", sellerSnapshotError);
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed after seller snapshot failure", error); }
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
    try { await stripe.checkout.sessions.expire(session.id); } catch (error) { console.error("Stripe session expiry failed after checkout items failure", error); }
    checkoutError("We couldn't prepare your checkout. Please try again.");
  }

  revalidatePath("/checkout/success");
  redirect(session.url);
}

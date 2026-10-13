"use client";

import { basketItemIssue, basketReviewLabel, reviewBasketItem, type BasketProduct } from "@/lib/basket-availability";
import { createClient } from "@/lib/supabase/client";
import { decodeDisplayText } from "@/lib/display-text";
import { withProductCover } from "@/lib/product-images";

import Image from "next/image";
import { unstable_rethrow } from "next/navigation";
import Link from "next/link";
import { startCheckout } from "@/app/checkout/actions";
import { BASKET_STORAGE_KEY, MAX_BASKET_QUANTITY, type BasketItem } from "@/lib/basket";
import { variantLineKey } from "@/lib/product-variants";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type BasketViewProps = { error?: string };
async function loadAvailability(ids: string[]) {
  return createClient().from("products")
    .select("id, name, price, currency, stock_quantity, category_type, product_variants(id, size, stock_quantity), lister_storefronts(delivery_option, delivery_charge, delivery_country)")
    .in("id", ids).eq("is_published", true).eq("review_status", "approved");
}

function readBasket() {
  if (typeof window === "undefined") return "[]";
  try { return window.localStorage.getItem(BASKET_STORAGE_KEY) ?? "[]"; } catch { return "storage-unavailable"; }
}

function subscribeToBasket(callback: () => void) {
  window.addEventListener("holyhub-basket-updated", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("holyhub-basket-updated", callback);
    window.removeEventListener("storage", callback);
  };
}

function parseStoredBasket(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as BasketItem[] : [];
  } catch {
    return [];
  }
}

export function BasketView({ error }: BasketViewProps) {
  const storedBasket = useSyncExternalStore(subscribeToBasket, readBasket, () => "[]");
  const items = useMemo(() => parseStoredBasket(storedBasket), [storedBasket]);
  const [availableProducts, setAvailableProducts] = useState<BasketProduct[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string>();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const firstWarning = useRef<HTMLElement | null>(null);
  const issues = useMemo(() => new Map(items.map(item => [variantLineKey(item.id, item.variantId), availableProducts ? basketItemIssue(item, availableProducts) : null])), [items, availableProducts]);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const productIds = [...new Set(items.map(item => item.id))].sort().join(",");
  useEffect(() => {
    if (!productIds) return;
    let cancelled = false;
    void Promise.resolve(createClient().from("products").select("id, image_url, product_images(image_url, sort_order)")
      .in("id", productIds.split(",")).eq("is_published", true).eq("review_status", "approved"))
      .then(({ data, error }) => { if (!cancelled && !error && data) setCovers(Object.fromEntries(data.map(product => [product.id, withProductCover(product).image_url]))); }).catch(() => { /* Availability is checked separately before checkout. */ });
    return () => { cancelled = true; };
  }, [productIds]);
  useEffect(() => {
    if (!productIds) return;
    let cancelled = false;
    void loadAvailability(productIds.split(",")).then(({ data, error: loadError }) => {
      if (!cancelled && !loadError && data) setAvailableProducts(data);
      else if (!cancelled) setCheckoutError("Availability could not be checked. Try checkout to check again before payment.");
    }).catch(() => { if (!cancelled) setCheckoutError("Availability could not be checked. Try checkout to check again before payment."); });
    return () => { cancelled = true; };
  }, [productIds, error]);
  useEffect(() => {
    if (error && [...issues.values()].some(Boolean)) firstWarning.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error, issues]);
  function currentCover(item: BasketItem) { return Object.hasOwn(covers, item.id) ? covers[item.id] : item.imageUrl; }

  const groupedItems = useMemo(() => {
    const groups = new Map<string, { listerId: string; listerName: string; deliveryOption: "free" | "flat"; deliveryCharge: number; items: BasketItem[] }>();
    for (const item of items) {
      const group = groups.get(item.listerId) ?? {
        listerId: item.listerId,
        listerName: item.listerName,
        deliveryOption: item.deliveryOption,
        deliveryCharge: item.deliveryCharge,
        items: [] as BasketItem[],
      };
      group.items.push(item);
      group.deliveryOption = group.items.some((entry) => entry.deliveryOption === "flat") ? "flat" : item.deliveryOption;
      group.deliveryCharge = Math.max(group.deliveryCharge, item.deliveryCharge);
      groups.set(item.listerId, group);
    }
    return Array.from(groups.values());
  }, [items]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const deliveryTotal = useMemo(
    () => groupedItems.reduce((sum, group) => sum + (group.deliveryOption === "flat" ? group.deliveryCharge : 0), 0),
    [groupedItems],
  );
  const total = subtotal + deliveryTotal;
  const basketPayload = JSON.stringify(items);

  function saveItems(nextItems: BasketItem[]) {
    try {
    setCheckoutError(undefined);
    window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(nextItems));
    window.dispatchEvent(new Event("holyhub-basket-updated"));
    } catch { setCheckoutError("We couldn’t update your basket. Allow browser storage, then try again."); }
  }

  function lineKey(item: BasketItem) {
    return variantLineKey(item.id, item.variantId);
  }

  function changeQuantity(item: BasketItem, quantity: number) {
    const key = lineKey(item);
    const maximum = typeof item.stockQuantity === "number" ? Math.min(MAX_BASKET_QUANTITY, item.stockQuantity) : MAX_BASKET_QUANTITY;
    saveItems(items.map((entry) => lineKey(entry) === key ? { ...entry, quantity: Math.max(1, Math.min(maximum, quantity)) } : entry));
  }

  function remove(item: BasketItem) {
    const key = lineKey(item);
    saveItems(items.filter((entry) => lineKey(entry) !== key));
  }

  function review(item: BasketItem) {
    const product = availableProducts?.find(product => product.id === item.id);
    const updated = product ? reviewBasketItem(item, product) : null;
    if (updated) saveItems(items.map(entry => lineKey(entry) === lineKey(item) ? updated : entry));
  }

  async function checkout(formData: FormData) {
    setChecking(true);
    setCheckoutError(undefined);
    try {
      const result = await loadAvailability(productIds.split(","));
      if (result.error || !result.data) { setCheckoutError("We couldn't check your basket. Please try again."); return; }
      setAvailableProducts(result.data);
      if (items.some(item => basketItemIssue(item, result.data))) {
        setCheckoutError("Please review the highlighted items before checkout.");
        window.requestAnimationFrame(() => firstWarning.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
        return;
      }
    } catch { setCheckoutError("We couldn't check your basket. Please try again."); return; }
    finally { setChecking(false); }
    setChecking(true);
    try { await startCheckout(formData); }
    catch (error) { unstable_rethrow(error); setCheckoutError("We couldn’t open checkout. Your basket is still here. Check My Purchases before trying again if you already entered payment details."); }
    finally { setChecking(false); }
  }

  const firstIssueKey = items.find(item => issues.get(lineKey(item)));
  return (
    <section>
      <Link className="text-link" href="/marketplace">Continue shopping</Link>
      <p className="eyebrow">Your HolyHub basket</p>
      <h1 className="page-title">Basket</h1>
      {storedBasket === "storage-unavailable" && <p role="alert" className="notice notice-error">Your basket could not be opened. Allow browser storage and refresh, or contact HolyHub.</p>}
      {error && <p className="notice notice-error">{error}</p>}
      {checkoutError && <p className="notice notice-error">{checkoutError}</p>}
      {items.length === 0 ? (
        <div className="card empty-state"><p>Your basket is empty.</p><Link className="button button-primary" href="/marketplace">Browse marketplace</Link></div>
      ) : (
        <div className="basket-layout">
          <div className="basket-items">
            {groupedItems.map((group, groupIndex) => (
              <div className="basket-lister-group" key={group.listerId || `lister-group-${groupIndex}`}>
                <div className="basket-lister-header">
                  <div>
                    <p className="eyebrow">Fulfilled by</p>
                    <h2>{group.listerName}</h2>
                  </div>
                  <strong>{group.deliveryOption === "flat" ? `Delivery £${group.deliveryCharge.toFixed(2)}` : "Delivery free"}</strong>
                </div>
                {group.items.map((item, itemIndex) => (
                  <article ref={firstIssueKey && lineKey(firstIssueKey) === lineKey(item) ? firstWarning : undefined} className={`basket-row${issues.get(lineKey(item)) ? " basket-row-warning" : ""}`} key={lineKey(item) || `${group.listerId || "lister"}-item-${itemIndex}`}>
                    <div className="basket-row-main">
                      {currentCover(item) ? <Image src={currentCover(item)!} alt="" width={300} height={300} unoptimized /> : <div className="product-placeholder" aria-hidden="true">HolyHub</div>}
                      <div><p className="eyebrow">{item.listerName}</p><h2>{decodeDisplayText(item.name)}</h2>{item.variantSize && <p>Size: {item.variantSize}</p>}<p>£{item.price.toFixed(2)} each</p></div>
                    </div>
                    {issues.get(lineKey(item)) && <div className="basket-item-warning" role="alert"><p>{decodeDisplayText(issues.get(lineKey(item))!)}</p><Link href={`/products/${item.id}`}>Review product</Link>{availableProducts?.some(product => product.id === item.id && reviewBasketItem(item, product)) && <button className="button button-secondary" type="button" onClick={() => review(item)}>{basketReviewLabel(item, availableProducts!.find(product => product.id === item.id)!)}</button>}</div>}
                    <div className="basket-row-actions">
                      <label className="quantity-control">Qty <input type="number" min="1" max={typeof item.stockQuantity === "number" ? Math.min(MAX_BASKET_QUANTITY, item.stockQuantity) : MAX_BASKET_QUANTITY} value={item.quantity} onChange={(event) => changeQuantity(item, Number(event.target.value))} /></label>
                      <strong>£{(item.price * item.quantity).toFixed(2)}</strong>
                      <button className="button button-quiet" type="button" onClick={() => remove(item)}>Remove from basket</button>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
          <aside className="card basket-summary">
            <h2>Order total</h2>
            <div className="meta-row"><span className="meta-label">Subtotal</span><strong>£{subtotal.toFixed(2)}</strong></div>
            <div className="meta-row"><span className="meta-label">Delivery</span><strong>{deliveryTotal > 0 ? `£${deliveryTotal.toFixed(2)}` : "Free"}</strong></div>
            <div className="meta-row"><span className="meta-label">Total</span><strong>£{total.toFixed(2)}</strong></div>
            <form action={checkout}>
              <input type="hidden" name="basket" value={basketPayload} />
              <label className="terms-consent">
                <input type="checkbox" name="accept_terms" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required />
                <span>I agree to the <Link href="/terms">Customer Terms</Link>, <Link href="/shipping">Shipping Policy</Link> and <Link href="/returns">Returns Policy</Link>.</span>
              </label>
              <button className="button button-primary checkout-button" type="submit" disabled={checking}>{checking ? "Checking basket…" : "Proceed to secure checkout"}</button>
            </form>
            <p className="muted-small">Prices are rechecked securely before payment.</p>
          </aside>
        </div>
      )}
    </section>
  );
}

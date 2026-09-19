"use client";

import Link from "next/link";
import { startCheckout } from "@/app/checkout/actions";
import { BASKET_STORAGE_KEY, MAX_BASKET_QUANTITY, type BasketItem } from "@/lib/basket";
import { useMemo, useState, useSyncExternalStore } from "react";

type BasketViewProps = { error?: string };

function readBasket() {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(BASKET_STORAGE_KEY) ?? "[]";
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
  const [checkoutError, setCheckoutError] = useState<string>();

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const basketPayload = JSON.stringify(items.map(({ id, quantity }) => ({ id, quantity })));

  function saveItems(nextItems: BasketItem[]) {
    window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(nextItems));
    window.dispatchEvent(new Event("holyhub-basket-updated"));
  }

  function changeQuantity(id: string, quantity: number) {
    saveItems(items.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(MAX_BASKET_QUANTITY, quantity)) } : item));
  }

  function remove(id: string) {
    saveItems(items.filter((item) => item.id !== id));
  }

  return (
    <section>
      <Link className="text-link" href="/marketplace">Continue shopping</Link>
      <p className="eyebrow">Your HolyHub basket</p>
      <h1 className="page-title">Basket</h1>
      {error && <p className="notice notice-error">{error}</p>}
      {checkoutError && <p className="notice notice-error">{checkoutError}</p>}
      {items.length === 0 ? (
        <div className="card empty-state"><p>Your basket is empty.</p><Link className="button button-primary" href="/marketplace">Browse marketplace</Link></div>
      ) : (
        <div className="basket-layout">
          <div className="basket-items">
            {items.map((item) => (
              <article className="basket-row" key={item.id}>
                <div className="basket-row-main">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="product-placeholder" aria-hidden="true">HolyHub</div>}
                  <div><p className="eyebrow">{item.listerName}</p><h2>{item.name}</h2><p>£{item.price.toFixed(2)} each</p></div>
                </div>
                <div className="basket-row-actions">
                  <label className="quantity-control">Qty <input type="number" min="1" max={MAX_BASKET_QUANTITY} value={item.quantity} onChange={(event) => changeQuantity(item.id, Number(event.target.value))} /></label>
                  <strong>£{(item.price * item.quantity).toFixed(2)}</strong>
                  <button className="button button-quiet" type="button" onClick={() => remove(item.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
          <aside className="card basket-summary">
            <h2>Order total</h2>
            <div className="meta-row"><span className="meta-label">Subtotal</span><strong>£{total.toFixed(2)}</strong></div>
            <div className="meta-row"><span className="meta-label">Total</span><strong>£{total.toFixed(2)}</strong></div>
            <form action={startCheckout} onSubmit={() => setCheckoutError(undefined)}>
              <input type="hidden" name="basket" value={basketPayload} />
              <label className="terms-consent">
                <input type="checkbox" name="accept_terms" required />
                <span>I agree to the <Link href="/terms">Customer Terms</Link>, <Link href="/shipping">Shipping Policy</Link> and <Link href="/returns">Returns Policy</Link>.</span>
              </label>
              <button className="button button-primary checkout-button" type="submit">Proceed to secure checkout</button>
            </form>
            <p className="muted-small">Prices are rechecked securely before payment.</p>
          </aside>
        </div>
      )}
    </section>
  );
}
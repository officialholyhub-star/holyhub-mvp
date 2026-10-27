"use client";

import { useState, useSyncExternalStore } from "react";
import { BASKET_STORAGE_KEY } from "@/lib/basket";
import { requestNorthernIrelandShipping } from "@/app/shipping/northern-ireland/actions";

function subscribe(callback: () => void) {
  window.addEventListener("holyhub-basket-updated", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("holyhub-basket-updated", callback); window.removeEventListener("storage", callback); };
}
function readBasket() {
  try { return window.localStorage.getItem(BASKET_STORAGE_KEY) ?? "[]"; } catch { return "[]"; }
}
export function NorthernIrelandInterest({ area, accountEmail }: { area: string; accountEmail: string }) {
  const basket = useSyncExternalStore(subscribe, readBasket, () => "[]");
  const [notify, setNotify] = useState(false);
  return <form action={requestNorthernIrelandShipping} className="form">
    <input type="hidden" name="basket" value={basket} />
    <label>Broad postcode district<input name="postcode_area" defaultValue={area} placeholder="BT7" required maxLength={4} pattern="[Bb][Tt][1-9][0-9]?" /></label>
    <p>Enter only the district, such as BT7. We do not need your full postcode or address for this request.</p>
    <p>Your current basket products and their sellers will be included. Add products to your basket before requesting shipping.</p>
    <label><input type="checkbox" name="notify" checked={notify} onChange={event => setNotify(event.target.checked)} />Email me if Northern Ireland shipping becomes available (optional)</label>
    {notify && <label>Notification email<input type="email" name="notification_email" defaultValue={accountEmail} required maxLength={254} autoComplete="email" /></label>}
    <button className="button button-primary" type="submit">Request Northern Ireland shipping</button>
  </form>;
}

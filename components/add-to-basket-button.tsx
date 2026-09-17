"use client";

import { useState } from "react";
import { BASKET_STORAGE_KEY, MAX_BASKET_ITEMS, MAX_BASKET_QUANTITY, type BasketItem } from "@/lib/basket";

type AddToBasketButtonProps = Omit<BasketItem, "quantity">;

export function AddToBasketButton(product: AddToBasketButtonProps) {
  const [added, setAdded] = useState(false);

  function addToBasket() {
    try {
      const stored = window.localStorage.getItem(BASKET_STORAGE_KEY);
      const basket: BasketItem[] = stored ? JSON.parse(stored) : [];
      const existing = basket.find((item) => item.id === product.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, MAX_BASKET_QUANTITY);
      } else if (basket.length < MAX_BASKET_ITEMS) {
        basket.push({ ...product, quantity: 1 });
      }
      window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
      window.dispatchEvent(new Event("holyhub-basket-updated"));
      setAdded(true);
    } catch {
      setAdded(false);
    }
  }

  return <button className="button button-primary" type="button" onClick={addToBasket}>{added ? "Added to basket" : "Add to basket"}</button>;
}
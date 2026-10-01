"use client";

import { useState } from "react";
import { BASKET_STORAGE_KEY, MAX_BASKET_ITEMS, MAX_BASKET_QUANTITY, type BasketItem } from "@/lib/basket";

type ProductVariant = {
  id: string;
  size: NonNullable<BasketItem["variantSize"]>;
  stock_quantity: number;
};

type AddToBasketButtonProps = Omit<BasketItem, "quantity" | "variantId" | "variantSize"> & {
  variants?: ProductVariant[];
};

export function AddToBasketButton(product: AddToBasketButtonProps) {
  const [added, setAdded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants?.find((variant) => variant.stock_quantity > 0)?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const selectedVariant = product.variants?.find((variant) => variant.id === selectedVariantId);
  const availableStock = selectedVariant?.stock_quantity ?? product.stockQuantity;
  const hasVariants = Boolean(product.variants?.length);
  const isOutOfStock = typeof availableStock === "number" && availableStock < 1;
  const maximum = typeof availableStock === "number" ? Math.min(MAX_BASKET_QUANTITY, availableStock) : MAX_BASKET_QUANTITY;

  function addToBasket() {
    if (isOutOfStock || (hasVariants && !selectedVariant)) return;
    try {
      const stored = window.localStorage.getItem(BASKET_STORAGE_KEY);
      const basket: BasketItem[] = stored ? JSON.parse(stored) : [];
      const existing = basket.find((item) => item.id === product.id && item.variantId === selectedVariant?.id);
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, maximum);
      } else if (basket.length < MAX_BASKET_ITEMS) {
        basket.push({
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency,
          imageUrl: product.imageUrl,
          listerId: product.listerId,
          listerName: product.listerName,
          deliveryOption: product.deliveryOption,
          deliveryCharge: product.deliveryCharge,
          stockQuantity: availableStock,
          variantId: selectedVariant?.id,
          variantSize: selectedVariant?.size,
          quantity,
        });
      }
      window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
      window.dispatchEvent(new Event("holyhub-basket-updated"));
      setAdded(true);
    } catch {
      setAdded(false);
    }
  }

  return (
    <div className="purchase-controls">
      {hasVariants && (
        <label className="field">
          <span>Choose size</span>
          <select value={selectedVariantId} onChange={(event) => { setSelectedVariantId(event.currentTarget.value); setQuantity(1); }}>
            <option value="" disabled>Select a size</option>
            {product.variants?.map((variant) => <option key={variant.id} value={variant.id} disabled={variant.stock_quantity < 1}>{variant.size}{variant.stock_quantity < 1 ? " - sold out" : ""}</option>)}
          </select>
        </label>
      )}
      <div className="quantity-control product-quantity-control">
        <span>Quantity</span>
        <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1}>-</button>
        <output>{quantity}</output>
        <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => Math.min(maximum, current + 1))} disabled={quantity >= maximum}>+</button>
      </div>
      <button className="button button-primary" type="button" onClick={addToBasket} disabled={isOutOfStock || (hasVariants && !selectedVariant)}>{isOutOfStock ? "Out of stock" : added ? "Added to basket" : "Add to basket"}</button>
    </div>
  );
}
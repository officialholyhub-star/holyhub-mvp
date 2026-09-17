export const BASKET_STORAGE_KEY = "holyhub-basket";
export const MAX_BASKET_QUANTITY = 20;
export const MAX_BASKET_ITEMS = 50;

export type BasketItem = {
  id: string;
  name: string;
  price: number;
  currency: "GBP";
  imageUrl: string | null;
  listerName: string;
  quantity: number;
};
import assert from "node:assert/strict";
import test from "node:test";
import { calculateCheckoutTotals, toPence } from "../lib/checkout-pricing.ts";

test("converts delivery pounds to integer pence", () => {
  assert.equal(toPence(6.35), 635);
  assert.equal(toPence("10.00"), 1000);
  assert.equal(toPence(1.999), null);
  assert.equal(toPence("1.999"), null);
});

test("charges a flat delivery amount once per lister", () => {
  const totals = calculateCheckoutTotals([
    { listerId: "seller-one", lineTotal: 1000, deliveryAmount: 635 },
    { listerId: "seller-one", lineTotal: 2000, deliveryAmount: 635 },
    { listerId: "seller-two", lineTotal: 500, deliveryAmount: 250 },
  ]);

  assert.equal(totals?.productSubtotal, 3500);
  assert.equal(totals?.deliveryTotal, 885);
  assert.equal(totals?.total, 4385);
  assert.equal(totals?.deliveryGroups.get("seller-one"), 635);
});

test("rejects unsafe or inconsistent checkout arithmetic", () => {
  assert.equal(calculateCheckoutTotals([{ listerId: "seller", lineTotal: Number.MAX_SAFE_INTEGER + 1, deliveryAmount: 0 }]), null);
  assert.equal(calculateCheckoutTotals([
    { listerId: "seller", lineTotal: 100, deliveryAmount: 500 },
    { listerId: "seller", lineTotal: 100, deliveryAmount: 600 },
  ]), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildCsv, FULFILMENT_STATUS_LABELS, isCarrier, isFulfilmentStatus } from "../lib/fulfilment.ts";

test("fulfilment statuses and carriers are carrier-neutral", () => {
  assert.equal(FULFILMENT_STATUS_LABELS.pending, "Unfulfilled");
  assert.equal(FULFILMENT_STATUS_LABELS.packed, "Processing");
  assert.equal(isFulfilmentStatus("dispatched"), true);
  assert.equal(isCarrier("Other"), true);
  assert.equal(isCarrier("Royal Mail"), true);
  assert.equal(isCarrier("Unknown"), false);
});

test("CSV escapes multi-item customer fulfilment rows", () => {
  const csv = buildCsv(["Order ID", "Product", "Variant/size", "Quantity"], [
    ["order-1", "T-shirt, blue", "M", 2],
    ["order-1", "Hoodie", "L", 1],
  ]);
  assert.match(csv, /"T-shirt, blue"/);
  assert.match(csv, /order-1,Hoodie,L,1/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const { calculateLaunchMetrics } = loadTypescript("lib/launch-metrics.ts");

test("calculates checkout, order and fulfilment launch metrics", () => {
  const metrics = calculateLaunchMetrics(
    [{ status: "paid" }, { status: "paid" }, { status: "failed" }, { status: "cancelled" }],
    [
      { order_status: "paid", total_amount: 2500, product_subtotal: 2200, delivery_total: 300, holyhub_commission: 110, stripe_processing_fee: 80, paid_at: "2026-10-18T00:00:00Z" },
      { order_status: "paid", total_amount: 1800, product_subtotal: 1800, delivery_total: 0, holyhub_commission: 90, stripe_processing_fee: 65, paid_at: "2026-10-18T00:02:00Z" },
    ],
    [{ fulfilment_status: "pending" }, { fulfilment_status: "dispatched" }],
  );

  assert.equal(metrics.checkoutStarts, 4);
  assert.equal(metrics.paidCheckouts, 2);
  assert.equal(metrics.checkoutConversionRate, 0.5);
  assert.equal(metrics.recordedOrderValue, 4300);
  assert.equal(metrics.recordedHolyHubCommission, 200);
  assert.equal(metrics.stripeFeeCoverage, 1);
  assert.equal(metrics.fulfilment.pending, 1);
  assert.equal(metrics.fulfilment.dispatched, 1);
  assert.equal(metrics.orderIntegrityMatches, true);
});

test("flags a paid checkout/order mismatch and handles an empty funnel", () => {
  const mismatch = calculateLaunchMetrics(
    [{ status: "paid" }, { status: "paid" }],
    [{ order_status: "paid", total_amount: 1000, product_subtotal: 1000, delivery_total: 0, holyhub_commission: 50, stripe_processing_fee: null, paid_at: "2026-10-18T00:00:00Z" }],
    [],
  );
  assert.equal(mismatch.orderIntegrityMatches, false);
  assert.equal(mismatch.stripeFeeCoverage, 0);

  const empty = calculateLaunchMetrics([], [], []);
  assert.equal(empty.checkoutConversionRate, null);
  assert.equal(empty.stripeFeeCoverage, null);
  assert.equal(empty.orderIntegrityMatches, true);
});

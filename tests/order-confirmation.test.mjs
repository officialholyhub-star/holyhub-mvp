import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const {
  orderConfirmationIdempotencyKey,
  renderOrderConfirmation,
  validateOrderConfirmation,
} = loadTypescript("lib/order-confirmation.ts");

function completeInput() {
  return {
    orderId: "order_123",
    orderDateIso: "2026-10-17T12:00:00.000Z",
    customerEmail: "customer@example.com",
    currency: "gbp",
    productSubtotal: 3000,
    deliveryTotal: 350,
    totalAmount: 3350,
    deliveryAddress: {
      line1: "1 Customer Road",
      city: "Basildon",
      postcode: "SS1 1AA",
      country: "GB",
    },
    sellers: [{
      sellerBusinessName: "Grace & Co",
      sellerLegalName: "Grace Trading Ltd",
      sellerGeographicalAddress: {
        line1: "10 Seller Street",
        city: "London",
        postcode: "E1 1AA",
        country: "GB",
      },
      sellerContactEmail: "help@seller.example",
      sellerTelephone: "020 0000 0000",
      deliveryAmount: 350,
      deliveryTerms: "Standard UK delivery — expected within 3–5 working days.",
      items: [{
        productName: "Faith Hoodie",
        quantity: 2,
        unitAmount: 1500,
        lineTotal: 3000,
      }],
    }],
  };
}

test("renders the required order, seller, price, delivery and cancellation structure", () => {
  const rendered = renderOrderConfirmation(completeInput());
  assert.equal(rendered.ok, true);
  assert.match(rendered.text, /Order reference: order_123/);
  assert.match(rendered.text, /Grace Trading Ltd/);
  assert.match(rendered.text, /10 Seller Street/);
  assert.match(rendered.text, /Faith Hoodie × 2/);
  assert.match(rendered.text, /Total paid: £33\.50/);
  assert.match(rendered.text, /within 14 days after receiving the goods/);
  assert.match(rendered.text, /Model cancellation form/);
});

test("fails closed when seller legal identity is unavailable", () => {
  const input = completeInput();
  input.sellers[0].sellerLegalName = "";
  const blockers = validateOrderConfirmation(input);
  assert.ok(blockers.includes("missing_seller_identity"));
  const rendered = renderOrderConfirmation(input);
  assert.deepEqual(rendered.ok, false);
});

test("escapes seller and product supplied HTML", () => {
  const input = completeInput();
  input.sellers[0].sellerBusinessName = "<Faith & Co>";
  input.sellers[0].items[0].productName = "<script>alert('x')</script>";
  const rendered = renderOrderConfirmation(input);
  assert.equal(rendered.ok, true);
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.match(rendered.html, /&lt;Faith &amp; Co&gt;/);
});

test("uses a stable per-order idempotency key", () => {
  assert.equal(orderConfirmationIdempotencyKey(" order_123 "), "customer-order-confirmation:order_123");
  assert.equal(orderConfirmationIdempotencyKey("order_123"), orderConfirmationIdempotencyKey("order_123"));
});

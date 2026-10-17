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
      sellerEntityType: "limited_company",
      sellerGeographicalAddress: {
        line1: "10 Seller Street",
        city: "London",
        postcode: "E1 1AA",
        country: "GB",
      },
      sellerServiceAddress: {
        line1: "11 Service Street",
        city: "London",
        postcode: "E1 1AB",
        country: "GB",
      },
      sellerContactEmail: "help@seller.example",
      sellerTelephone: "020 0000 0000",
      registrationNumber: "12345678",
      registrationJurisdiction: "England and Wales",
      registeredOffice: {
        line1: "12 Registered Road",
        city: "London",
        postcode: "E1 1AC",
        country: "GB",
      },
      vatNumber: "GB123456789",
      deliveryAmount: 350,
      deliveryTerms: "Dispatch within 3–5 working days",
      items: [{
        productName: "Faith Hoodie",
        variantSize: "M",
        quantity: 2,
        unitAmount: 1500,
        lineTotal: 3000,
      }],
    }],
  };
}

test("renders order, seller, registration, dispatch and cancellation details", () => {
  const rendered = renderOrderConfirmation(completeInput());
  assert.equal(rendered.ok, true);
  assert.match(rendered.text, /Order reference: order_123/);
  assert.match(rendered.text, /Grace Trading Ltd/);
  assert.match(rendered.text, /10 Seller Street/);
  assert.match(rendered.text, /11 Service Street/);
  assert.match(rendered.text, /12 Registered Road/);
  assert.match(rendered.text, /12345678/);
  assert.match(rendered.text, /Faith Hoodie — M × 2/);
  assert.match(rendered.text, /Dispatch within 3–5 working days/);
  assert.match(rendered.text, /Total paid: £33\.50/);
  assert.match(rendered.text, /legal duty to supply goods that conform to the contract/);
  assert.match(rendered.text, /within 14 days after receiving the goods/);
  assert.match(rendered.text, /Model cancellation form — Seller 1/);
  assert.match(rendered.text, /To: Grace Trading Ltd, 10 Seller Street/);
});

test("fails closed when seller legal identity is unavailable", () => {
  const input = completeInput();
  input.sellers[0].sellerLegalName = "";
  const blockers = validateOrderConfirmation(input);
  assert.ok(blockers.includes("missing_seller_identity"));
  const rendered = renderOrderConfirmation(input);
  assert.deepEqual(rendered.ok, false);
});

test("fails closed when company registration details are incomplete", () => {
  const input = completeInput();
  input.sellers[0].registrationNumber = null;
  assert.ok(validateOrderConfirmation(input).includes("missing_company_details"));
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

test("uses a stable versioned per-order idempotency key", () => {
  assert.equal(orderConfirmationIdempotencyKey(" order_123 "), "order:order_123:customer-confirmation:v1");
  assert.equal(orderConfirmationIdempotencyKey("order_123"), orderConfirmationIdempotencyKey("order_123"));
});

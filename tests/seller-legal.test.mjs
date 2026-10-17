import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const {
  formatSellerAddress,
  normalizeSellerLegalInput,
  sellerEntityLabel,
  sellerLegalProfileMatches,
  sellerLegalValidationError,
} = loadTypescript("lib/seller-legal.ts");

function completeInput() {
  return normalizeSellerLegalInput({
    legal_name: "Grace Trading Ltd",
    entity_type: "limited_company",
    address_line1: "10 Seller Street",
    address_line2: "",
    city: "London",
    postcode: "e1 1aa",
    country: "United Kingdom",
    contact_email: " Help@Seller.Example ",
    contact_phone: "020 0000 0000",
    registration_number: "ab123456",
    vat_number: "gb123456789",
  });
}

test("normalises and accepts a complete limited-company seller identity", () => {
  const input = completeInput();
  assert.equal(input.contact_email, "help@seller.example");
  assert.equal(input.postcode, "E1 1AA");
  assert.equal(input.registration_number, "AB123456");
  assert.equal(sellerLegalValidationError(input), null);
});

test("requires a registration number for a limited company", () => {
  const input = completeInput();
  input.registration_number = null;
  assert.match(sellerLegalValidationError(input), /registration number/i);
});

test("rejects an invalid business contact email", () => {
  const input = completeInput();
  input.contact_email = "not-an-email";
  assert.match(sellerLegalValidationError(input), /valid business contact email/i);
});

test("formats the public seller address and entity label", () => {
  const input = completeInput();
  assert.equal(formatSellerAddress(input), "10 Seller Street, London, E1 1AA, United Kingdom");
  assert.equal(sellerEntityLabel(input.entity_type), "Limited company");
});

test("detects whether an edited legal profile materially changed", () => {
  const input = completeInput();
  const profile = {
    ...input,
    user_id: "user-1",
    verification_status: "verified",
    verification_note: null,
    verified_at: "2026-10-17T12:00:00Z",
    verified_by: "admin-1",
    created_at: "2026-10-17T10:00:00Z",
    updated_at: "2026-10-17T12:00:00Z",
  };
  assert.equal(sellerLegalProfileMatches(profile, input), true);
  assert.equal(sellerLegalProfileMatches(profile, { ...input, city: "Manchester" }), false);
});

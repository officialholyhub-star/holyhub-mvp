import assert from "node:assert/strict";
import test from "node:test";
import { APPAREL_SIZES, hasAvailableApparelStock, hasValidApparelStock, variantLineKey } from "../lib/product-variants.ts";

test("apparel exposes six size stocks and accepts zero stock", () => {
  assert.deepEqual(APPAREL_SIZES, ["XS", "S", "M", "L", "XL", "XXL"]);
  assert.equal(hasValidApparelStock([0, 2, 5, 0, 1, 0]), true);
  assert.equal(hasValidApparelStock([0, 2, 5]), false);
  assert.equal(hasValidApparelStock([0, 2, -1, 0, 1, 0]), false);
  assert.equal(hasAvailableApparelStock([0, 0, 0, 0, 0, 0]), false);
  assert.equal(hasAvailableApparelStock([0, 2, 0, 0, 0, 0]), true);
});

test("different apparel sizes remain separate basket lines", () => {
  assert.notEqual(variantLineKey("product", "small-id"), variantLineKey("product", "medium-id"));
  assert.equal(variantLineKey("product"), "product:base");
});

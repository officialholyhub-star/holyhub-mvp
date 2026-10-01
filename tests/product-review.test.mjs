import assert from "node:assert/strict";
import test from "node:test";
import { combineReviewFeedback, hasMaterialProductChange } from "../lib/product-review.ts";

const base = { name: "Book", description: "A useful book", category_type: "Books", image_url: "old.jpg", size_guide_url: null, price: 20, stock_quantity: 5 };

test("operational price and stock changes are not material review changes", () => {
  assert.equal(hasMaterialProductChange(base, { ...base, price: 25, stock_quantity: 10 }), false);
});

test("presentation changes are material review changes", () => {
  assert.equal(hasMaterialProductChange(base, { ...base, description: "New detail" }), true);
  assert.equal(hasMaterialProductChange(base, { ...base, category_type: "Gifts" }), true);
  assert.equal(hasMaterialProductChange(base, { ...base, image_url: "new.jpg" }), true);
});

test("rejection feedback accepts presets, notes, or both", () => {
  assert.equal(combineReviewFeedback(["Wrong category"], ""), "Wrong category");
  assert.equal(combineReviewFeedback([], "Please add more context."), "Please add more context.");
  assert.equal(combineReviewFeedback(["Wrong category"], "Please correct it."), "Wrong category\nPlease correct it.");
  assert.equal(combineReviewFeedback([], ""), null);
});
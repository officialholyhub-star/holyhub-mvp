import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";
const presentation = loadTypescript("lib/order-presentation.ts");
const orderPresentation = (...args) => JSON.parse(JSON.stringify(presentation.orderPresentation(...args)));
test("order colours retain status labels and never invent overdue deadlines", () => {
  assert.deepEqual(orderPresentation("pending"), { tone: "neutral", label: "Unfulfilled" });
  assert.deepEqual(orderPresentation("packed"), { tone: "progress", label: "Processing" });
  assert.equal(orderPresentation("dispatched").tone, "progress");
  assert.deepEqual(orderPresentation("delivered"), { tone: "complete", label: "Delivered" });
  assert.deepEqual(orderPresentation("packed", "cancelled"), { tone: "neutral", label: "Cancelled" });
  assert.equal(orderPresentation("pending", "failed").tone, "urgent");
});

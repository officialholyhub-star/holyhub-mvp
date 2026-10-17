import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const {
  dispatchTerms,
  dispatchValidationError,
  isDispatchWindow,
} = loadTypescript("lib/dispatch-timeframe.ts");

test("accepts each approved standard dispatch window", () => {
  for (const value of ["1-2-working-days", "2-3-working-days", "3-5-working-days", "5-7-working-days"]) {
    assert.equal(isDispatchWindow(value), true);
    assert.equal(dispatchValidationError(value, ""), null);
    assert.match(dispatchTerms(value, ""), /Dispatch within/);
  }
});

test("made-to-order requires a specific saved timeframe", () => {
  assert.match(dispatchValidationError("made-to-order", ""), /approved made-to-order/i);
  assert.equal(dispatchValidationError("made-to-order", "Dispatch within 10–14 working days"), null);
  assert.equal(dispatchTerms("made-to-order", "Dispatch within 10–14 working days"), "Made to order — Dispatch within 10–14 working days");
});

test("rejects custom text on a standard dispatch window", () => {
  assert.match(dispatchValidationError("2-3-working-days", "something else"), /Remove the made-to-order detail/);
});

test("rejects unknown dispatch windows", () => {
  assert.equal(isDispatchWindow("tomorrow"), false);
  assert.match(dispatchValidationError("tomorrow", ""), /Choose a dispatch timeframe/);
  assert.equal(dispatchTerms("tomorrow", ""), null);
});

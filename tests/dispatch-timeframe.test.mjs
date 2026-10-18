import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const {
  dispatchTerms,
  dispatchValidationError,
  isDispatchWindow,
} = loadTypescript("lib/dispatch-timeframe.ts");

test("keeps approved legacy dispatch windows valid", () => {
  for (const value of ["1-2-working-days", "2-3-working-days", "3-5-working-days", "5-7-working-days"]) {
    assert.equal(isDispatchWindow(value), true);
    assert.equal(dispatchValidationError(value, ""), null);
    assert.match(dispatchTerms(value, ""), /Dispatch within/);
  }
});

test("seller can choose an exact number of working days", () => {
  assert.equal(isDispatchWindow("working-days"), true);
  for (const [days, label] of [
    ["1", "Dispatch within 1 working day"],
    ["4", "Dispatch within 4 working days"],
    ["30", "Dispatch within 30 working days"],
  ]) {
    assert.equal(dispatchValidationError("working-days", days), null);
    assert.equal(dispatchTerms("working-days", days), label);
  }
});

test("exact working days stays bounded and numeric", () => {
  for (const value of ["", "0", "31", "1.5", "four", " 4 days "]) {
    assert.match(dispatchValidationError("working-days", value), /whole number from 1 to 30/i);
    assert.equal(dispatchTerms("working-days", value), null);
  }
});

test("made-to-order requires a specific saved timeframe", () => {
  assert.match(dispatchValidationError("made-to-order", ""), /made-to-order/i);
  assert.equal(dispatchValidationError("made-to-order", "Dispatch within 10–14 working days"), null);
  assert.equal(dispatchTerms("made-to-order", "Dispatch within 10–14 working days"), "Made to order — Dispatch within 10–14 working days");
});

test("rejects custom text on a legacy dispatch window", () => {
  assert.match(dispatchValidationError("2-3-working-days", "something else"), /Remove the custom dispatch detail/);
});

test("rejects unknown dispatch windows", () => {
  assert.equal(isDispatchWindow("tomorrow"), false);
  assert.match(dispatchValidationError("tomorrow", ""), /Choose a dispatch timeframe/);
  assert.equal(dispatchTerms("tomorrow", ""), null);
});

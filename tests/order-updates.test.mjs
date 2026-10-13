import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./helpers/load-typescript.mjs";

function actionFor(owner = "seller-a", existing = { fulfilment_status: "packed", dispatched_at: null, delivered_at: null }) {
  const updates = [];
  const invalidated = [];
  const db = { from(table) {
    assert.equal(table, "seller_orders");
    const filters = {};
    let values;
    return {
      select() { return this; },
      update(next) { values = next; return this; },
      eq(key, value) { filters[key] = value; return this; },
      maybeSingle: async () => {
        const allowed = owner === filters.seller_user_id && (!values || !filters.fulfilment_status || filters.fulfilment_status === existing.fulfilment_status);
        if (values && allowed) updates.push({ values, filters });
        return { data: allowed ? { id: "order-a", ...existing } : null, error: null };
      },
      then(resolve) { updates.push({ values, filters }); resolve({ error: null }); },
    };
  } };
  const { updateSellerFulfilment } = loadTypescript("app/lister/orders/actions.ts", {
    "@/lib/auth/require-user": { requireRole: async role => { assert.equal(role, "lister"); return { user: { id: "seller-a" }, supabase: db }; } },
    "next/cache": { revalidatePath: path => invalidated.push(path) },
    "next/navigation": { redirect: location => { throw new Error(location); } },
  });
  return { run: updateSellerFulfilment, updates, invalidated };
}

function form(status = "packed") {
  const data = new FormData();
  for (const [key, value] of Object.entries({ seller_order_id: "order-a", fulfilment_status: status, confirmed: "yes", cancellation_reason: "item_unavailable", cancellation_confirmation: "final", carrier: "Royal Mail", carrier_other: "", tracking_number: "TRACK123", tracking_url: "https://example.com/track", fulfilment_note: "Pack carefully" })) data.set(key, value);
  return data;
}

test("status actions preserve stored enums and ownership; only dispatch writes delivery fields", async () => {
  for (const [current, status] of [["pending", "packed"], ["packed", "dispatched"], ["dispatched", "delivered"], ["packed", "cancelled"]]) {
    const action = actionFor("seller-a", { fulfilment_status: current });
    await assert.rejects(action.run(form(status)), /Fulfilment%20updated/);
    const { values, filters } = action.updates[0];
    assert.equal(filters.id, "order-a");
    assert.equal(filters.seller_user_id, "seller-a");
    assert.equal(values.fulfilment_status, status);
    assert.equal(values.tracking_number, status === "dispatched" ? "TRACK123" : undefined);
    assert.equal(values.tracking_url, status === "dispatched" ? "https://example.com/track" : undefined);
    assert.equal("fulfilment_note" in values, false);
    assert.ok(action.invalidated.includes("/lister"));
    assert.ok(action.invalidated.includes("/lister/orders"));
  }
});

test("another seller’s order is rejected without updating anything", async () => {
  const action = actionFor("seller-b");
  await assert.rejects(action.run(form()), /could%20not%20be%20found/);
  assert.equal(action.updates.length, 0);
});

test("Other carrier and URL validation remain enforced", async () => {
  const invalid = form("dispatched"); invalid.set("carrier", "Other");
  const action = actionFor();
  await assert.rejects(action.run(invalid), /valid%20values/);
  invalid.set("carrier_other", "Local delivery");
  invalid.set("tracking_url", "javascript:alert(1)");
  await assert.rejects(action.run(invalid), /valid%20values/);
  assert.equal(action.updates.length, 0);
  invalid.set("tracking_url", "https://example.com/track");
  await assert.rejects(action.run(invalid), /Fulfilment%20updated/);
  assert.equal(action.updates[0].values.carrier_other, "Local delivery");
});


test("delivery and private-note saves never change status or milestone dates", async () => {
  for (const status of ["dispatched", "delivered"]) {
    for (const intent of ["delivery", "note"]) {
      const action = actionFor("seller-a", { fulfilment_status: status, dispatched_at: "2026-10-01", delivered_at: "2026-10-02" });
      const data = form(status); data.set("intent", intent);
      await assert.rejects(action.run(data), /Fulfilment%20updated/);
      const values = action.updates[0].values;
      for (const key of ["fulfilment_status", "dispatched_at", "delivered_at"]) assert.equal(key in values, false);
      assert.equal("fulfilment_note" in values, intent === "note");
      assert.equal("tracking_number" in values, intent === "delivery");
      assert.ok(action.invalidated.includes("/account/orders"));
    }
  }
});

test("dispatched and completed orders cannot be cancelled through the server action", async () => {
  for (const status of ["dispatched", "delivered"]) {
    const action = actionFor("seller-a", { fulfilment_status: status });
    await assert.rejects(action.run(form("cancelled")), /cannot%20be%20cancelled/);
    assert.equal(action.updates.length, 0);
  }
});

test("high-impact status changes require confirmation", async () => {
  for (const status of ["dispatched", "delivered", "cancelled"]) {
    const action = actionFor(); const data = form(status); data.delete("confirmed");
    await assert.rejects(action.run(data), /Confirm/);
    assert.equal(action.updates.length, 0);
  }
});

test("correction allows earlier stages, preserves tracking, and resets invalid milestone dates", async () => {
  for (const [current, targets] of [["packed", ["pending"]], ["dispatched", ["pending", "packed"]], ["delivered", ["pending", "packed", "dispatched"]]]) {
    for (const target of targets) {
      const action = actionFor("seller-a", { fulfilment_status: current, dispatched_at: "2026-10-01", delivered_at: "2026-10-02" });
      const data = form(target); data.set("intent", "correction");
      await assert.rejects(action.run(data), /Fulfilment%20updated/);
      assert.equal(action.updates[0].values.delivered_at, null);
      assert.equal(action.updates[0].values.dispatched_at, target === "dispatched" ? "2026-10-01" : null);
      assert.equal("tracking_number" in action.updates[0].values, false);
    }
  }
  const action = actionFor(); const data = form("delivered"); data.set("intent", "correction");
  await assert.rejects(action.run(data), /earlier%20stage/);
  assert.equal(action.updates.length, 0);
});

test("dispatch without carrier or tracking remains allowed", async () => {
  const action = actionFor(); const data = form("dispatched");
  for (const key of ["carrier", "carrier_other", "tracking_number", "tracking_url"]) data.set(key, "");
  await assert.rejects(action.run(data), /Fulfilment%20updated/);
  assert.equal(action.updates[0].values.tracking_number, null);
});


test("stale status screens cannot overwrite a more recent stage", async () => {
  const action = actionFor("seller-a", { fulfilment_status: "dispatched" });
  const data = form("cancelled"); data.set("expected_status", "packed");
  await assert.rejects(action.run(data), /cannot%20be%20cancelled|has%20changed/);
  assert.equal(action.updates.length, 0);
});

test("another seller cannot edit delivery details or notes", async () => {
  for (const intent of ["delivery", "note", "correction"]) {
    const action = actionFor("seller-b"); const data = form(); data.set("intent", intent);
    await assert.rejects(action.run(data), /could%20not%20be%20found/);
    assert.equal(action.updates.length, 0);
  }
});


test("the normal action cannot bypass the secondary correction flow", async () => {
  const action = actionFor("seller-a", { fulfilment_status: "dispatched" });
  await assert.rejects(action.run(form("packed")), /Correct%20order%20status/);
  assert.equal(action.updates.length, 0);
});


test("cancellation needs a valid reason, custom explanation for Other, and final confirmation", async () => {
  for (const [reason, custom, confirmation] of [["", "", "final"], ["invalid", "", "final"], ["other", "   ", "final"], ["other", "x".repeat(241), "final"], ["item_unavailable", "", ""]]) {
    const action = actionFor(); const data = form("cancelled");
    data.set("cancellation_reason", reason); data.set("cancellation_custom_reason", custom); data.set("cancellation_confirmation", confirmation);
    await assert.rejects(action.run(data), /cancellation%20reason|cancellation%20confirmations/);
    assert.equal(action.updates.length, 0);
  }
  const action = actionFor(); const data = form("cancelled"); data.set("cancellation_reason", "other"); data.set("cancellation_custom_reason", "Wrong item ordered");
  await assert.rejects(action.run(data), /Fulfilment%20updated/);
  assert.equal(action.updates[0].values.fulfilment_status, "cancelled");
  assert.equal("fulfilment_note" in action.updates[0].values, false);
});

test("cancelled orders cannot be restored through status or correction actions", async () => {
  for (const intent of ["status", "correction"]) {
    const action = actionFor("seller-a", { fulfilment_status: "cancelled" }); const data = form("pending"); data.set("intent", intent);
    await assert.rejects(action.run(data), /Correct%20order%20status|earlier%20stage/);
    assert.equal(action.updates.length, 0);
  }
});

test("another lister cannot cancel an order even with a valid reason and confirmations", async () => {
  const action = actionFor("seller-b");
  await assert.rejects(action.run(form("cancelled")), /could%20not%20be%20found/);
  assert.equal(action.updates.length, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { page, query } from "./helpers/render-progress.mjs";
import { loadTypescript } from "./helpers/load-typescript.mjs";

const { getSellerFulfilmentSummary } = loadTypescript("lib/fulfilment-summary.ts");

function clientFor(rows, fail = false) {
  return {
    from(table) {
      assert.equal(table, "seller_orders");
      return {
        select(columns, options) {
          assert.equal(columns, "id");
          assert.equal(options.count, "exact");
          assert.equal(options.head, true);
          const filters = {};
          return {
            eq(column, value) {
              filters[column] = value;
              return this;
            },
            then(resolve) {
              assert.ok(filters.seller_user_id);
              resolve({ count: fail ? null : rows.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)).length, error: fail ? { message: "Unavailable" } : null });
            },
          };
        },
      };
    },
  };
}

test("counts only the current seller and excludes delivered/cancelled", async () => {
  const rows = ["pending", "pending", "packed", "dispatched", "dispatched", "dispatched", "delivered", "cancelled"].map(fulfilment_status => ({ seller_user_id: "seller-a", fulfilment_status }));
  rows.push({ seller_user_id: "seller-b", fulfilment_status: "pending" });
  const summary = await getSellerFulfilmentSummary(clientFor(rows), "seller-a");
  assert.equal(summary.unfulfilled, 2);
  assert.equal(summary.processing, 1);
  assert.equal(summary.dispatched, 3);
  assert.equal(summary.completed, 1);
  assert.equal(summary.toFulfil, 3);
});

test("empty and completed-only sellers have zero outstanding orders", async () => {
  for (const rows of [[], [{ seller_user_id: "seller-a", fulfilment_status: "delivered" }]]) {
    const summary = await getSellerFulfilmentSummary(clientFor(rows), "seller-a");
    assert.equal(summary.toFulfil, 0);
    assert.equal(summary.unfulfilled, 0);
    assert.equal(summary.processing, 0);
    assert.equal(summary.dispatched, 0);
    assert.equal(summary.completed, rows.length);
  }
});

test("exact counts cover more orders than the default list limit and reflect status changes", async () => {
  const rows = Array.from({ length: 1200 }, () => ({ seller_user_id: "seller-a", fulfilment_status: "pending" }));
  const client = clientFor(rows);
  assert.equal((await getSellerFulfilmentSummary(client, "seller-a")).unfulfilled, 1200);
  rows[0].fulfilment_status = "packed";
  rows[1].fulfilment_status = "delivered";
  const summary = await getSellerFulfilmentSummary(client, "seller-a");
  assert.equal(summary.unfulfilled, 1198);
  assert.equal(summary.processing, 1);
  assert.equal(summary.toFulfil, 1199);
});

test("query failures are not presented as an all-caught-up zero", async () => {
  assert.equal(await getSellerFulfilmentSummary(clientFor([], true), "seller-a"), null);
});

test("both pages use authenticated counts and saves invalidate both summaries", () => {
  for (const file of ["app/lister/page.tsx", "app/lister/orders/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireRole\("lister"\)/);
    assert.match(source, /getSellerFulfilmentSummary\(supabase, user.id\)/);
    if (file === "app/lister/orders/page.tsx") assert.match(source, /<FulfilmentSummary summary=\{fulfilmentSummary\}/);
  }
  const action = readFileSync("app/lister/orders/actions.ts", "utf8");
  assert.match(action, /revalidatePath\("\/lister"\)/);
  assert.match(action, /revalidatePath\("\/lister\/orders"\)/);
  const component = readFileSync("components/fulfilment-summary.tsx", "utf8");
  assert.match(component, /href="\/lister\/orders">View orders/);
  assert.match(component, /summary.toFulfil === 0/);
  assert.match(component, /No orders waiting to be prepared or sent\./);
});

test("dashboard tiles retain authenticated fulfilment counts and unavailable states", async () => {
  const supabase = { from: () => query({ data: [], count: 0, error: null }) };
  for (const summary of [{ toFulfil: 7 }, null]) {
    const html = await page("app/lister/page.tsx", supabase, {}, {
      "@/lib/fulfilment-summary": { getSellerFulfilmentSummary: async (client, owner) => {
        assert.equal(client, supabase); assert.equal(owner, "owner"); return summary;
      } },
    });
    assert.match(html, /href="\/lister\/orders"/);
    if (summary) assert.match(html, /7 need preparing or dispatch/);
    else {
      assert.match(html, /Order counts unavailable/);
      assert.doesNotMatch(html, /0 need preparing or dispatch/);
    }
  }
});

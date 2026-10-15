import assert from "node:assert/strict";
import test from "node:test";
import { renderAccount, elements } from "./helpers/render-account.mjs";
import { loadTypescript } from "./helpers/load-typescript.mjs";

test("customer account prioritises orders, removes fragmented cards, and keeps personal forms last", async () => {
  const { html, tree, actions } = await renderAccount({ fullName: "  Alex Customer" });
  assert.match(html, /Welcome back, Alex/);
  assert.match(html, /<dt>Status<\/dt><dd>Active/);
  assert.match(html, /<dt>Access<\/dt><dd>Customer/);
  assert.doesNotMatch(html, /Explore Marketplace|Account details|fulfilment|seller order|class="card/);
  assert.ok(html.indexOf("My purchases") < html.indexOf("Favourites</h2>"));
  assert.ok(html.indexOf("Favourites</h2>") < html.indexOf("Password / Security"));
  assert.ok(html.indexOf("Password / Security") < html.indexOf('id="profile-heading"'));
  const links = elements(tree, element => element.props?.href).map(element => element.props.href);
  for (const href of ["/account/orders", "/account/favourites", "/auth/forgot-password", "/lister/apply"]) assert.ok(links.includes(href));
  assert.ok(!links.includes("/lister"));
  const forms = elements(tree, element => element.type === "form");
  assert.equal(forms[0].props.action, actions.updateProfile);
  assert.equal(forms[1].props.action, actions.updateEmail);
  const inputs = elements(tree, element => element.type === "input");
  assert.equal(inputs[0].props.name, "full_name");
  assert.equal(inputs[0].props.defaultValue, "  Alex Customer");
  assert.equal(inputs[0].props.maxLength, 100);
  assert.equal(inputs[1].props.name, "email");
  assert.equal(inputs[1].props.defaultValue, "alex@example.test");
  assert.equal(inputs[1].props.required, true);
});

test("lister shortcut appears before customer actions and carries the whole-section link and brand", async () => {
  const { html, queries } = await renderAccount({ roles: [{ role: "customer" }, { role: "lister" }, { role: "admin" }], storefront: { business_name: "Alex Shop", logo_url: null } });
  assert.match(html, /Customer \/ Lister \/ Admin/);
  assert.match(html, /class="listerShortcut" href="\/lister"/);
  assert.match(html, /Manage your products, orders and storefront/);
  assert.match(html, /Open lister space/);
  assert.match(html, /Alex Shop brand logo/);
  assert.ok(html.indexOf("Lister space") < html.indexOf("My purchases"));
  assert.doesNotMatch(html, /Apply to become a lister/);
  assert.ok(queries.some(query => query.table === "lister_storefronts"));
});

test("pending and approved applications do not grant a lister shortcut without the lister role", async () => {
  for (const status of ["pending", "approved"]) {
    const { html, queries } = await renderAccount({ application: { status } });
    assert.match(html, status === "pending" ? /awaiting review/ : /approved/);
    assert.doesNotMatch(html, /href="\/lister"|Apply to become a lister/);
    assert.ok(!queries.some(query => query.table === "lister_storefronts"));
    for (const query of queries) assert.ok(query.filters.some(([field, value]) => ["id", "user_id"].includes(field) && value === "account-user"));
    assert.deepEqual(queries.find(query => query.table === "lister_applications").filters[1], ["status", ["pending", "approved"]]);
  }
});

test("missing profile or roles remain readable and account notices are preserved", async () => {
  const { html } = await renderAccount({ fullName: null, roles: null, params: { error: "Please try again", message: "Profile updated." } });
  assert.match(html, /Welcome back\./);
  assert.match(html, /<dd>Customer/);
  assert.match(html, /Please try again/);
  assert.match(html, /Profile updated\./);
});

test("profile and email actions still authenticate, save the expected fields, and return confirmation", async () => {
  const writes = [];
  const redirect = location => { throw new Error(location); };
  const actions = loadTypescript("app/account/actions.ts", {
    "next/navigation": { redirect }, "next/cache": { revalidatePath: path => writes.push(["revalidate", path]) },
    "@/lib/auth/require-user": { requireUser: async () => ({ user: { id: "account-user" }, supabase: {
      from: table => ({ update: values => ({ eq: (field, value) => { writes.push([table, values.full_name, field, value]); return { select: () => ({ maybeSingle: async () => ({ data: { id: value }, error: null }) }) }; } }) }),
      auth: { updateUser: async values => { writes.push(["email", values.email]); return { error: null }; } },
    } }) },
  });
  const profile = new FormData(); profile.set("full_name", "  Alex Updated  ");
  await assert.rejects(actions.updateProfile(profile), /Profile%20updated/);
  assert.deepEqual(writes[0], ["profiles", "Alex Updated", "id", "account-user"]);
  assert.deepEqual(writes[1], ["revalidate", "/account"]);
  const email = new FormData(); email.set("email", " New@Example.test ");
  await assert.rejects(actions.updateEmail(email), /confirm%20the%20change/);
  assert.deepEqual(writes[2], ["email", "new@example.test"]);
});

test("permanent preferences entry survives completed or dismissed optional onboarding", async () => {
  const { html, tree } = await renderAccount();
  assert.match(html, /Personalise HolyHub/);
  assert.match(html, /Update what you’re interested in and finish your HolyHub setup\./);
  const entry = elements(tree, element => element.props?.href === "/account/setup?edit=1");
  assert.equal(entry.length, 1);
  assert.match(html, /Edit preferences/);
});

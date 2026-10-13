import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const styles = new Proxy({}, { get: (_, key) => String(key) });
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in dependencies ? dependencies[name] : require(name) }, { filename: file });
  return exports;
}

export async function renderAccount({ roles = [{ role: "customer" }], application = null, storefront = null, fullName = "Alex Customer", params = {} } = {}) {
  const queries = [];
  const data = { profiles: { full_name: fullName, account_status: "active" }, user_roles: roles, lister_applications: application, lister_storefronts: storefront };
  const supabase = { from(table) {
    const query = { table, filters: [] };
    queries.push(query);
    const result = { data: data[table] };
    const builder = {
      select() { return builder; },
      eq(field, value) { query.filters.push([field, value]); return builder; },
      in(field, values) { query.filters.push([field, Array.from(values)]); return builder; },
      single: async () => result, maybeSingle: async () => result,
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
    return builder;
  } };
  const actions = { updateProfile: async function updateProfile() {}, updateEmail: async function updateEmail() {} };
  const brand = load("components/account-lister-brand.tsx", {
    "./account-lister-brand.module.css": { default: styles, __esModule: true },
    "next/image": { default: props => { const imageProps = { ...props }; delete imageProps.unoptimized; return React.createElement("img", imageProps); }, __esModule: true },
  });
  const { default: AccountPage } = load("app/account/page.tsx", {
    "@/components/draft-form": { DraftForm: "form", ClearDraft: () => null },
    "./actions": actions,
    "@/lib/auth/require-user": { requireUser: async () => ({ supabase, user: { id: "account-user", email: "alex@example.test" } }) },
    "@/components/account-lister-brand": brand,
    "next/link": { default: props => React.createElement("a", props), __esModule: true },
    "./page.module.css": { default: styles, __esModule: true },
  });
  const tree = await AccountPage({ searchParams: Promise.resolve(params) });
  return { tree, html: renderToStaticMarkup(tree), queries, actions };
}

export function elements(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}

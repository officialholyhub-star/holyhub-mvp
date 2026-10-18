import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const link = { default: ({ children, ...props }) => React.createElement('a', props, children), __esModule: true };
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, console: { error() {} }, process: { env: {} }, URL, URLSearchParams, FormData, Date, setTimeout, clearTimeout, ...globals, require: name => {
    if (name in dependencies) return dependencies[name];
    if (name === 'server-only') return {};
    if (name === 'next/link') return link;
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => String(key) }), __esModule: true };
    if (name.startsWith('@/')) { const base = name.slice(2); return load(fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`, dependencies, globals); }
    if (name.startsWith('.')) { const base = path.resolve(path.dirname(file), name); return load(fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`, dependencies, globals); }
    return require(name);
  } }, { filename: file });
  return exports;
}
function query(result) {
  return new Proxy({ then(resolve) { return Promise.resolve(result).then(resolve); } }, { get(target, key) { return key in target ? target[key] : () => query(result); } });
}
const render = element => renderToStaticMarkup(element);
const role = supabase => ({ requireRole: async () => ({ supabase, user: { id: 'owner' } }) });
const client = result => ({
  from: () => query(result),
  rpc: async () => ({ data: [], error: null }),
  auth: { getUser: async () => ({ data: { user: null } }) },
});
async function page(file, supabase, params = {}, dependencies = {}) {
  return render(await load(file, { '@/lib/auth/require-user': role(supabase), '@/lib/supabase/server': { createClient: async () => supabase }, ...dependencies }).default({ searchParams: Promise.resolve(params), params: Promise.resolve({ id: 'shop' }) }));
}

export { load, page, query, render, client };

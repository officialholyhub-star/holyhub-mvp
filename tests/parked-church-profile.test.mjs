import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const unavailable = new Error('NEXT_HTTP_ERROR_FALLBACK;404');
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const guard = load('lib/church-profile-availability.ts', { 'next/navigation': { notFound() { throw unavailable; } } });
const dependencies = {
  '@/lib/church-profile-availability': guard,
  '@/lib/auth/require-user': { requireUser() { assert.fail('Parked church feature must stop before authentication or database access'); } },
  '@/lib/church-places': {}, 'next/navigation': {}, 'next/cache': {},
  'react/jsx-runtime': {}, 'next/link': {}, '@/components/church-location-form': {},
  '@/app/churches/profile/actions': {},
};
test('direct church-profile navigation returns unavailable before any database query', async () => {
  const page = load('app/churches/profile/page.tsx', dependencies).default;
  await assert.rejects(page(), error => error === unavailable);
});
test('direct church-profile save action cannot access the parked schema', async () => {
  const action = load('app/churches/profile/actions.ts', dependencies).saveChurchProfile;
  await assert.rejects(action({}, new FormData()), error => error === unavailable);
});

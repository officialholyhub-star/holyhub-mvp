import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
export function loadTypescript(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: name => {
      if (name in dependencies) return dependencies[name];
      if (name === 'server-only') return {};
      if (name.startsWith('.')) return loadTypescript(path.resolve(path.dirname(file), `${name}.ts`), dependencies);
      if (name.startsWith('@/')) return loadTypescript(`${name.slice(2)}.ts`, dependencies);
      return nativeRequire(name);
    }, Buffer, TextEncoder, URL, AbortSignal, console, process, setTimeout, clearTimeout,
  }, { filename: file });
  return exports;
}

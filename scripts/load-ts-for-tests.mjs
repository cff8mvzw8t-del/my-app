import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Execute the real storage modules without adding a runtime dependency. */
export function loadTypeScriptForTests(entry, cache = new Map()) {
  const url = entry instanceof URL ? entry : new URL(entry);
  if (cache.has(url.href)) return cache.get(url.href).exports;
  const module = { exports: {} };
  cache.set(url.href, module);
  const source = readFileSync(url, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const nativeRequire = createRequire(url);
  const require = (specifier) => specifier.startsWith('.')
    ? loadTypeScriptForTests(new URL(specifier + '.ts', url), cache)
    : nativeRequire(specifier);
  new Function('require', 'module', 'exports', outputText + '\n//# sourceURL=' + fileURLToPath(url))(require, module, module.exports);
  return module.exports;
}

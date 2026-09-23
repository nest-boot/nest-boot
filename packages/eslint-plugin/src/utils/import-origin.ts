import type { TSESTree } from "@typescript-eslint/utils";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";
import * as ts from "typescript";

// Each parser Program owns its symbols; do not retain results across rebuilds.
interface ProgramCache {
  exports: Map<string, Map<ts.Symbol, string>>;
  names: Map<ts.Symbol, Map<string, string | null>>;
}
const programs = new WeakMap<ts.Program, ProgramCache>();

/** Identifies a re-export by symbol identity, never by the spelling of its alias. @internal */
export function reexportedImportName(
  source: Readonly<SourceCode>,
  modules: string | readonly string[],
  node: TSESTree.Node,
): string | null {
  const { program, esTreeNodeToTSNodeMap } = source.parserServices ?? {};
  if (!program || !esTreeNodeToTSNodeMap) return null;
  const checker = program.getTypeChecker();
  const original = esTreeNodeToTSNodeMap.get(node);
  const unalias = (symbol: ts.Symbol) =>
    symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  const reference = checker.getSymbolAtLocation(original);
  if (!reference) return null;
  const symbol = unalias(reference);
  const declarations = symbol.getDeclarations();
  if (!declarations?.length) return null;
  const candidates = typeof modules === "string" ? [modules] : modules;
  const key = JSON.stringify(candidates);
  const cache: ProgramCache = programs.get(program) ?? {
    exports: new Map(),
    names: new Map(),
  };
  programs.set(program, cache);
  const names = cache.names.get(symbol) ?? new Map<string, string | null>();
  cache.names.set(symbol, names);
  if (names.has(key)) return names.get(key) ?? null;

  // Resolving from a declaration also supports relative imports into workspace
  // packages whose public entry point is available through package self-reference.
  const locations = new Set([
    original.getSourceFile().fileName,
    ...declarations.map((declaration) => declaration.getSourceFile().fileName),
  ]);
  for (const module of candidates) {
    for (const location of locations) {
      const exportKey = JSON.stringify([module, location]);
      let exports = cache.exports.get(exportKey);
      if (!exports) {
        exports = new Map();
        const resolved = ts.resolveModuleName(
          module,
          location,
          program.getCompilerOptions(),
          ts.sys,
          undefined,
          undefined,
          ts.ModuleKind.ESNext,
        ).resolvedModule;
        const file =
          resolved && program.getSourceFile(resolved.resolvedFileName);
        const moduleSymbol = file && checker.getSymbolAtLocation(file);
        if (moduleSymbol) {
          for (const exported of checker.getExportsOfModule(moduleSymbol)) {
            exports.set(unalias(exported), exported.name);
          }
        }
        cache.exports.set(exportKey, exports);
      }
      const name = exports.get(symbol);
      if (name) {
        names.set(key, name);
        return name;
      }
    }
  }
  names.set(key, null);
  return null;
}

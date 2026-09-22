import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import type { RuleFix, SourceCode } from "@typescript-eslint/utils/ts-eslint";

/** Finds a canonical named binding in one module, respecting value imports. @internal */
export function hasNamedImport(
  source: Readonly<SourceCode>,
  moduleName: string,
  name: string,
  valueOnly = true,
): boolean {
  return source.ast.body.some(
    (node) =>
      node.type === AST_NODE_TYPES.ImportDeclaration &&
      node.source.value === moduleName &&
      (!valueOnly || node.importKind !== "type") &&
      node.specifiers.some(
        (specifier) =>
          specifier.type === AST_NODE_TYPES.ImportSpecifier &&
          specifier.imported.type === AST_NODE_TYPES.Identifier &&
          specifier.imported.name === name &&
          specifier.local.name === name &&
          (!valueOnly || specifier.importKind !== "type"),
      ),
  );
}

/** Adds canonical named imports while preserving existing aliases and type imports. @internal */
export function namedImportEdits(
  source: Readonly<SourceCode>,
  moduleName: string,
  names: readonly string[],
  valueImport = true,
): RuleFix[] {
  const imports = source.ast.body.filter(
    (node): node is TSESTree.ImportDeclaration =>
      node.type === AST_NODE_TYPES.ImportDeclaration &&
      node.source.value === moduleName,
  );
  const missing: string[] = [];
  const edits: RuleFix[] = [];
  const promotions = new Map<TSESTree.ImportDeclaration, Set<string>>();

  for (const name of new Set(names)) {
    const existing = imports.find((node) =>
      node.specifiers.some(
        (specifier) =>
          specifier.type === AST_NODE_TYPES.ImportSpecifier &&
          specifier.imported.type === AST_NODE_TYPES.Identifier &&
          specifier.imported.name === name &&
          specifier.local.name === name,
      ),
    );
    if (!existing) {
      missing.push(name);
    } else if (valueImport) {
      const promoted = promotions.get(existing) ?? new Set<string>();
      promoted.add(name);
      promotions.set(existing, promoted);
    }
  }

  for (const [declaration, promoted] of promotions) {
    if (declaration.importKind === "type") {
      const typeToken = source.getTokens(declaration)[1];
      edits.push({ range: typeToken.range, text: "" });
      for (const specifier of declaration.specifiers) {
        if (
          specifier.type === AST_NODE_TYPES.ImportSpecifier &&
          !promoted.has(specifier.local.name)
        ) {
          edits.push({
            range: [specifier.range[0], specifier.range[0]],
            text: "type ",
          });
        }
      }
    } else {
      for (const specifier of declaration.specifiers) {
        if (
          specifier.type === AST_NODE_TYPES.ImportSpecifier &&
          specifier.importKind === "type" &&
          promoted.has(specifier.local.name)
        ) {
          const typeToken = source.getFirstToken(specifier);
          if (typeToken) edits.push({ range: typeToken.range, text: "" });
        }
      }
    }
  }

  if (missing.length > 0) {
    const target = imports.find(
      (node) =>
        (!valueImport || node.importKind !== "type") &&
        node.specifiers.some(
          (specifier) => specifier.type === AST_NODE_TYPES.ImportSpecifier,
        ),
    );
    const last = target?.specifiers.at(-1);
    if (last) {
      const separator =
        target && source.getText(target).includes("\n") ? ",\n  " : ", ";
      edits.push({
        range: [last.range[1], last.range[1]],
        text: separator + missing.join(separator),
      });
    } else {
      const firstImport = source.ast.body.find(
        (node) => node.type === AST_NODE_TYPES.ImportDeclaration,
      );
      const start = firstImport?.range[0] ?? 0;
      const lineStart = source.text.lastIndexOf("\n", start - 1) + 1;
      const indent = source.text.slice(lineStart, start);
      edits.push({
        range: [start, start],
        text: `import { ${missing.join(", ")} } from ${JSON.stringify(moduleName)};\n${indent}`,
      });
    }
  }

  return edits;
}

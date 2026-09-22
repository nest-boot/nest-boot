import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import {
  type RuleFix,
  Scope,
  type SourceCode,
} from "@typescript-eslint/utils/ts-eslint";

type Modules = string | readonly string[];

const matchesModule = (modules: Modules, name: string) =>
  typeof modules === "string" ? modules === name : modules.includes(name);

const importedName = (specifier: TSESTree.ImportSpecifier) =>
  specifier.imported.type === AST_NODE_TYPES.Identifier
    ? specifier.imported.name
    : specifier.imported.value;

function importsFrom(source: Readonly<SourceCode>, modules: Modules) {
  return source.ast.body.filter(
    (node): node is TSESTree.ImportDeclaration =>
      node.type === AST_NODE_TYPES.ImportDeclaration &&
      matchesModule(modules, node.source.value),
  );
}

function findImport(
  source: Readonly<SourceCode>,
  modules: Modules,
  name: string,
):
  | {
      declaration: TSESTree.ImportDeclaration;
      specifier: TSESTree.ImportSpecifier;
    }
  | undefined {
  const bindings = importsFrom(source, modules).flatMap((declaration) =>
    declaration.specifiers.flatMap((specifier) =>
      specifier.type === AST_NODE_TYPES.ImportSpecifier &&
      importedName(specifier) === name &&
      !(source.scopeManager?.scopes ?? []).some((scope) =>
        scope.variables.some(
          (variable) =>
            variable.name === specifier.local.name &&
            variable.defs.some(
              (definition) =>
                definition.type !== Scope.DefinitionType.ImportBinding,
            ),
        ),
      )
        ? [{ declaration, specifier }]
        : [],
    ),
  );
  return (
    bindings.find(({ specifier }) => specifier.local.name === name) ??
    bindings[0]
  );
}

/** Resolves an existing alias or allocates a name without capturing another binding. @internal */
export function namedImportBinding(
  source: Readonly<SourceCode>,
  modules: Modules,
  name: string,
): string {
  const existing = findImport(source, modules, name);
  if (existing) return existing.specifier.local.name;
  const occupied = new Set(
    (source.scopeManager?.scopes ?? []).flatMap((scope) =>
      scope.variables
        .filter((variable) => variable.defs.length > 0)
        .map((variable) => variable.name),
    ),
  );
  let local = name;
  for (let suffix = 2; occupied.has(local); suffix++)
    local = `${name}${String(suffix)}`;
  return local;
}

/** Resolves a local identifier back to its imported name in the selected modules. @internal */
export function importedBindingName(
  source: Readonly<SourceCode>,
  modules: Modules,
  local: string,
): string {
  for (const declaration of importsFrom(source, modules)) {
    for (const specifier of declaration.specifiers) {
      if (
        specifier.type === AST_NODE_TYPES.ImportSpecifier &&
        specifier.local.name === local
      ) {
        return importedName(specifier);
      }
    }
  }
  return local;
}

/** Checks the binding used by generated code, including aliases and type-only imports. @internal */
export function hasNamedImport(
  source: Readonly<SourceCode>,
  modules: Modules,
  name: string,
  valueOnly = true,
): boolean {
  const existing = findImport(source, modules, name);
  return (
    !!existing &&
    (!valueOnly ||
      (existing.declaration.importKind !== "type" &&
        existing.specifier.importKind !== "type"))
  );
}

/** Adds or promotes the bindings returned by namedImportBinding. @internal */
export function namedImportEdits(
  source: Readonly<SourceCode>,
  modules: Modules,
  names: readonly string[],
  valueImport = true,
): RuleFix[] {
  const imports = importsFrom(source, modules);
  const missing: string[] = [];
  const edits: RuleFix[] = [];
  const promotions = new Map<TSESTree.ImportDeclaration, Set<string>>();

  for (const name of new Set(names)) {
    const existing = findImport(source, modules, name);
    if (!existing) {
      const local = namedImportBinding(source, modules, name);
      missing.push(local === name ? name : `${name} as ${local}`);
    } else if (valueImport) {
      const promoted =
        promotions.get(existing.declaration) ?? new Set<string>();
      promoted.add(existing.specifier.local.name);
      promotions.set(existing.declaration, promoted);
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
      const separator = source.getText(target).includes("\n") ? ",\n  " : ", ";
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
      const moduleName =
        imports[0]?.source.value ??
        (typeof modules === "string" ? modules : modules[0]);
      edits.push({
        range: [start, start],
        text: `import { ${missing.join(", ")} } from ${JSON.stringify(moduleName)};\n${indent}`,
      });
    }
  }
  return edits;
}

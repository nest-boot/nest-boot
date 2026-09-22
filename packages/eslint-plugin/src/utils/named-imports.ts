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

function visibleScopes(source: Readonly<SourceCode>, location: TSESTree.Node) {
  const scopes = [];
  let scope: Scope.Scope | null = source.getScope(location);
  if (location === source.ast)
    scope =
      source.scopeManager?.scopes.find(
        (candidate) => candidate.type === Scope.ScopeType.module,
      ) ?? scope;
  for (; scope; scope = scope.upper) scopes.push(scope);
  return scopes;
}

function findImport(
  source: Readonly<SourceCode>,
  modules: Modules,
  name: string,
  location: TSESTree.Node,
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
      visibleScopes(source, location)
        .map((scope) => scope.set.get(specifier.local.name))
        .find((variable) => !!variable)
        ?.defs.some(
          (definition) =>
            definition.type === Scope.DefinitionType.ImportBinding &&
            definition.node === specifier,
        )
        ? [{ declaration, specifier }]
        : [],
    ),
  );
  const values = bindings.filter(
    ({ declaration, specifier }) =>
      declaration.importKind !== "type" && specifier.importKind !== "type",
  );
  const preferred = values.length ? values : bindings;
  return (
    preferred.find(({ specifier }) => specifier.local.name === name) ??
    preferred[0]
  );
}

/** Resolves an existing alias or allocates a name without capturing another binding. @internal */
export function namedImportBinding(
  source: Readonly<SourceCode>,
  modules: Modules,
  name: string,
  location: TSESTree.Node = source.ast,
): string {
  const existing = findImport(source, modules, name, location);
  if (existing) return existing.specifier.local.name;
  const occupied = new Set(
    [
      ...new Set([
        ...visibleScopes(source, location),
        ...visibleScopes(source, source.ast),
      ]),
    ].flatMap((scope) =>
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

/** Resolves named and namespace imports through their lexical references. @internal */
export function importedBindingName(
  source: Readonly<SourceCode>,
  modules: Modules,
  node: TSESTree.Node,
): string | null {
  const identifier =
    node.type === AST_NODE_TYPES.Identifier
      ? node
      : node.type === AST_NODE_TYPES.MemberExpression &&
          node.object.type === AST_NODE_TYPES.Identifier
        ? node.object
        : node.type === AST_NODE_TYPES.TSQualifiedName &&
            node.left.type === AST_NODE_TYPES.Identifier
          ? node.left
          : null;
  if (!identifier) return null;
  const member =
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
    node.property.type === AST_NODE_TYPES.Identifier
      ? node.property.name
      : node.type === AST_NODE_TYPES.TSQualifiedName
        ? node.right.name
        : null;
  const reference = (source.scopeManager?.scopes ?? [])
    .flatMap((scope) => scope.references)
    .find((candidate) => candidate.identifier === identifier);
  const variable = reference?.resolved;
  // Preserve the rules' support for unresolved ambient decorator names.
  if (!variable) return node === identifier ? identifier.name : null;
  for (const definition of variable.defs) {
    if (
      definition.type !== Scope.DefinitionType.ImportBinding ||
      definition.parent.type !== AST_NODE_TYPES.ImportDeclaration ||
      !matchesModule(modules, definition.parent.source.value)
    )
      continue;
    if (
      node === identifier &&
      definition.node.type === AST_NODE_TYPES.ImportSpecifier
    ) {
      return importedName(definition.node);
    }
    if (definition.node.type === AST_NODE_TYPES.ImportNamespaceSpecifier)
      return member;
  }
  return null;
}

/** Whether the actual reference points to an erased import. @internal */
export function isTypeOnlyImportReference(
  source: Readonly<SourceCode>,
  node: TSESTree.Node,
): boolean {
  const identifier =
    node.type === AST_NODE_TYPES.MemberExpression ? node.object : node;
  const variable = (source.scopeManager?.scopes ?? [])
    .flatMap((scope) => scope.references)
    .find((reference) => reference.identifier === identifier)?.resolved;
  return (
    variable?.defs.some(
      (definition) =>
        definition.type === Scope.DefinitionType.ImportBinding &&
        (definition.parent.importKind === "type" ||
          (definition.node.type === AST_NODE_TYPES.ImportSpecifier &&
            definition.node.importKind === "type")),
    ) ?? false
  );
}

/** Checks the binding used by generated code, including aliases and type-only imports. @internal */
export function hasNamedImport(
  source: Readonly<SourceCode>,
  modules: Modules,
  name: string,
  valueOnly = true,
  location: TSESTree.Node = source.ast,
): boolean {
  const existing = findImport(source, modules, name, location);
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
  location: TSESTree.Node = source.ast,
): RuleFix[] {
  const imports = importsFrom(source, modules);
  const missing: string[] = [];
  const edits: RuleFix[] = [];
  const promotions = new Map<TSESTree.ImportDeclaration, Set<string>>();

  for (const name of new Set(names)) {
    const existing = findImport(source, modules, name, location);
    if (!existing) {
      const local = namedImportBinding(source, modules, name, location);
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
      const firstStatement = source.ast.body.find(
        (node) =>
          node.type !== AST_NODE_TYPES.ExpressionStatement || !node.directive,
      );
      const start =
        firstImport?.range[0] ?? firstStatement?.range[0] ?? source.text.length;
      const lineStart = source.text.lastIndexOf("\n", start - 1) + 1;
      const prefix = source.text.slice(lineStart, start);
      const indent = /^[ \t]*/.exec(prefix)?.[0] ?? "";
      const separator = prefix.trim() ? `\n${indent}` : "";
      const moduleName =
        imports[0]?.source.value ??
        (typeof modules === "string" ? modules : modules[0]);
      edits.push({
        range: [start, start],
        text: `${separator}import { ${missing.join(", ")} } from ${JSON.stringify(moduleName)};\n${indent}`,
      });
    }
  }
  return edits;
}

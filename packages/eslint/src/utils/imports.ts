import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  AST_NODE_TYPES,
  AST_TOKEN_TYPES,
  ASTUtils,
  type TSESTree,
} from "@typescript-eslint/utils";
import {
  type RuleFix,
  type RuleFixer,
  Scope,
  type SourceCode,
} from "@typescript-eslint/utils/ts-eslint";

type ModuleMatcher = string | readonly string[];

interface EnclosingPackage {
  dir: string;
  name: string;
}

const enclosingPackageCache = new Map<string, EnclosingPackage | null>();

/**
 * Finds the nearest enclosing `package.json` directory and `"name"` for `filename`.
 * @param filename - Absolute file path being linted.
 * @returns Enclosing package metadata, or null when unavailable.
 */
function findEnclosingPackage(filename?: string): EnclosingPackage | null {
  if (!filename || !path.isAbsolute(filename)) {
    return null;
  }
  let dir = path.dirname(filename);
  const visited: string[] = [];
  for (;;) {
    const cached = enclosingPackageCache.get(dir);
    if (cached !== undefined) {
      for (const item of visited) {
        enclosingPackageCache.set(item, cached);
      }
      return cached;
    }
    visited.push(dir);
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          name?: unknown;
        };
        const found =
          typeof parsed.name === "string" ? { dir, name: parsed.name } : null;
        for (const item of visited) {
          enclosingPackageCache.set(item, found);
        }
        return found;
      } catch {
        // Ignore unreadable package.json files and continue walking upward.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      for (const item of visited) {
        enclosingPackageCache.set(item, null);
      }
      return null;
    }
    dir = parent;
  }
}

const matchesModule = (
  modules: ModuleMatcher,
  moduleName: string,
  filename?: string,
): boolean => {
  let effective = moduleName;
  if (moduleName.startsWith(".")) {
    const pkg = findEnclosingPackage(filename);
    if (pkg && filename) {
      const resolved = path.resolve(path.dirname(filename), moduleName);
      const rel = path.relative(pkg.dir, resolved);
      if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
        effective = pkg.name;
      }
    }
  }
  return typeof modules === "string"
    ? modules === effective
    : modules.includes(effective);
};

const getSpecifierImportedName = (
  specifier: TSESTree.ImportSpecifier,
): string =>
  specifier.imported.type === AST_NODE_TYPES.Identifier
    ? specifier.imported.name
    : specifier.imported.value;

/**
 * Extracts the root identifier and optional member property name from a reference node.
 * @param node - The identifier, member expression, or qualified type name node.
 * @returns The root identifier and static member name, or null when unsupported.
 */
function extractReferenceParts(node: TSESTree.Node): {
  identifier: TSESTree.Identifier;
  member: string | null;
} | null {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return { identifier: node, member: null };
  }
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    node.object.type === AST_NODE_TYPES.Identifier
  ) {
    const member = ASTUtils.getPropertyName(node);
    return member ? { identifier: node.object, member } : null;
  }
  if (
    node.type === AST_NODE_TYPES.TSQualifiedName &&
    node.left.type === AST_NODE_TYPES.Identifier
  ) {
    return { identifier: node.left, member: node.right.name };
  }
  return null;
}

/**
 * Resolves the lexical scope to start variable lookups from for `location`.
 * @param source - The ESLint source code for the current file.
 * @param location - The AST node whose visible scope should be inspected.
 * @returns Starting `Scope` (module scope when `location` is `Program`).
 */
function getLookupScope(
  source: Readonly<SourceCode>,
  location: TSESTree.Node,
): Scope.Scope {
  if (location === source.ast) {
    return (
      source.scopeManager?.scopes.find(
        (candidate) => candidate.type === Scope.ScopeType.module,
      ) ?? source.getScope(location)
    );
  }
  return source.getScope(location);
}

/**
 * Finds an in-scope named import specifier from `modules` matching `exportedName`.
 * @param source - The ESLint source code for the current file.
 * @param modules - Target module specifier(s).
 * @param exportedName - Exported symbol name to match.
 * @param location - AST node where the binding must be visible.
 * @param filename - Optional current file path for intra-package relative import resolution.
 * @returns Matching import declaration and specifier, if present.
 */
function findVisibleImport(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  exportedName: string,
  location: TSESTree.Node,
  filename?: string,
):
  | {
      declaration: TSESTree.ImportDeclaration;
      specifier: TSESTree.ImportSpecifier;
    }
  | undefined {
  const lookupScope = getLookupScope(source, location);
  const candidates = source.ast.body.flatMap((statement) =>
    statement.type !== AST_NODE_TYPES.ImportDeclaration ||
    !matchesModule(modules, statement.source.value, filename)
      ? []
      : statement.specifiers.flatMap((specifier) => {
          if (
            specifier.type !== AST_NODE_TYPES.ImportSpecifier ||
            getSpecifierImportedName(specifier) !== exportedName
          ) {
            return [];
          }
          const visibleVar = ASTUtils.findVariable(
            lookupScope,
            specifier.local.name,
          );
          const resolvesToSpecifier = visibleVar?.defs.some(
            (def) =>
              def.type === Scope.DefinitionType.ImportBinding &&
              def.node === specifier,
          );
          return resolvesToSpecifier
            ? [{ declaration: statement, specifier }]
            : [];
        }),
  );

  const valueCandidates = candidates.filter(
    ({ declaration, specifier }) =>
      declaration.importKind !== "type" && specifier.importKind !== "type",
  );
  const preferred = valueCandidates.length > 0 ? valueCandidates : candidates;
  return (
    preferred.find(({ specifier }) => specifier.local.name === exportedName) ??
    preferred[0]
  );
}

/**
 * Resolves the canonical exported name referenced by `node` when imported from `modules`
 * (or referenced as an unshadowed ambient identifier in standalone rule snippets).
 * @param source - The ESLint source code for the current file.
 * @param modules - Candidate module specifier(s).
 * @param node - Reference AST node (identifier, member expression, or qualified name).
 * @param filename - Optional current file path for intra-package relative import resolution.
 * @returns Canonical exported symbol name, or null when bound elsewhere.
 */
export function getImportedName(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  node: TSESTree.Node,
  filename?: string,
): string | null {
  const parts = extractReferenceParts(node);
  if (!parts) {
    return null;
  }
  const variable = ASTUtils.findVariable(
    source.getScope(parts.identifier),
    parts.identifier,
  );
  if (!variable || variable.defs.length === 0) {
    return parts.member === null ? parts.identifier.name : null;
  }
  for (const def of variable.defs) {
    if (
      def.type !== Scope.DefinitionType.ImportBinding ||
      def.parent.type !== AST_NODE_TYPES.ImportDeclaration ||
      !matchesModule(modules, def.parent.source.value, filename)
    ) {
      continue;
    }
    if (
      parts.member === null &&
      def.node.type === AST_NODE_TYPES.ImportSpecifier
    ) {
      return getSpecifierImportedName(def.node);
    }
    if (
      parts.member !== null &&
      def.node.type === AST_NODE_TYPES.ImportNamespaceSpecifier
    ) {
      return parts.member;
    }
  }
  return null;
}

/**
 * Checks whether `node` resolves to a type-only import that is erased at runtime.
 * @param source - The ESLint source code for the current file.
 * @param node - Reference AST node to check.
 * @returns True when backed by a `type` import declaration or specifier.
 */
export function isTypeOnlyImportReference(
  source: Readonly<SourceCode>,
  node: TSESTree.Node,
): boolean {
  const parts = extractReferenceParts(node);
  if (!parts) {
    return false;
  }
  const variable = ASTUtils.findVariable(
    source.getScope(parts.identifier),
    parts.identifier,
  );
  return (variable?.defs ?? []).some(
    (def) =>
      def.type === Scope.DefinitionType.ImportBinding &&
      def.parent.type === AST_NODE_TYPES.ImportDeclaration &&
      (def.parent.importKind === "type" ||
        (def.node.type === AST_NODE_TYPES.ImportSpecifier &&
          def.node.importKind === "type")),
  );
}

/**
 * Checks whether a matching named import is visible at `location`.
 * @param source - The ESLint source code for the current file.
 * @param modules - Candidate module specifier(s).
 * @param name - Exported symbol name to look up.
 * @param valueOnly - Whether to require a non-type value import.
 * @param location - AST node where the import must be visible.
 * @param filename - Optional current file path for intra-package relative import resolution.
 * @returns True when a matching import binding exists.
 */
export function hasNamedImport(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  name: string,
  valueOnly = true,
  location: TSESTree.Node = source.ast,
  filename?: string,
): boolean {
  const existing = findVisibleImport(source, modules, name, location, filename);
  return (
    existing !== undefined &&
    (!valueOnly ||
      (existing.declaration.importKind !== "type" &&
        existing.specifier.importKind !== "type"))
  );
}

/**
 * Resolves the local identifier to reference for `name` imported from `modules`,
 * reusing an existing alias or avoiding shadowed local bindings.
 * @param source - The ESLint source code for the current file.
 * @param modules - Candidate module specifier(s).
 * @param name - Exported symbol name to bind.
 * @param location - AST node where the identifier will be referenced.
 * @param filename - Optional current file path for intra-package relative import resolution.
 * @returns Safe local identifier name.
 */
export function getLocalImportBinding(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  name: string,
  location: TSESTree.Node = source.ast,
  filename?: string,
): string {
  const existing = findVisibleImport(source, modules, name, location, filename);
  if (existing) {
    return existing.specifier.local.name;
  }
  const lookupScope = getLookupScope(source, location);
  const moduleScope = getLookupScope(source, source.ast);
  const isOccupied = (candidate: string): boolean =>
    (ASTUtils.findVariable(lookupScope, candidate)?.defs.length ?? 0) > 0 ||
    (ASTUtils.findVariable(moduleScope, candidate)?.defs.length ?? 0) > 0;
  let local = name;
  for (let suffix = 2; isOccupied(local); suffix++) {
    local = `${name}${String(suffix)}`;
  }
  return local;
}

/**
 * Builds `RuleFix` operations promoting selected type-only imports to value imports.
 * @param fixer - ESLint `RuleFixer`.
 * @param source - The ESLint source code for the current file.
 * @param promotions - Map of import declarations to local binding names to promote.
 * @returns Array of `RuleFix` edits.
 */
function buildPromotionFixes(
  fixer: RuleFixer,
  source: Readonly<SourceCode>,
  promotions: Map<TSESTree.ImportDeclaration, Set<string>>,
): RuleFix[] {
  const fixes: RuleFix[] = [];
  for (const [declaration, promotedNames] of promotions) {
    if (declaration.importKind === "type") {
      const typeToken = source.getFirstToken(declaration, { skip: 1 });
      if (typeToken?.value === "type") {
        const tokenAfter = source.getTokenAfter(typeToken);
        fixes.push(
          fixer.removeRange([
            typeToken.range[0],
            tokenAfter ? tokenAfter.range[0] : typeToken.range[1],
          ]),
        );
      }
      for (const specifier of declaration.specifiers) {
        if (
          specifier.type === AST_NODE_TYPES.ImportSpecifier &&
          !promotedNames.has(specifier.local.name)
        ) {
          fixes.push(fixer.insertTextBefore(specifier, "type "));
        }
      }
    } else {
      for (const specifier of declaration.specifiers) {
        if (
          specifier.type === AST_NODE_TYPES.ImportSpecifier &&
          specifier.importKind === "type" &&
          promotedNames.has(specifier.local.name)
        ) {
          const typeToken = source.getFirstToken(specifier);
          if (typeToken?.value === "type") {
            const tokenAfter = source.getTokenAfter(typeToken);
            fixes.push(
              fixer.removeRange([
                typeToken.range[0],
                tokenAfter ? tokenAfter.range[0] : typeToken.range[1],
              ]),
            );
          }
        }
      }
    }
  }
  return fixes;
}

/**
 * Produces `RuleFix` edits ensuring `names` are imported from `modules` (promoting
 * type-only imports when `valueImport` is true).
 * @param fixer - ESLint `RuleFixer`.
 * @param source - The ESLint source code for the current file.
 * @param modules - Candidate module specifier(s).
 * @param names - Exported symbol names to import.
 * @param valueImport - Whether runtime value imports are required.
 * @param location - AST node where the bindings will be referenced.
 * @param filename - Optional current file path for intra-package relative import resolution.
 * @returns Array of `RuleFix` edits.
 */
export function ensureNamedImportFixes(
  fixer: RuleFixer,
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  names: readonly string[],
  valueImport = true,
  location: TSESTree.Node = source.ast,
  filename?: string,
): RuleFix[] {
  const matchingDecls = source.ast.body.filter(
    (stmt): stmt is TSESTree.ImportDeclaration =>
      stmt.type === AST_NODE_TYPES.ImportDeclaration &&
      matchesModule(modules, stmt.source.value, filename),
  );
  const missingSpecs: string[] = [];
  const promotions = new Map<TSESTree.ImportDeclaration, Set<string>>();

  for (const name of new Set(names)) {
    const existing = findVisibleImport(
      source,
      modules,
      name,
      location,
      filename,
    );
    if (!existing) {
      const local = getLocalImportBinding(
        source,
        modules,
        name,
        location,
        filename,
      );
      missingSpecs.push(local === name ? name : `${name} as ${local}`);
    } else if (
      valueImport &&
      (existing.declaration.importKind === "type" ||
        existing.specifier.importKind === "type")
    ) {
      const set = promotions.get(existing.declaration) ?? new Set<string>();
      set.add(existing.specifier.local.name);
      promotions.set(existing.declaration, set);
    }
  }

  const fixes = buildPromotionFixes(fixer, source, promotions);
  if (missingSpecs.length === 0) {
    return fixes;
  }

  const targetDecl = matchingDecls.find(
    (decl) =>
      (!valueImport || decl.importKind !== "type" || promotions.has(decl)) &&
      decl.specifiers.some(
        (spec) => spec.type === AST_NODE_TYPES.ImportSpecifier,
      ),
  );
  const lastSpecifier = targetDecl?.specifiers.at(-1);
  if (targetDecl && lastSpecifier) {
    const separator = source.getText(targetDecl).includes("\n")
      ? ",\n  "
      : ", ";
    fixes.push(
      fixer.insertTextAfter(
        lastSpecifier,
        separator + missingSpecs.join(separator),
      ),
    );
    return fixes;
  }

  const firstImport = source.ast.body.find(
    (stmt) => stmt.type === AST_NODE_TYPES.ImportDeclaration,
  );
  const firstStatement = source.ast.body.find(
    (stmt) =>
      stmt.type !== AST_NODE_TYPES.ExpressionStatement || !stmt.directive,
  );
  const anchor = firstImport ?? firstStatement;
  const attachedDocComment =
    anchor &&
    source
      .getCommentsBefore(anchor)
      .find(
        (comment) =>
          comment.type === AST_TOKEN_TYPES.Block &&
          comment.value.startsWith("*") &&
          !/@(?:license|preserve|file(?:overview)?)\b|copyright/i.test(
            comment.value,
          ),
      );
  const insertPos =
    attachedDocComment?.range[0] ?? anchor?.range[0] ?? source.text.length;
  const lineStart = source.text.lastIndexOf("\n", insertPos - 1) + 1;
  const prefix = source.text.slice(lineStart, insertPos);
  const indent = /^[ \t]*/.exec(prefix)?.[0] ?? "";
  const leadingBreak = prefix.trim() ? `\n${indent}` : "";
  const targetModule =
    matchingDecls[0]?.source.value ??
    (typeof modules === "string" ? modules : modules[0]);

  fixes.push(
    fixer.insertTextBeforeRange(
      [insertPos, insertPos],
      `${leadingBreak}import { ${missingSpecs.join(", ")} } from ${JSON.stringify(targetModule)};\n${indent}`,
    ),
  );
  return fixes;
}

/**
 * Promotes type-only imports referenced at runtime by `nodes` to value imports.
 * @param fixer - ESLint `RuleFixer`.
 * @param source - The ESLint source code for the current file.
 * @param nodes - Runtime reference AST nodes.
 * @returns Array of `RuleFix` edits.
 */
export function promoteTypeImportFixes(
  fixer: RuleFixer,
  source: Readonly<SourceCode>,
  nodes: readonly TSESTree.Node[],
): RuleFix[] {
  const promotions = new Map<TSESTree.ImportDeclaration, Set<string>>();
  for (const node of nodes) {
    const parts = extractReferenceParts(node);
    if (!parts) {
      continue;
    }
    const variable = ASTUtils.findVariable(
      source.getScope(parts.identifier),
      parts.identifier,
    );
    for (const def of variable?.defs ?? []) {
      if (
        def.type === Scope.DefinitionType.ImportBinding &&
        def.parent.type === AST_NODE_TYPES.ImportDeclaration &&
        def.node.type !== AST_NODE_TYPES.TSImportEqualsDeclaration &&
        (def.parent.importKind === "type" ||
          (def.node.type === AST_NODE_TYPES.ImportSpecifier &&
            def.node.importKind === "type"))
      ) {
        const set = promotions.get(def.parent) ?? new Set<string>();
        set.add(def.node.local.name);
        promotions.set(def.parent, set);
      }
    }
  }
  return buildPromotionFixes(fixer, source, promotions);
}

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
import { isSymbolFlagSet } from "ts-api-utils";
import * as ts from "typescript";

type ModuleMatcher = string | readonly string[];

interface EnclosingPackage {
  dir: string;
  name: string;
}

const enclosingPackageCache = new Map<string, EnclosingPackage | null>();

/**
 * Finds the nearest enclosing `package.json` with a valid `"name"` field for `filename`.
 * @param filename - Absolute file path being inspected.
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
        if (typeof parsed.name === "string" && parsed.name.length > 0) {
          const found = { dir, name: parsed.name };
          for (const item of visited) {
            enclosingPackageCache.set(item, found);
          }
          return found;
        }
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

const matchesDirectModule = (
  modules: ModuleMatcher,
  moduleName: string,
): boolean =>
  typeof modules === "string"
    ? modules === moduleName
    : modules.includes(moduleName);

const matchesOriginPackage = (
  modules: ModuleMatcher,
  pkg: EnclosingPackage,
  declFile: string,
): boolean => {
  const candidates = typeof modules === "string" ? [modules] : modules;
  const relFile = path.relative(pkg.dir, declFile).replaceAll("\\", "/");
  return candidates.some((candidate) => {
    if (candidate === pkg.name) {
      return true;
    }
    if (!candidate.startsWith(`${pkg.name}/`)) {
      return false;
    }
    const subpath = candidate.slice(pkg.name.length + 1);
    return (
      relFile === subpath ||
      relFile.startsWith(`${subpath}/`) ||
      relFile.startsWith(`${subpath}.`)
    );
  });
};

/**
 * Resolves the canonical exported name via TypeScript's symbol graph when `specifier`
 * re-exports or points inside a package matched by `modules`.
 * @param source - The ESLint source code for the current file.
 * @param modules - Target module specifier(s).
 * @param specifier - Named or namespace import specifier AST node.
 * @param memberName - Property name accessed on a namespace import, or null for named imports.
 * @returns Canonical symbol name declared in a matching package, or null.
 */
function resolveSymbolOriginName(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  specifier: TSESTree.ImportSpecifier | TSESTree.ImportNamespaceSpecifier,
  memberName: string | null,
): string | null {
  const services = source.parserServices;
  const program = services?.program;
  const nodeMap = services?.esTreeNodeToTSNodeMap;
  if (!program || !nodeMap) {
    return null;
  }
  try {
    const checker = program.getTypeChecker();
    const tsNode = nodeMap.get(specifier);
    let sym = checker.getSymbolAtLocation(
      ts.isImportSpecifier(tsNode) || ts.isNamespaceImport(tsNode)
        ? tsNode.name
        : tsNode,
    );
    if (!sym) {
      return null;
    }
    if (isSymbolFlagSet(sym, ts.SymbolFlags.Alias)) {
      sym = checker.getAliasedSymbol(sym);
    }
    if (memberName !== null) {
      const exported = checker
        .getExportsOfModule(sym)
        .find((item) => item.name === memberName);
      if (!exported) {
        return null;
      }
      sym = isSymbolFlagSet(exported, ts.SymbolFlags.Alias)
        ? checker.getAliasedSymbol(exported)
        : exported;
    }
    if (!sym.declarations?.length) {
      return null;
    }
    for (const decl of sym.declarations) {
      const declFile = decl.getSourceFile().fileName;
      const pkg = findEnclosingPackage(declFile);
      if (pkg && matchesOriginPackage(modules, pkg, declFile)) {
        return sym.name;
      }
    }
  } catch {
    // Fall back when TypeScript symbol resolution is unavailable.
  }
  return null;
}

const getSpecifierImportedName = (
  specifier: TSESTree.ImportSpecifier,
): string =>
  ASTUtils.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value;

/**
 * Extracts the root identifier and optional member property name from a reference node.
 * @param node - The identifier, member expression, or qualified type name node.
 * @param source - The ESLint source code for scope-aware property name evaluation.
 * @returns The root identifier and static member name, or null when unsupported.
 */
function extractReferenceParts(
  node: TSESTree.Node,
  source: Readonly<SourceCode>,
): {
  identifier: TSESTree.Identifier;
  member: string | null;
} | null {
  if (ASTUtils.isIdentifier(node)) {
    return { identifier: node, member: null };
  }
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    ASTUtils.isIdentifier(node.object)
  ) {
    const member = ASTUtils.getPropertyName(node, source.getScope(node));
    return member ? { identifier: node.object, member } : null;
  }
  if (
    node.type === AST_NODE_TYPES.TSQualifiedName &&
    ASTUtils.isIdentifier(node.left)
  ) {
    return { identifier: node.left, member: node.right.name };
  }
  return null;
}

/**
 * Resolves the `Scope.Variable` bound to `identifier`, preferring `@typescript-eslint/scope-manager`'s
 * resolved reference (which separates type vs value namespaces) before falling back to lexical lookup.
 * @param source - The ESLint source code for the current file.
 * @param identifier - Identifier AST node to resolve.
 * @returns Resolved `Scope.Variable`, or null when unbound.
 */
function resolveIdentifierVariable(
  source: Readonly<SourceCode>,
  identifier: TSESTree.Identifier,
): Scope.Variable | null {
  for (
    let scope: Scope.Scope | null = source.getScope(identifier);
    scope;
    scope = scope.upper
  ) {
    const ref = scope.references.find(
      (candidate) => candidate.identifier === identifier,
    );
    if (ref) {
      return ref.resolved;
    }
  }
  return ASTUtils.findVariable(source.getScope(identifier), identifier);
}

/**
 * Resolves `node` to its underlying root variable and optional namespace member,
 * unwrapping `const { Exported: Local } = ns` destructuring bindings.
 * @param source - The ESLint source code for the current file.
 * @param node - Reference AST node.
 * @returns Resolved identifier, member name, and `Scope.Variable`, or null when unsupported.
 */
function resolveEffectiveReference(
  source: Readonly<SourceCode>,
  node: TSESTree.Node,
): {
  identifier: TSESTree.Identifier;
  member: string | null;
  variable: Scope.Variable | null;
} | null {
  const parts = extractReferenceParts(node, source);
  if (!parts) {
    return null;
  }
  let { identifier, member } = parts;
  let variable = resolveIdentifierVariable(source, identifier);
  if (member === null && variable?.defs.length === 1) {
    const def = variable.defs[0];
    if (
      def.type === Scope.DefinitionType.Variable &&
      def.parent?.type === AST_NODE_TYPES.VariableDeclaration &&
      def.parent.kind === "const" &&
      def.node.id.type === AST_NODE_TYPES.ObjectPattern &&
      def.node.init !== null &&
      ASTUtils.isIdentifier(def.node.init)
    ) {
      let destructuredMember: string | null = null;
      for (const candidate of def.node.id.properties) {
        if (
          candidate.type === AST_NODE_TYPES.Property &&
          candidate.value === def.name
        ) {
          destructuredMember = ASTUtils.getPropertyName(
            candidate,
            source.getScope(candidate),
          );
          break;
        }
      }
      if (destructuredMember) {
        identifier = def.node.init;
        member = destructuredMember;
        variable = resolveIdentifierVariable(source, identifier);
      }
    }
  }
  return { identifier, member, variable };
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
 * Finds the nearest visible `Scope.Variable` for `name` starting at `lookupScope`.
 * @param lookupScope - Starting lexical scope.
 * @param name - Variable name to resolve.
 * @param ignorePureTypeDefs - When true, skips inner variables that only declare types.
 * @returns Matching `Scope.Variable`, or null when unbound.
 */
function findVisibleBindingVariable(
  lookupScope: Scope.Scope,
  name: string,
  ignorePureTypeDefs: boolean,
): Scope.Variable | null {
  for (
    let scope: Scope.Scope | null = lookupScope;
    scope;
    scope = scope.upper
  ) {
    const variable = scope.set.get(name);
    if (!variable) {
      continue;
    }
    if (
      ignorePureTypeDefs &&
      variable.defs.length > 0 &&
      variable.defs.every((def) => def.type === Scope.DefinitionType.Type)
    ) {
      continue;
    }
    return variable;
  }
  return null;
}

/**
 * Finds an in-scope named import specifier from `modules` matching `exportedName`.
 * @param source - The ESLint source code for the current file.
 * @param modules - Target module specifier(s).
 * @param exportedName - Exported symbol name to match.
 * @param location - AST node where the binding must be visible.
 * @param ignorePureTypeShadowing - Whether inner `type` declarations should not shadow outer imports.
 * @returns Matching import declaration and specifier, if present.
 */
function findVisibleImport(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  exportedName: string,
  location: TSESTree.Node,
  ignorePureTypeShadowing = true,
):
  | {
      declaration: TSESTree.ImportDeclaration;
      specifier: TSESTree.ImportSpecifier;
    }
  | undefined {
  const lookupScope = getLookupScope(source, location);
  const candidates = source.ast.body.flatMap((statement) => {
    if (statement.type !== AST_NODE_TYPES.ImportDeclaration) {
      return [];
    }
    const isDirect = matchesDirectModule(modules, statement.source.value);
    return statement.specifiers.flatMap((specifier) => {
      if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) {
        return [];
      }
      const matchesSymbol = isDirect
        ? getSpecifierImportedName(specifier) === exportedName
        : resolveSymbolOriginName(source, modules, specifier, null) ===
          exportedName;
      if (!matchesSymbol) {
        return [];
      }
      const visibleVar = findVisibleBindingVariable(
        lookupScope,
        specifier.local.name,
        ignorePureTypeShadowing,
      );
      const resolvesToSpecifier = visibleVar?.defs.some(
        (def) =>
          def.type === Scope.DefinitionType.ImportBinding &&
          def.node === specifier,
      );
      return resolvesToSpecifier
        ? [{ declaration: statement, specifier, isDirect }]
        : [];
    });
  });

  const valueCandidates = candidates.filter(
    ({ declaration, specifier }) =>
      declaration.importKind !== "type" && specifier.importKind !== "type",
  );
  const preferred = valueCandidates.length > 0 ? valueCandidates : candidates;
  const directPreferred = preferred.filter((item) => item.isDirect);
  const pool = directPreferred.length > 0 ? directPreferred : preferred;
  return (
    pool.find(({ specifier }) => specifier.local.name === exportedName) ??
    pool[0]
  );
}

/**
 * Resolves the canonical exported name referenced by `node` when imported from `modules`
 * (or referenced as an unshadowed ambient identifier in standalone rule snippets).
 * @param source - The ESLint source code for the current file.
 * @param modules - Candidate module specifier(s).
 * @param node - Reference AST node (identifier, member expression, or qualified name).
 * @param _filename - Optional file path (retained for call-site compatibility).
 * @returns Canonical exported symbol name, or null when bound elsewhere.
 */
export function getImportedName(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  node: TSESTree.Node,
  _filename?: string,
): string | null {
  const resolved = resolveEffectiveReference(source, node);
  if (!resolved) {
    return null;
  }
  const { identifier, member, variable } = resolved;
  if (!variable || variable.defs.length === 0) {
    return member === null ? identifier.name : null;
  }
  for (const def of variable.defs) {
    if (
      def.type !== Scope.DefinitionType.ImportBinding ||
      def.parent.type !== AST_NODE_TYPES.ImportDeclaration
    ) {
      continue;
    }
    const isDirect = matchesDirectModule(modules, def.parent.source.value);
    if (member === null && def.node.type === AST_NODE_TYPES.ImportSpecifier) {
      if (isDirect) {
        return getSpecifierImportedName(def.node);
      }
      const origin = resolveSymbolOriginName(source, modules, def.node, null);
      if (origin) {
        return origin;
      }
    }
    if (
      member !== null &&
      def.node.type === AST_NODE_TYPES.ImportNamespaceSpecifier
    ) {
      if (isDirect) {
        return member;
      }
      const origin = resolveSymbolOriginName(source, modules, def.node, member);
      if (origin) {
        return origin;
      }
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
  const resolved = resolveEffectiveReference(source, node);
  if (!resolved?.variable) {
    return false;
  }
  return resolved.variable.defs.some(
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
 * @param _filename - Optional file path (retained for call-site compatibility).
 * @returns True when a matching import binding exists.
 */
export function hasNamedImport(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  name: string,
  valueOnly = true,
  location: TSESTree.Node = source.ast,
  _filename?: string,
): boolean {
  const existing = findVisibleImport(
    source,
    modules,
    name,
    location,
    valueOnly,
  );
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
 * @param _filename - Optional file path (retained for call-site compatibility).
 * @returns Safe local identifier name.
 */
export function getLocalImportBinding(
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  name: string,
  location: TSESTree.Node = source.ast,
  _filename?: string,
): string {
  const existing = findVisibleImport(source, modules, name, location);
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
 * Removes a `type` modifier token while preserving adjacent comments.
 * @param fixer - ESLint `RuleFixer`.
 * @param source - The ESLint source code for the current file.
 * @param typeToken - The `type` keyword token to remove.
 * @returns `RuleFix` removing `type` and trailing whitespace up to the next token or comment.
 */
function removeTypeKeywordToken(
  fixer: RuleFixer,
  source: Readonly<SourceCode>,
  typeToken: TSESTree.Token,
): RuleFix {
  const nextTokenOrComment = source.getTokenAfter(typeToken, {
    includeComments: true,
  });
  return fixer.removeRange([
    typeToken.range[0],
    nextTokenOrComment ? nextTokenOrComment.range[0] : typeToken.range[1],
  ]);
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
      const typeToken = source.getFirstToken(
        declaration,
        ASTUtils.isTypeKeyword,
      );
      if (typeToken) {
        fixes.push(removeTypeKeywordToken(fixer, source, typeToken));
      }
      for (const specifier of declaration.specifiers.filter(
        ASTUtils.isNodeOfType(AST_NODE_TYPES.ImportSpecifier),
      )) {
        if (!promotedNames.has(specifier.local.name)) {
          fixes.push(fixer.insertTextBefore(specifier, "type "));
        }
      }
    } else {
      for (const specifier of declaration.specifiers.filter(
        ASTUtils.isNodeOfType(AST_NODE_TYPES.ImportSpecifier),
      )) {
        if (
          specifier.importKind === "type" &&
          promotedNames.has(specifier.local.name)
        ) {
          const typeToken = source.getFirstToken(
            specifier,
            ASTUtils.isTypeKeyword,
          );
          if (typeToken) {
            fixes.push(removeTypeKeywordToken(fixer, source, typeToken));
          }
        }
      }
    }
  }
  return fixes;
}

const isAttachedAnchorComment = (comment: TSESTree.Comment): boolean => {
  if (comment.type === AST_TOKEN_TYPES.Block && comment.value.startsWith("*")) {
    return !/@(?:license|preserve|file(?:overview)?)\b|copyright/i.test(
      comment.value,
    );
  }
  const trimmed = comment.value.trim();
  return (
    /^@ts-(?:expect-error|ignore)\b/.test(trimmed) ||
    /^eslint-disable-next-line\b/.test(trimmed) ||
    /^(?:istanbul|c8|v8)\s+ignore\s+(?:next|start)\b/.test(trimmed)
  );
};

/**
 * Produces `RuleFix` edits ensuring `names` are imported from `modules` (promoting
 * type-only imports when `valueImport` is true).
 * @param fixer - ESLint `RuleFixer`.
 * @param source - The ESLint source code for the current file.
 * @param modules - Candidate module specifier(s).
 * @param names - Exported symbol names to import.
 * @param valueImport - Whether runtime value imports are required.
 * @param location - AST node where the bindings will be referenced.
 * @param _filename - Optional file path (retained for call-site compatibility).
 * @returns Array of `RuleFix` edits.
 */
export function ensureNamedImportFixes(
  fixer: RuleFixer,
  source: Readonly<SourceCode>,
  modules: ModuleMatcher,
  names: readonly string[],
  valueImport = true,
  location: TSESTree.Node = source.ast,
  _filename?: string,
): RuleFix[] {
  const allImports = source.ast.body.filter(
    ASTUtils.isNodeOfType(AST_NODE_TYPES.ImportDeclaration),
  );
  const matchingDecls = allImports.filter((stmt) =>
    matchesDirectModule(modules, stmt.source.value),
  );
  const missingSpecs: string[] = [];
  const promotions = new Map<TSESTree.ImportDeclaration, Set<string>>();

  for (const name of new Set(names)) {
    const existing = findVisibleImport(source, modules, name, location);
    if (!existing) {
      const local = getLocalImportBinding(source, modules, name, location);
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
        ASTUtils.isNodeOfType(AST_NODE_TYPES.ImportSpecifier),
      ),
  );
  const lastSpecifier = targetDecl?.specifiers.at(-1);
  if (targetDecl && lastSpecifier) {
    const separator = ASTUtils.isTokenOnSameLine(targetDecl, lastSpecifier)
      ? ", "
      : ",\n  ";
    fixes.push(
      fixer.insertTextAfter(
        lastSpecifier,
        separator + missingSpecs.join(separator),
      ),
    );
    return fixes;
  }

  const firstImport = allImports[0];
  const firstStatement = source.ast.body.find(
    (stmt) =>
      stmt.type !== AST_NODE_TYPES.ExpressionStatement || !stmt.directive,
  );
  const anchor = firstImport ?? firstStatement;
  let attachedComment: TSESTree.Comment | undefined;
  if (anchor) {
    const leadingComments = source.getCommentsBefore(anchor);
    for (let index = leadingComments.length - 1; index >= 0; index--) {
      if (!isAttachedAnchorComment(leadingComments[index])) {
        break;
      }
      attachedComment = leadingComments[index];
    }
  }
  const insertPos =
    attachedComment?.range[0] ?? anchor?.range[0] ?? source.text.length;
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
    const resolved = resolveEffectiveReference(source, node);
    for (const def of resolved?.variable?.defs ?? []) {
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

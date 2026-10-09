import {
  AST_NODE_TYPES,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";

/** Rewrites a package import while preserving local names for renamed exports. */
export function fixRenamedImport(
  fixer: TSESLint.RuleFixer,
  node: TSESTree.ImportDeclaration,
  source: string,
  names: Record<string, string>,
): TSESLint.RuleFix[] | null {
  if (
    node.specifiers.some(
      (specifier) => specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier,
    )
  ) {
    return null;
  }

  const fixes = [fixer.replaceText(node.source, JSON.stringify(source))];
  for (const specifier of node.specifiers) {
    if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
    const imported =
      specifier.imported.type === AST_NODE_TYPES.Identifier
        ? specifier.imported.name
        : specifier.imported.value;
    if (!Object.hasOwn(names, imported)) continue;
    const replacement = names[imported];
    fixes.push(
      fixer.replaceText(
        specifier.imported,
        imported === specifier.local.name
          ? `${replacement} as ${specifier.local.name}`
          : replacement,
      ),
    );
  }
  return fixes;
}

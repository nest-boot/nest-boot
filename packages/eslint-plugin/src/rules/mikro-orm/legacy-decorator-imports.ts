import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import type { SourceCode } from "@typescript-eslint/utils/ts-eslint";

const decorators = new Set([
  "Entity",
  "Embeddable",
  "Property",
  "Enum",
  "PrimaryKey",
  "SerializedPrimaryKey",
  "OneToOne",
  "ManyToOne",
  "ManyToMany",
  "OneToMany",
  "Embedded",
  "Check",
  "Trigger",
  "Formula",
  "Index",
  "Unique",
  "Filter",
  "CreateRequestContext",
  "EnsureRequestContext",
  "BeforeCreate",
  "AfterCreate",
  "BeforeUpdate",
  "AfterUpdate",
  "BeforeUpsert",
  "AfterUpsert",
  "OnInit",
  "OnLoad",
  "BeforeDelete",
  "AfterDelete",
  "Transactional",
]);

/** Moves v6 decorator bindings before property fixes add v7 imports. @internal */
export function legacyDecoratorImports(source: Readonly<SourceCode>) {
  const bindingText = (specifier: TSESTree.ImportSpecifier) =>
    source.text.slice(specifier.range[0], specifier.imported.range[0]) +
    (specifier.imported.type === AST_NODE_TYPES.Identifier
      ? specifier.imported.name
      : specifier.imported.value) +
    source.text.slice(specifier.imported.range[1], specifier.range[1]);

  return source.ast.body.flatMap((node) => {
    if (
      node.type !== AST_NODE_TYPES.ImportDeclaration ||
      node.source.value !== "@mikro-orm/core"
    ) {
      return [];
    }

    const moved = node.specifiers.filter(
      (specifier): specifier is TSESTree.ImportSpecifier =>
        specifier.type === AST_NODE_TYPES.ImportSpecifier &&
        decorators.has(
          specifier.imported.type === AST_NODE_TYPES.Identifier
            ? specifier.imported.name
            : specifier.imported.value,
        ),
    );
    if (moved.length === 0) return [];

    const legacySource = '"@mikro-orm/decorators/legacy"';
    let text = source.getText(node);
    const start = node.range[0];
    if (moved.length === node.specifiers.length) {
      text =
        text.slice(0, node.source.range[0] - start) +
        legacySource +
        text.slice(node.source.range[1] - start);
      for (const specifier of moved.toReversed()) {
        text =
          text.slice(0, specifier.range[0] - start) +
          bindingText(specifier) +
          text.slice(specifier.range[1] - start);
      }
    } else {
      // Delete only bindings and redundant commas, retaining surrounding comments.
      const removed = new Set<TSESTree.Node>(moved);
      const ranges = moved.map((specifier) => specifier.range);
      for (const [index, specifier] of node.specifiers.entries()) {
        if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
        const comma = source.getTokenAfter(specifier);
        const hasLaterBinding = node.specifiers
          .slice(index + 1)
          .some((item) => !removed.has(item));
        if (
          comma?.value === "," &&
          (removed.has(specifier) || !hasLaterBinding)
        ) {
          ranges.push(comma.range);
        }
      }
      for (const [from, to] of ranges.sort((a, b) => b[0] - a[0])) {
        text = text.slice(0, from - start) + text.slice(to - start);
      }
      const kind = node.importKind === "type" ? "type " : "";
      text += `\nimport ${kind}{ ${moved.map(bindingText).join(", ")} } from ${legacySource};`;
    }
    return [{ node, text }];
  });
}

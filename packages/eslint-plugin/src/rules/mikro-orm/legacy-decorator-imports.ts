import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import {
  type RuleFix,
  Scope,
  type SourceCode,
} from "@typescript-eslint/utils/ts-eslint";

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

const core = "@mikro-orm/core";
const legacy = "@mikro-orm/decorators/legacy";
const coreHelpers = new Set(["t", "Opt", "Ref", "Collection"]);
const entryPoints = new Set([
  core,
  "@mikro-orm/sql",
  "@mikro-orm/postgresql",
  "@mikro-orm/mysql",
  "@mikro-orm/mariadb",
  "@mikro-orm/sqlite",
  "@mikro-orm/better-sqlite",
  "@mikro-orm/libsql",
  "@mikro-orm/mssql",
  "@mikro-orm/mongodb",
  "@mikro-orm/pglite",
]);

/** Normalizes core helpers and legacy decorators before field fixes generate bindings. @internal */
export function legacyDecoratorImports(source: Readonly<SourceCode>) {
  const bindingText = (specifier: TSESTree.ImportSpecifier) => {
    const name =
      specifier.imported.type === AST_NODE_TYPES.Identifier
        ? specifier.imported.name
        : specifier.imported.value;
    const prefix = source.text.slice(
      specifier.range[0],
      specifier.imported.range[0],
    );
    return (
      (decorators.has(name) ? prefix.replace(/^type\b/, "") : prefix) +
      name +
      source.text.slice(specifier.imported.range[1], specifier.range[1])
    );
  };

  return source.ast.body.flatMap((node) => {
    if (
      node.type !== AST_NODE_TYPES.ImportDeclaration ||
      !entryPoints.has(node.source.value)
    ) {
      return [];
    }

    const destinations = new Map<string, TSESTree.ImportSpecifier[]>();
    for (const specifier of node.specifiers) {
      if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
      const name =
        specifier.imported.type === AST_NODE_TYPES.Identifier
          ? specifier.imported.name
          : specifier.imported.value;
      const target = decorators.has(name)
        ? legacy
        : coreHelpers.has(name)
          ? core
          : node.source.value;
      if (target === node.source.value) continue;
      const bindings = destinations.get(target) ?? [];
      bindings.push(specifier);
      destinations.set(target, bindings);
    }
    const moved = [...destinations.values()].flat();
    if (moved.length === 0) return [];

    let text = source.getText(node);
    const start = node.range[0];
    if (moved.length === node.specifiers.length && destinations.size === 1) {
      text =
        text.slice(0, node.source.range[0] - start) +
        JSON.stringify([...destinations.keys()][0]) +
        text.slice(node.source.range[1] - start);
      for (const specifier of moved.toReversed()) {
        text =
          text.slice(0, specifier.range[0] - start) +
          bindingText(specifier) +
          text.slice(specifier.range[1] - start);
      }
      if (node.importKind === "type" && destinations.has(legacy)) {
        const token = source.getTokens(node)[1];
        text =
          text.slice(0, token.range[0] - start) +
          text.slice(token.range[1] - start);
      }
    } else if (moved.length === node.specifiers.length) {
      // Preserve comments between bindings when an import splits into two destinations.
      text = source
        .getCommentsInside(node)
        .filter(
          (comment) =>
            !moved.some(
              (item) =>
                item.range[0] <= comment.range[0] &&
                item.range[1] >= comment.range[1],
            ),
        )
        .map((comment) => source.getText(comment))
        .join("\n");
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
    }
    if (moved.length !== node.specifiers.length || destinations.size > 1) {
      for (const [target, bindings] of destinations) {
        const kind =
          target !== legacy && node.importKind === "type" ? "type " : "";
        text += `\nimport ${kind}{ ${bindings.map(bindingText).join(", ")} } from ${JSON.stringify(target)};`;
      }
    }
    return [{ node, text }];
  });
}

/** Splits obsolete namespace decorators without changing core/driver members or shadowed references. @internal */
export function legacyNamespaceEdits(source: Readonly<SourceCode>): RuleFix[] {
  const edits: RuleFix[] = [];
  const occupied = new Set(
    (source.scopeManager?.scopes ?? []).flatMap((scope) =>
      scope.variables.map((variable) => variable.name),
    ),
  );
  for (const declaration of source.ast.body) {
    if (
      declaration.type !== AST_NODE_TYPES.ImportDeclaration ||
      !entryPoints.has(declaration.source.value)
    )
      continue;
    const binding = declaration.specifiers.find(
      (specifier) => specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier,
    );
    if (!binding) continue;
    const variable = source
      .getDeclaredVariables(declaration)
      .find((candidate) =>
        candidate.defs.some(
          (definition) =>
            definition.type === Scope.DefinitionType.ImportBinding &&
            definition.node === binding,
        ),
      );
    const references = (variable?.references ?? []).flatMap((reference) => {
      const parent = reference.identifier.parent;
      const name =
        parent.type === AST_NODE_TYPES.MemberExpression &&
        parent.object === reference.identifier
          ? !parent.computed &&
            parent.property.type === AST_NODE_TYPES.Identifier
            ? parent.property.name
            : parent.computed &&
                parent.property.type === AST_NODE_TYPES.Literal &&
                typeof parent.property.value === "string"
              ? parent.property.value
              : null
          : parent.type === AST_NODE_TYPES.TSQualifiedName &&
              parent.left === reference.identifier
            ? parent.right.name
            : null;
      return name && decorators.has(name) ? [reference.identifier] : [];
    });
    if (!references.length) continue;
    if (
      references.length === variable?.references.length &&
      declaration.specifiers.length === 1
    ) {
      edits.push({
        range: declaration.source.range,
        text: JSON.stringify(legacy),
      });
      if (declaration.importKind === "type")
        edits.push({ range: source.getTokens(declaration)[1].range, text: "" });
      continue;
    }
    const base = `${binding.local.name}Decorators`;
    let name = base;
    for (let suffix = 2; occupied.has(name); suffix++)
      name = `${base}${String(suffix)}`;
    occupied.add(name);
    edits.push({
      range: [declaration.range[1], declaration.range[1]],
      text: `\nimport * as ${name} from ${JSON.stringify(legacy)};`,
    });
    for (const reference of references)
      edits.push({ range: reference.range, text: name });
  }
  return edits;
}

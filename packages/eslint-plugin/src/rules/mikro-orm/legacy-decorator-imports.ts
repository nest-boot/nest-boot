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
  "@mikro-orm/knex",
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

interface LegacyImportEdit {
  node: TSESTree.Node;
  text: string;
}

/** Normalizes core helpers and legacy decorators before field fixes generate bindings. @internal */
export function legacyDecoratorImports(source: Readonly<SourceCode>) {
  type NamedBinding = TSESTree.ImportSpecifier | TSESTree.ExportSpecifier;
  const bindingName = (specifier: NamedBinding) =>
    specifier.type === AST_NODE_TYPES.ImportSpecifier
      ? specifier.imported
      : specifier.local;
  const bindingText = (specifier: NamedBinding) => {
    const imported = bindingName(specifier);
    const name =
      imported.type === AST_NODE_TYPES.Identifier
        ? imported.name
        : imported.value;
    const prefix = source.text.slice(specifier.range[0], imported.range[0]);
    return (
      (specifier.type === AST_NODE_TYPES.ImportSpecifier && decorators.has(name)
        ? prefix.replace(/^type\b/, "")
        : prefix) +
      source.getText(imported) +
      source.text.slice(imported.range[1], specifier.range[1])
    );
  };

  const wildcardExports = source.ast.body.filter(
    (node): node is TSESTree.ExportAllDeclaration =>
      node.type === AST_NODE_TYPES.ExportAllDeclaration &&
      !node.exported &&
      entryPoints.has(node.source.value),
  );
  const wildcardKind = wildcardExports.some(
    (node) => node.exportKind !== "type",
  )
    ? "value"
    : "type";
  const hasLegacyWildcard = source.ast.body.some(
    (node) =>
      node.type === AST_NODE_TYPES.ExportAllDeclaration &&
      !node.exported &&
      node.source.value === legacy &&
      (wildcardKind === "type" || node.exportKind !== "type"),
  );

  return source.ast.body.flatMap<LegacyImportEdit>((node) => {
    // v7 renamed the shared SQL entry point; remaining SQL bindings stay valid there.
    if (
      (node.type === AST_NODE_TYPES.ImportDeclaration ||
        node.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        node.type === AST_NODE_TYPES.ExportAllDeclaration) &&
      node.source?.value === "@mikro-orm/knex"
    ) {
      const text = source.getText(node);
      return [
        {
          node,
          text:
            text.slice(0, node.source.range[0] - node.range[0]) +
            JSON.stringify("@mikro-orm/sql") +
            text.slice(node.source.range[1] - node.range[0]),
        },
      ];
    }
    if (node === wildcardExports[0] && !hasLegacyWildcard) {
      return [
        {
          node,
          text: `${source.getText(node)}\nexport ${wildcardKind === "type" ? "type " : ""}* from ${JSON.stringify(legacy)};`,
        },
      ];
    }
    if (
      (node.type !== AST_NODE_TYPES.ImportDeclaration &&
        node.type !== AST_NODE_TYPES.ExportNamedDeclaration) ||
      !node.source ||
      !entryPoints.has(node.source.value)
    ) {
      return [];
    }

    const keyword =
      node.type === AST_NODE_TYPES.ImportDeclaration ? "import" : "export";
    const destinations = new Map<string, NamedBinding[]>();
    for (const specifier of node.specifiers) {
      if (
        specifier.type !== AST_NODE_TYPES.ImportSpecifier &&
        specifier.type !== AST_NODE_TYPES.ExportSpecifier
      )
        continue;
      const imported = bindingName(specifier);
      const name =
        imported.type === AST_NODE_TYPES.Identifier
          ? imported.name
          : imported.value;
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
      if (
        node.type === AST_NODE_TYPES.ImportDeclaration &&
        node.importKind === "type" &&
        destinations.has(legacy)
      ) {
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
        if (
          specifier.type !== AST_NODE_TYPES.ImportSpecifier &&
          specifier.type !== AST_NODE_TYPES.ExportSpecifier
        )
          continue;
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
        const kind = (
          node.type === AST_NODE_TYPES.ExportNamedDeclaration
            ? node.exportKind === "type"
            : target !== legacy && node.importKind === "type"
        )
          ? "type "
          : "";
        text += `\n${keyword} ${kind}{ ${bindings.map(bindingText).join(", ")} } from ${JSON.stringify(target)};`;
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
    const mixedPatterns: {
      pattern: TSESTree.ObjectPattern;
      init: TSESTree.Identifier;
      moved: Map<TSESTree.Node, string>;
    }[] = [];
    const references = (variable?.references ?? []).flatMap((reference) => {
      const parent = reference.identifier.parent;
      if (
        parent.type === AST_NODE_TYPES.VariableDeclarator &&
        parent.init === reference.identifier &&
        parent.id.type === AST_NODE_TYPES.ObjectPattern
      ) {
        const moved = new Map<TSESTree.Node, string>();
        for (const property of parent.id.properties) {
          if (property.type !== AST_NODE_TYPES.Property) continue;
          const name =
            !property.computed &&
            property.key.type === AST_NODE_TYPES.Identifier
              ? property.key.name
              : property.key.type === AST_NODE_TYPES.Literal &&
                  typeof property.key.value === "string"
                ? property.key.value
                : null;
          if (name !== null && decorators.has(name)) moved.set(property, name);
        }
        if (moved.size === parent.id.properties.length && moved.size > 0)
          return [reference.identifier];
        if (moved.size > 0)
          mixedPatterns.push({
            pattern: parent.id,
            init: reference.identifier,
            moved,
          });
        return [];
      }
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
    if (!references.length && !mixedPatterns.length) continue;
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
    for (const { pattern, init, moved } of mixedPatterns) {
      if (pattern.typeAnnotation) {
        const properties = [...new Set(moved.values())].map(
          (key) => `${JSON.stringify(key)}: ${name}[${JSON.stringify(key)}]`,
        );
        edits.push({
          range: init.range,
          text: `{ ...${source.getText(init)}, ${properties.join(", ")} }`,
        });
        continue;
      }
      const retained = new Set<TSESTree.Node>(
        pattern.properties.filter((property) => !moved.has(property)),
      );
      edits.push({
        range: pattern.range,
        text: `${selectedPattern(source, pattern, new Set(moved.keys()))} = ${name}, ${selectedPattern(source, pattern, retained)}`,
      });
    }
    if (mixedPatterns.length && declaration.importKind === "type")
      edits.push({ range: source.getTokens(declaration)[1].range, text: "" });
  }
  return edits;
}

function selectedPattern(
  source: Readonly<SourceCode>,
  pattern: TSESTree.ObjectPattern,
  selected: ReadonlySet<TSESTree.Node>,
): string {
  const ranges: TSESTree.Range[] = [];
  for (const [index, property] of pattern.properties.entries()) {
    if (!selected.has(property)) ranges.push(property.range);
    const comma = source.getTokenAfter(property);
    if (
      comma?.value === "," &&
      (!selected.has(property) ||
        !pattern.properties
          .slice(index + 1)
          .some((later) => selected.has(later)))
    )
      ranges.push(comma.range);
  }
  let text = source.getText(pattern);
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0]))
    text =
      text.slice(0, start - pattern.range[0]) +
      text.slice(end - pattern.range[0]);
  return text;
}

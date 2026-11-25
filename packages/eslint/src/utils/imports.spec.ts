import path from "node:path";

import tsParser from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { Linter } from "eslint";

import { createRule } from "./createRule.js";
import {
  ensureNamedImportFixes,
  getImportedName,
  getLocalImportBinding,
  hasNamedImport,
  isTypeOnlyImportReference,
  promoteTypeImportFixes,
} from "./imports.js";

const linter = new Linter();

describe("imports utilities", () => {
  it("resolves named, aliased, quoted, namespace, and shadowed bindings", () => {
    const inspectRule = createRule({
      name: "test/inspect",
      meta: {
        type: "problem",
        docs: { description: "inspect imports" },
        schema: [],
        messages: { hit: "{{name}}|{{typeOnly}}|{{has}}|{{local}}" },
      },
      create(context) {
        const source = context.sourceCode;
        return {
          CallExpression(node) {
            const name = getImportedName(
              source,
              ["@pkg/mod", "@nest-boot/eslint"],
              node.callee,
              context.filename,
            );
            const typeOnly = isTypeOnlyImportReference(source, node.callee);
            const has = hasNamedImport(
              source,
              ["@pkg/mod", "@nest-boot/eslint"],
              "Target",
              true,
              node,
              context.filename,
            );
            const local = getLocalImportBinding(
              source,
              ["@pkg/mod", "@nest-boot/eslint"],
              "Target",
              node,
              context.filename,
            );
            context.report({
              node,
              messageId: "hit",
              data: {
                name: String(name),
                typeOnly: String(typeOnly),
                has: String(has),
                local,
              },
            });
          },
        };
      },
    });

    const config: Linter.Config[] = [
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tsParser },
        plugins: { test: { rules: { inspect: inspectRule as never } } },
        rules: { "test/inspect": "error" },
      },
    ];

    const aliased = linter.verify(
      'import { "Target" as Alias } from "@pkg/mod"; Alias();',
      config,
      "a.ts",
    );
    expect(aliased[0]?.message).toBe("Target|false|true|Alias");

    const ns = linter.verify(
      'import type * as mod from "@pkg/mod"; mod["Target"]();',
      config,
      "b.ts",
    );
    expect(ns[0]?.message).toBe("Target|true|false|Target");

    const shadowed = linter.verify(
      "function run(Target: () => void) { Target(); }",
      config,
      "c.ts",
    );
    expect(shadowed[0]?.message).toBe("null|false|false|Target2");

    const intraPackage = linter.verify(
      'import { Target as LocalTarget } from "./createRule.js"; LocalTarget();',
      config,
      path.join(import.meta.dirname, "sample.ts"),
    );
    expect(intraPackage[0]?.message).toBe("Target|false|true|LocalTarget");
  });

  it("inserts, appends, and promotes named imports while preserving doc comments", () => {
    const fixRule = createRule({
      name: "test/fix-imports",
      meta: {
        type: "problem",
        fixable: "code",
        docs: { description: "fix imports" },
        schema: [],
        messages: { fix: "Fix imports." },
      },
      create(context) {
        const source = context.sourceCode;
        return {
          ClassDeclaration(node) {
            if (
              hasNamedImport(source, "@pkg/mod", "Alpha", true, node) &&
              hasNamedImport(source, "@pkg/mod", "Beta", true, node)
            ) {
              return;
            }
            const typeNodes = node.body.body.flatMap((member) =>
              member.type === AST_NODE_TYPES.PropertyDefinition &&
              member.typeAnnotation?.typeAnnotation.type ===
                AST_NODE_TYPES.TSTypeReference
                ? [member.typeAnnotation.typeAnnotation.typeName]
                : [],
            );
            context.report({
              node,
              messageId: "fix",
              fix: (fixer) => [
                ...ensureNamedImportFixes(
                  fixer,
                  source,
                  ["@pkg/mod"],
                  ["Alpha", "Beta"],
                  true,
                  node,
                ),
                ...promoteTypeImportFixes(fixer, source, typeNodes),
              ],
            });
          },
        };
      },
    });

    const config: Linter.Config[] = [
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tsParser },
        plugins: { test: { rules: { "fix-imports": fixRule as never } } },
        rules: { "test/fix-imports": "error" },
      },
    ];

    const fromScratch = linter.verifyAndFix(
      "/** Class doc. */\nclass Demo {}",
      config,
      "a.ts",
    );
    expect(fromScratch.output).toBe(
      'import { Alpha, Beta } from "@pkg/mod";\n/** Class doc. */\nclass Demo {}',
    );

    const promoteAndAppend = linter.verifyAndFix(
      'import type { Alpha, Unused } from "@pkg/mod";\nimport { type Helper } from "@pkg/other";\nclass Demo { prop!: Helper; }',
      config,
      "b.ts",
    );
    expect(promoteAndAppend.output).toContain(
      'import { Alpha, type Unused, Beta } from "@pkg/mod";',
    );
    expect(promoteAndAppend.output).toContain(
      'import { Helper } from "@pkg/other";',
    );

    const multiline = linter.verifyAndFix(
      'import {\n  type Alpha,\n} from "@pkg/mod";\nclass Demo {}',
      config,
      "c.ts",
    );
    expect(multiline.output).toContain("Alpha,\n  Beta");
  });
});

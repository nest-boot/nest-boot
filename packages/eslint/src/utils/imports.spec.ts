import path from "node:path";

import { RuleTester } from "@typescript-eslint/rule-tester";
import { AST_NODE_TYPES, ASTUtils } from "@typescript-eslint/utils";

import { createRule } from "./createRule.js";
import {
  ensureNamedImportFixes,
  getImportedName,
  getLocalImportBinding,
  hasNamedImport,
  isTypeOnlyImportReference,
  promoteTypeImportFixes,
} from "./imports.js";

const ruleTester = new RuleTester();

const inspectRule = createRule({
  name: "inspect",
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

const fixRule = createRule({
  name: "fix-imports",
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
        const typeNodes = node.body.body
          .filter(ASTUtils.isNodeOfType(AST_NODE_TYPES.PropertyDefinition))
          .flatMap((member) =>
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

ruleTester.run("inspect", inspectRule, {
  valid: ['import { Target } from "@pkg/mod"; void Target;'],
  invalid: [
    {
      code: 'import { "Target" as Alias } from "@pkg/mod"; Alias();',
      errors: [
        {
          messageId: "hit",
          data: {
            name: "Target",
            typeOnly: "false",
            has: "true",
            local: "Alias",
          },
        },
      ],
    },
    {
      code: 'import type * as mod from "@pkg/mod"; mod["Target"]();',
      errors: [
        {
          messageId: "hit",
          data: {
            name: "Target",
            typeOnly: "true",
            has: "false",
            local: "Target",
          },
        },
      ],
    },
    {
      code: "function run(Target: () => void) { Target(); }",
      errors: [
        {
          messageId: "hit",
          data: {
            name: "null",
            typeOnly: "false",
            has: "false",
            local: "Target2",
          },
        },
      ],
    },
    {
      code: 'import { Target as LocalTarget } from "./createRule.js"; LocalTarget();',
      filename: path.join(import.meta.dirname, "sample.ts"),
      errors: [
        {
          messageId: "hit",
          data: {
            name: "Target",
            typeOnly: "false",
            has: "true",
            local: "LocalTarget",
          },
        },
      ],
    },
  ],
});

ruleTester.run("fix-imports", fixRule, {
  valid: ['import { Alpha, Beta } from "@pkg/mod";\nclass Demo {}'],
  invalid: [
    {
      code: "/** Class doc. */\nclass Demo {}",
      output:
        'import { Alpha, Beta } from "@pkg/mod";\n/** Class doc. */\nclass Demo {}',
      errors: [{ messageId: "fix" }],
    },
    {
      code: 'import type { Alpha, Unused } from "@pkg/mod";\nimport { type Helper } from "@pkg/other";\nclass Demo { prop!: Helper; }',
      output:
        'import { Alpha, type Unused, Beta } from "@pkg/mod";\nimport { Helper } from "@pkg/other";\nclass Demo { prop!: Helper; }',
      errors: [{ messageId: "fix" }],
    },
    {
      code: 'import {\n  type Alpha,\n} from "@pkg/mod";\nclass Demo {}',
      output: 'import {\n  Alpha,\n  Beta,\n} from "@pkg/mod";\nclass Demo {}',
      errors: [{ messageId: "fix" }],
    },
  ],
});

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

const typedRuleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*", "src/utils/*.ts"],
        defaultProject: "tsconfig.json",
      },
      tsconfigRootDir: path.resolve(import.meta.dirname, "../.."),
    },
  },
});

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
          "createRule",
          true,
          node,
          context.filename,
        );
        const local = getLocalImportBinding(
          source,
          ["@pkg/mod", "@nest-boot/eslint"],
          "createRule",
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
          hasNamedImport(source, "@nest-boot/eslint", "Alpha", true, node) &&
          hasNamedImport(source, "@nest-boot/eslint", "Beta", true, node)
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
              ["@nest-boot/eslint"],
              ["Alpha", "Beta"],
              true,
              node,
              context.filename,
            ),
            ...promoteTypeImportFixes(fixer, source, typeNodes),
          ],
        });
      },
    };
  },
});

ruleTester.run("inspect", inspectRule, {
  valid: ['import { createRule } from "@pkg/mod"; void createRule;'],
  invalid: [
    {
      code: 'import { "createRule" as Alias } from "@pkg/mod"; Alias();',
      errors: [
        {
          messageId: "hit",
          data: {
            name: "createRule",
            typeOnly: "false",
            has: "true",
            local: "Alias",
          },
        },
      ],
    },
    {
      code: 'import type * as mod from "@pkg/mod"; mod["createRule"]();',
      errors: [
        {
          messageId: "hit",
          data: {
            name: "createRule",
            typeOnly: "true",
            has: "false",
            local: "createRule",
          },
        },
      ],
    },
    {
      code: 'import * as mod from "@pkg/mod"; const { createRule: Consume } = mod; Consume();',
      errors: [
        {
          messageId: "hit",
          data: {
            name: "createRule",
            typeOnly: "false",
            has: "false",
            local: "createRule",
          },
        },
      ],
    },
    {
      code: 'import { createRule } from "@pkg/mod"; function run() { type createRule = string; createRule(); }',
      errors: [
        {
          messageId: "hit",
          data: {
            name: "createRule",
            typeOnly: "false",
            has: "true",
            local: "createRule",
          },
        },
      ],
    },
    {
      code: "function run(createRule: () => void) { createRule(); }",
      errors: [
        {
          messageId: "hit",
          data: {
            name: "null",
            typeOnly: "false",
            has: "false",
            local: "createRule2",
          },
        },
      ],
    },
    {
      code: 'import { NonExistent as LocalTarget } from "./createRule.js"; LocalTarget();',
      filename: path.join(import.meta.dirname, "sample.ts"),
      errors: [
        {
          messageId: "hit",
          data: {
            name: "null",
            typeOnly: "false",
            has: "false",
            local: "createRule",
          },
        },
      ],
    },
  ],
});

typedRuleTester.run("inspect-typed", inspectRule, {
  valid: [],
  invalid: [
    {
      code: 'import { createRule as LocalCreateRule } from "./createRule.js"; LocalCreateRule();',
      filename: path.join(import.meta.dirname, "sample.ts"),
      errors: [
        {
          messageId: "hit",
          data: {
            name: "createRule",
            typeOnly: "false",
            has: "true",
            local: "LocalCreateRule",
          },
        },
      ],
    },
    {
      code: 'import * as localMod from "./createRule.js"; localMod.createRule();',
      filename: path.join(import.meta.dirname, "sample.ts"),
      errors: [
        {
          messageId: "hit",
          data: {
            name: "createRule",
            typeOnly: "false",
            has: "false",
            local: "createRule",
          },
        },
      ],
    },
    {
      code: 'import { NonExistent } from "./createRule.js"; NonExistent();',
      filename: path.join(import.meta.dirname, "sample.ts"),
      errors: [
        {
          messageId: "hit",
          data: {
            name: "null",
            typeOnly: "false",
            has: "false",
            local: "createRule",
          },
        },
      ],
    },
  ],
});

ruleTester.run("fix-imports", fixRule, {
  valid: ['import { Alpha, Beta } from "@nest-boot/eslint";\nclass Demo {}'],
  invalid: [
    {
      code: "/** Class doc. */\n// @ts-expect-error\n/* v8 ignore next */\nclass Demo {}",
      output:
        'import { Alpha, Beta } from "@nest-boot/eslint";\n/** Class doc. */\n// @ts-expect-error\n/* v8 ignore next */\nclass Demo {}',
      errors: [{ messageId: "fix" }],
    },
    {
      code: 'import { createRule } from "./createRule.js";\nclass Demo {}',
      filename: path.join(import.meta.dirname, "sample.ts"),
      output:
        'import { Alpha, Beta } from "@nest-boot/eslint";\nimport { createRule } from "./createRule.js";\nclass Demo {}',
      errors: [{ messageId: "fix" }],
    },
    {
      code: 'import type /* keep-decl */ { Alpha, Unused } from "@nest-boot/eslint";\nimport { type /* keep-spec */ Helper } from "@pkg/other";\nclass Demo { prop!: Helper; }',
      output:
        'import /* keep-decl */ { Alpha, type Unused, Beta } from "@nest-boot/eslint";\nimport { /* keep-spec */ Helper } from "@pkg/other";\nclass Demo { prop!: Helper; }',
      errors: [{ messageId: "fix" }],
    },
    {
      code: 'import {\n  type Alpha,\n} from "@nest-boot/eslint";\nclass Demo {}',
      output:
        'import {\n  Alpha,\n  Beta,\n} from "@nest-boot/eslint";\nclass Demo {}',
      errors: [{ messageId: "fix" }],
    },
  ],
});

import parser from "@typescript-eslint/parser";
import { Linter, type Rule } from "eslint";
import * as ts from "typescript";

import { createRule } from "./createRule.js";
import { importedBindingName, namedImportEdits } from "./named-imports.js";

const rule = createRule<[], "missing">({
  name: "test-import",
  meta: {
    type: "problem",
    docs: { description: "Exercise runtime import insertion." },
    fixable: "code",
    schema: [],
    messages: { missing: "Add runtime import." },
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(node) {
        const edits = namedImportEdits(context.sourceCode, "node:fs", [
          "readFileSync",
        ]);
        if (edits.length)
          context.report({ node, messageId: "missing", fix: () => edits });
      },
    };
  },
});

it.each<[string, string | null]>([
  ["const { Entity } = { Entity }; @Entity() class Thing {}", null],
  [
    "const { Entity: orm } = { Entity: orm.Entity }; @orm.Entity() class Thing {}",
    null,
  ],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; const { ["Entity"]: Model = () => (() => undefined), ...rest } = orm; @Model() class Thing {}',
    "Entity",
  ],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; const { Entity: Model } = { ...orm, "Entity": orm["Entity"] }; @Model() class Thing {}',
    "Entity",
  ],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; const { Entity: Model } = { ...orm, Entity: orm.Entity }; @Model() class Thing {}',
    "Entity",
  ],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; const { Entity: Model } = { Entity: orm.Entity, ...unknown }; @Model() class Thing {}',
    null,
  ],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; const { Entity: Model } = { Entity: orm.Entity, [unknown]: orm.Entity }; @Model() class Thing {}',
    null,
  ],
  [
    'import { Entity as orm } from "@mikro-orm/decorators/legacy"; const { Entity: Model } = orm; @Model() class Thing {}',
    null,
  ],
  ["const { Entity: Model } = orm; @Model() class Thing {}", null],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; function dynamic(key: string) { const { [key]: Model } = orm; @Model() class Thing {} }',
    null,
  ],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; const { nested: { Entity: Model } } = { nested: orm }; @Model() class Thing {}',
    null,
  ],
  [
    'import * as orm from "@mikro-orm/decorators/legacy"; function shadow(orm: { Entity(): ClassDecorator }) { const { Entity: Model } = orm; @Model() class Thing {} }',
    null,
  ],
])("resolves only verified namespace bindings: %s", (code, expected) => {
  const probe = createRule<[], "unused">({
    name: "test-origin",
    meta: {
      type: "problem",
      docs: { description: "Exercise import origin resolution." },
      schema: [],
      messages: { unused: "Unused." },
    },
    defaultOptions: [],
    create(context) {
      return {
        "CallExpression > Identifier, CallExpression > MemberExpression"(node) {
          expect(
            importedBindingName(
              context.sourceCode,
              "@mikro-orm/decorators/legacy",
              node,
            ),
          ).toBe(expected);
        },
      };
    },
  });
  const result = new Linter().verify(code, {
    languageOptions: { parser },
    plugins: {
      test: { rules: { origin: probe as unknown as Rule.RuleModule } },
    },
    rules: { "test/origin": "error" },
  });
  expect(result).toEqual([]);
});

it.each([
  "#!/usr/bin/env node\n",
  '/// <reference types="node" />\n',
  '#!/usr/bin/env node\n/// <reference types="node" />\n"use strict";\n// preserve the file header\n',
  '"use client";',
])("preserves the file preamble %j", (preamble) => {
  const linter = new Linter();
  const config: Linter.Config = {
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: { parser },
    plugins: {
      test: { rules: { imports: rule as unknown as Rule.RuleModule } },
    },
    rules: { "test/imports": "error" },
  };
  const code = `${preamble}readFileSync("file.txt");`;
  const result = linter.verifyAndFix(code, config);
  expect(result.messages).toEqual([]);
  expect(result.output.startsWith(preamble)).toBe(true);
  expect(ts.preProcessFile(result.output).typeReferenceDirectives).toEqual(
    ts.preProcessFile(code).typeReferenceDirectives,
  );
  expect(linter.verifyAndFix(result.output, config).fixed).toBe(false);
});

it.each([
  "/** Public model description. */",
  "// @ts-expect-error",
  "/* istanbul ignore next */",
  "/* c8 ignore next */",
  "// eslint-disable-next-line no-unused-vars",
])("keeps %s attached to its statement", (comment) => {
  const preamble =
    '#!/usr/bin/env node\n/// <reference types="node" />\n"use strict";\n';
  const code = `${preamble}${comment}\nexport class Thing {}`;
  const linter = new Linter();
  const config: Linter.Config = {
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: { parser },
    plugins: {
      test: { rules: { imports: rule as unknown as Rule.RuleModule } },
    },
    rules: { "test/imports": "error" },
  };
  const result = linter.verifyAndFix(code, config);
  expect(result.output).toContain(`${comment}\nexport class Thing`);
  expect(result.output.startsWith(preamble)).toBe(true);
  if (comment.startsWith("/**")) {
    const source = ts.createSourceFile(
      "test.ts",
      result.output,
      ts.ScriptTarget.ESNext,
      true,
    );
    const declaration = source.statements.find(ts.isClassDeclaration);
    if (!declaration) throw new Error("Missing class declaration");
    expect(ts.getJSDocCommentsAndTags(declaration)).toHaveLength(1);
  }
  expect(linter.verifyAndFix(result.output, config).fixed).toBe(false);
});

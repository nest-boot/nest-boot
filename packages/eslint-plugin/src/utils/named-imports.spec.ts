import parser from "@typescript-eslint/parser";
import { Linter, type Rule } from "eslint";
import * as ts from "typescript";

import { createRule } from "./createRule.js";
import { namedImportEdits } from "./named-imports.js";

const rule = createRule<[], "missing">({
  name: "test-import",
  meta: {
    type: "problem",
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

it.each([
  "#!/usr/bin/env node\n",
  '/// <reference types="node" />\n',
  '#!/usr/bin/env node\n/// <reference types="node" />\n"use strict";\n// preserve the file header\n',
  '"use client";',
])("preserves the file preamble %j", (preamble) => {
  const linter = new Linter();
  const config: Linter.Config = {
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

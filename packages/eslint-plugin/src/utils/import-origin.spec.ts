import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "./createRule.js";
import { importedBindingName } from "./named-imports.js";
import { tester } from "./tester.js";

const rule = createRule<[], "recognized">({
  name: "test-import-origin",
  meta: {
    type: "problem",
    docs: {
      description:
        "Verify public export identity across source and build entry points.",
    },
    schema: [],
    messages: { recognized: "Recognized {{name}}." },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return;
        const name = importedBindingName(
          context.sourceCode,
          "@nest-boot/mikro-orm-crypt",
          node.callee,
        );
        if (name === "EncryptedProperty")
          context.report({ node, messageId: "recognized", data: { name } });
      },
    };
  },
});

tester.run("import-origin", rule, {
  valid: [
    "function EncryptedProperty() {} EncryptedProperty();",
    'import { EncryptedProperty } from "./unknown-package.js"; EncryptedProperty();',
  ],
  invalid: ["src", "dist"].map((directory) => ({
    code: `import { EncryptedProperty as Secret } from "../mikro-orm-crypt/${directory}/index.js"; Secret();`,
    errors: [{ messageId: "recognized", data: { name: "EncryptedProperty" } }],
  })),
});

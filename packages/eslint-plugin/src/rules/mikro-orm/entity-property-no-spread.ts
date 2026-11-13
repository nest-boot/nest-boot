import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../../utils/createRule.js";
import { importedBindingName } from "../../utils/named-imports.js";

const decoratorModules = [
  "@mikro-orm/decorators/legacy",
  "@nest-boot/database",
  "@nest-boot/database-crypt",
  "@nest-boot/database-hash",
];
const fieldDecorators = new Set([
  "Property",
  "PrimaryKey",
  "Enum",
  "Embedded",
  "OneToOne",
  "OneToMany",
  "ManyToOne",
  "ManyToMany",
  "Index",
  "Unique",
  "EncryptedProperty",
  "HashedProperty",
  "SearchableProperty",
]);

export default createRule({
  name: "entity-property-no-spread",
  meta: {
    type: "problem",
    schema: [],
    docs: {
      description: "Require explicit options in entity field decorators.",
    },
    messages: {
      noSpread:
        "List field decorator options explicitly instead of spreading shared configuration.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      PropertyDefinition(node) {
        for (const decorator of node.decorators) {
          const call = decorator.expression;
          if (
            call.type !== AST_NODE_TYPES.CallExpression ||
            !fieldDecorators.has(
              importedBindingName(
                context.sourceCode,
                decoratorModules,
                call.callee,
              ) ?? "",
            )
          ) {
            continue;
          }
          for (const argument of call.arguments) {
            const spreads =
              argument.type === AST_NODE_TYPES.SpreadElement
                ? [argument]
                : argument.type === AST_NODE_TYPES.ObjectExpression
                  ? argument.properties.filter(
                      (property) =>
                        property.type === AST_NODE_TYPES.SpreadElement,
                    )
                  : [];
            for (const spread of spreads) {
              context.report({ node: spread, messageId: "noSpread" });
            }
          }
        }
      },
    };
  },
});

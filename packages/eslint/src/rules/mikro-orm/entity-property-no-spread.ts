import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../../utils/createRule.js";
import { getImportedName } from "../../utils/imports.js";

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
  name: "database/entity-property-no-spread",
  meta: {
    type: "problem",
    docs: {
      description: "require explicit options in entity field decorators",
      recommended: true,
    },
    schema: [],
    messages: {
      noSpread:
        "List field decorator options explicitly instead of spreading shared configuration.",
    },
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        for (const decorator of node.decorators) {
          const call = decorator.expression;
          if (
            call.type !== AST_NODE_TYPES.CallExpression ||
            !fieldDecorators.has(
              getImportedName(
                context.sourceCode,
                decoratorModules,
                call.callee,
                context.filename,
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

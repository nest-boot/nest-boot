import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESTree,
} from "@typescript-eslint/utils";

import { createRule } from "../utils/createRule.js";
import { getImportedName } from "../utils/imports.js";

const decoratorModules = [
  "@mikro-orm/decorators/legacy",
  "@nest-boot/database",
  "@nest-boot/database-crypt",
  "@nest-boot/database-hash",
];

const trackedPropertyDecorators = new Set([
  "Property",
  "Enum",
  "OneToOne",
  "OneToMany",
  "ManyToOne",
  "ManyToMany",
  "EncryptedProperty",
  "HashedProperty",
  "SearchableProperty",
]);

export default createRule({
  name: "database-entity-property-definite-assignment",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "require definite assignment assertions on uninitialized entity properties",
      recommended: true,
    },
    fixable: "code",
    schema: [],
    messages: {
      addDefiniteAssignment: "Add definite assignment assertion (!).",
    },
  },
  create(context) {
    const source = context.sourceCode;

    const getDecoratorName = (decorator: TSESTree.Decorator): string | null =>
      decorator.expression.type === AST_NODE_TYPES.CallExpression
        ? getImportedName(
            source,
            decoratorModules,
            decorator.expression.callee,
            context.filename,
          )
        : null;

    return {
      ClassDeclaration(node) {
        if (
          !node.decorators.some(
            (decorator) => getDecoratorName(decorator) === "Entity",
          )
        ) {
          return;
        }

        for (const member of node.body.body.filter(
          ASTUtils.isNodeOfType(AST_NODE_TYPES.PropertyDefinition),
        )) {
          if (
            !ASTUtils.isIdentifier(member.key) ||
            member.optional ||
            member.declare ||
            member.value !== null ||
            member.definite ||
            !member.decorators.some((decorator) =>
              trackedPropertyDecorators.has(getDecoratorName(decorator) ?? ""),
            )
          ) {
            continue;
          }

          context.report({
            node: member,
            messageId: "addDefiniteAssignment",
            fix: (fixer) => fixer.insertTextAfter(member.key, "!"),
          });
        }
      },
    };
  },
});

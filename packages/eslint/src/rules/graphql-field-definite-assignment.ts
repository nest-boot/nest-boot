import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESTree,
} from "@typescript-eslint/utils";

import { createRule } from "../utils/createRule.js";
import { getImportedName } from "../utils/imports.js";

const graphqlModules = ["@nestjs/graphql", "@nest-boot/graphql"];
const modelDecorators = new Set(["ObjectType", "InputType", "ArgsType"]);

export default createRule<[], "addDefiniteAssignment">({
  name: "graphql-field-definite-assignment",
  meta: {
    type: "problem",
    docs: {
      description:
        "require definite assignment assertions on uninitialized GraphQL @Field properties",
      recommended: true,
    },
    fixable: "code",
    schema: [],
    messages: {
      addDefiniteAssignment:
        "Property '{{propertyName}}' has a @Field decorator without an initializer and requires a definite assignment assertion (!).",
    },
  },
  create(context) {
    const source = context.sourceCode;

    const getDecoratorName = (decorator: TSESTree.Decorator): string | null =>
      decorator.expression.type === AST_NODE_TYPES.CallExpression
        ? getImportedName(
            source,
            graphqlModules,
            decorator.expression.callee,
            context.filename,
          )
        : null;

    return {
      ClassDeclaration(node) {
        if (
          !node.decorators.some((decorator) =>
            modelDecorators.has(getDecoratorName(decorator) ?? ""),
          )
        ) {
          return;
        }

        for (const member of node.body.body.filter(
          ASTUtils.isNodeOfType(AST_NODE_TYPES.PropertyDefinition),
        )) {
          if (
            member.computed ||
            !ASTUtils.isIdentifier(member.key) ||
            member.optional ||
            member.declare ||
            member.value !== null ||
            member.definite ||
            !member.decorators.some(
              (decorator) => getDecoratorName(decorator) === "Field",
            )
          ) {
            continue;
          }

          context.report({
            node: member,
            messageId: "addDefiniteAssignment",
            data: { propertyName: member.key.name },
            fix: (fixer) => fixer.insertTextAfter(member.key, "!"),
          });
        }
      },
    };
  },
});

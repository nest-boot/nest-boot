import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

import { createRule } from "../../utils/createRule";
import {
  hasClassDecorator,
  hasPropertyDecorator,
} from "../../utils/decorators";

export default createRule<
  [],
  "addDefiniteAssignment" | "removeDefiniteAssignment"
>({
  name: "graphql-field-definite-assignment",
  meta: {
    type: "problem",
    docs: {
      description:
        "Ensures that properties with the GraphQL @Field decorator correctly use the definite assignment assertion (!). Properties without initializers should have !, and properties with initializers should not have !.",
    },
    fixable: "code",
    schema: [],
    messages: {
      addDefiniteAssignment:
        "Property '{{propertyName}}' has a @Field decorator but no initializer, it should have a definite assignment assertion (!).",
      removeDefiniteAssignment:
        "Property '{{propertyName}}' has a @Field decorator and an initializer, the definite assignment assertion (!) should be removed.",
    },
  },
  defaultOptions: [],
  create(context) {
    const source = context.sourceCode;

    const isGraphqlModelClass = (node: TSESTree.ClassDeclaration): boolean => {
      return hasClassDecorator(node, ["ObjectType", "InputType", "ArgsType"]);
    };

    const getPropertyName = (
      member: TSESTree.PropertyDefinition,
    ): string | null => {
      if (member.key.type === AST_NODE_TYPES.Identifier) {
        return member.key.name;
      }
      return null;
    };

    const hasInitializer = (member: TSESTree.PropertyDefinition): boolean => {
      return !!member.value;
    };

    const hasDefiniteAssignment = (
      member: TSESTree.PropertyDefinition,
    ): boolean => {
      return member.definite;
    };

    const isOptionalProperty = (
      member: TSESTree.PropertyDefinition,
    ): boolean => {
      // Check the AST node's optional flag
      if (member.optional) return true;

      // Check if there is a ? symbol in the source code (between property name and colon)
      const keyEnd = member.key.range[1];
      const text = source.text;
      for (let i = keyEnd; i < member.range[1]; i++) {
        if (text[i] === "?") return true;
        if (text[i] === ":" || text[i] === "!") break;
      }

      return false;
    };

    return {
      ClassDeclaration(node) {
        if (!isGraphqlModelClass(node)) return;

        node.body.body.forEach((member: TSESTree.ClassElement) => {
          if (member.type !== AST_NODE_TYPES.PropertyDefinition) return;
          if (!hasPropertyDecorator(member, "Field")) return;

          const propertyName = getPropertyName(member);
          if (!propertyName) return;

          // Optional properties (?:) do not need a definite assignment assertion
          if (isOptionalProperty(member)) return;

          const hasInit = hasInitializer(member);
          const hasDefinite = hasDefiniteAssignment(member);

          // Case 1: No initializer and no definite assignment assertion
          if (!hasInit && !hasDefinite) {
            context.report({
              node: member,
              messageId: "addDefiniteAssignment",
              data: {
                propertyName,
              },
              fix: (fixer) => {
                // Find the end position of the property name
                const keyEnd = member.key.range[1];
                // Insert ! after the property name
                return fixer.insertTextAfterRange([keyEnd, keyEnd], "!");
              },
            });
          }

          // Case 2: Has initializer but also has definite assignment assertion
          if (hasInit && hasDefinite) {
            context.report({
              node: member,
              messageId: "removeDefiniteAssignment",
              data: {
                propertyName,
              },
              fix: (fixer) => {
                // Find and remove the ! position
                const keyEnd = member.key.range[1];
                const text = source.text;

                // Find the ! position (between the property name and the colon)
                let exclamationPos = -1;
                for (let i = keyEnd; i < member.range[1]; i++) {
                  if (text[i] === "!") {
                    exclamationPos = i;
                    break;
                  }
                  // If we encounter a colon, there is no !
                  if (text[i] === ":") {
                    break;
                  }
                }

                if (exclamationPos !== -1) {
                  return fixer.removeRange([
                    exclamationPos,
                    exclamationPos + 1,
                  ]);
                }
                return null;
              },
            });
          }
        });
      },
    };
  },
});

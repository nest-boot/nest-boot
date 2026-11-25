import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

import { createRule } from "../../utils/createRule.js";

export default createRule({
  name: "graphql/no-direct-nestjs-import",
  meta: {
    type: "problem",
    schema: [],
    docs: {
      description: "Require the Nest Boot public GraphQL entry point.",
    },
    messages: {
      useNestBootGraphql: "Use @nest-boot/graphql for public GraphQL imports.",
    },
  },
  defaultOptions: [],
  create(context) {
    /**
     * Reports direct imports from `@nestjs/graphql`.
     * @param source - The module specifier node to inspect.
     */
    function checkSource(source: TSESTree.Node | null): void {
      if (
        source?.type === AST_NODE_TYPES.Literal &&
        source.value === "@nestjs/graphql"
      ) {
        context.report({ node: source, messageId: "useNestBootGraphql" });
      }
    }

    return {
      ImportDeclaration(node) {
        checkSource(node.source);
      },
      ImportExpression(node) {
        checkSource(node.source);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source);
      },
      ExportAllDeclaration(node) {
        checkSource(node.source);
      },
      TSImportType(node) {
        checkSource(node.source);
      },
      TSImportEqualsDeclaration(node) {
        if (
          node.moduleReference.type === AST_NODE_TYPES.TSExternalModuleReference
        ) {
          checkSource(node.moduleReference.expression);
        }
      },
    };
  },
});

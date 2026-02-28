import { createRule } from "../../utils/createRule";

export default createRule({
  name: "import-graphql",
  meta: {
    type: "problem",
    docs: {
      description:
        "Fix imports from @nestjs/graphql to use @nest-boot/graphql instead",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceGraphqlImport:
        "Should import from @nest-boot/graphql instead of @nestjs/graphql",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        // Check if importing from @nestjs/graphql
        if (node.source.value === "@nestjs/graphql") {
          context.report({
            node,
            messageId: "replaceGraphqlImport",
            fix(fixer) {
              // Replace import source with @nest-boot/graphql
              return fixer.replaceText(node.source, '"@nest-boot/graphql"');
            },
          });
        }
      },
    };
  },
});

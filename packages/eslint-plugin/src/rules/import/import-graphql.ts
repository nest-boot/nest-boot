import { createRule } from "../../utils/createRule";

export default createRule({
  name: "import-graphql",
  meta: {
    type: "problem",
    docs: {
      description:
        "将从 @nestjs/graphql 导入的包修复为从 @nest-boot/graphql 导入",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceGraphqlImport:
        "应从 @nest-boot/graphql 导入，而不是 @nestjs/graphql",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        // 检查是否从 @nestjs/graphql 导入
        if (node.source.value === "@nestjs/graphql") {
          context.report({
            node,
            messageId: "replaceGraphqlImport",
            fix(fixer) {
              // 将导入源替换为 @nest-boot/graphql
              return fixer.replaceText(node.source, '"@nest-boot/graphql"');
            },
          });
        }
      },
    };
  },
});

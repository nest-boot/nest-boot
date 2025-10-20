import { createRule } from "../../utils/createRule";

export default createRule({
  name: "import-bullmq",
  meta: {
    type: "problem",
    docs: {
      description:
        "将从 @nestjs/bullmq 导入的包修复为从 @nest-boot/bullmq 导入",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceBullmqImport: "应从 @nest-boot/bullmq 导入，而不是 @nestjs/bullmq",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        // 检查是否从 @nestjs/bullmq 导入
        if (node.source.value === "@nestjs/bullmq") {
          context.report({
            node,
            messageId: "replaceBullmqImport",
            fix(fixer) {
              // 将导入源替换为 @nest-boot/bullmq
              return fixer.replaceText(node.source, '"@nest-boot/bullmq"');
            },
          });
        }
      },
    };
  },
});

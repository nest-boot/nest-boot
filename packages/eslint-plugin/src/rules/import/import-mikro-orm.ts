import { createRule } from "../../utils/createRule";

export default createRule({
  name: "import-mikro-orm",
  meta: {
    type: "problem",
    docs: {
      description:
        "将从 @mikro-orm/nestjs 导入的包修复为从 @nest-boot/mikro-orm 导入",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceMikroOrmImport:
        "应从 @nest-boot/mikro-orm 导入，而不是 @mikro-orm/nestjs",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        // 检查是否从 @mikro-orm/nestjs 导入
        if (node.source.value === "@mikro-orm/nestjs") {
          context.report({
            node,
            messageId: "replaceMikroOrmImport",
            fix(fixer) {
              // 将导入源替换为 @nest-boot/mikro-orm
              return fixer.replaceText(node.source, '"@nest-boot/mikro-orm"');
            },
          });
        }
      },
    };
  },
});

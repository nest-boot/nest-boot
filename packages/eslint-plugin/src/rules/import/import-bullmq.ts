import { createRule } from "../../utils/createRule";

export default createRule({
  name: "import-bullmq",
  meta: {
    type: "problem",
    docs: {
      description:
        "Fix imports from @nestjs/bullmq to use @nest-boot/bullmq instead",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceBullmqImport:
        "Should import from @nest-boot/bullmq instead of @nestjs/bullmq",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        // Check if importing from @nestjs/bullmq
        if (node.source.value === "@nestjs/bullmq") {
          context.report({
            node,
            messageId: "replaceBullmqImport",
            fix(fixer) {
              // Replace import source with @nest-boot/bullmq
              return fixer.replaceText(node.source, '"@nest-boot/bullmq"');
            },
          });
        }
      },
    };
  },
});

import { createRule } from "../../utils/createRule.js";
import { fixRenamedImport } from "../../utils/fix-renamed-import.js";

export default createRule({
  name: "import-queue",
  meta: {
    type: "problem",
    docs: {
      description:
        "Fix imports from @nestjs/bullmq to use @nest-boot/queue instead",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceBullmqImport:
        "Should import from @nest-boot/queue instead of @nestjs/bullmq",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        if (
          node.source.value === "@nestjs/bullmq" ||
          node.source.value === "@nest-boot/bullmq"
        ) {
          context.report({
            node,
            messageId: "replaceBullmqImport",
            fix(fixer) {
              return fixRenamedImport(fixer, node, "@nest-boot/queue", {
                BullModule: "QueueModule",
                BullModuleOptions: "QueueModuleOptions",
                BullMQHealthIndicator: "QueueHealthIndicator",
              });
            },
          });
        }
      },
    };
  },
});

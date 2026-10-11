import { AST_NODE_TYPES } from "@typescript-eslint/utils";

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
      replaceQueueImport:
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
            messageId: "replaceQueueImport",
            fix(fixer) {
              const supported = new Set([
                "BullModuleOptions",
                "QueueModuleOptions",
                "BullMQHealthIndicator",
                "QueueHealthIndicator",
                "WorkerHost",
                "BaseProcessor",
                "OnWorkerEvent",
                "OnQueueEvent",
                "JOB_REF",
                "QueueEventsHost",
              ]);
              if (
                node.specifiers.some(
                  (specifier) =>
                    specifier.type !== AST_NODE_TYPES.ImportSpecifier ||
                    !supported.has(
                      specifier.imported.type === AST_NODE_TYPES.Identifier
                        ? specifier.imported.name
                        : specifier.imported.value,
                    ),
                )
              )
                return null;
              return fixRenamedImport(fixer, node, "@nest-boot/queue", {
                WorkerHost: "BaseProcessor",
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

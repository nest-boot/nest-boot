import { createRule } from "../../utils/createRule.js";
import { fixRenamedImport } from "../../utils/fix-renamed-import.js";

export default createRule({
  name: "import-database",
  meta: {
    type: "problem",
    docs: {
      description:
        "Fix imports from @mikro-orm/nestjs to use @nest-boot/database instead",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceDatabaseImport:
        "Should import from @nest-boot/database instead of @mikro-orm/nestjs",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        if (
          node.source.value === "@mikro-orm/nestjs" ||
          node.source.value === "@nest-boot/mikro-orm"
        ) {
          context.report({
            node,
            messageId: "replaceDatabaseImport",
            fix(fixer) {
              return fixRenamedImport(fixer, node, "@nest-boot/database", {
                MikroOrmModule: "DatabaseModule",
                MikroOrmModuleOptions: "DatabaseModuleOptions",
              });
            },
          });
        }
      },
    };
  },
});

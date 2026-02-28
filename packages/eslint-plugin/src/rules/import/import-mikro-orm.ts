import { createRule } from "../../utils/createRule";

export default createRule({
  name: "import-mikro-orm",
  meta: {
    type: "problem",
    docs: {
      description:
        "Fix imports from @mikro-orm/nestjs to use @nest-boot/mikro-orm instead",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceMikroOrmImport:
        "Should import from @nest-boot/mikro-orm instead of @mikro-orm/nestjs",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        // Check if importing from @mikro-orm/nestjs
        if (node.source.value === "@mikro-orm/nestjs") {
          context.report({
            node,
            messageId: "replaceMikroOrmImport",
            fix(fixer) {
              // Replace import source with @nest-boot/mikro-orm
              return fixer.replaceText(node.source, '"@nest-boot/mikro-orm"');
            },
          });
        }
      },
    };
  },
});

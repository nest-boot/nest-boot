import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utils/createRule";

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "实体字段不能使用可选属性和非空断言",
    },
    fixable: "code",
    schema: [],
    messages: {
      entityPropertyNoOptionalOrNonNullAssertion:
        "实体字段不能使用可选属性和非空断言。",
    },
  },
  defaultOptions: [{}],
  create(context) {
    return {
      ClassDeclaration(node) {
        if (
          node.decorators.some((decorator) => {
            return (
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decorator.expression.callee.type === AST_NODE_TYPES.Identifier &&
              decorator.expression.callee.name === "Entity"
            );
          })
        ) {
          // 遍历类属性
          node.body.body.forEach((property) => {
            // 检查是否有 @Property、@ManyToOne 或 @PrimaryKey 装饰器
            if (
              property.type === AST_NODE_TYPES.PropertyDefinition &&
              property.decorators &&
              property.decorators.some((decorator) => {
                return (
                  decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                  decorator.expression.callee.type ===
                    AST_NODE_TYPES.Identifier &&
                  ["Property", "ManyToOne", "PrimaryKey"].includes(
                    decorator.expression.callee.name,
                  )
                );
              })
            ) {
              if (property.optional || property.definite) {
                context.report({
                  node: property,
                  messageId: "entityPropertyNoOptionalOrNonNullAssertion",
                  fix: (fixer) => {
                    const tokenBefore = context.sourceCode.getTokenBefore(
                      property.key,
                    );
                    const propertyStart =
                      tokenBefore && tokenBefore.range[1] < property.range[0]
                        ? tokenBefore.range[1]
                        : property.range[0];
                    const propertyEnd = property.range[1];

                    // 从属性中移除 ? 或 ! 符号
                    const fixedPropertyText = context.sourceCode
                      .getText()
                      .slice(propertyStart, propertyEnd)
                      .replace(/\?|!/, "");

                    return fixer.replaceTextRange(
                      [propertyStart, propertyEnd],
                      fixedPropertyText,
                    );
                  },
                });
              }
            }
          });
        }
      },
    };
  },
});

import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utils/createRule";

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "没有默认值的实体字段需要在构造函数中初始化",
    },
    fixable: "code",
    schema: [],
    messages: {
      entityConstructor: "没有默认值的实体字段需要在构造函数中初始化",
    },
  },
  defaultOptions: [{}],
  create(context) {
    return {
      ClassDeclaration(node) {
        // 检查是否有 @Entity 装饰器
        if (
          node.id !== null &&
          node.decorators.some((decorator) => {
            return (
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decorator.expression.callee.type === AST_NODE_TYPES.Identifier &&
              decorator.expression.callee.name === "Entity"
            );
          })
        ) {
          const constructor = node.body.body.find((method) => {
            return (
              method.type === AST_NODE_TYPES.MethodDefinition &&
              method.kind === "constructor"
            );
          });

          if (typeof constructor === "undefined") {
            // 遍历类属性
            const requiredPropertyKeys = node.body.body
              .map((property) => {
                return property.type === AST_NODE_TYPES.PropertyDefinition &&
                  property.value === null &&
                  property.key.type === AST_NODE_TYPES.Identifier
                  ? property.key.name
                  : null;
              })
              .filter((property) => property !== null);

            if (requiredPropertyKeys.length > 0) {
              context.report({
                node,
                messageId: "entityConstructor",
                fix(fixer) {
                  const constructorCode = /* typescript */ `
                    constructor(data: Pick<${
                      node.id.name
                    }, ${requiredPropertyKeys
                      .map((key) => `"${key}"`)
                      .join(` | `)}>) {
                      ${requiredPropertyKeys
                        .map((key) => `this.${key} = data.${key}`)
                        .join(`;\n`)};
                    }
                  `;

                  return fixer.insertTextBefore(
                    node.body.body[0],
                    constructorCode,
                  );
                },
              });
            }
          }
        }
      },
    };
  },
});

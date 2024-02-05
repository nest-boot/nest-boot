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
            const propertyKeys: { name: string; required: boolean }[] = [];

            // 遍历类属性
            node.body.body.forEach((property) => {
              if (
                property.type === AST_NODE_TYPES.PropertyDefinition &&
                property.key.type === AST_NODE_TYPES.Identifier
              ) {
                propertyKeys.push({
                  name: property.key.name,
                  required: property.value === null,
                });
              }
            });

            if (propertyKeys.length > 0) {
              context.report({
                node,
                messageId: "entityConstructor",
                fix(fixer) {
                  const constructorCode = /* typescript */ `
                    constructor(data: Pick<${node.id?.name}, ${propertyKeys
                      .filter((key) => key.required)
                      .map((key) => `"${key.name}"`)
                      .join(` | `)}> & Partial<Pick<${
                      node.id?.name
                    }, ${propertyKeys
                      .filter((key) => !key.required)
                      .map((key) => `"${key.name}"`)
                      .join(` | `)}>>) {
                      ${propertyKeys
                        .filter((key) => key.required)
                        .map((key) => `this.${key.name} = data.${key.name};`)
                        .join(`\n`)}
                      
                      ${propertyKeys
                        .filter((key) => !key.required)
                        .map(
                          (key) =>
                            `data.${key.name} !== void 0 && (this.${key.name} = data.${key.name});`,
                        )
                        .join(`\n`)}
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

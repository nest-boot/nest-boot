import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import { createRule } from "../utils/createRule";

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "实体字段可为空时属性类型",
    },
    fixable: "code",
    schema: [],
    messages: {
      entityPropertyNullable:
        "@Property({ nullable: true }) 属性类型需包含 null。",
    },
  },
  defaultOptions: [{}],
  create(context) {
    return {
      ClassDeclaration(node) {
        // 检查是否有 @Entity 装饰器
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
            // 检查是否有 @Property() 装饰器
            if (property.type === AST_NODE_TYPES.PropertyDefinition) {
              const propertyDecorator = property.decorators.find(
                (decorator) => {
                  return (
                    decorator.expression.type ===
                      AST_NODE_TYPES.CallExpression &&
                    decorator.expression.callee.type ===
                      AST_NODE_TYPES.Identifier &&
                    decorator.expression.callee.name === "Property"
                  );
                },
              );

              if (typeof propertyDecorator === "undefined") {
                return;
              }

              // 检查 @Property() 装饰器 nullable 参数是否为 true
              if (
                propertyDecorator.expression.type ===
                  AST_NODE_TYPES.CallExpression &&
                propertyDecorator.expression.arguments[0]?.type ===
                  AST_NODE_TYPES.ObjectExpression &&
                propertyDecorator.expression.arguments[0]?.properties?.some(
                  (prop) => {
                    return (
                      prop.type === AST_NODE_TYPES.Property &&
                      prop.key.type === AST_NODE_TYPES.Identifier &&
                      prop.key.name === "nullable" &&
                      prop.value.type === AST_NODE_TYPES.Literal &&
                      prop.value.value === true
                    );
                  },
                )
              ) {
                const typeAnnotation = property.typeAnnotation;

                if (typeof typeAnnotation === "undefined") {
                  return;
                }

                // 检查属性类型是否包含 null
                if (
                  !(
                    typeAnnotation.type === AST_NODE_TYPES.TSTypeAnnotation &&
                    typeAnnotation.typeAnnotation.type ===
                      AST_NODE_TYPES.TSUnionType &&
                    typeAnnotation.typeAnnotation.types.some(
                      (type) => type.type === AST_NODE_TYPES.TSNullKeyword,
                    )
                  )
                ) {
                  context.report({
                    node: property,
                    messageId: "entityPropertyNullable",
                    fix: (fixer) => {
                      const typeAnnotationStart = typeAnnotation.range[0];
                      const typeAnnotationEnd = typeAnnotation.range[1];
                      const originalType =
                        context.sourceCode.getText(typeAnnotation);

                      return fixer.replaceTextRange(
                        [typeAnnotationStart, typeAnnotationEnd],
                        `${originalType} | null${
                          property.value ? "" : " = null"
                        }`,
                      );
                    },
                  });
                }
              }
            }
          });
        }
      },
    };
  },
});

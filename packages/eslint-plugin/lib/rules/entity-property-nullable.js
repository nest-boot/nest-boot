/**
 * @fileoverview 实体字段可为空时属性类型
 * @author D4rkCr0w
 */
"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "实体字段可为空时属性类型",
      recommended: false,
      url: null,
    },
    fixable: "code",
    schema: [],
    messages: {
      entityPropertyNullable:
        "@Property({ nullable: true }) 属性类型需包含 null。",
    },
  },

  create(context) {
    return {
      ClassDeclaration(node) {
        // 检查是否有 @Entity 装饰器
        if (
          node.decorators &&
          node.decorators.some(
            (decorator) => decorator.expression.callee.name === "Entity",
          )
        ) {
          // 遍历类属性
          node.body.body.forEach((property) => {
            // 检查是否有 @Property() 装饰器
            if (property.type === "PropertyDefinition" && property.decorators) {
              const propertyDecorator = property.decorators.find(
                (decorator) => decorator.expression.callee.name === "Property",
              );

              // 检查 @Property() 装饰器 nullable 参数是否为 true
              if (
                propertyDecorator &&
                propertyDecorator.expression.arguments[0] &&
                propertyDecorator.expression.arguments[0].properties &&
                propertyDecorator.expression.arguments[0].properties.some(
                  (prop) =>
                    prop.key.name === "nullable" &&
                    prop.value.type === "Literal" &&
                    prop.value.value === true,
                )
              ) {
                // 检查属性类型是否包含 null
                if (
                  !property.typeAnnotation ||
                  property.typeAnnotation.typeAnnotation.type !==
                    "TSUnionType" ||
                  !property.typeAnnotation.typeAnnotation.types.some(
                    (type) => type.type === "TSNullKeyword",
                  )
                ) {
                  context.report({
                    node: property,
                    messageId: "entityPropertyNullable",
                    fix: (fixer) => {
                      const typeAnnotationStart =
                        property.typeAnnotation.range[0];
                      const typeAnnotationEnd =
                        property.typeAnnotation.range[1];
                      const originalType = context.sourceCode.getText(
                        property.typeAnnotation,
                      );

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
};

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
      entityPropertyFieldType:
        "@Field(() => type) 属性类型需包含 null。",
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
                    decorator.expression.callee.name === "Field"
                  );
                },
              );

              if (typeof propertyDecorator === "undefined") {
                return;
              }

               // 检查属性类型是否是联合类型且 @Field 没有加类型
               if (propertyDecorator.expression?.arguments?.findIndex(item => item.type === 'ArrowFunctionExpression') === -1) {

                const nonemptyTypes = property.typeAnnotation?.typeAnnotation?.types?.filter(item => ![AST_NODE_TYPES.TSNullKeyword, AST_NODE_TYPES.TSUndefinedKeyword].includes(item.type))
                // 是否有非空类型
                if (nonemptyTypes?.length) {
                  context.report({
                    node: property,
                    messageId: "entityPropertyFieldType",
                    fix: (fixer) => {
                      const typeAnnotationStart = property.range[0];

                     return fixer.insertTextAfterRange([typeAnnotationStart, typeAnnotationStart + '@Field('.length], `() => ${nonemptyTypes[0].type.replace(/TS|Keyword/g, '')}${propertyDecorator.expression?.arguments?.length? ', ': ""}`)
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

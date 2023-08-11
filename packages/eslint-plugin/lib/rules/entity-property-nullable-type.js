/**
 * @fileoverview 实体字段可为空时属性类型
 * @author 实体字段可为空时属性类型
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: null, // `problem`, `suggestion`, or `layout`
    docs: {
      description: "实体字段可为空时属性类型",
      recommended: false,
      url: null, // URL to the documentation page for this rule
    },
    fixable: null, // Or `code` or `whitespace`
    schema: [], // Add a schema if the rule has options
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    // any helper functions should go here or else delete this section

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

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
            // 检查是否有 @Property 装饰器
            if (property.type === "PropertyDefinition" && property.decorators) {
              const propertyDecorator = property.decorators.find(
                (decorator) => decorator.expression.callee.name === "Property",
              );

              // 检查是否有 @Property(nullable: true) 装饰器
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
                    message:
                      "@Property({ nullable: true }) 属性类型需包含 null。",
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

/**
 * @fileoverview 实体字段不能使用可选属性和非空断言
 * @author 实体字段不能使用可选属性和非空断言
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
      description: "实体字段不能使用可选属性和非空断言",
      recommended: false,
      url: null, // URL to the documentation page for this rule
    },
    fixable: null, // Or `code` or `whitespace`
    schema: [], // Add a schema if the rule has options
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
            // 检查是否有 @Property、@ManyToOne 或 @PrimaryKey 装饰器
            if (
              property.type === "PropertyDefinition" &&
              property.decorators &&
              property.decorators.some((decorator) => {
                return ["Property", "ManyToOne", "PrimaryKey"].includes(
                  decorator.expression.callee.name,
                );
              })
            ) {
              if (property.optional || property.definite) {
                context.report({
                  node: property,
                  message: "实体属性不能有 ? 或 ! 断言。",
                });
              }
            }
          });
        }
      },
    };
  },
};

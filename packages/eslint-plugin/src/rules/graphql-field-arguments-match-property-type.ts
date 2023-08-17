import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import * as console from "console";

import { createRule } from "../utils/createRule";

const scalarTypeAlias: Record<string, string> = {
  Boolean: "boolean",
  Int: "number",
  Float: "number",
  String: "string",
};

const astTypeAlias: Record<string, string> = {
  TSBooleanKeyword: "boolean",
  TSNumberKeyword: "number",
  TSStringKeyword: "string",
};

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "@Field() 装饰器参数需要和字段类型相符。",
    },
    fixable: "code",
    schema: [],
    messages: {
      fieldArgumentsMatchPropertyType:
        "@Field() 装饰器参数需要和字段类型相符。",
    },
  },
  defaultOptions: [{}],
  create(context) {
    return {
      ClassDeclaration(node) {
        // 检查是否有 @ObjectType 或者 @InputType 装饰器
        if (
          node.decorators.some((decorator) => {
            return (
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decorator.expression.callee.type === AST_NODE_TYPES.Identifier &&
              ["ObjectType", "InputType"].includes(
                decorator.expression.callee.name,
              )
            );
          })
        ) {
          // 遍历类属性
          node.body.body.forEach((property) => {
            // 检查是否有 @Field() 装饰器
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
              if (
                property.typeAnnotation?.type ===
                  AST_NODE_TYPES.TSTypeAnnotation &&
                property.typeAnnotation.typeAnnotation.type ===
                  AST_NODE_TYPES.TSUnionType &&
                propertyDecorator.expression.type ===
                  AST_NODE_TYPES.CallExpression &&
                propertyDecorator.expression.arguments[0]?.type !==
                  AST_NODE_TYPES.ArrowFunctionExpression
              ) {
                const typeAnnotation =
                  property.typeAnnotation.typeAnnotation.types.find(
                    (item) =>
                      ![
                        AST_NODE_TYPES.TSNullKeyword,
                        AST_NODE_TYPES.TSUndefinedKeyword,
                      ].includes(item.type),
                  );

                if (typeof typeAnnotation !== "undefined") {
                  const propertyTypeAnnotationHasNullType =
                    property.typeAnnotation.typeAnnotation.types.some(
                      (item) => item.type === AST_NODE_TYPES.TSNullKeyword,
                    );

                  const propertyTypeName =
                    astTypeAlias[typeAnnotation.type] ??
                    (typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
                    typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier
                      ? typeAnnotation.typeName.name
                      : typeAnnotation.type);

                  console.log(
                    "typeAnnotation",
                    propertyTypeAnnotationHasNullType,
                    propertyTypeName,
                  );

                  const expectedScalarType =
                    Object.entries(scalarTypeAlias).find(
                      ([, value]) => value === propertyTypeName,
                    )?.[0] ?? propertyTypeName;

                  context.report({
                    node: property,
                    messageId: "fieldArgumentsMatchPropertyType",
                    fix: (fixer) => {
                      const fixes = [];

                      if (["Int", "Float"].includes(expectedScalarType)) {
                        fixes.push(
                          fixer.insertTextBeforeRange(
                            [0, 0],
                            `import { ${expectedScalarType} } from "@nestjs/graphql";\n`,
                          ),
                        );
                      }

                      fixes.push(
                        fixer.replaceText(
                          propertyDecorator,
                          `@Field(() => ${expectedScalarType}${
                            propertyTypeAnnotationHasNullType
                              ? ", { nullable: true }"
                              : ""
                          })`,
                        ),
                      );

                      return fixes;
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

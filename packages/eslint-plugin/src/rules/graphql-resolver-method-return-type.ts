import { AST_NODE_TYPES } from "@typescript-eslint/utils";

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
      description: "GraphQL 解决器的方法装饰器类型需要和返回类型需要一致",
    },
    fixable: "code",
    schema: [],
    messages: {
      resolveMethodReturnType: "解决器的方法装饰器类型需要和返回类型需要一致",
    },
  },
  defaultOptions: [{}],
  create(context) {
    return {
      ClassDeclaration(node) {
        // 检查是否有 @Resolver 装饰器
        if (
          node.decorators.some((decorator) => {
            return (
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decorator.expression.callee.type === AST_NODE_TYPES.Identifier &&
              decorator.expression.callee.name === "Resolver"
            );
          })
        ) {
          // 遍历类属性
          node.body.body.forEach((method) => {
            // 仅检查方法
            if (method.type === AST_NODE_TYPES.MethodDefinition) {
              const isAsync = method.value.async;

              const methodDecorator = method.decorators.find((decorator) => {
                return (
                  decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                  decorator.expression.callee.type ===
                    AST_NODE_TYPES.Identifier &&
                  ["Query", "Mutation", "ResolveField"].includes(
                    decorator.expression.callee.name,
                  )
                );
              });

              // 检查是否有 @Query, @Mutation, @ResolveField 装饰器
              if (typeof methodDecorator === "undefined") {
                return;
              }

              const methodDecoratorExpression = methodDecorator.expression;

              if (
                methodDecoratorExpression.type ===
                  AST_NODE_TYPES.CallExpression &&
                methodDecoratorExpression.arguments[0]?.type ===
                  AST_NODE_TYPES.ArrowFunctionExpression
              ) {
                let actualReturnTypeAnnotation =
                  method.value.returnType?.typeAnnotation ?? null;
                const expectedReturnTypeFunctionBody =
                  methodDecoratorExpression.arguments[0].body;

                const isNullable =
                  methodDecoratorExpression.arguments[1]?.type ===
                    AST_NODE_TYPES.ObjectExpression &&
                  methodDecoratorExpression.arguments[1]?.properties?.some(
                    (prop) => {
                      return (
                        prop.type === AST_NODE_TYPES.Property &&
                        prop.key.type === AST_NODE_TYPES.Identifier &&
                        prop.key.name === "nullable" &&
                        prop.value.type === AST_NODE_TYPES.Literal &&
                        prop.value.value === true
                      );
                    },
                  );

                // 如果没有定义返回类型，或者返回类型不是标识符，跳过检查
                if (
                  typeof expectedReturnTypeFunctionBody === "undefined" ||
                  expectedReturnTypeFunctionBody.type !==
                    AST_NODE_TYPES.Identifier
                ) {
                  return;
                }

                // 获取期望返回类型
                const expectedReturnType =
                  scalarTypeAlias[expectedReturnTypeFunctionBody.name] ??
                  expectedReturnTypeFunctionBody.name;

                // 获取实际返回类型
                let actualReturnType: string | null = null;
                let actualHasPromise = false;
                let actualHasNullable = false;

                if (
                  actualReturnTypeAnnotation?.type ===
                    AST_NODE_TYPES.TSTypeReference &&
                  actualReturnTypeAnnotation.typeName.type ===
                    AST_NODE_TYPES.Identifier &&
                  actualReturnTypeAnnotation.typeName.name === "Promise"
                ) {
                  actualHasPromise = true;
                  actualReturnTypeAnnotation =
                    actualReturnTypeAnnotation.typeArguments?.params[0] ?? null;
                }

                if (
                  actualReturnTypeAnnotation?.type ===
                  AST_NODE_TYPES.TSUnionType
                ) {
                  actualHasNullable = actualReturnTypeAnnotation.types.some(
                    ({ type }) => type === AST_NODE_TYPES.TSNullKeyword,
                  );

                  actualReturnTypeAnnotation =
                    actualReturnTypeAnnotation.types.find(
                      ({ type }) => type !== AST_NODE_TYPES.TSNullKeyword,
                    ) ?? null;
                }

                if (actualReturnTypeAnnotation !== null) {
                  actualReturnType =
                    astTypeAlias[actualReturnTypeAnnotation.type] ??
                    (actualReturnTypeAnnotation.type ===
                      AST_NODE_TYPES.TSTypeReference &&
                    actualReturnTypeAnnotation.typeName.type ===
                      AST_NODE_TYPES.Identifier
                      ? actualReturnTypeAnnotation.typeName.name
                      : actualReturnTypeAnnotation.type);
                }

                // 如果期望返回类型和实际返回类型不一致，则报告错误。
                if (
                  expectedReturnType !== actualReturnType ||
                  isNullable !== actualHasNullable ||
                  isAsync !== actualHasPromise
                ) {
                  context.report({
                    node: method,
                    messageId: "resolveMethodReturnType",
                    fix: (fixer) => {
                      const fixes = [];

                      let returnTypeString = expectedReturnType;

                      if (isNullable) {
                        returnTypeString += " | null";
                      }

                      if (isAsync) {
                        returnTypeString = `Promise<${returnTypeString}>`;
                      }

                      if (
                        typeof method.value.returnType === "undefined" ||
                        actualReturnType === null
                      ) {
                        if (
                          method.value.type ===
                          AST_NODE_TYPES.FunctionExpression
                        ) {
                          fixes.push(
                            fixer.insertTextBefore(
                              method.value.body,
                              `: ${returnTypeString} `,
                            ),
                          );
                        }
                      } else {
                        fixes.push(
                          fixer.replaceText(
                            method.value.returnType.typeAnnotation,
                            returnTypeString,
                          ),
                        );
                      }

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

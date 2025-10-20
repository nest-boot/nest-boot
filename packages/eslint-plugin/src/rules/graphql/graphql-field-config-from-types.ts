import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import type { RuleFixer } from "@typescript-eslint/utils/ts-eslint";

import { createRule } from "../../utils/createRule";
import {
  getPropertyDecorator,
  hasClassDecorator,
} from "../../utils/decorators";

// 自定义 Fix 对象类型,用于延迟应用修复
interface CustomFix {
  type: "insert" | "replace";
  range: readonly [number, number];
  text: string;
}

interface TypeInfo {
  typeName: string | null;
  isArray: boolean;
  isNullable: boolean;
}

export type DecoratorBehavior = "ignore" | "remove";

export interface Options {
  decorators?: Record<string, DecoratorBehavior>;
}

export default createRule<
  [Options],
  "alignFieldDecoratorWithTsType" | "removeFieldDecorator"
>({
  name: "graphql-field-config-from-types",
  meta: {
    type: "problem",
    docs: {
      description:
        "根据 TypeScript 类型自动生成或修正 @Field 装饰器的类型与 nullable 配置（支持数组）。",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          decorators: {
            type: "object",
            additionalProperties: {
              type: "string",
              enum: ["ignore", "remove"],
            },
            description:
              "配置每个装饰器的行为。ignore: 跳过检查；remove: 移除 @Field。默认：{ HideField: 'remove', OneToOne: 'remove', OneToMany: 'remove', ManyToOne: 'remove', ManyToMany: 'remove' }",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      alignFieldDecoratorWithTsType:
        "@Field 装饰器应与 TypeScript 类型保持一致（类型与 nullable）。",
      removeFieldDecorator:
        "属性带有 @{{decoratorName}} 装饰器，应移除 @Field 装饰器。",
    },
  },
  defaultOptions: [
    {
      decorators: {
        HideField: "remove",
        OneToOne: "remove",
        OneToMany: "remove",
        ManyToOne: "remove",
        ManyToMany: "remove",
      },
    },
  ],
  create(context, [options]) {
    const source = context.sourceCode;

    const scalarFromTsKeyword = (
      typeNodeType: AST_NODE_TYPES,
    ): string | null => {
      switch (typeNodeType) {
        case AST_NODE_TYPES.TSBooleanKeyword:
          return "Boolean";
        case AST_NODE_TYPES.TSStringKeyword:
          return "String";
        case AST_NODE_TYPES.TSNumberKeyword:
          // 默认 number → Float（GraphQL 默认也是 Float；Int 需显式声明）
          return "Float";
        default:
          return null;
      }
    };

    const getIdentifierName = (node: TSESTree.TypeNode): string | null => {
      if (
        node.type === AST_NODE_TYPES.TSTypeReference &&
        node.typeName.type === AST_NODE_TYPES.Identifier
      ) {
        return node.typeName.name;
      }
      return null;
    };

    const extractArrayElementType = (
      node: TSESTree.TypeNode,
    ): TSESTree.TypeNode | null => {
      if (node.type === AST_NODE_TYPES.TSArrayType) {
        return node.elementType;
      }
      if (
        node.type === AST_NODE_TYPES.TSTypeReference &&
        node.typeName.type === AST_NODE_TYPES.Identifier &&
        node.typeName.name === "Array"
      ) {
        return node.typeArguments?.params[0] ?? null;
      }
      return null;
    };

    const computeTypeInfo = (
      property: TSESTree.PropertyDefinition,
    ): TypeInfo | null => {
      let isNullable = false;
      let isArray = false;

      let baseTypeNode: TSESTree.TypeNode | null =
        property.typeAnnotation?.type === AST_NODE_TYPES.TSTypeAnnotation
          ? property.typeAnnotation.typeAnnotation
          : null;

      // 可选属性（?）视为可空
      if (property.optional) {
        isNullable = true;
      }

      // 处理联合类型中的 null/undefined
      if (baseTypeNode?.type === AST_NODE_TYPES.TSUnionType) {
        const hasNullish = baseTypeNode.types.some((t: TSESTree.TypeNode) => {
          return (
            t.type === AST_NODE_TYPES.TSNullKeyword ||
            t.type === AST_NODE_TYPES.TSUndefinedKeyword
          );
        });
        if (hasNullish) isNullable = true;

        baseTypeNode =
          baseTypeNode.types.find((t: TSESTree.TypeNode) => {
            return (
              t.type !== AST_NODE_TYPES.TSNullKeyword &&
              t.type !== AST_NODE_TYPES.TSUndefinedKeyword
            );
          }) ?? null;
      }

      // 先解包 Ref<T> 和 Opt<T> → T，并在内部再次处理 null/undefined
      if (
        baseTypeNode?.type === AST_NODE_TYPES.TSTypeReference &&
        baseTypeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        (baseTypeNode.typeName.name === "Ref" ||
          baseTypeNode.typeName.name === "Opt")
      ) {
        let inner = baseTypeNode.typeArguments?.params[0] ?? null;
        if (inner && inner.type === AST_NODE_TYPES.TSUnionType) {
          const hasNullish = inner.types.some((t: TSESTree.TypeNode) => {
            return (
              t.type === AST_NODE_TYPES.TSNullKeyword ||
              t.type === AST_NODE_TYPES.TSUndefinedKeyword
            );
          });
          if (hasNullish) isNullable = true;
          inner =
            inner.types.find((t: TSESTree.TypeNode) => {
              return (
                t.type !== AST_NODE_TYPES.TSNullKeyword &&
                t.type !== AST_NODE_TYPES.TSUndefinedKeyword
              );
            }) ?? inner;
        }
        baseTypeNode = inner ?? baseTypeNode;
      }

      // 数组类型（T[] 或 Array<T>）- 在解包 Opt/Ref 之后检查
      const elementTypeNode = baseTypeNode
        ? extractArrayElementType(baseTypeNode)
        : null;
      if (elementTypeNode) {
        isArray = true;
      }

      const targetTypeNode: TSESTree.TypeNode | null =
        elementTypeNode ?? baseTypeNode;

      // 无显式类型时，尝试从字面量初始值推断
      if (!targetTypeNode) {
        if (property.value?.type === AST_NODE_TYPES.Literal) {
          const value = property.value.value;
          const typeOf = typeof value;
          if (typeOf === "boolean")
            return { typeName: "Boolean", isArray, isNullable };
          if (typeOf === "number")
            return { typeName: "Float", isArray, isNullable };
          if (typeOf === "string")
            return { typeName: "String", isArray, isNullable };
        }
        return null;
      }

      // id 字段优先使用 GraphQL 标量 ID
      const propertyName =
        property.key.type === AST_NODE_TYPES.Identifier
          ? property.key.name
          : null;

      if (
        propertyName === "id" ||
        (typeof propertyName === "string" &&
          (propertyName.endsWith("Id") || propertyName.endsWith("ID")))
      ) {
        return { typeName: "ID", isArray, isNullable };
      }

      // Record<*, *> → GraphQLJSONObject（不限制键值类型）
      if (
        targetTypeNode.type === AST_NODE_TYPES.TSTypeReference &&
        targetTypeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        targetTypeNode.typeName.name === "Record"
      ) {
        return { typeName: "GraphQLJSONObject", isArray, isNullable };
      }

      // 关键字类型 → GraphQL 标量
      const scalar = scalarFromTsKeyword(targetTypeNode.type);
      if (scalar) {
        return { typeName: scalar, isArray, isNullable };
      }

      // 标识符（类/自定义类型）
      const ident = getIdentifierName(targetTypeNode);
      if (ident) {
        return { typeName: ident, isArray, isNullable };
      }

      return null;
    };

    const ensureScalarImport = (fixes: CustomFix[], expected: string) => {
      if (["Int", "Float", "ID"].includes(expected)) {
        if (
          !context.sourceCode.text.includes(
            `import { ${expected} } from "@nestjs/graphql"`,
          )
        ) {
          fixes.push({
            type: "insert",
            range: [0, 0],
            text: `import { ${expected} } from "@nestjs/graphql";\n`,
          });
        }
      }
    };

    const ensureJSONObjectImport = (fixes: CustomFix[]) => {
      const hasImport =
        context.sourceCode.text.includes(`from "graphql-type-json"`) &&
        context.sourceCode.text.includes("GraphQLJSONObject");
      if (!hasImport) {
        fixes.push({
          type: "insert",
          range: [0, 0],
          text: `import { GraphQLJSONObject } from "graphql-type-json";\n`,
        });
      }
    };

    const addFieldDecorator = (
      property: TSESTree.PropertyDefinition,
      info: TypeInfo,
    ) => {
      const fixes: CustomFix[] = [];

      const typeName = info.typeName ?? "";
      const typeExpr = info.isArray
        ? `() => [${typeName}]`
        : `() => ${typeName}`;
      const optionsExpr = info.isNullable ? ", { nullable: true }" : "";

      const newDecoratorText = `@Field(${typeExpr}${optionsExpr})`;

      ensureScalarImport(fixes, info.typeName ?? "");
      if (info.typeName === "GraphQLJSONObject") {
        ensureJSONObjectImport(fixes);
      }

      fixes.push({
        type: "insert",
        range: property.range,
        text: newDecoratorText + "\n  ",
      });

      return fixes;
    };

    const fixWithTypeInfo = (
      property: TSESTree.PropertyDefinition,
      fieldDecorator: TSESTree.Decorator,
      info: TypeInfo,
    ) => {
      const fixes: CustomFix[] = [];

      const typeName = info.typeName ?? "";
      const typeExpr = info.isArray
        ? `() => [${typeName}]`
        : `() => ${typeName}`;

      // 提取现有的配置选项（除了 nullable）
      const callExpr = fieldDecorator.expression;
      const existingOptions: string[] = [];

      // 检查是否有现有的配置对象
      let optionsArg: TSESTree.ObjectExpression | null = null;
      if (
        callExpr.type === AST_NODE_TYPES.CallExpression &&
        callExpr.arguments.length > 0
      ) {
        // 如果第一个参数是对象表达式（没有 type function）
        if (
          callExpr.arguments[0] &&
          callExpr.arguments[0].type === AST_NODE_TYPES.ObjectExpression
        ) {
          optionsArg = callExpr.arguments[0];
        }
        // 如果第二个参数是对象表达式（有 type function）
        else if (
          callExpr.arguments[1] &&
          callExpr.arguments[1].type === AST_NODE_TYPES.ObjectExpression
        ) {
          optionsArg = callExpr.arguments[1];
        }
      }

      // 提取现有选项，同时处理 nullable
      let hasNullableProperty = false;
      if (optionsArg) {
        optionsArg.properties.forEach((prop: TSESTree.ObjectLiteralElement) => {
          // 处理展开运算符 (SpreadElement)
          if (prop.type === AST_NODE_TYPES.SpreadElement) {
            const propText = source.getText(prop);
            existingOptions.push(propText);
            return;
          }
          // 处理普通属性 (Property)
          if (
            prop.key.type === AST_NODE_TYPES.Identifier &&
            prop.key.name === "nullable"
          ) {
            hasNullableProperty = true;
            // 根据类型决定是否保留或更新 nullable
            if (info.isNullable) {
              existingOptions.push("nullable: true");
            }
            // 如果不需要 nullable，则跳过（不保留）
          } else {
            // 保留原有的其他配置
            const propText = source.getText(prop);
            existingOptions.push(propText);
          }
        });
      }

      // 如果需要 nullable 但原配置中没有，则添加到最前面
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (info.isNullable && !hasNullableProperty) {
        existingOptions.unshift("nullable: true");
      }

      // 构建新的装饰器文本
      const optionsExpr =
        existingOptions.length > 0 ? `, { ${existingOptions.join(", ")} }` : "";
      const newDecoratorText = `@Field(${typeExpr}${optionsExpr})`;

      ensureScalarImport(fixes, info.typeName ?? "");
      if (info.typeName === "GraphQLJSONObject") {
        ensureJSONObjectImport(fixes);
      }

      fixes.push({
        type: "replace",
        range: fieldDecorator.range,
        text: newDecoratorText,
      });

      return fixes;
    };

    const applyFixes = (fixer: RuleFixer, fixes: CustomFix[]) => {
      return fixes.map((fix) => {
        if (fix.type === "replace") {
          return fixer.replaceTextRange(fix.range, fix.text);
        } else {
          return fixer.insertTextBeforeRange(fix.range, fix.text);
        }
      });
    };

    const isGraphqlModelClass = (node: TSESTree.ClassDeclaration): boolean => {
      return hasClassDecorator(node, ["ObjectType", "InputType", "ArgsType"]);
    };

    return {
      ClassDeclaration(node) {
        if (!isGraphqlModelClass(node)) return;

        node.body.body.forEach((member: TSESTree.ClassElement) => {
          if (member.type !== AST_NODE_TYPES.PropertyDefinition) return;

          const decoratorConfig = options.decorators ?? {
            HideField: "remove",
            OneToOne: "remove",
            OneToMany: "remove",
            ManyToOne: "remove",
            ManyToMany: "remove",
          };

          // 检查是否有配置的装饰器
          let foundDecoratorName: string | null = null;
          let foundBehavior: DecoratorBehavior | null = null;

          for (const decorator of member.decorators) {
            if (
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decorator.expression.callee.type === AST_NODE_TYPES.Identifier
            ) {
              const decoratorName = decorator.expression.callee.name;
              if (decoratorName in decoratorConfig) {
                foundDecoratorName = decoratorName;
                foundBehavior = decoratorConfig[decoratorName];
                break;
              }
            }
          }

          // 如果是 ignore 行为，直接跳过
          if (foundBehavior === "ignore") return;

          const fieldDecorator = getPropertyDecorator(member, "Field");

          // 如果是 remove 行为且有 @Field，则移除 @Field
          if (foundBehavior === "remove" && fieldDecorator) {
            context.report({
              node: fieldDecorator,
              messageId: "removeFieldDecorator",
              data: {
                decoratorName: foundDecoratorName ?? "unknown",
              },
              fix: (fixer) => {
                // 移除整个装饰器行（包括换行）
                const decoratorStart = fieldDecorator.range[0];
                const decoratorEnd = fieldDecorator.range[1];

                // 查找装饰器后的换行符和空格
                const textAfter = source.text.slice(
                  decoratorEnd,
                  decoratorEnd + 10,
                );
                const matchNewline = /^(\r?\n\s*)/.exec(textAfter);
                const endPos = matchNewline
                  ? decoratorEnd + matchNewline[0].length
                  : decoratorEnd;

                return fixer.removeRange([decoratorStart, endPos]);
              },
            });
            return;
          }

          // 如果是 remove 行为但没有 @Field，跳过
          if (foundBehavior === "remove") return;

          const typeInfo = computeTypeInfo(member);
          if (!typeInfo?.typeName) return;

          // 如果没有 @Field 装饰器，添加它
          if (!fieldDecorator) {
            context.report({
              node: member,
              messageId: "alignFieldDecoratorWithTsType",
              fix: (fixer) => {
                const fixes = addFieldDecorator(member, typeInfo);
                return applyFixes(fixer, fixes);
              },
            });
            return;
          }

          // 若已有 ArrowFunction 但与期望不一致，也进行修正
          const callExpr = fieldDecorator.expression;
          if (callExpr.type !== AST_NODE_TYPES.CallExpression) return;

          let needReport = true;

          if (
            callExpr.arguments.length > 0 &&
            callExpr.arguments[0].type === AST_NODE_TYPES.ArrowFunctionExpression
          ) {
            const firstArg = callExpr.arguments[0];
            const calleeText = source.getText(firstArg.body);
            const expectedTypeText = typeInfo.isArray
              ? `[${typeInfo.typeName}]`
              : typeInfo.typeName;

            const hasNullableOption =
              callExpr.arguments.length > 1 &&
              callExpr.arguments[1].type === AST_NODE_TYPES.ObjectExpression &&
              callExpr.arguments[1].properties.some(
                (prop: TSESTree.ObjectLiteralElement) => {
                  return (
                    prop.type === AST_NODE_TYPES.Property &&
                    prop.key.type === AST_NODE_TYPES.Identifier &&
                    prop.key.name === "nullable" &&
                    prop.value.type === AST_NODE_TYPES.Literal &&
                    prop.value.value === true
                  );
                },
              );

            // 对于 number 类型，Int 和 Float 都是合法的
            const isNumberType = typeInfo.typeName === "Float";
            const actualTypeText = calleeText.replace(/^\[|\]$/g, ""); // 移除数组括号
            const isValidNumberType =
              isNumberType &&
              (actualTypeText === "Int" || actualTypeText === "Float");

            const typeMatches =
              calleeText === expectedTypeText || isValidNumberType;

            if (typeMatches && hasNullableOption === typeInfo.isNullable) {
              needReport = false;
            }
          }

          if (!needReport) return;

          context.report({
            node: member,
            messageId: "alignFieldDecoratorWithTsType",
            fix: (fixer) => {
              const fixes = fixWithTypeInfo(member, fieldDecorator, typeInfo);
              return applyFixes(fixer, fixes);
            },
          });
        });
      },
    };
  },
});

import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import type { RuleFixer } from "@typescript-eslint/utils/ts-eslint";

import { createRule } from "../../utils/createRule";
import {
  getPropertyDecorator,
  hasClassDecorator,
} from "../../utils/decorators";

// Custom Fix object type for deferred fix application
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
        "Automatically generate or fix @Field decorator type and nullable configuration based on TypeScript types (with array support).",
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
              "Configure behavior for each decorator. ignore: skip checks; remove: remove @Field. Default: { HideField: 'remove', OneToOne: 'remove', OneToMany: 'remove', ManyToOne: 'remove', ManyToMany: 'remove' }",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      alignFieldDecoratorWithTsType:
        "@Field decorator should align with the TypeScript type (type and nullable).",
      removeFieldDecorator:
        "Property has a @{{decoratorName}} decorator, @Field decorator should be removed.",
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
          // Default number → Float (GraphQL default is also Float; Int must be declared explicitly)
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

      // Optional property (?) is treated as nullable
      if (property.optional) {
        isNullable = true;
      }

      // Handle null/undefined in union types
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

      // First unwrap Ref<T> and Opt<T> → T, and handle null/undefined within
      if (
        baseTypeNode?.type === AST_NODE_TYPES.TSTypeReference &&
        baseTypeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        (baseTypeNode.typeName.name === "Ref" ||
          baseTypeNode.typeName.name === "Opt")
      ) {
        let inner = baseTypeNode.typeArguments?.params[0] ?? null;
        if (inner?.type === AST_NODE_TYPES.TSUnionType) {
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

      // Array type (T[] or Array<T>) - checked after unwrapping Opt/Ref
      const elementTypeNode = baseTypeNode
        ? extractArrayElementType(baseTypeNode)
        : null;
      if (elementTypeNode) {
        isArray = true;
      }

      const targetTypeNode: TSESTree.TypeNode | null =
        elementTypeNode ?? baseTypeNode;

      // When no explicit type, try to infer from literal initializer
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

      // id field prefers GraphQL scalar ID
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

      // Record<*, *> → GraphQLJSONObject (no restriction on key/value types)
      if (
        targetTypeNode.type === AST_NODE_TYPES.TSTypeReference &&
        targetTypeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        targetTypeNode.typeName.name === "Record"
      ) {
        return { typeName: "GraphQLJSONObject", isArray, isNullable };
      }

      // Keyword types → GraphQL scalars
      const scalar = scalarFromTsKeyword(targetTypeNode.type);
      if (scalar) {
        return { typeName: scalar, isArray, isNullable };
      }

      // Identifier (class/custom type)
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

      // Extract existing config options (except nullable)
      const callExpr = fieldDecorator.expression;
      const existingOptions: string[] = [];

      // Check if there is an existing config object
      let optionsArg: TSESTree.ObjectExpression | null = null;
      if (
        callExpr.type === AST_NODE_TYPES.CallExpression &&
        callExpr.arguments.length > 0
      ) {
        // If the first argument is an object expression (no type function)
        if (callExpr.arguments[0]?.type === AST_NODE_TYPES.ObjectExpression) {
          optionsArg = callExpr.arguments[0];
        }
        // If the second argument is an object expression (has type function)
        else if (
          callExpr.arguments[1]?.type === AST_NODE_TYPES.ObjectExpression
        ) {
          optionsArg = callExpr.arguments[1];
        }
      }

      // Extract existing options, while handling nullable
      let hasNullableProperty = false;
      if (optionsArg) {
        optionsArg.properties.forEach((prop: TSESTree.ObjectLiteralElement) => {
          // Handle spread elements (SpreadElement)
          if (prop.type === AST_NODE_TYPES.SpreadElement) {
            const propText = source.getText(prop);
            existingOptions.push(propText);
            return;
          }
          // Handle regular properties (Property)
          if (
            prop.key.type === AST_NODE_TYPES.Identifier &&
            prop.key.name === "nullable"
          ) {
            hasNullableProperty = true;
            // Decide whether to keep or update nullable based on type
            if (info.isNullable) {
              existingOptions.push("nullable: true");
            }
            // If nullable is not needed, skip (don't keep)
          } else {
            // Keep other existing config options
            const propText = source.getText(prop);
            existingOptions.push(propText);
          }
        });
      }

      // If nullable is needed but not in original config, prepend it
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (info.isNullable && !hasNullableProperty) {
        existingOptions.unshift("nullable: true");
      }

      // Build the new decorator text
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

          // Check if the property has a configured decorator
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

          // If behavior is "ignore", skip directly
          if (foundBehavior === "ignore") return;

          const fieldDecorator = getPropertyDecorator(member, "Field");

          // If behavior is "remove" and has @Field, remove @Field
          if (foundBehavior === "remove" && fieldDecorator) {
            context.report({
              node: fieldDecorator,
              messageId: "removeFieldDecorator",
              data: {
                decoratorName: foundDecoratorName ?? "unknown",
              },
              fix: (fixer) => {
                // Remove the entire decorator line (including newline)
                const decoratorStart = fieldDecorator.range[0];
                const decoratorEnd = fieldDecorator.range[1];

                // Find the newline and whitespace after the decorator
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

          // If behavior is "remove" but no @Field, skip
          if (foundBehavior === "remove") return;

          const typeInfo = computeTypeInfo(member);
          if (!typeInfo?.typeName) return;

          // If there is no @Field decorator, add one
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

          // If there is an existing ArrowFunction but it doesn't match expectations, fix it
          const callExpr = fieldDecorator.expression;
          if (callExpr.type !== AST_NODE_TYPES.CallExpression) return;

          let needReport = true;

          if (
            callExpr.arguments.length > 0 &&
            callExpr.arguments[0].type ===
              AST_NODE_TYPES.ArrowFunctionExpression
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

            // For number types, both Int and Float are valid
            const isNumberType = typeInfo.typeName === "Float";
            const actualTypeText = calleeText.replace(/^\[|\]$/g, ""); // Remove array brackets
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

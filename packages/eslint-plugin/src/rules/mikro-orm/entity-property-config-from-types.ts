import {
  AST_NODE_TYPES,
  ESLintUtils,
  TSESTree,
} from "@typescript-eslint/utils";
import type { RuleFix, RuleFixer } from "@typescript-eslint/utils/ts-eslint";
import * as ts from "typescript";

import { createRule } from "../../utils/createRule";
import { hasClassDecorator } from "../../utils/decorators";

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
  isEnum: boolean; // Whether the type is an enum
  propertyType: string | null; // MikroORM type such as t.text, t.bigint, etc.
  arrayElementTypeName?: string | null; // Type name of array elements (for special validation)
}

export default createRule<
  [],
  | "alignPropertyDecoratorWithTsType"
  | "removePropertyDecorator"
  | "useEnumDecorator"
  | "useOptTypeForInitializedProperty"
  | "removeOptTypeForNonInitializedProperty"
>({
  name: "entity-property-config-from-types",
  meta: {
    type: "problem",
    docs: {
      description:
        "Automatically generate or fix @Property decorator type and nullable configuration based on TypeScript types (with array support), as well as @Enum decorator nullable configuration. Checks whether properties with initializers use the Opt<T> type.",
    },
    fixable: "code",
    schema: [],
    messages: {
      alignPropertyDecoratorWithTsType:
        "@Property decorator should align with the TypeScript type (type and nullable).",
      removePropertyDecorator:
        "Property has a @{{decoratorName}} decorator, @Property decorator should be removed.",
      useEnumDecorator:
        "Enum types should use @Enum decorator instead of @Property decorator.",
      useOptTypeForInitializedProperty:
        "Properties with non-null initializers should use the Opt<T> type wrapper.",
      removeOptTypeForNonInitializedProperty:
        "Properties without initializers or initialized to null should not use the Opt<T> type wrapper.",
    },
  },
  defaultOptions: [],
  create(context) {
    const source = context.sourceCode;
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    // Check if the type is an enum
    const isEnumType = (node: TSESTree.Node): boolean => {
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const type = checker.getTypeAtLocation(tsNode);

        // Check if it is an enum type
        if (type.symbol.flags & ts.SymbolFlags.Enum) {
          return true;
        }

        // Check each member in a union type
        if (type.isUnion()) {
          return type.types.some(
            (t) =>
              t.symbol.flags & ts.SymbolFlags.EnumMember ||
              t.symbol.flags & ts.SymbolFlags.Enum,
          );
        }

        return false;
      } catch {
        return false;
      }
    };

    const getPropertyType = (typeName: string | null): string | null => {
      if (!typeName) return null;

      switch (typeName) {
        case "String":
        case "string":
          return "t.string"; // Default to t.string
        case "Number":
        case "number":
          return "t.float"; // Default to t.float
        case "Boolean":
        case "boolean":
          return "t.boolean"; // Default to t.boolean
        case "Date":
          return "t.datetime"; // Default to t.datetime
        case "GraphQLJSONObject":
        case "Record":
          return "t.json";
        default:
          return null;
      }
    };

    const isValidStringType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // Accept t.string, t.text, t.uuid, t.decimal, t.bigint
      if (
        typeConfig === "t.string" ||
        typeConfig === "t.text" ||
        typeConfig === "t.uuid" ||
        typeConfig === "t.decimal" ||
        typeConfig === "t.bigint"
      ) {
        return true;
      }

      // Accept DecimalType (class reference, without arguments)
      if (typeConfig === "DecimalType") {
        return true;
      }

      // Accept new DecimalType('string') and new BigIntType('string')
      // but exclude new BigIntType('number')
      if (
        typeConfig.includes("DecimalType") ||
        typeConfig.includes("BigIntType")
      ) {
        // If it's new BigIntType('number'), it's invalid
        if (
          typeConfig.includes("BigIntType") &&
          (typeConfig.includes("'number'") || typeConfig.includes('"number"'))
        ) {
          return false;
        }
        // Other cases (including new XXXType('string') and DecimalType) are valid
        return true;
      }

      return false;
    };

    const isValidNumberType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // Accept t.integer, t.float, t.double, t.decimal
      if (
        typeConfig === "t.integer" ||
        typeConfig === "t.float" ||
        typeConfig === "t.double" ||
        typeConfig === "t.decimal"
      ) {
        return true;
      }

      // Accept BigIntType and DecimalType (class reference, without arguments)
      if (typeConfig === "BigIntType" || typeConfig === "DecimalType") {
        return true;
      }

      // Accept new DecimalType('number') and new BigIntType('number')
      // but exclude new XXXType('string')
      if (
        typeConfig.includes("DecimalType") ||
        typeConfig.includes("BigIntType")
      ) {
        // If it contains 'string', it's invalid for number type
        if (
          typeConfig.includes("'string'") ||
          typeConfig.includes('"string"')
        ) {
          return false;
        }
        // Other cases (including new XXXType('number')) are valid
        return true;
      }

      return false;
    };

    const isValidNumberArrayType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // Accept t.array (default)
      if (typeConfig === "t.array") {
        return true;
      }

      // Accept VectorType (class reference)
      if (typeConfig === "VectorType") {
        return true;
      }

      // Accept new VectorType(...)
      if (typeConfig.includes("VectorType")) {
        return true;
      }

      return false;
    };

    const isValidDateType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // Accept t.datetime, t.date, t.time
      if (
        typeConfig === "t.datetime" ||
        typeConfig === "t.date" ||
        typeConfig === "t.time"
      ) {
        return true;
      }

      return false;
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

    const isCollectionType = (node: TSESTree.TypeNode): boolean => {
      return (
        node.type === AST_NODE_TYPES.TSTypeReference &&
        node.typeName.type === AST_NODE_TYPES.Identifier &&
        node.typeName.name === "Collection"
      );
    };

    // Check if the type is wrapped with Opt<T>
    const isWrappedWithOpt = (
      property: TSESTree.PropertyDefinition,
    ): boolean => {
      const typeAnnotation = property.typeAnnotation;
      if (typeAnnotation?.type !== AST_NODE_TYPES.TSTypeAnnotation) {
        return false;
      }

      const typeNode = typeAnnotation.typeAnnotation;
      return (
        typeNode.type === AST_NODE_TYPES.TSTypeReference &&
        typeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        typeNode.typeName.name === "Opt"
      );
    };

    // Check if Opt is imported
    const hasOptImport = (): boolean => {
      const program = context.sourceCode.ast;
      for (const statement of program.body) {
        if (statement.type === AST_NODE_TYPES.ImportDeclaration) {
          const importSource = statement.source.value;
          // Check imports from @mikro-orm/*
          if (
            typeof importSource === "string" &&
            importSource.startsWith("@mikro-orm/")
          ) {
            const hasOpt = statement.specifiers.some(
              (spec: TSESTree.ImportClause) => {
                return (
                  spec.type === AST_NODE_TYPES.ImportSpecifier &&
                  spec.imported.type === AST_NODE_TYPES.Identifier &&
                  spec.imported.name === "Opt"
                );
              },
            );
            if (hasOpt) return true;
          }
        }
      }
      return false;
    };

    // Add Opt to the @mikro-orm/core import
    const addOptImport = (fixer: RuleFixer): RuleFix | null => {
      const program = context.sourceCode.ast;

      // Find the @mikro-orm/core import statement
      let coreImport: TSESTree.ImportDeclaration | null = null;

      for (const statement of program.body) {
        if (statement.type === AST_NODE_TYPES.ImportDeclaration) {
          const importSource = statement.source.value;
          if (importSource === "@mikro-orm/core") {
            coreImport = statement;
            break;
          }
        }
      }

      if (coreImport) {
        // Already has @mikro-orm/core import, add Opt to the import list
        const lastSpecifier =
          coreImport.specifiers[coreImport.specifiers.length - 1];

        // Check if it's a multiline import
        const importText = source.getText(coreImport);
        const isMultiline = importText.includes("\n");

        if (isMultiline) {
          // Multiline import: add after the last import item, keeping indentation
          const indent = "  "; // Assuming 2-space indentation
          return fixer.insertTextAfter(lastSpecifier, `,\n${indent}Opt`);
        } else {
          // Single-line import: add directly
          return fixer.insertTextAfter(lastSpecifier, ", Opt");
        }
      } else {
        // No @mikro-orm/core import, add a new import statement at the top
        const firstImport = program.body.find(
          (node: TSESTree.ProgramStatement) =>
            node.type === AST_NODE_TYPES.ImportDeclaration,
        );

        if (firstImport) {
          return fixer.insertTextBefore(
            firstImport,
            "import { Opt } from '@mikro-orm/core';\n",
          );
        }
      }
      return null;
    };

    const computeTypeInfo = (
      property: TSESTree.PropertyDefinition,
    ): TypeInfo | null => {
      let isNullable = false;
      let isArray = false;
      let isEnum = false;

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

      // Skip Collection<T> types (these should be handled by OneToMany etc. decorators)
      if (baseTypeNode && isCollectionType(baseTypeNode)) {
        return null;
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

      // Check if target type is an enum
      if (targetTypeNode) {
        isEnum = isEnumType(targetTypeNode);
      }

      // When no explicit type, try to infer from literal initializer
      if (!targetTypeNode) {
        if (property.value?.type === AST_NODE_TYPES.Literal) {
          const value = property.value.value;
          const typeOf = typeof value;
          if (typeOf === "boolean")
            return {
              typeName: "boolean",
              isArray,
              isNullable,
              isEnum: false,
              propertyType: isArray ? "t.json" : getPropertyType("boolean"),
              arrayElementTypeName: isArray ? "boolean" : undefined,
            };
          if (typeOf === "number")
            return {
              typeName: "number",
              isArray,
              isNullable,
              isEnum: false,
              propertyType: isArray ? "t.array" : getPropertyType("number"),
              arrayElementTypeName: isArray ? "number" : undefined,
            };
          if (typeOf === "string")
            return {
              typeName: "string",
              isArray,
              isNullable,
              isEnum: false,
              propertyType: isArray ? "t.array" : getPropertyType("string"),
              arrayElementTypeName: isArray ? "string" : undefined,
            };
        }
        return null;
      }

      // Record<*, *> → t.json
      if (
        targetTypeNode.type === AST_NODE_TYPES.TSTypeReference &&
        targetTypeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        targetTypeNode.typeName.name === "Record"
      ) {
        return {
          typeName: "Record",
          isArray,
          isNullable,
          isEnum: false,
          propertyType: "t.json",
          arrayElementTypeName: isArray ? "Record" : undefined,
        };
      }

      // Keyword types
      if (targetTypeNode.type === AST_NODE_TYPES.TSStringKeyword) {
        return {
          typeName: "string",
          isArray,
          isNullable,
          isEnum: false,
          propertyType: isArray ? "t.array" : getPropertyType("string"),
          arrayElementTypeName: isArray ? "string" : undefined,
        };
      }
      if (targetTypeNode.type === AST_NODE_TYPES.TSNumberKeyword) {
        return {
          typeName: "number",
          isArray,
          isNullable,
          isEnum: false,
          propertyType: isArray ? "t.array" : getPropertyType("number"),
          arrayElementTypeName: isArray ? "number" : undefined,
        };
      }
      if (targetTypeNode.type === AST_NODE_TYPES.TSBooleanKeyword) {
        return {
          typeName: "boolean",
          isArray,
          isNullable,
          isEnum: false,
          propertyType: isArray ? "t.json" : getPropertyType("boolean"),
          arrayElementTypeName: isArray ? "boolean" : undefined,
        };
      }

      // Identifier (class/custom type)
      const ident = getIdentifierName(targetTypeNode);
      if (ident) {
        // For arrays, custom type arrays use t.json
        if (isArray) {
          return {
            typeName: ident,
            isArray,
            isNullable,
            isEnum,
            propertyType: "t.json",
            arrayElementTypeName: ident,
          };
        }

        return {
          typeName: ident,
          isArray,
          isNullable,
          isEnum,
          propertyType: getPropertyType(ident),
          arrayElementTypeName: undefined,
        };
      }

      return null;
    };

    // Wrap type with Opt<T>
    const wrapWithOpt = (typeString: string): string => {
      return `Opt<${typeString}>`;
    };

    const buildEnumDecorator = (info: TypeInfo): string => {
      const options: string[] = [];

      if (info.typeName) {
        options.push(`items: () => ${info.typeName}`);
      }

      if (info.isNullable) {
        options.push("nullable: true");
      }

      if (options.length === 0) {
        return "@Enum()";
      }

      return `@Enum({ ${options.join(", ")} })`;
    };

    const buildPropertyDecorator = (
      info: TypeInfo,
      otherProps: { key: string; value: string }[] = [],
      decoratorName = "Property",
    ): string => {
      const options: string[] = [];

      // If there is a propertyType configuration, add type
      if (info.propertyType) {
        options.push(`type: ${info.propertyType}`);
      }

      // Add other properties (keeping original order)
      for (const prop of otherProps) {
        options.push(`${prop.key}: ${prop.value}`);
      }

      if (info.isNullable) {
        options.push("nullable: true");
      }

      if (options.length === 0) {
        return `@${decoratorName}()`;
      }

      return `@${decoratorName}({ ${options.join(", ")} })`;
    };

    const addPropertyDecorator = (
      property: TSESTree.PropertyDefinition,
      info: TypeInfo,
    ) => {
      const fixes: CustomFix[] = [];

      const newDecoratorText = buildPropertyDecorator(info);

      fixes.push({
        type: "insert",
        range: property.range,
        text: newDecoratorText + "\n  ",
      });

      return fixes;
    };

    const fixWithTypeInfo = (
      property: TSESTree.PropertyDefinition,
      propertyDecorator: TSESTree.Decorator,
      info: TypeInfo,
      currentConfig: {
        type: string | null;
        nullable: boolean;
        otherProps: { key: string; value: string }[];
      },
      decoratorName = "Property",
    ) => {
      const fixes: CustomFix[] = [];

      // If current config already has a valid value, keep it instead of replacing with default
      const finalInfo = { ...info };

      // PrimaryKey number type defaults to t.integer
      if (
        decoratorName === "PrimaryKey" &&
        finalInfo.propertyType === "t.float"
      ) {
        finalInfo.propertyType = "t.integer";
      }

      if (
        info.propertyType === "t.string" &&
        isValidStringType(currentConfig.type)
      ) {
        // Keep valid string type config
        finalInfo.propertyType = currentConfig.type;
      } else if (
        (info.propertyType === "t.float" ||
          info.propertyType === "t.integer") &&
        isValidNumberType(currentConfig.type)
      ) {
        // Keep valid number type config
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.datetime" &&
        isValidDateType(currentConfig.type)
      ) {
        // Keep valid Date type config
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.isArray &&
        info.arrayElementTypeName === "number" &&
        isValidNumberArrayType(currentConfig.type)
      ) {
        // Keep valid number[] type config (VectorType)
        finalInfo.propertyType = currentConfig.type;
      }

      // Keep other property configs
      const newDecoratorText = buildPropertyDecorator(
        finalInfo,
        currentConfig.otherProps,
        decoratorName,
      );

      fixes.push({
        type: "replace",
        range: propertyDecorator.range,
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

    const isEntityClass = (node: TSESTree.ClassDeclaration): boolean => {
      return hasClassDecorator(node, "Entity");
    };

    const parsePropertyDecorator = (
      decorator: TSESTree.Decorator,
    ): {
      type: string | null;
      nullable: boolean;
      otherProps: { key: string; value: string }[];
    } => {
      const callExpr = decorator.expression;
      if (
        callExpr.type !== AST_NODE_TYPES.CallExpression ||
        callExpr.arguments.length === 0
      ) {
        return { type: null, nullable: false, otherProps: [] };
      }

      const firstArg = callExpr.arguments[0];
      if (firstArg.type !== AST_NODE_TYPES.ObjectExpression) {
        return { type: null, nullable: false, otherProps: [] };
      }

      let type: string | null = null;
      let nullable = false;
      const otherProps: { key: string; value: string }[] = [];

      for (const prop of firstArg.properties) {
        if (prop.type !== AST_NODE_TYPES.Property) continue;
        if (prop.key.type !== AST_NODE_TYPES.Identifier || !prop.key.name)
          continue;

        if (prop.key.name === "type") {
          type = source.getText(prop.value);
        } else if (prop.key.name === "nullable") {
          if (
            prop.value.type === AST_NODE_TYPES.Literal &&
            prop.value.value === true
          ) {
            nullable = true;
          }
        } else {
          // Keep all other properties
          otherProps.push({
            key: prop.key.name,
            value: source.getText(prop.value),
          });
        }
      }

      return { type, nullable, otherProps };
    };

    const parseEnumDecorator = (
      decorator: TSESTree.Decorator,
    ): {
      items: string | null;
      nullable: boolean;
    } => {
      const callExpr = decorator.expression;
      if (
        callExpr.type !== AST_NODE_TYPES.CallExpression ||
        callExpr.arguments.length === 0
      ) {
        return { items: null, nullable: false };
      }

      const firstArg = callExpr.arguments[0];
      if (firstArg.type !== AST_NODE_TYPES.ObjectExpression) {
        return { items: null, nullable: false };
      }

      let items: string | null = null;
      let nullable = false;

      for (const prop of firstArg.properties) {
        if (prop.type !== AST_NODE_TYPES.Property) continue;
        if (prop.key.type !== AST_NODE_TYPES.Identifier || !prop.key.name)
          continue;

        if (prop.key.name === "items") {
          items = source.getText(prop.value);
        } else if (prop.key.name === "nullable") {
          if (
            prop.value.type === AST_NODE_TYPES.Literal &&
            prop.value.value === true
          ) {
            nullable = true;
          }
        }
      }

      return { items, nullable };
    };

    // Check if the file uses the Opt type but hasn't imported it
    const checkOptUsageWithoutImport = (node: TSESTree.ClassDeclaration) => {
      let usesOpt = false;

      // Iterate through all members to check for Opt<T> type annotations
      node.body.body.forEach((member: TSESTree.ClassElement) => {
        if (member.type !== AST_NODE_TYPES.PropertyDefinition) return;

        const typeAnnotation = member.typeAnnotation?.typeAnnotation;
        if (!typeAnnotation) return;

        // Recursively check if the type node contains Opt
        const containsOpt = (typeNode: TSESTree.TypeNode): boolean => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!typeNode) return false;

          // Check if it's Opt<T>
          if (
            typeNode.type === AST_NODE_TYPES.TSTypeReference &&
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            typeNode.typeName?.type === AST_NODE_TYPES.Identifier &&
            typeNode.typeName.name === "Opt"
          ) {
            return true;
          }

          // Recursively check union types
          if (typeNode.type === AST_NODE_TYPES.TSUnionType) {
            return typeNode.types.some((t: TSESTree.TypeNode) =>
              containsOpt(t),
            );
          }

          // Recursively check type parameters
          if (
            typeNode.type === AST_NODE_TYPES.TSTypeReference &&
            typeNode.typeArguments?.params
          ) {
            return typeNode.typeArguments.params.some(
              (param: TSESTree.TypeNode) => containsOpt(param),
            );
          }

          // Recursively check array element type
          if (typeNode.type === AST_NODE_TYPES.TSArrayType) {
            return containsOpt(typeNode.elementType);
          }

          return false;
        };

        if (containsOpt(typeAnnotation)) {
          usesOpt = true;
        }
      });

      // If Opt is used but not imported, report an error
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (usesOpt && !hasOptImport()) {
        context.report({
          node,
          messageId: "useOptTypeForInitializedProperty",
          fix: (fixer) => {
            const importFix = addOptImport(fixer);
            return importFix ? [importFix] : [];
          },
        });
      }
    };

    return {
      ClassDeclaration(node) {
        if (!isEntityClass(node)) return;

        // First check if Opt is used but not imported
        checkOptUsageWithoutImport(node);

        node.body.body.forEach((member: TSESTree.ClassElement) => {
          if (member.type !== AST_NODE_TYPES.PropertyDefinition) return;

          // Check relation decorators (OneToOne, OneToMany, ManyToOne, ManyToMany)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const hasRelationDecorator = member.decorators?.some(
            (decorator: TSESTree.Decorator) => {
              if (
                decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                decorator.expression.callee.type === AST_NODE_TYPES.Identifier
              ) {
                const decoratorName = decorator.expression.callee.name;
                return [
                  "OneToOne",
                  "OneToMany",
                  "ManyToOne",
                  "ManyToMany",
                ].includes(decoratorName);
              }
              return false;
            },
          );

          // If there are relation decorators, skip checking (these properties don't need @Property)
          if (hasRelationDecorator) return;

          // Property-like decorators (decorators that need type checking)
          const propertyLikeDecorators = [
            "Property",
            "PrimaryKey",
            "EncryptedProperty",
            "HashedProperty",
          ];

          // Find property-like decorator
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const propertyLikeDecorator = member.decorators?.find(
            (decorator: TSESTree.Decorator) => {
              if (
                decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                decorator.expression.callee.type === AST_NODE_TYPES.Identifier
              ) {
                return propertyLikeDecorators.includes(
                  decorator.expression.callee.name,
                );
              }
              return false;
            },
          );

          // Get decorator name
          const getDecoratorName = (
            decorator: TSESTree.Decorator,
          ): string | null => {
            if (
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decorator.expression.callee.type === AST_NODE_TYPES.Identifier
            ) {
              return decorator.expression.callee.name;
            }
            return null;
          };

          // Check @Enum decorator
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const enumDecorator = member.decorators?.find(
            (decorator: TSESTree.Decorator) => {
              return (
                decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                decorator.expression.callee.type ===
                  AST_NODE_TYPES.Identifier &&
                decorator.expression.callee.name === "Enum"
              );
            },
          );

          // Use property-like decorator
          const propertyDecorator = propertyLikeDecorator;
          const currentDecoratorName = propertyDecorator
            ? getDecoratorName(propertyDecorator)
            : null;

          const typeInfo = computeTypeInfo(member);

          if (!typeInfo?.typeName) return;

          // Check initializer and Opt<T> type match
          const hasInitializer = member.value !== null;
          const isOptWrapped = isWrappedWithOpt(member);

          // Check if the initializer is null

          const isInitializedToNull =
            hasInitializer &&
            member.value?.type === AST_NODE_TYPES.Literal &&
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            member.value?.value === null;

          // Case 1: Has non-null initializer but not wrapped with Opt<T>
          if (
            hasInitializer &&
            !isInitializedToNull &&
            !isOptWrapped &&
            !member.optional
          ) {
            // Has initializer but not wrapped with Opt<T>, needs to report error
            const typeAnnotation = member.typeAnnotation?.typeAnnotation;
            const needsImport = !hasOptImport();

            if (typeAnnotation) {
              const currentTypeText = source.getText(typeAnnotation);
              const wrappedType = wrapWithOpt(currentTypeText);

              context.report({
                node: member,
                messageId: "useOptTypeForInitializedProperty",
                fix: (fixer) => {
                  const fixes = [
                    fixer.replaceText(typeAnnotation, wrappedType),
                  ];

                  // If needed, add Opt import
                  if (needsImport) {
                    const importFix = addOptImport(fixer);
                    if (importFix) fixes.push(importFix);
                  }

                  return fixes;
                },
              });
            } else if (member.value) {
              // No type annotation, infer type from initializer
              let inferredType: string | null = null;

              if (member.value.type === AST_NODE_TYPES.Literal) {
                const valueType = typeof member.value.value;
                if (valueType === "boolean") inferredType = "boolean";
                else if (valueType === "number") inferredType = "number";
                else if (valueType === "string") inferredType = "string";
              } else if (member.value.type === AST_NODE_TYPES.ArrayExpression) {
                // Empty array [] case, need to infer type from @Property decorator
                inferredType = "unknown[]";
              } else if (member.value.type === AST_NODE_TYPES.NewExpression) {
                // new Date() case
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (member.value.callee?.type === AST_NODE_TYPES.Identifier) {
                  inferredType = member.value.callee.name;
                }
              }

              if (inferredType) {
                const wrappedType = wrapWithOpt(inferredType);
                const propertyName = member.key;

                context.report({
                  node: member,
                  messageId: "useOptTypeForInitializedProperty",
                  fix: (fixer) => {
                    const fixes = [
                      fixer.insertTextAfter(propertyName, `: ${wrappedType}`),
                    ];

                    // If needed, add Opt import
                    if (needsImport) {
                      const importFix = addOptImport(fixer);
                      if (importFix) fixes.push(importFix);
                    }

                    return fixes;
                  },
                });
              }
            }
          }

          // If there is an @Enum decorator, check its configuration regardless of whether the type is recognized as enum
          if (enumDecorator) {
            const enumConfig = parseEnumDecorator(enumDecorator);

            // Check if nullable configuration matches the TypeScript type
            if (enumConfig.nullable !== typeInfo.isNullable) {
              const expectedEnumText = buildEnumDecorator(typeInfo);
              context.report({
                node: enumDecorator,
                messageId: "alignPropertyDecoratorWithTsType",
                fix: (fixer) => {
                  return fixer.replaceTextRange(
                    enumDecorator.range,
                    expectedEnumText,
                  );
                },
              });
            }
            // Properties with @Enum decorator do not need @Property decorator
            return;
          }

          // If it's an enum type but doesn't have @Enum decorator
          if (typeInfo.isEnum) {
            // If it has @Property decorator, suggest replacing with @Enum
            if (propertyDecorator) {
              context.report({
                node: propertyDecorator,
                messageId: "useEnumDecorator",
                fix: (fixer) => {
                  const newDecoratorText = buildEnumDecorator(typeInfo);
                  return fixer.replaceTextRange(
                    propertyDecorator.range,
                    newDecoratorText,
                  );
                },
              });
              return;
            }

            // If it doesn't have @Enum decorator, add one
            context.report({
              node: member,
              messageId: "useEnumDecorator",
              fix: (fixer) => {
                const newDecoratorText = buildEnumDecorator(typeInfo);
                return fixer.insertTextBeforeRange(
                  member.range,
                  newDecoratorText + "\n  ",
                );
              },
            });
            return;
          }

          // Non-enum type: if no @Property decorator, add one
          if (!propertyDecorator) {
            context.report({
              node: member,
              messageId: "alignPropertyDecoratorWithTsType",
              fix: (fixer) => {
                const fixes = addPropertyDecorator(member, typeInfo);
                return applyFixes(fixer, fixes);
              },
            });
            return;
          }

          // Check if existing decorator matches the type
          const currentConfig = parsePropertyDecorator(propertyDecorator);
          let expectedType = typeInfo.propertyType;

          // PrimaryKey number type expects t.integer
          if (
            currentDecoratorName === "PrimaryKey" &&
            expectedType === "t.float"
          ) {
            expectedType = "t.integer";
          }

          let needReport = false;

          // Check type configuration
          if (expectedType && currentConfig.type !== expectedType) {
            // For string type, accept multiple valid configurations
            if (
              expectedType === "t.string" &&
              isValidStringType(currentConfig.type)
            ) {
              // Current config is a valid string type configuration, no modification needed
            } else if (
              (expectedType === "t.float" || expectedType === "t.integer") &&
              isValidNumberType(currentConfig.type)
            ) {
              // Current config is a valid number type configuration, no modification needed
            } else if (
              expectedType === "t.datetime" &&
              isValidDateType(currentConfig.type)
            ) {
              // Current config is a valid Date type configuration, no modification needed
            } else if (
              expectedType === "t.array" &&
              typeInfo.arrayElementTypeName === "number" &&
              isValidNumberArrayType(currentConfig.type)
            ) {
              // Current config is a valid number[] type configuration (t.array or VectorType), no modification needed
            } else if (expectedType === "t.json") {
              // For t.json type (Record or custom type arrays)
              if (currentConfig.type === "t.json") {
                // t.json config is correct, no modification needed
              } else {
                needReport = true;
              }
            } else {
              needReport = true;
            }
          } else if (!expectedType && currentConfig.type) {
            // If type is not needed but currently has one, needs correction
            needReport = true;
          }

          // Check nullable configuration
          if (currentConfig.nullable !== typeInfo.isNullable) {
            needReport = true;
          }

          if (!needReport) return;

          context.report({
            node: member,
            messageId: "alignPropertyDecoratorWithTsType",
            fix: (fixer) => {
              const fixes = fixWithTypeInfo(
                member,
                propertyDecorator,
                typeInfo,
                currentConfig,
                currentDecoratorName ?? "Property",
              );
              return applyFixes(fixer, fixes);
            },
          });
        });
      },
    };
  },
});

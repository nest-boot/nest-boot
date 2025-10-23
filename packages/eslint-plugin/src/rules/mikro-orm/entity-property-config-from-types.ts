import {
  AST_NODE_TYPES,
  ESLintUtils,
  TSESTree,
} from "@typescript-eslint/utils";
import type { RuleFix, RuleFixer } from "@typescript-eslint/utils/ts-eslint";
import * as ts from "typescript";

import { createRule } from "../../utils/createRule";
import { hasClassDecorator } from "../../utils/decorators";

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
  isEnum: boolean; // 是否是枚举类型
  propertyType: string | null; // MikroORM 类型如 t.text, t.bigint 等
  arrayElementTypeName?: string | null; // 数组元素的类型名称（用于特殊验证）
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
        "根据 TypeScript 类型自动生成或修正 @Property 装饰器的类型与 nullable 配置（支持数组）,以及 @Enum 装饰器的 nullable 配置。检查有初始化值的属性是否使用 Opt<T> 类型。",
    },
    fixable: "code",
    schema: [],
    messages: {
      alignPropertyDecoratorWithTsType:
        "@Property 装饰器应与 TypeScript 类型保持一致（类型与 nullable）。",
      removePropertyDecorator:
        "属性带有 @{{decoratorName}} 装饰器，应移除 @Property 装饰器。",
      useEnumDecorator: "枚举类型应使用 @Enum 装饰器而不是 @Property 装饰器。",
      useOptTypeForInitializedProperty:
        "有非 null 初始化值的属性应使用 Opt<T> 类型包装。",
      removeOptTypeForNonInitializedProperty:
        "没有初始化值或初始化为 null 的属性不应使用 Opt<T> 类型包装。",
    },
  },
  defaultOptions: [],
  create(context) {
    const source = context.sourceCode;
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    // 检查是否为枚举类型
    const isEnumType = (node: TSESTree.Node): boolean => {
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const type = checker.getTypeAtLocation(tsNode);

        // 检查是否是枚举类型
        if (type.symbol.flags & ts.SymbolFlags.Enum) {
          return true;
        }

        // 检查联合类型中的每个成员
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
          return "t.string"; // 默认使用 t.string
        case "Number":
        case "number":
          return "t.float"; // 默认使用 t.float
        case "Boolean":
        case "boolean":
          return "t.boolean"; // 默认使用 t.boolean
        case "Date":
          return "t.datetime"; // 默认使用 t.datetime
        case "GraphQLJSONObject":
        case "Record":
          return "t.json";
        default:
          return null;
      }
    };

    const isValidStringType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // 接受 t.string, t.text, t.decimal, t.bigint
      if (
        typeConfig === "t.string" ||
        typeConfig === "t.text" ||
        typeConfig === "t.decimal" ||
        typeConfig === "t.bigint"
      ) {
        return true;
      }

      // 接受 DecimalType（类引用，不带参数）
      if (typeConfig === "DecimalType") {
        return true;
      }

      // 接受 new DecimalType('string') 和 new BigIntType('string')
      // 但排除 new BigIntType('number')
      if (
        typeConfig.includes("DecimalType") ||
        typeConfig.includes("BigIntType")
      ) {
        // 如果是 new BigIntType('number')，则无效
        if (
          typeConfig.includes("BigIntType") &&
          (typeConfig.includes("'number'") || typeConfig.includes('"number"'))
        ) {
          return false;
        }
        // 其他情况（包括 new XXXType('string') 和 DecimalType）都有效
        return true;
      }

      return false;
    };

    const isValidNumberType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // 接受 t.integer, t.float, t.double, t.decimal
      if (
        typeConfig === "t.integer" ||
        typeConfig === "t.float" ||
        typeConfig === "t.double" ||
        typeConfig === "t.decimal"
      ) {
        return true;
      }

      // 接受 BigIntType 和 DecimalType（类引用，不带参数）
      if (typeConfig === "BigIntType" || typeConfig === "DecimalType") {
        return true;
      }

      // 接受 new DecimalType('number') 和 new BigIntType('number')
      // 但排除 new XXXType('string')
      if (
        typeConfig.includes("DecimalType") ||
        typeConfig.includes("BigIntType")
      ) {
        // 如果包含 'string'，则对 number 类型无效
        if (
          typeConfig.includes("'string'") ||
          typeConfig.includes('"string"')
        ) {
          return false;
        }
        // 其他情况（包括 new XXXType('number')）都有效
        return true;
      }

      return false;
    };

    const isValidNumberArrayType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // 接受 t.array（默认）
      if (typeConfig === "t.array") {
        return true;
      }

      // 接受 VectorType（类引用）
      if (typeConfig === "VectorType") {
        return true;
      }

      // 接受 new VectorType(...)
      if (typeConfig.includes("VectorType")) {
        return true;
      }

      return false;
    };

    const isValidDateType = (typeConfig: string | null): boolean => {
      if (!typeConfig) return false;

      // 接受 t.datetime, t.date, t.time
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

    // 检查类型是否被 Opt<T> 包装
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

    // 检查是否已导入 Opt
    const hasOptImport = (): boolean => {
      const program = context.sourceCode.ast;
      for (const statement of program.body) {
        if (statement.type === AST_NODE_TYPES.ImportDeclaration) {
          const importSource = statement.source.value;
          // 检查从 @mikro-orm/* 导入的语句
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

    // 添加 Opt 到 @mikro-orm/core 的导入
    const addOptImport = (fixer: RuleFixer): RuleFix | null => {
      const program = context.sourceCode.ast;

      // 查找 @mikro-orm/core 的导入语句
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
        // 已有 @mikro-orm/core 导入,添加 Opt 到导入列表
        const lastSpecifier =
          coreImport.specifiers[coreImport.specifiers.length - 1];

        // 检查是否是多行导入
        const importText = source.getText(coreImport);
        const isMultiline = importText.includes("\n");

        if (isMultiline) {
          // 多行导入:在最后一个导入项后添加,保持缩进
          const indent = "  "; // 假设使用 2 个空格缩进
          return fixer.insertTextAfter(lastSpecifier, `,\n${indent}Opt`);
        } else {
          // 单行导入:直接添加
          return fixer.insertTextAfter(lastSpecifier, ", Opt");
        }
      } else {
        // 没有 @mikro-orm/core 导入,在文件开头添加新的导入语句
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

      // 跳过 Collection<T> 类型（这些应该由 OneToMany 等装饰器处理）
      if (baseTypeNode && isCollectionType(baseTypeNode)) {
        return null;
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

      // 检查目标类型是否为枚举
      if (targetTypeNode) {
        isEnum = isEnumType(targetTypeNode);
      }

      // 无显式类型时，尝试从字面量初始值推断
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

      // 关键字类型
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

      // 标识符（类/自定义类型）
      const ident = getIdentifierName(targetTypeNode);
      if (ident) {
        // 如果是数组，自定义类型数组使用 t.json
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

    // 将类型包装为 Opt<T>
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
    ): string => {
      const options: string[] = [];

      // 如果有 propertyType 配置，添加 type
      if (info.propertyType) {
        options.push(`type: ${info.propertyType}`);
      }

      // 添加其他属性（保持原有顺序）
      for (const prop of otherProps) {
        options.push(`${prop.key}: ${prop.value}`);
      }

      if (info.isNullable) {
        options.push("nullable: true");
      }

      if (options.length === 0) {
        return "@Property()";
      }

      return `@Property({ ${options.join(", ")} })`;
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
    ) => {
      const fixes: CustomFix[] = [];

      // 如果当前已经有有效的配置，保留它而不是替换成默认值
      const finalInfo = { ...info };
      if (
        info.propertyType === "t.string" &&
        isValidStringType(currentConfig.type)
      ) {
        // 保留有效的 string 类型配置
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.float" &&
        isValidNumberType(currentConfig.type)
      ) {
        // 保留有效的 number 类型配置
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.datetime" &&
        isValidDateType(currentConfig.type)
      ) {
        // 保留有效的 Date 类型配置
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.isArray &&
        info.arrayElementTypeName === "number" &&
        isValidNumberArrayType(currentConfig.type)
      ) {
        // 保留有效的 number[] 类型配置（VectorType）
        finalInfo.propertyType = currentConfig.type;
      }

      // 保留其他属性配置
      const newDecoratorText = buildPropertyDecorator(
        finalInfo,
        currentConfig.otherProps,
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
          // 保留其他所有属性
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

    // 检查文件中是否使用了 Opt 类型但没有导入
    const checkOptUsageWithoutImport = (node: TSESTree.ClassDeclaration) => {
      let usesOpt = false;

      // 遍历所有成员，检查是否有使用 Opt<T> 的类型注解
      node.body.body.forEach((member: TSESTree.ClassElement) => {
        if (member.type !== AST_NODE_TYPES.PropertyDefinition) return;

        const typeAnnotation = member.typeAnnotation?.typeAnnotation;
        if (!typeAnnotation) return;

        // 递归检查类型节点中是否包含 Opt
        const containsOpt = (typeNode: TSESTree.TypeNode): boolean => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!typeNode) return false;

          // 检查是否是 Opt<T>
          if (
            typeNode.type === AST_NODE_TYPES.TSTypeReference &&
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            typeNode.typeName?.type === AST_NODE_TYPES.Identifier &&
            typeNode.typeName.name === "Opt"
          ) {
            return true;
          }

          // 递归检查联合类型
          if (typeNode.type === AST_NODE_TYPES.TSUnionType) {
            return typeNode.types.some((t: TSESTree.TypeNode) =>
              containsOpt(t),
            );
          }

          // 递归检查类型参数
          if (
            typeNode.type === AST_NODE_TYPES.TSTypeReference &&
            typeNode.typeArguments?.params
          ) {
            return typeNode.typeArguments.params.some(
              (param: TSESTree.TypeNode) => containsOpt(param),
            );
          }

          // 递归检查数组元素类型
          if (typeNode.type === AST_NODE_TYPES.TSArrayType) {
            return containsOpt(typeNode.elementType);
          }

          return false;
        };

        if (containsOpt(typeAnnotation)) {
          usesOpt = true;
        }
      });

      // 如果使用了 Opt 但没有导入，报告错误
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

        // 首先检查是否使用了 Opt 但没有导入
        checkOptUsageWithoutImport(node);

        node.body.body.forEach((member: TSESTree.ClassElement) => {
          if (member.type !== AST_NODE_TYPES.PropertyDefinition) return;

          // 检查关系装饰器（PrimaryKey, OneToOne, OneToMany, ManyToOne, ManyToMany）
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const hasRelationDecorator = member.decorators?.some(
            (decorator: TSESTree.Decorator) => {
              if (
                decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                decorator.expression.callee.type === AST_NODE_TYPES.Identifier
              ) {
                const decoratorName = decorator.expression.callee.name;
                return [
                  "PrimaryKey",
                  "OneToOne",
                  "OneToMany",
                  "ManyToOne",
                  "ManyToMany",
                ].includes(decoratorName);
              }
              return false;
            },
          );

          // 如果有关系装饰器，跳过检查（这些属性不需要 @Property 装饰器）
          if (hasRelationDecorator) return;

          // 检查 @Enum 装饰器
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

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const propertyDecorator = member.decorators?.find(
            (decorator: TSESTree.Decorator) => {
              return (
                decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                decorator.expression.callee.type ===
                  AST_NODE_TYPES.Identifier &&
                decorator.expression.callee.name === "Property"
              );
            },
          );

          const typeInfo = computeTypeInfo(member);

          if (!typeInfo?.typeName) return;

          // 检查初始化值和 Opt<T> 类型的匹配
          const hasInitializer = member.value !== null;
          const isOptWrapped = isWrappedWithOpt(member);

          // 检查初始化值是否为 null

          const isInitializedToNull =
            hasInitializer &&
            member.value?.type === AST_NODE_TYPES.Literal &&
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            member.value?.value === null;

          // 情况 1：有非 null 初始化值但没有使用 Opt<T>
          if (
            hasInitializer &&
            !isInitializedToNull &&
            !isOptWrapped &&
            !member.optional
          ) {
            // 有初始化值但没有使用 Opt<T> 包装，需要报错
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

                  // 如果需要，添加 Opt 导入
                  if (needsImport) {
                    const importFix = addOptImport(fixer);
                    if (importFix) fixes.push(importFix);
                  }

                  return fixes;
                },
              });
            } else if (member.value) {
              // 没有类型注解，从初始化值推断类型
              let inferredType: string | null = null;

              if (member.value.type === AST_NODE_TYPES.Literal) {
                const valueType = typeof member.value.value;
                if (valueType === "boolean") inferredType = "boolean";
                else if (valueType === "number") inferredType = "number";
                else if (valueType === "string") inferredType = "string";
              } else if (member.value.type === AST_NODE_TYPES.ArrayExpression) {
                // 空数组 [] 的情况,需要从 @Property 装饰器推断类型
                inferredType = "unknown[]";
              } else if (member.value.type === AST_NODE_TYPES.NewExpression) {
                // new Date() 的情况
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

                    // 如果需要，添加 Opt 导入
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

          // 如果有 @Enum 装饰器，无论是否识别为枚举类型，都检查其配置
          if (enumDecorator) {
            const enumConfig = parseEnumDecorator(enumDecorator);

            // 检查 nullable 配置是否与 TypeScript 类型匹配
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
            // 有 @Enum 装饰器的属性，不需要 @Property 装饰器
            return;
          }

          // 如果是枚举类型但没有 @Enum 装饰器
          if (typeInfo.isEnum) {
            // 如果有 @Property 装饰器，建议替换为 @Enum
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

            // 如果没有 @Enum 装饰器，添加它
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

          // 非枚举类型：如果没有 @Property 装饰器，添加它
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

          // 检查现有 @Property 装饰器是否与类型匹配
          const currentConfig = parsePropertyDecorator(propertyDecorator);
          const expectedType = typeInfo.propertyType;

          let needReport = false;

          // 检查 type 配置
          if (expectedType && currentConfig.type !== expectedType) {
            // 对于 string 类型，接受多种有效配置
            if (
              expectedType === "t.string" &&
              isValidStringType(currentConfig.type)
            ) {
              // 当前配置是有效的 string 类型配置，不需要修改
            } else if (
              expectedType === "t.float" &&
              isValidNumberType(currentConfig.type)
            ) {
              // 当前配置是有效的 number 类型配置，不需要修改
            } else if (
              expectedType === "t.datetime" &&
              isValidDateType(currentConfig.type)
            ) {
              // 当前配置是有效的 Date 类型配置，不需要修改
            } else if (
              expectedType === "t.array" &&
              typeInfo.arrayElementTypeName === "number" &&
              isValidNumberArrayType(currentConfig.type)
            ) {
              // 当前配置是有效的 number[] 类型配置（t.array 或 VectorType），不需要修改
            } else if (expectedType === "t.json") {
              // 对于 t.json 类型（Record 或自定义类型数组）
              if (currentConfig.type === "t.json") {
                // t.json 配置正确，不需要修改
              } else {
                needReport = true;
              }
            } else {
              needReport = true;
            }
          } else if (!expectedType && currentConfig.type) {
            // 如果不需要 type 但当前有 type，也需要修正
            needReport = true;
          }

          // 检查 nullable 配置
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
              );
              return applyFixes(fixer, fixes);
            },
          });
        });
      },
    };
  },
});

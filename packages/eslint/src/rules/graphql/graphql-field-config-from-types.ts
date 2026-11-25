import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import type { RuleFix, RuleFixer } from "@typescript-eslint/utils/ts-eslint";
import * as ts from "typescript";

import { createRule } from "../../utils/createRule.js";
import {
  hasNamedImport,
  importedBindingName,
  isTypeOnlyImportReference,
  namedImportBinding,
  namedImportEdits,
  promoteImportReferences,
} from "../../utils/named-imports.js";

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
  isCustomType?: boolean;
  typeReference?: TSESTree.Node;
  targetTypeNode?: TSESTree.TypeNode;
  fullTypeNode?: TSESTree.TypeNode;
  isWholeValueScalar?: boolean;
  scalarExpression?: string;
}

export type DecoratorBehavior = "ignore" | "remove";

export interface Options {
  decorators?: Record<string, DecoratorBehavior>;
}

export default createRule<
  [Options],
  "alignFieldDecoratorWithTsType" | "removeFieldDecorator"
>({
  name: "graphql/field-config-from-types",
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
    let importLocation: TSESTree.Node = source.ast;
    const ormModules = [
      "@mikro-orm/core",
      "@mikro-orm/decorators/legacy",
      ...source.ast.body.flatMap((node) =>
        node.type === AST_NODE_TYPES.ImportDeclaration &&
        node.source.value.startsWith("@mikro-orm/")
          ? [node.source.value]
          : [],
      ),
    ];
    const ormTypeName = (name: TSESTree.Node) =>
      importedBindingName(source, ormModules, name);

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
        node.type === AST_NODE_TYPES.TSTypeOperator &&
        node.operator === "readonly" &&
        node.typeAnnotation?.type === AST_NODE_TYPES.TSArrayType
      ) {
        return node.typeAnnotation.elementType;
      }
      if (
        node.type === AST_NODE_TYPES.TSTypeReference &&
        node.typeName.type === AST_NODE_TYPES.Identifier &&
        (node.typeName.name === "Array" ||
          node.typeName.name === "ReadonlyArray")
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
        if (hasNullish) {
          isNullable = true;
        }

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
        (ormTypeName(baseTypeNode.typeName) === "Ref" ||
          ormTypeName(baseTypeNode.typeName) === "Opt")
      ) {
        let inner = baseTypeNode.typeArguments?.params[0] ?? null;
        if (inner?.type === AST_NODE_TYPES.TSUnionType) {
          const hasNullish = inner.types.some((t: TSESTree.TypeNode) => {
            return (
              t.type === AST_NODE_TYPES.TSNullKeyword ||
              t.type === AST_NODE_TYPES.TSUndefinedKeyword
            );
          });
          if (hasNullish) {
            isNullable = true;
          }
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
          if (typeOf === "boolean") {
            return { typeName: "Boolean", isArray, isNullable };
          }
          if (typeOf === "number") {
            return { typeName: "Float", isArray, isNullable };
          }
          if (typeOf === "string") {
            return { typeName: "String", isArray, isNullable };
          }
        }
        return null;
      }

      // id field prefers GraphQL scalar ID
      const propertyName =
        property.key.type === AST_NODE_TYPES.Identifier
          ? property.key.name
          : null;

      const fullTypeNode = baseTypeNode ?? undefined;

      if (
        propertyName === "id" ||
        (typeof propertyName === "string" &&
          (propertyName.endsWith("Id") || propertyName.endsWith("ID")))
      ) {
        return {
          typeName: "ID",
          isArray,
          isNullable,
          targetTypeNode,
          fullTypeNode,
        };
      }

      // Record<*, *> → GraphQLJSONObject (no restriction on key/value types)
      if (
        targetTypeNode.type === AST_NODE_TYPES.TSTypeReference &&
        targetTypeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        targetTypeNode.typeName.name === "Record"
      ) {
        return {
          typeName: "GraphQLJSONObject",
          isArray,
          isNullable,
          targetTypeNode,
          fullTypeNode,
        };
      }

      // Keyword types → GraphQL scalars
      const scalar = scalarFromTsKeyword(targetTypeNode.type);
      if (scalar) {
        return {
          typeName: scalar,
          isArray,
          isNullable,
          targetTypeNode,
          fullTypeNode,
        };
      }

      // Identifier (class/custom type)
      const ident = getIdentifierName(targetTypeNode);
      if (ident) {
        return {
          typeName: ident,
          isArray,
          isNullable,
          isCustomType: true,
          targetTypeNode,
          fullTypeNode,
          typeReference:
            targetTypeNode.type === AST_NODE_TYPES.TSTypeReference
              ? targetTypeNode.typeName
              : undefined,
        };
      }

      return null;
    };

    const parserServices = source.parserServices;
    const program = parserServices?.program;
    const esTreeNodeToTSNodeMap = parserServices?.esTreeNodeToTSNodeMap;
    const checker = program?.getTypeChecker();

    const builtInJsConstructors = new Set([
      "Number",
      "String",
      "Boolean",
      "Date",
      "Array",
      "Object",
      "Function",
      "Symbol",
      "BigInt",
    ]);

    const unwrapTypeAssertions = (node: TSESTree.Node): TSESTree.Node => {
      let current = node;
      while (
        current.type === AST_NODE_TYPES.TSAsExpression ||
        current.type === AST_NODE_TYPES.TSTypeAssertion ||
        current.type === AST_NODE_TYPES.TSSatisfiesExpression ||
        current.type === AST_NODE_TYPES.TSNonNullExpression
      ) {
        current = current.expression;
      }
      return current;
    };

    const isUnusableType = (type: ts.Type): boolean => {
      return (
        (type.flags &
          (ts.TypeFlags.Any |
            ts.TypeFlags.Unknown |
            ts.TypeFlags.Never |
            ts.TypeFlags.Void)) !==
        0
      );
    };

    const areTypesEquivalent = (a: ts.Type, b: ts.Type): boolean => {
      if (!checker || isUnusableType(a) || isUnusableType(b)) {
        return false;
      }
      return (
        checker.isTypeAssignableTo(a, b) && checker.isTypeAssignableTo(b, a)
      );
    };

    const hasClassSymbol = (type: ts.Type): boolean => {
      return Boolean(type.symbol && type.symbol.flags & ts.SymbolFlags.Class);
    };

    const isPrimitiveEnumValueType = (type: ts.Type): boolean => {
      if (!checker || isUnusableType(type)) {
        return false;
      }
      if (type.isUnion()) {
        return (
          type.types.length > 0 && type.types.every(isPrimitiveEnumValueType)
        );
      }
      if (
        type.flags &
        (ts.TypeFlags.StringLike |
          ts.TypeFlags.NumberLike |
          ts.TypeFlags.EnumLike)
      ) {
        return true;
      }
      const constraint = checker.getBaseConstraintOfType(type);
      return constraint !== undefined && constraint !== type
        ? isPrimitiveEnumValueType(constraint)
        : false;
    };

    const collectLiteralValues = (
      type: ts.Type,
    ): Set<string | number> | null => {
      if (type.isUnion()) {
        if (type.types.length === 0) {
          return null;
        }
        const values = new Set<string | number>();
        for (const member of type.types) {
          const memberValues = collectLiteralValues(member);
          if (!memberValues) {
            return null;
          }
          for (const value of memberValues) {
            values.add(value);
          }
        }
        return values;
      }
      if (type.isStringLiteral() || type.isNumberLiteral()) {
        return new Set([type.value]);
      }
      return null;
    };

    const literalSetsEqual = (
      left: Set<string | number> | null,
      right: Set<string | number> | null,
    ): boolean => {
      if (!left || !right || left.size === 0 || left.size !== right.size) {
        return false;
      }
      for (const value of left) {
        if (!right.has(value)) {
          return false;
        }
      }
      return true;
    };

    const extractGraphQLScalarInternalType = (
      type: ts.Type,
      visited = new Set<ts.Type>(),
    ): ts.Type | null => {
      if (!checker || visited.has(type)) {
        return null;
      }
      visited.add(type);
      if (
        type.symbol?.name === "GraphQLScalarType" &&
        type.flags & ts.TypeFlags.Object &&
        (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
      ) {
        const internal = checker.getTypeArguments(type as ts.TypeReference)[0];
        return internal && !isUnusableType(internal) ? internal : null;
      }
      if (type.isClassOrInterface()) {
        for (const base of checker.getBaseTypes(type)) {
          const found = extractGraphQLScalarInternalType(base, visited);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const extractConstructedInstanceType = (
      type: ts.Type,
      location: ts.Node,
    ): ts.Type | null => {
      if (!checker) {
        return null;
      }
      const constructSignatures = checker.getSignaturesOfType(
        type,
        ts.SignatureKind.Construct,
      );
      if (constructSignatures.length > 0) {
        const returnType = constructSignatures[0].getReturnType();
        return !isUnusableType(returnType) ? returnType : null;
      }

      // Constructor-like intersections such as MikroORM's EntityClass<T> = Function & { prototype: T }
      const members = type.isIntersection() ? type.types : [type];
      const isFunctionLike =
        checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0 ||
        members.some((member) => member.symbol?.name === "Function");
      if (!isFunctionLike) {
        return null;
      }
      for (const member of members) {
        if (member.symbol?.name === "Function") {
          continue;
        }
        const proto = checker.getPropertyOfType(member, "prototype");
        if (!proto) {
          continue;
        }
        const protoType = checker.getTypeOfSymbolAtLocation(proto, location);
        if (!isUnusableType(protoType)) {
          return protoType;
        }
      }
      return null;
    };

    const resolveAliasedSymbol = (node: ts.Node): ts.Symbol | undefined => {
      if (!checker) {
        return undefined;
      }
      const raw = checker.getSymbolAtLocation(node);
      return raw && raw.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(raw)
        : raw;
    };

    const matchesMappedRecordAliasValue = (
      exprType: ts.Type,
      propType: ts.Type,
      propTypeNode: ts.TypeNode,
    ): boolean => {
      if (!checker) {
        return false;
      }
      const aliasDecl = exprType.aliasSymbol?.declarations?.find(
        ts.isTypeAliasDeclaration,
      );
      if (
        !aliasDecl ||
        !ts.isTypeReferenceNode(aliasDecl.type) ||
        !ts.isIdentifier(aliasDecl.type.typeName) ||
        aliasDecl.type.typeName.text !== "Record" ||
        aliasDecl.type.typeArguments?.length !== 2
      ) {
        return false;
      }

      const valueTypeNode = aliasDecl.type.typeArguments[1];
      const declaredValueType = checker.getTypeFromTypeNode(valueTypeNode);
      if (
        !isPrimitiveEnumValueType(declaredValueType) ||
        !isPrimitiveEnumValueType(propType)
      ) {
        return false;
      }
      if (!aliasDecl.typeParameters?.length) {
        return areTypesEquivalent(propType, declaredValueType);
      }
      if (!ts.isTypeReferenceNode(valueTypeNode)) {
        return false;
      }

      const targetSym = resolveAliasedSymbol(valueTypeNode.typeName);
      if (!targetSym) {
        return false;
      }

      // If TypeScript expanded the property alias (e.g. to Extract<...>), inspect its AST type reference.
      let propAliasSym = propType.aliasSymbol;
      let propArgs = propType.aliasTypeArguments;
      if (targetSym !== propAliasSym && ts.isTypeReferenceNode(propTypeNode)) {
        const refSym = resolveAliasedSymbol(propTypeNode.typeName);
        if (refSym === targetSym) {
          propAliasSym = refSym;
          propArgs = (propTypeNode.typeArguments ?? []).map((arg) =>
            checker.getTypeFromTypeNode(arg),
          );
        }
      }
      if (targetSym !== propAliasSym) {
        return false;
      }

      const declaredParams = aliasDecl.typeParameters;
      const instantiatedArgs = exprType.aliasTypeArguments ?? [];
      const valueArgNodes = valueTypeNode.typeArguments ?? [];
      const actualPropArgs = propArgs ?? [];
      if (
        declaredParams.length !== instantiatedArgs.length ||
        valueArgNodes.length !== actualPropArgs.length
      ) {
        return false;
      }

      const paramMap = new Map<ts.Symbol, ts.Type>();
      declaredParams.forEach((param, index) => {
        const paramSym = checker.getSymbolAtLocation(param.name);
        if (paramSym) {
          paramMap.set(paramSym, instantiatedArgs[index]);
        }
      });

      return valueArgNodes.every((argNode, index) => {
        const argSym =
          ts.isTypeReferenceNode(argNode) && !argNode.typeArguments?.length
            ? checker.getSymbolAtLocation(argNode.typeName)
            : undefined;
        const substituted =
          (argSym ? paramMap.get(argSym) : undefined) ??
          checker.getTypeFromTypeNode(argNode);
        return areTypesEquivalent(substituted, actualPropArgs[index]);
      });
    };

    const matchesEnumObjectType = (
      exprType: ts.Type,
      propType: ts.Type,
      location: ts.Node,
      propTypeNode: ts.TypeNode,
    ): boolean => {
      if (!checker) {
        return false;
      }

      // 1. TypeScript enum declaration (e.g. enum Status { ACTIVE = "ACTIVE" })
      if (exprType.symbol && exprType.symbol.flags & ts.SymbolFlags.Enum) {
        const declared = checker.getDeclaredTypeOfSymbol(exprType.symbol);
        if (areTypesEquivalent(propType, declared)) {
          return true;
        }
        const enumValues = new Set<string | number>();
        let allLiterals = true;
        for (const prop of checker.getPropertiesOfType(exprType)) {
          if (!(prop.flags & ts.SymbolFlags.EnumMember)) {
            continue;
          }
          const memberType = checker.getTypeOfSymbolAtLocation(prop, location);
          if (memberType.isStringLiteral() || memberType.isNumberLiteral()) {
            enumValues.add(memberType.value);
          } else {
            allLiterals = false;
            break;
          }
        }
        if (allLiterals) {
          return literalSetsEqual(enumValues, collectLiteralValues(propType));
        }
        return false;
      }

      // 2. Runtime enum object map (Record<string, string>, OrderFieldType<Entity>, or `as const` map)
      if (!(exprType.flags & ts.TypeFlags.Object)) {
        return false;
      }
      if (
        checker.isArrayType(exprType) ||
        checker.isTupleType(exprType) ||
        hasClassSymbol(exprType) ||
        checker.getSignaturesOfType(exprType, ts.SignatureKind.Construct)
          .length > 0 ||
        checker.getSignaturesOfType(exprType, ts.SignatureKind.Call).length > 0
      ) {
        return false;
      }
      if (
        [
          "Date",
          "RegExp",
          "Map",
          "Set",
          "Promise",
          "GraphQLScalarType",
        ].includes(exprType.symbol?.name ?? "")
      ) {
        return false;
      }

      // 2a. Concrete string index signature (e.g. Record<string, string>)
      const stringIndexType = checker.getIndexTypeOfType(
        exprType,
        ts.IndexKind.String,
      );
      if (stringIndexType) {
        return (
          isPrimitiveEnumValueType(stringIndexType) &&
          areTypesEquivalent(propType, stringIndexType)
        );
      }

      // 2b. Generic mapped type (e.g. Record<K, V> or OrderFieldType<Entity> = Record<OrderFieldKey<T>, OrderFieldValue<T>>)
      const objectFlags = (exprType as ts.ObjectType).objectFlags;
      if (objectFlags & ts.ObjectFlags.Mapped) {
        if (
          exprType.aliasSymbol?.name === "Record" &&
          exprType.aliasTypeArguments?.length === 2
        ) {
          const valType = exprType.aliasTypeArguments[1];
          return (
            isPrimitiveEnumValueType(valType) &&
            areTypesEquivalent(propType, valType)
          );
        }
        return matchesMappedRecordAliasValue(exprType, propType, propTypeNode);
      }

      // 2c. Plain `as const` enum object literal (e.g. const Status = { OPEN: "open", CLOSED: "closed" } as const)
      const properties = checker.getPropertiesOfType(exprType);
      if (properties.length > 0) {
        const objectValues = new Set<string | number>();
        for (const prop of properties) {
          const memberType = checker.getTypeOfSymbolAtLocation(prop, location);
          if (memberType.isStringLiteral() || memberType.isNumberLiteral()) {
            objectValues.add(memberType.value);
          } else {
            return false;
          }
        }
        return literalSetsEqual(objectValues, collectLiteralValues(propType));
      }

      return false;
    };

    const resolveRuntimeExpressionType = (tsExpr: ts.Node): ts.Type | null => {
      if (!checker) {
        return null;
      }
      let exprType = checker.getTypeAtLocation(tsExpr);
      if (isUnusableType(exprType)) {
        const sym = checker.getSymbolAtLocation(tsExpr);
        if (sym) {
          const resolved =
            sym.flags & ts.SymbolFlags.Alias
              ? checker.getAliasedSymbol(sym)
              : sym;
          exprType = checker.getTypeOfSymbolAtLocation(resolved, tsExpr);
        }
      }
      return isUnusableType(exprType) ? null : exprType;
    };

    const resolveCustomReturnTypes = (
      innerExprNode: TSESTree.Node,
      typeNode: TSESTree.TypeNode,
    ): {
      tsExpr: ts.Node;
      tsTarget: ts.TypeNode;
      exprType: ts.Type;
      propType: ts.Type;
    } | null => {
      if (!checker || !esTreeNodeToTSNodeMap) {
        return null;
      }
      const unwrapped = unwrapTypeAssertions(innerExprNode);
      if (
        unwrapped.type === AST_NODE_TYPES.Identifier &&
        builtInJsConstructors.has(unwrapped.name) &&
        !hasResolvedBinding(unwrapped)
      ) {
        return null;
      }
      const importedScalar = importedBindingName(
        source,
        [...graphqlModules, jsonModule],
        unwrapped,
      );
      if (
        importedScalar &&
        ["Int", "Float", "ID", "GraphQLJSONObject"].includes(importedScalar)
      ) {
        return null;
      }
      const tsExpr = esTreeNodeToTSNodeMap.get(unwrapped);
      const tsTarget = esTreeNodeToTSNodeMap.get(typeNode);
      if (!ts.isTypeNode(tsTarget)) {
        return null;
      }
      const exprType = resolveRuntimeExpressionType(tsExpr);
      const propType = checker.getNonNullableType(
        checker.getTypeFromTypeNode(tsTarget),
      );
      if (!exprType || isUnusableType(propType)) {
        return null;
      }
      return { tsExpr, tsTarget, exprType, propType };
    };

    const matchesGraphqlReturnType = (
      innerExprNode: TSESTree.Node,
      targetTypeNode: TSESTree.TypeNode,
      scalarOnly = false,
    ): boolean => {
      const resolved = resolveCustomReturnTypes(innerExprNode, targetTypeNode);
      if (!resolved) {
        return false;
      }
      const { tsExpr, tsTarget, exprType, propType } = resolved;

      // A. Custom GraphQLScalarType<TInternal, TExternal>
      const scalarInternalType = extractGraphQLScalarInternalType(exprType);
      if (scalarInternalType) {
        return areTypesEquivalent(propType, scalarInternalType);
      }
      if (scalarOnly) {
        return false;
      }

      // B. Runtime class / Type<T> / EntityClass<T>
      const instanceType = extractConstructedInstanceType(exprType, tsExpr);
      if (instanceType) {
        if (
          hasClassSymbol(instanceType) &&
          hasClassSymbol(propType) &&
          instanceType.symbol !== propType.symbol
        ) {
          return false;
        }
        return areTypesEquivalent(propType, instanceType);
      }

      // C. TypeScript enum or GraphQL enum object map
      return matchesEnumObjectType(exprType, propType, tsExpr, tsTarget);
    };

    const isTypeOnlySymbol = (node?: TSESTree.Node): boolean => {
      if (!node || !checker || !esTreeNodeToTSNodeMap) {
        return false;
      }
      const sym = resolveAliasedSymbol(esTreeNodeToTSNodeMap.get(node));
      return sym !== undefined && (sym.flags & ts.SymbolFlags.Value) === 0;
    };

    const graphqlModules = ["@nestjs/graphql", "@nest-boot/graphql"];
    const jsonModule = "graphql-type-json";
    const scalarModules = (name: string) =>
      name === "GraphQLJSONObject" ? jsonModule : graphqlModules;
    const scalarBinding = (name: string): string =>
      ["Int", "Float", "ID", "GraphQLJSONObject"].includes(name)
        ? namedImportBinding(source, scalarModules(name), name, importLocation)
        : name;
    const typeBinding = (info: TypeInfo) =>
      info.scalarExpression ??
      (info.isCustomType
        ? (info.typeName ?? "")
        : scalarBinding(info.typeName ?? ""));
    const fieldBinding = () =>
      namedImportBinding(source, graphqlModules, "Field", importLocation);
    const decoratorName = (name: TSESTree.Node) =>
      importedBindingName(source, graphqlModules, name);

    // Origin checks already verify imports and const namespace destructures.
    // A resolved binding distinguishes those values from supported ambient names.
    const hasResolvedBinding = (node: TSESTree.Node) => {
      const identifier =
        node.type === AST_NODE_TYPES.MemberExpression ? node.object : node;
      return (source.scopeManager?.scopes ?? []).some((scope) =>
        scope.references.some(
          (reference) =>
            reference.identifier === identifier && reference.resolved !== null,
        ),
      );
    };

    const ensureImports = (
      fixes: CustomFix[],
      info: TypeInfo,
      includeField = true,
    ) => {
      const expected =
        info.isCustomType || info.scalarExpression ? "" : (info.typeName ?? "");
      const names = [
        ...(includeField ? ["Field"] : []),
        ...(["Int", "Float", "ID"].includes(expected) ? [expected] : []),
      ];
      const edits = namedImportEdits(
        source,
        graphqlModules,
        names,
        true,
        importLocation,
      );
      if (expected === "GraphQLJSONObject") {
        edits.push(
          ...namedImportEdits(
            source,
            jsonModule,
            [expected],
            true,
            importLocation,
          ),
        );
      }
      fixes.push(
        ...edits.map((edit) => ({ ...edit, type: "replace" as const })),
      );
    };

    const customTypeImportEdits = (info: TypeInfo): RuleFix[] =>
      info.typeReference
        ? promoteImportReferences(source, [info.typeReference])
        : [];

    const addFieldDecorator = (
      property: TSESTree.PropertyDefinition,
      info: TypeInfo,
    ) => {
      const fixes: CustomFix[] = [];

      const typeName = typeBinding(info);
      const typeExpr =
        info.isArray && !info.isWholeValueScalar
          ? `() => [${typeName}]`
          : `() => ${typeName}`;
      const optionsExpr = info.isNullable ? ", { nullable: true }" : "";

      const newDecoratorText = `@${fieldBinding()}(${typeExpr}${optionsExpr})`;

      ensureImports(fixes, info);

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

      const typeName = typeBinding(info);
      const typeExpr =
        info.isArray && !info.isWholeValueScalar
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
      if (info.isNullable && !hasNullableProperty) {
        existingOptions.unshift("nullable: true");
      }

      // Build the new decorator text
      const optionsExpr =
        existingOptions.length > 0 ? `, { ${existingOptions.join(", ")} }` : "";
      const existingField =
        callExpr.type === AST_NODE_TYPES.CallExpression &&
        hasResolvedBinding(callExpr.callee) &&
        !isTypeOnlyImportReference(source, callExpr.callee)
          ? source.getText(callExpr.callee)
          : null;
      const newDecoratorText = `@${existingField ?? fieldBinding()}(${typeExpr}${optionsExpr})`;

      ensureImports(fixes, info, existingField === null);

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
      return node.decorators.some(
        (decorator) =>
          decorator.expression.type === AST_NODE_TYPES.CallExpression &&
          ["ObjectType", "InputType", "ArgsType"].includes(
            decoratorName(decorator.expression.callee) ?? "",
          ),
      );
    };

    return {
      ClassDeclaration(node) {
        if (!isGraphqlModelClass(node)) {
          return;
        }
        importLocation = node;
        const modelImports = promoteImportReferences(
          source,
          node.decorators.flatMap((decorator) =>
            decorator.expression.type === AST_NODE_TYPES.CallExpression &&
            decoratorName(decorator.expression.callee) !== null
              ? [decorator.expression.callee]
              : [],
          ),
        );
        if (modelImports.length) {
          context.report({
            node,
            messageId: "alignFieldDecoratorWithTsType",
            fix: () => modelImports,
          });
          return;
        }

        node.body.body.forEach((member: TSESTree.ClassElement) => {
          if (
            member.type !== AST_NODE_TYPES.PropertyDefinition ||
            member.static
          ) {
            return;
          }

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
            if (decorator.expression.type === AST_NODE_TYPES.CallExpression) {
              const callee = decorator.expression.callee;
              const name =
                importedBindingName(
                  source,
                  [...graphqlModules, ...ormModules],
                  callee,
                ) ??
                (callee.type === AST_NODE_TYPES.Identifier
                  ? callee.name
                  : null);
              if (name && name in decoratorConfig) {
                foundDecoratorName = name;
                foundBehavior = decoratorConfig[name];
                break;
              }
            }
          }

          // If behavior is "ignore", skip directly
          if (foundBehavior === "ignore") {
            return;
          }

          const fieldDecorator = member.decorators.find(
            (decorator) =>
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decoratorName(decorator.expression.callee) === "Field",
          );

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
          if (foundBehavior === "remove") {
            return;
          }

          const typeInfo = computeTypeInfo(member);
          if (!typeInfo?.typeName) {
            return;
          }

          // If there is no @Field decorator, add one
          if (!fieldDecorator) {
            if (
              typeInfo.isCustomType &&
              isTypeOnlySymbol(typeInfo.typeReference)
            ) {
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
              });
              return;
            }
            const customImports = customTypeImportEdits(typeInfo);
            if (customImports.length) {
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
                fix: () => customImports,
              });
              return;
            }
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
          if (callExpr.type !== AST_NODE_TYPES.CallExpression) {
            return;
          }

          let needReport = true;
          let scalarReference: TSESTree.Node | null = null;
          let verifiedScalarReference: TSESTree.Node | null = null;
          let isSemanticMatch = false;

          if (
            callExpr.arguments.length > 0 &&
            callExpr.arguments[0].type ===
              AST_NODE_TYPES.ArrowFunctionExpression
          ) {
            const firstArg = callExpr.arguments[0];
            const calleeText = source.getText(firstArg.body);
            const expectedTypeText = typeInfo.isArray
              ? `[${typeBinding(typeInfo)}]`
              : typeBinding(typeInfo);

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
            const isNumberType =
              !typeInfo.isCustomType && typeInfo.typeName === "Float";
            const bodyIsArray =
              firstArg.body.type === AST_NODE_TYPES.ArrayExpression;
            const scalarNode =
              firstArg.body.type === AST_NODE_TYPES.ArrayExpression
                ? firstArg.body.elements.length === 1
                  ? firstArg.body.elements[0]
                  : null
                : firstArg.body;
            scalarReference = scalarNode
              ? unwrapTypeAssertions(scalarNode)
              : null;
            const explicitScalar = scalarNode
              ? importedBindingName(
                  source,
                  scalarModules(typeInfo.typeName),
                  scalarNode,
                )
              : null;
            const isValidNumberType =
              isNumberType &&
              !!explicitScalar &&
              ["Int", "Float"].includes(explicitScalar) &&
              typeInfo.isArray === bodyIsArray;
            if (isValidNumberType) {
              typeInfo.typeName = explicitScalar;
            }
            const isValidScalar =
              !typeInfo.isCustomType &&
              !!explicitScalar &&
              ["Int", "Float", "ID", "GraphQLJSONObject"].includes(
                explicitScalar,
              ) &&
              explicitScalar === typeInfo.typeName &&
              typeInfo.isArray === bodyIsArray;
            if (isValidScalar) {
              verifiedScalarReference = scalarNode;
            }
            if (
              isValidScalar &&
              scalarNode &&
              hasResolvedBinding(scalarNode) &&
              !isTypeOnlyImportReference(source, scalarNode)
            ) {
              typeInfo.scalarExpression = source.getText(scalarNode);
            }

            let typeMatches =
              calleeText === expectedTypeText ||
              isValidNumberType ||
              isValidScalar;

            if (
              !typeMatches &&
              scalarNode &&
              typeInfo.targetTypeNode &&
              typeInfo.isArray === bodyIsArray &&
              matchesGraphqlReturnType(scalarNode, typeInfo.targetTypeNode)
            ) {
              typeMatches = true;
              isSemanticMatch = true;
              typeInfo.scalarExpression = source.getText(scalarNode);
            } else if (
              !typeMatches &&
              scalarNode &&
              !bodyIsArray &&
              typeInfo.isArray &&
              typeInfo.fullTypeNode &&
              matchesGraphqlReturnType(scalarNode, typeInfo.fullTypeNode, true)
            ) {
              typeMatches = true;
              isSemanticMatch = true;
              typeInfo.isWholeValueScalar = true;
              typeInfo.scalarExpression = source.getText(scalarNode);
            }

            if (typeMatches && hasNullableOption === typeInfo.isNullable) {
              needReport = false;
            }
          }

          const destructuredImports = promoteImportReferences(
            source,
            [
              callExpr.callee,
              ...(verifiedScalarReference ? [verifiedScalarReference] : []),
            ],
            { destructuredOnly: true },
          );
          if (destructuredImports.length) {
            context.report({
              node: member,
              messageId: "alignFieldDecoratorWithTsType",
              fix: () => destructuredImports,
            });
            return;
          }

          if (
            scalarReference !== null &&
            isTypeOnlyImportReference(source, scalarReference) &&
            (isSemanticMatch || (!needReport && typeInfo.isCustomType))
          ) {
            const runtimePromotions = promoteImportReferences(source, [
              scalarReference,
            ]);
            if (runtimePromotions.length) {
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
                fix: () => runtimePromotions,
              });
              return;
            }
          }

          if (!needReport) {
            const modules = scalarModules(typeInfo.typeName);
            const typeOnlyScalar =
              !isSemanticMatch &&
              ((scalarReference !== null &&
                isTypeOnlyImportReference(source, scalarReference)) ||
                (!typeInfo.isCustomType &&
                  hasNamedImport(
                    source,
                    modules,
                    typeInfo.typeName,
                    false,
                    importLocation,
                  ) &&
                  !hasNamedImport(
                    source,
                    modules,
                    typeInfo.typeName,
                    true,
                    importLocation,
                  )));
            const typeOnlyField =
              isTypeOnlyImportReference(source, callExpr.callee) ||
              (hasNamedImport(
                source,
                graphqlModules,
                "Field",
                false,
                importLocation,
              ) &&
                !hasNamedImport(
                  source,
                  graphqlModules,
                  "Field",
                  true,
                  importLocation,
                ));
            if (!typeOnlyScalar && !typeOnlyField) {
              return;
            }
          }

          if (!typeInfo.scalarExpression) {
            if (
              typeInfo.isCustomType &&
              isTypeOnlySymbol(typeInfo.typeReference)
            ) {
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
              });
              return;
            }
            const customImports = customTypeImportEdits(typeInfo);
            if (customImports.length) {
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
                fix: () => customImports,
              });
              return;
            }
          }

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

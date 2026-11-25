import {
  AST_NODE_TYPES,
  ASTUtils,
  ESLintUtils,
  TSESTree,
} from "@typescript-eslint/utils";
import {
  type RuleFix,
  type RuleFixer,
  Scope,
} from "@typescript-eslint/utils/ts-eslint";
import {
  intersectionConstituents,
  isObjectFlagSet,
  isSymbolFlagSet,
  isTypeFlagSet,
  unionConstituents,
} from "ts-api-utils";
import * as ts from "typescript";

import { createRule } from "../utils/createRule.js";
import {
  ensureNamedImportFixes,
  getImportedName,
  getLocalImportBinding,
  hasNamedImport,
  isTypeOnlyImportReference,
  promoteTypeImportFixes,
} from "../utils/imports.js";

interface TypeInfo {
  typeName: string | null;
  isArray: boolean;
  isNullable: boolean;
  isItemsNullable?: boolean;
  isCustomType?: boolean;
  unautofixableCustomType?: boolean;
  typeReference?: TSESTree.Node;
  targetTypeNode?: TSESTree.TypeNode;
  fullTypeNode?: TSESTree.TypeNode;
  resolvedTargetTsType?: ts.Type;
  resolvedRawItemTsType?: ts.Type;
  compatibleScalar?: string;
  isWholeValueScalar?: boolean;
  scalarExpression?: string;
}

type ExpectedNullableOption = true | "items" | "itemsAndList" | null;

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
        "enforce @Field decorator type and nullable configuration from TypeScript types",
      recommended: true,
      requiresTypeChecking: true,
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        description:
          "Options controlling decorator handling in GraphQL models.",
        properties: {
          decorators: {
            type: "object",
            additionalProperties: {
              type: "string",
              enum: ["ignore", "remove"],
              description:
                "Whether to ignore the property ('ignore') or remove @Field ('remove').",
            },
            description:
              "Configure behavior for each decorator. ignore: skip checks; remove: remove @Field. Default: { HideField: 'remove', OneToOne: 'remove', OneToMany: 'remove', ManyToOne: 'remove', ManyToMany: 'remove' }",
          },
        },
        additionalProperties: false,
      },
    ],
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
    messages: {
      alignFieldDecoratorWithTsType:
        "@Field decorator should align with the TypeScript type (type and nullable).",
      removeFieldDecorator:
        "Property has a @{{decoratorName}} decorator, @Field decorator should be removed.",
    },
  },
  create(context, [options]) {
    const source = context.sourceCode;
    const filename = context.filename;
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
      getImportedName(source, ormModules, name, filename);

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

    const scalarFromTsLiteral = (node: TSESTree.TypeNode): string | null => {
      if (node.type !== AST_NODE_TYPES.TSLiteralType) {
        return null;
      }
      if (node.literal.type === AST_NODE_TYPES.TemplateLiteral) {
        return "String";
      }
      if (node.literal.type === AST_NODE_TYPES.Literal) {
        if (typeof node.literal.value === "string") {
          return "String";
        }
        if (typeof node.literal.value === "number") {
          return "Float";
        }
        if (typeof node.literal.value === "boolean") {
          return "Boolean";
        }
      }
      if (
        node.literal.type === AST_NODE_TYPES.UnaryExpression &&
        node.literal.operator === "-" &&
        node.literal.argument.type === AST_NODE_TYPES.Literal &&
        typeof node.literal.argument.value === "number"
      ) {
        return "Float";
      }
      return null;
    };

    const isNullishTypeNode = ASTUtils.isNodeOfTypes([
      AST_NODE_TYPES.TSNullKeyword,
      AST_NODE_TYPES.TSUndefinedKeyword,
    ]);
    const isTypeAssertionLike = ASTUtils.isNodeOfTypes([
      AST_NODE_TYPES.TSAsExpression,
      AST_NODE_TYPES.TSTypeAssertion,
      AST_NODE_TYPES.TSSatisfiesExpression,
      AST_NODE_TYPES.TSNonNullExpression,
    ]);

    const getIdentifierName = (node: TSESTree.TypeNode): string | null =>
      node.type === AST_NODE_TYPES.TSTypeReference &&
      ASTUtils.isIdentifier(node.typeName)
        ? node.typeName.name
        : null;

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

    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;
    const checker = program?.getTypeChecker();

    const hasNullishFlag = (type: ts.Type): boolean =>
      unionConstituents(type).some((member) =>
        isTypeFlagSet(member, ts.TypeFlags.Null | ts.TypeFlags.Undefined),
      );

    const stripExplicitNullish = (
      typeChecker: ts.TypeChecker,
      type: ts.Type,
    ): ts.Type => {
      if (!type.isUnion()) {
        // Avoid getNonNullableType on non-unions: in TS 4.8+, getNonNullableType(T)
        // narrows an unconstrained type parameter T into `T & {}`.
        return type;
      }
      const hasTypeParam = type.types.some((member) =>
        isTypeFlagSet(member, ts.TypeFlags.TypeParameter),
      );
      if (hasTypeParam) {
        const remaining = type.types.filter(
          (member) =>
            !isTypeFlagSet(member, ts.TypeFlags.Null | ts.TypeFlags.Undefined),
        );
        if (remaining.length === 1) {
          return remaining[0];
        }
        if (remaining.length === type.types.length) {
          return type;
        }
      }
      return typeChecker.getNonNullableType(type);
    };

    const hasResolvedNullishType = (node: TSESTree.TypeNode): boolean => {
      if (!checker || !esTreeNodeToTSNodeMap) {
        return false;
      }
      try {
        const tsNode = esTreeNodeToTSNodeMap.get(node);
        if (!ts.isTypeNode(tsNode)) {
          return false;
        }
        return hasNullishFlag(checker.getTypeFromTypeNode(tsNode));
      } catch {
        return false;
      }
    };

    const extractArrayElementTsType = (
      typeChecker: ts.TypeChecker,
      type: ts.Type,
    ): ts.Type | null => {
      if (
        typeChecker.isArrayType(type) ||
        type.symbol?.name === "ReadonlyArray"
      ) {
        return (
          typeChecker.getTypeArguments(type as ts.TypeReference)[0] ??
          typeChecker.getIndexTypeOfType(type, ts.IndexKind.Number) ??
          null
        );
      }
      return null;
    };

    const isEnumLikeType = (type: ts.Type): boolean => {
      const parts = unionConstituents(type);
      return (
        parts.length > 0 &&
        parts.every((member) => isTypeFlagSet(member, ts.TypeFlags.EnumLike))
      );
    };

    const isTypeOnlyImportedName = (name: string): boolean =>
      (
        ASTUtils.findVariable(source.getScope(importLocation), name)?.defs ?? []
      ).some(
        (def) =>
          def.type === Scope.DefinitionType.ImportBinding &&
          def.parent.type === AST_NODE_TYPES.ImportDeclaration &&
          (def.parent.importKind === "type" ||
            (def.node.type === AST_NODE_TYPES.ImportSpecifier &&
              def.node.importKind === "type")),
      );

    const classifyHomogeneousScalarFromTsType = (
      type: ts.Type,
    ): "Boolean" | "String" | "Float" | null => {
      if (isEnumLikeType(type)) {
        return null;
      }
      const parts = unionConstituents(type);
      const isHomogeneous = (flag: ts.TypeFlags) =>
        parts.length > 0 &&
        parts.every((member) => isTypeFlagSet(member, flag));
      if (isHomogeneous(ts.TypeFlags.BooleanLike)) {
        return "Boolean";
      }
      if (isHomogeneous(ts.TypeFlags.StringLike)) {
        return "String";
      }
      if (isHomogeneous(ts.TypeFlags.NumberLike)) {
        return "Float";
      }
      return null;
    };

    const isRecordObjectTsType = (
      typeChecker: ts.TypeChecker,
      type: ts.Type,
    ): boolean => {
      return (
        type.aliasSymbol?.name === "Record" ||
        (isTypeFlagSet(type, ts.TypeFlags.Object) &&
          !hasClassSymbol(type) &&
          typeChecker.getIndexTypeOfType(type, ts.IndexKind.String) !==
            undefined &&
          typeChecker.getPropertiesOfType(type).length === 0)
      );
    };

    const inferGraphqlElementFromTsType = (
      typeChecker: ts.TypeChecker,
      elemType: ts.Type,
      location: ts.Node,
      isIdProperty: boolean,
    ): {
      typeName: string;
      isCustomType?: boolean;
      unautofixableCustomType?: boolean;
    } => {
      if (isIdProperty) {
        return { typeName: "ID" };
      }
      const homogeneousScalar = classifyHomogeneousScalarFromTsType(elemType);
      if (homogeneousScalar) {
        return { typeName: homogeneousScalar };
      }
      if (isRecordObjectTsType(typeChecker, elemType)) {
        return { typeName: "GraphQLJSONObject" };
      }
      const rawTargetSym = elemType.aliasSymbol ?? elemType.symbol;
      const targetSym =
        rawTargetSym && isSymbolFlagSet(rawTargetSym, ts.SymbolFlags.Alias)
          ? typeChecker.getAliasedSymbol(rawTargetSym)
          : rawTargetSym;
      if (targetSym && isSymbolFlagSet(targetSym, ts.SymbolFlags.Value)) {
        const resolvedInScope = typeChecker.resolveName(
          targetSym.name,
          location,
          ts.SymbolFlags.Value,
          false,
        );
        const unaliasedInScope =
          resolvedInScope &&
          isSymbolFlagSet(resolvedInScope, ts.SymbolFlags.Alias)
            ? typeChecker.getAliasedSymbol(resolvedInScope)
            : resolvedInScope;
        if (
          unaliasedInScope === targetSym &&
          !isTypeOnlyImportedName(targetSym.name)
        ) {
          return { typeName: targetSym.name, isCustomType: true };
        }
      }
      return {
        typeName: targetSym?.name ?? "__unresolvable__",
        isCustomType: true,
        unautofixableCustomType: true,
      };
    };

    const computeTypeInfo = (
      property: TSESTree.PropertyDefinition,
    ): TypeInfo | null => {
      let isNullable = false;
      let isItemsNullable = false;
      let isArray = false;

      let baseTypeNode: TSESTree.TypeNode | null =
        property.typeAnnotation?.type === AST_NODE_TYPES.TSTypeAnnotation
          ? property.typeAnnotation.typeAnnotation
          : null;

      // Optional property (?) is treated as nullable
      if (property.optional) {
        isNullable = true;
      }

      // Unwrap outer null/undefined and nested Ref<T>/Opt<T> wrappers, preserving
      // the full union node prior to collapsing multi-member unions.
      let semanticOuterNode: TSESTree.TypeNode | null = baseTypeNode;
      while (baseTypeNode) {
        if (baseTypeNode.type === AST_NODE_TYPES.TSUnionType) {
          if (baseTypeNode.types.some(isNullishTypeNode)) {
            isNullable = true;
          }
          semanticOuterNode = baseTypeNode;
          baseTypeNode =
            baseTypeNode.types.find((t) => !isNullishTypeNode(t)) ?? null;
          if (
            baseTypeNode?.type === AST_NODE_TYPES.TSTypeReference &&
            (ormTypeName(baseTypeNode.typeName) === "Ref" ||
              ormTypeName(baseTypeNode.typeName) === "Opt")
          ) {
            semanticOuterNode = baseTypeNode;
            continue;
          }
          break;
        }
        if (
          baseTypeNode.type === AST_NODE_TYPES.TSTypeReference &&
          (ormTypeName(baseTypeNode.typeName) === "Ref" ||
            ormTypeName(baseTypeNode.typeName) === "Opt")
        ) {
          const inner = baseTypeNode.typeArguments?.params[0] ?? null;
          if (!inner || inner === baseTypeNode) {
            break;
          }
          baseTypeNode = inner;
          semanticOuterNode = inner;
          continue;
        }
        semanticOuterNode = baseTypeNode;
        break;
      }

      // Carry nullability declared inside aliased types (e.g. type MaybeText = string | null)
      if (!isNullable && baseTypeNode && hasResolvedNullishType(baseTypeNode)) {
        isNullable = true;
      }

      // Array type (T[], readonly T[], Array<T>, ReadonlyArray<T>) - checked after unwrapping Opt/Ref
      const rawElementTypeNode = baseTypeNode
        ? extractArrayElementType(baseTypeNode)
        : null;
      let elementTypeNode = rawElementTypeNode;
      if (rawElementTypeNode) {
        isArray = true;
        if (rawElementTypeNode.type === AST_NODE_TYPES.TSUnionType) {
          if (rawElementTypeNode.types.some(isNullishTypeNode)) {
            isItemsNullable = true;
          }
          elementTypeNode =
            rawElementTypeNode.types.find((t) => !isNullishTypeNode(t)) ?? null;
        } else if (hasResolvedNullishType(rawElementTypeNode)) {
          isItemsNullable = true;
        }
      }

      const targetTypeNode: TSESTree.TypeNode | null =
        elementTypeNode ?? baseTypeNode;
      const semanticTargetNode: TSESTree.TypeNode | undefined =
        rawElementTypeNode ?? semanticOuterNode ?? undefined;

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
      const isIdProperty =
        propertyName === "id" ||
        (typeof propertyName === "string" &&
          (propertyName.endsWith("Id") || propertyName.endsWith("ID")));

      const fullTypeNode = semanticOuterNode ?? baseTypeNode ?? undefined;

      // Resolve array type aliases (e.g. type Tags = readonly string[]) before falling back to custom identifier
      if (
        !isArray &&
        checker &&
        esTreeNodeToTSNodeMap &&
        baseTypeNode?.type === AST_NODE_TYPES.TSTypeReference
      ) {
        const tsBase = esTreeNodeToTSNodeMap.get(baseTypeNode);
        if (ts.isTypeNode(tsBase)) {
          const resolvedOuter = stripExplicitNullish(
            checker,
            checker.getTypeFromTypeNode(tsBase),
          );
          const elemTsType = extractArrayElementTsType(checker, resolvedOuter);
          if (elemTsType) {
            isArray = true;
            if (hasNullishFlag(elemTsType)) {
              isItemsNullable = true;
            }
            const nonNullElem = stripExplicitNullish(checker, elemTsType);
            const inferredElem = inferGraphqlElementFromTsType(
              checker,
              nonNullElem,
              tsBase,
              isIdProperty,
            );
            return {
              typeName: inferredElem.typeName,
              isArray: true,
              isNullable,
              isItemsNullable,
              isCustomType: inferredElem.isCustomType,
              unautofixableCustomType: inferredElem.unautofixableCustomType,
              targetTypeNode: semanticTargetNode,
              fullTypeNode,
              resolvedTargetTsType: nonNullElem,
              resolvedRawItemTsType: elemTsType,
            };
          }
        }
      }

      if (isIdProperty) {
        return {
          typeName: "ID",
          isArray,
          isNullable,
          isItemsNullable,
          targetTypeNode: semanticTargetNode,
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
          isItemsNullable,
          targetTypeNode: semanticTargetNode,
          fullTypeNode,
        };
      }

      // Keyword and literal types → GraphQL scalars
      const scalar =
        scalarFromTsKeyword(targetTypeNode.type) ??
        scalarFromTsLiteral(targetTypeNode);
      if (scalar) {
        return {
          typeName: scalar,
          isArray,
          isNullable,
          isItemsNullable,
          targetTypeNode: semanticTargetNode,
          fullTypeNode,
        };
      }

      // Resolve aliased scalar/Record references (e.g. type Name = string, type Tag = "a" | "b", Tag[])
      let compatibleScalar: string | undefined;
      if (
        checker &&
        esTreeNodeToTSNodeMap &&
        targetTypeNode.type === AST_NODE_TYPES.TSTypeReference
      ) {
        const tsTarget = esTreeNodeToTSNodeMap.get(targetTypeNode);
        if (ts.isTypeNode(tsTarget)) {
          const nonNullTarget = stripExplicitNullish(
            checker,
            checker.getTypeFromTypeNode(tsTarget),
          );
          if (
            !isUnusableType(nonNullTarget) &&
            !isEnumLikeType(nonNullTarget)
          ) {
            if (isArray) {
              const elemScalar =
                classifyHomogeneousScalarFromTsType(nonNullTarget) ??
                (isRecordObjectTsType(checker, nonNullTarget)
                  ? "GraphQLJSONObject"
                  : null);
              if (elemScalar) {
                return {
                  typeName: elemScalar,
                  isArray: true,
                  isNullable,
                  isItemsNullable,
                  targetTypeNode: semanticTargetNode,
                  fullTypeNode,
                };
              }
            } else {
              if (isTypeFlagSet(nonNullTarget, ts.TypeFlags.Boolean)) {
                return {
                  typeName: "Boolean",
                  isArray: false,
                  isNullable,
                  isItemsNullable,
                  targetTypeNode: semanticTargetNode,
                  fullTypeNode,
                };
              }
              if (isTypeFlagSet(nonNullTarget, ts.TypeFlags.String)) {
                return {
                  typeName: "String",
                  isArray: false,
                  isNullable,
                  isItemsNullable,
                  targetTypeNode: semanticTargetNode,
                  fullTypeNode,
                };
              }
              if (isTypeFlagSet(nonNullTarget, ts.TypeFlags.Number)) {
                return {
                  typeName: "Float",
                  isArray: false,
                  isNullable,
                  isItemsNullable,
                  targetTypeNode: semanticTargetNode,
                  fullTypeNode,
                };
              }
              if (isRecordObjectTsType(checker, nonNullTarget)) {
                return {
                  typeName: "GraphQLJSONObject",
                  isArray: false,
                  isNullable,
                  isItemsNullable,
                  targetTypeNode: semanticTargetNode,
                  fullTypeNode,
                };
              }
              compatibleScalar =
                classifyHomogeneousScalarFromTsType(nonNullTarget) ?? undefined;
            }
          }
        }
      }

      // Identifier (class/custom type)
      const ident = getIdentifierName(targetTypeNode);
      if (ident) {
        return {
          typeName: ident,
          isArray,
          isNullable,
          isItemsNullable,
          isCustomType: true,
          compatibleScalar,
          targetTypeNode: semanticTargetNode,
          fullTypeNode,
          typeReference:
            targetTypeNode.type === AST_NODE_TYPES.TSTypeReference
              ? targetTypeNode.typeName
              : undefined,
        };
      }

      // Inline structural types (object literals `{ ... }`, tuples `[...]`, and intersections `A & B`)
      if (
        targetTypeNode.type === AST_NODE_TYPES.TSTypeLiteral ||
        targetTypeNode.type === AST_NODE_TYPES.TSTupleType ||
        targetTypeNode.type === AST_NODE_TYPES.TSIntersectionType
      ) {
        if (checker && esTreeNodeToTSNodeMap) {
          const tsTarget = esTreeNodeToTSNodeMap.get(targetTypeNode);
          if (ts.isTypeNode(tsTarget)) {
            const nonNullTarget = stripExplicitNullish(
              checker,
              checker.getTypeFromTypeNode(tsTarget),
            );
            if (isRecordObjectTsType(checker, nonNullTarget)) {
              return {
                typeName: "GraphQLJSONObject",
                isArray,
                isNullable,
                isItemsNullable,
                targetTypeNode: semanticTargetNode,
                fullTypeNode,
              };
            }
          }
        }
        return {
          typeName: "__inline_structural__",
          isArray,
          isNullable,
          isItemsNullable,
          isCustomType: true,
          unautofixableCustomType: true,
          targetTypeNode: semanticTargetNode,
          fullTypeNode,
        };
      }

      return null;
    };

    const builtInJsConstructors = new Set([
      "Number",
      "String",
      "Boolean",
      "Array",
      "Object",
      "Function",
      "Symbol",
      "BigInt",
    ]);

    const isDefaultLibraryType = (type: ts.Type): boolean => {
      if (!program) {
        return false;
      }
      const rawSym = type.aliasSymbol ?? type.symbol;
      const sym =
        rawSym && isSymbolFlagSet(rawSym, ts.SymbolFlags.Alias) && checker
          ? checker.getAliasedSymbol(rawSym)
          : rawSym;
      const declarations = sym?.getDeclarations();
      if (!declarations || declarations.length === 0) {
        return false;
      }
      return declarations.every((decl) =>
        program.isSourceFileDefaultLibrary(decl.getSourceFile()),
      );
    };

    const unwrapTypeAssertions = (node: TSESTree.Node): TSESTree.Node => {
      let current = node;
      while (isTypeAssertionLike(current)) {
        current = current.expression;
      }
      return current;
    };

    const isUnusableType = (type: ts.Type): boolean =>
      isTypeFlagSet(
        type,
        ts.TypeFlags.Any |
          ts.TypeFlags.Unknown |
          ts.TypeFlags.Never |
          ts.TypeFlags.Void,
      );

    const hasBroadNumberMember = (type: ts.Type): boolean =>
      unionConstituents(type).some((member) =>
        isTypeFlagSet(member, ts.TypeFlags.Number),
      );

    const hasEnumLikeMember = (type: ts.Type): boolean =>
      unionConstituents(type).some((member) =>
        isTypeFlagSet(member, ts.TypeFlags.EnumLike),
      );

    const areTypesEquivalent = (
      typeChecker: ts.TypeChecker,
      a: ts.Type,
      b: ts.Type,
      visited = new Map<ts.Type, Set<ts.Type>>(),
    ): boolean => {
      if (
        isTypeFlagSet(a, ts.TypeFlags.Any) ||
        isTypeFlagSet(b, ts.TypeFlags.Any)
      ) {
        return false;
      }
      if (a === b) {
        return true;
      }
      if (isUnusableType(a) || isUnusableType(b)) {
        return false;
      }
      // TypeScript treats broad `number` and numeric enums as mutually assignable;
      // reject those pairs so unconstrained numbers cannot match finite numeric enums.
      if (
        hasBroadNumberMember(a) !== hasBroadNumberMember(b) &&
        (hasEnumLikeMember(a) || hasEnumLikeMember(b))
      ) {
        return false;
      }
      const seenForA = visited.get(a);
      if (seenForA?.has(b)) {
        return true;
      }
      if (
        !typeChecker.isTypeAssignableTo(a, b) ||
        !typeChecker.isTypeAssignableTo(b, a)
      ) {
        return false;
      }
      if (seenForA) {
        seenForA.add(b);
      } else {
        visited.set(a, new Set([b]));
      }
      if (a.isUnion() && b.isUnion()) {
        for (const memberA of a.types) {
          const matchesInB = b.types.filter(
            (memberB) =>
              typeChecker.isTypeAssignableTo(memberA, memberB) &&
              typeChecker.isTypeAssignableTo(memberB, memberA),
          );
          if (
            matchesInB.length > 0 &&
            !matchesInB.some((memberB) =>
              areTypesEquivalent(typeChecker, memberA, memberB, visited),
            )
          ) {
            return false;
          }
        }
        return true;
      }
      const elemA = extractArrayElementTsType(typeChecker, a);
      const elemB = extractArrayElementTsType(typeChecker, b);
      if (elemA && elemB) {
        return areTypesEquivalent(typeChecker, elemA, elemB, visited);
      }
      if (typeChecker.isTupleType(a) && typeChecker.isTupleType(b)) {
        const argsA = typeChecker.getTypeArguments(a as ts.TypeReference);
        const argsB = typeChecker.getTypeArguments(b as ts.TypeReference);
        return (
          argsA.length === argsB.length &&
          argsA.every((arg, index) =>
            areTypesEquivalent(typeChecker, arg, argsB[index], visited),
          )
        );
      }
      if (
        isTypeFlagSet(a, ts.TypeFlags.Object | ts.TypeFlags.Intersection) &&
        isTypeFlagSet(b, ts.TypeFlags.Object | ts.TypeFlags.Intersection)
      ) {
        const refA =
          isTypeFlagSet(a, ts.TypeFlags.Object) &&
          isObjectFlagSet(a as ts.ObjectType, ts.ObjectFlags.Reference);
        const refB =
          isTypeFlagSet(b, ts.TypeFlags.Object) &&
          isObjectFlagSet(b as ts.ObjectType, ts.ObjectFlags.Reference);
        if (refA && refB && a.symbol && a.symbol === b.symbol) {
          const argsA = typeChecker.getTypeArguments(a as ts.TypeReference);
          const argsB = typeChecker.getTypeArguments(b as ts.TypeReference);
          return (
            argsA.length === argsB.length &&
            argsA.every((arg, index) =>
              areTypesEquivalent(typeChecker, arg, argsB[index], visited),
            )
          );
        }
        const strIndexA = typeChecker.getIndexTypeOfType(
          a,
          ts.IndexKind.String,
        );
        const strIndexB = typeChecker.getIndexTypeOfType(
          b,
          ts.IndexKind.String,
        );
        if (
          strIndexA &&
          strIndexB &&
          !areTypesEquivalent(typeChecker, strIndexA, strIndexB, visited)
        ) {
          return false;
        }
        const numIndexA = typeChecker.getIndexTypeOfType(
          a,
          ts.IndexKind.Number,
        );
        const numIndexB = typeChecker.getIndexTypeOfType(
          b,
          ts.IndexKind.Number,
        );
        if (
          numIndexA &&
          numIndexB &&
          !areTypesEquivalent(typeChecker, numIndexA, numIndexB, visited)
        ) {
          return false;
        }
        if (!(hasClassSymbol(a) && hasClassSymbol(b))) {
          const propsA = typeChecker.getPropertiesOfType(a);
          const propsB = typeChecker.getPropertiesOfType(b);
          if (propsA.length !== propsB.length) {
            return false;
          }
          for (const propA of propsA) {
            const propB = typeChecker.getPropertyOfType(b, propA.name);
            if (
              !propB ||
              !areTypesEquivalent(
                typeChecker,
                typeChecker.getTypeOfSymbol(propA),
                typeChecker.getTypeOfSymbol(propB),
                visited,
              )
            ) {
              return false;
            }
          }
        }
      }
      return true;
    };

    const hasClassSymbol = (type: ts.Type): boolean =>
      type.symbol !== undefined &&
      isSymbolFlagSet(type.symbol, ts.SymbolFlags.Class);

    const isPrimitiveEnumValueType = (
      typeChecker: ts.TypeChecker,
      type: ts.Type,
    ): boolean => {
      if (isUnusableType(type)) {
        return false;
      }
      if (type.isUnion()) {
        return (
          type.types.length > 0 &&
          type.types.every((member) =>
            isPrimitiveEnumValueType(typeChecker, member),
          )
        );
      }
      if (
        isTypeFlagSet(
          type,
          ts.TypeFlags.StringLike |
            ts.TypeFlags.NumberLike |
            ts.TypeFlags.EnumLike,
        )
      ) {
        return true;
      }
      const constraint = typeChecker.getBaseConstraintOfType(type);
      return constraint !== undefined && constraint !== type
        ? isPrimitiveEnumValueType(typeChecker, constraint)
        : false;
    };

    const collectLiteralValues = (
      type: ts.Type,
    ): Set<string | number> | null => {
      const parts = unionConstituents(type);
      if (parts.length === 0) {
        return null;
      }
      const values = new Set<string | number>();
      for (const part of parts) {
        if (!part.isStringLiteral() && !part.isNumberLiteral()) {
          return null;
        }
        values.add(part.value);
      }
      return values;
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
      typeChecker: ts.TypeChecker,
      type: ts.Type,
      visited = new Set<ts.Type>(),
    ): ts.Type | null => {
      if (visited.has(type)) {
        return null;
      }
      visited.add(type);
      if (
        type.symbol?.name === "GraphQLScalarType" &&
        isTypeFlagSet(type, ts.TypeFlags.Object) &&
        isObjectFlagSet(type as ts.ObjectType, ts.ObjectFlags.Reference)
      ) {
        const internal = typeChecker.getTypeArguments(
          type as ts.TypeReference,
        )[0];
        return internal && !isUnusableType(internal) ? internal : null;
      }
      if (type.isIntersection()) {
        for (const member of type.types) {
          const found = extractGraphQLScalarInternalType(
            typeChecker,
            member,
            visited,
          );
          if (found) {
            return found;
          }
        }
      }
      if (type.isClassOrInterface()) {
        for (const base of typeChecker.getBaseTypes(type)) {
          const found = extractGraphQLScalarInternalType(
            typeChecker,
            base,
            visited,
          );
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const acceptConstructedInstanceType = (
      exprType: ts.Type,
      instanceType: ts.Type,
    ): ts.Type | null => {
      if (isUnusableType(instanceType)) {
        return null;
      }
      // Reject standard-library JS constructors (Object, Number, Array, RegExp, etc.),
      // regardless of how they are reached (e.g. globalThis.Object or const NativeObject = Object).
      // Only Date is mapped by @nestjs/graphql as a built-in scalar constructor.
      if (
        instanceType.symbol?.name !== "Date" &&
        (isDefaultLibraryType(exprType) || isDefaultLibraryType(instanceType))
      ) {
        return null;
      }
      return instanceType;
    };

    const extractConstructedInstanceType = (
      typeChecker: ts.TypeChecker,
      type: ts.Type,
      location: ts.Node,
    ): ts.Type | null => {
      const constructSignatures = typeChecker.getSignaturesOfType(
        type,
        ts.SignatureKind.Construct,
      );
      if (constructSignatures.length > 0) {
        return acceptConstructedInstanceType(
          type,
          constructSignatures[0].getReturnType(),
        );
      }

      // Constructor-like intersections such as MikroORM's EntityClass<T> = Function & { prototype: T }
      const members = intersectionConstituents(type);
      const isFunctionLike =
        typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call).length >
          0 || members.some((member) => member.symbol?.name === "Function");
      if (!isFunctionLike) {
        return null;
      }
      for (const member of members) {
        if (member.symbol?.name === "Function") {
          continue;
        }
        const proto = typeChecker.getPropertyOfType(member, "prototype");
        if (!proto) {
          continue;
        }
        const protoType = typeChecker.getTypeOfSymbolAtLocation(
          proto,
          location,
        );
        const accepted = acceptConstructedInstanceType(type, protoType);
        if (accepted) {
          return accepted;
        }
      }
      return null;
    };

    const resolveAliasedSymbol = (
      typeChecker: ts.TypeChecker,
      node: ts.Node,
    ): ts.Symbol | undefined => {
      const raw = typeChecker.getSymbolAtLocation(node);
      return raw && isSymbolFlagSet(raw, ts.SymbolFlags.Alias)
        ? typeChecker.getAliasedSymbol(raw)
        : raw;
    };

    const matchesMappedRecordAliasValue = (
      typeChecker: ts.TypeChecker,
      exprType: ts.Type,
      propType: ts.Type,
      propTypeNode?: ts.TypeNode,
    ): boolean => {
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
      const declaredValueType = typeChecker.getTypeFromTypeNode(valueTypeNode);
      if (
        !isPrimitiveEnumValueType(typeChecker, declaredValueType) ||
        !isPrimitiveEnumValueType(typeChecker, propType)
      ) {
        return false;
      }
      if (
        !aliasDecl.typeParameters?.length ||
        !ts.isTypeReferenceNode(valueTypeNode)
      ) {
        return false;
      }

      const targetSym = resolveAliasedSymbol(
        typeChecker,
        valueTypeNode.typeName,
      );
      if (!targetSym) {
        return false;
      }

      // If TypeScript expanded the property alias (e.g. to Extract<...>), inspect its AST type reference.
      let propAliasSym = propType.aliasSymbol;
      let propArgs = propType.aliasTypeArguments;
      if (
        targetSym !== propAliasSym &&
        propTypeNode &&
        ts.isTypeReferenceNode(propTypeNode)
      ) {
        const refSym = resolveAliasedSymbol(typeChecker, propTypeNode.typeName);
        if (refSym === targetSym) {
          propAliasSym = refSym;
          propArgs = (propTypeNode.typeArguments ?? []).map((arg) =>
            typeChecker.getTypeFromTypeNode(arg),
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
        const paramSym = typeChecker.getSymbolAtLocation(param.name);
        if (paramSym) {
          paramMap.set(paramSym, instantiatedArgs[index]);
        }
      });

      return valueArgNodes.every((argNode, index) => {
        const argSym =
          ts.isTypeReferenceNode(argNode) && !argNode.typeArguments?.length
            ? typeChecker.getSymbolAtLocation(argNode.typeName)
            : undefined;
        const substituted =
          (argSym ? paramMap.get(argSym) : undefined) ??
          typeChecker.getTypeFromTypeNode(argNode);
        return areTypesEquivalent(
          typeChecker,
          substituted,
          actualPropArgs[index],
        );
      });
    };

    const matchesEnumObjectType = (
      typeChecker: ts.TypeChecker,
      exprNode: TSESTree.Node,
      exprType: ts.Type,
      propType: ts.Type,
      location: ts.Node,
      propTypeNode?: ts.TypeNode,
    ): boolean => {
      if (exprNode.type === AST_NODE_TYPES.ObjectExpression) {
        return false;
      }

      // 1. TypeScript enum declaration (e.g. enum Status { ACTIVE = "ACTIVE" })
      if (
        exprType.symbol &&
        isSymbolFlagSet(exprType.symbol, ts.SymbolFlags.Enum)
      ) {
        const declared = typeChecker.getDeclaredTypeOfSymbol(exprType.symbol);
        if (areTypesEquivalent(typeChecker, propType, declared)) {
          return true;
        }
        const enumValues = new Set<string | number>();
        let allLiterals = true;
        for (const prop of typeChecker.getPropertiesOfType(exprType)) {
          if (!isSymbolFlagSet(prop, ts.SymbolFlags.EnumMember)) {
            continue;
          }
          const memberType = typeChecker.getTypeOfSymbolAtLocation(
            prop,
            location,
          );
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
      if (!isTypeFlagSet(exprType, ts.TypeFlags.Object)) {
        return false;
      }
      if (
        typeChecker.isArrayType(exprType) ||
        typeChecker.isTupleType(exprType) ||
        hasClassSymbol(exprType) ||
        typeChecker.getSignaturesOfType(exprType, ts.SignatureKind.Construct)
          .length > 0 ||
        typeChecker.getSignaturesOfType(exprType, ts.SignatureKind.Call)
          .length > 0
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
      const stringIndexType = typeChecker.getIndexTypeOfType(
        exprType,
        ts.IndexKind.String,
      );
      if (stringIndexType) {
        return (
          isPrimitiveEnumValueType(typeChecker, stringIndexType) &&
          areTypesEquivalent(typeChecker, propType, stringIndexType)
        );
      }

      // 2b. Generic mapped type (e.g. Record<K, V> or OrderFieldType<Entity> = Record<OrderFieldKey<T>, OrderFieldValue<T>>)
      if (isObjectFlagSet(exprType as ts.ObjectType, ts.ObjectFlags.Mapped)) {
        if (
          exprType.aliasSymbol?.name === "Record" &&
          exprType.aliasTypeArguments?.length === 2
        ) {
          const valType = exprType.aliasTypeArguments[1];
          return (
            isPrimitiveEnumValueType(typeChecker, valType) &&
            areTypesEquivalent(typeChecker, propType, valType)
          );
        }
        return matchesMappedRecordAliasValue(
          typeChecker,
          exprType,
          propType,
          propTypeNode,
        );
      }

      // 2c. Plain `as const` enum object literal (e.g. const Status = { OPEN: "open", CLOSED: "closed" } as const)
      const properties = typeChecker.getPropertiesOfType(exprType);
      if (properties.length > 0) {
        const objectValues = new Set<string | number>();
        for (const prop of properties) {
          const memberType = typeChecker.getTypeOfSymbolAtLocation(
            prop,
            location,
          );
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

    const resolveRuntimeExpressionType = (
      typeChecker: ts.TypeChecker,
      tsExpr: ts.Node,
    ): ts.Type | null => {
      let exprType = typeChecker.getTypeAtLocation(tsExpr);
      if (isUnusableType(exprType)) {
        const sym = resolveAliasedSymbol(typeChecker, tsExpr);
        if (sym) {
          exprType = typeChecker.getTypeOfSymbolAtLocation(sym, tsExpr);
        }
      }
      return isUnusableType(exprType) ? null : exprType;
    };

    const resolveCustomReturnTypes = (
      innerExprNode: TSESTree.Node,
      typeNode?: TSESTree.TypeNode,
      explicitPropType?: ts.Type,
    ): {
      typeChecker: ts.TypeChecker;
      exprNode: TSESTree.Node;
      tsExpr: ts.Node;
      tsTarget?: ts.TypeNode;
      exprType: ts.Type;
      propType: ts.Type;
      rawPropType: ts.Type;
    } | null => {
      if (!checker || !esTreeNodeToTSNodeMap) {
        return null;
      }
      const unwrapped = unwrapTypeAssertions(innerExprNode);
      if (
        unwrapped.type === AST_NODE_TYPES.Identifier &&
        builtInJsConstructors.has(unwrapped.name) &&
        !hasDeclaredBinding(unwrapped)
      ) {
        return null;
      }
      const importedScalar = getImportedName(
        source,
        [...graphqlModules, jsonModule],
        unwrapped,
        filename,
      );
      if (
        importedScalar &&
        ["Int", "Float", "ID", "GraphQLJSONObject"].includes(importedScalar)
      ) {
        return null;
      }
      const tsExpr = esTreeNodeToTSNodeMap.get(unwrapped);
      let tsTarget: ts.TypeNode | undefined;
      let rawPropType: ts.Type | undefined = explicitPropType;
      if (typeNode) {
        const mappedTarget = esTreeNodeToTSNodeMap.get(typeNode);
        if (ts.isTypeNode(mappedTarget)) {
          tsTarget = mappedTarget;
          rawPropType ??= checker.getTypeFromTypeNode(mappedTarget);
        }
      }
      if (!rawPropType) {
        return null;
      }
      const exprType = resolveRuntimeExpressionType(checker, tsExpr);
      const propType = stripExplicitNullish(checker, rawPropType);
      if (!exprType || isUnusableType(propType)) {
        return null;
      }
      return {
        typeChecker: checker,
        exprNode: unwrapped,
        tsExpr,
        tsTarget,
        exprType,
        propType,
        rawPropType,
      };
    };

    const matchesGraphqlReturnType = (
      innerExprNode: TSESTree.Node,
      targetTypeNode: TSESTree.TypeNode | undefined,
      scalarOnly = false,
      explicitPropType?: ts.Type,
      alternateRawPropType?: ts.Type,
    ): boolean => {
      const resolved = resolveCustomReturnTypes(
        innerExprNode,
        targetTypeNode,
        explicitPropType,
      );
      if (!resolved) {
        return false;
      }
      const {
        typeChecker,
        exprNode,
        tsExpr,
        tsTarget,
        exprType,
        propType,
        rawPropType,
      } = resolved;

      // A. Custom GraphQLScalarType<TInternal, TExternal>
      const scalarInternalType = extractGraphQLScalarInternalType(
        typeChecker,
        exprType,
      );
      if (scalarInternalType) {
        const rawCandidate = alternateRawPropType ?? rawPropType;
        return (
          areTypesEquivalent(typeChecker, propType, scalarInternalType) ||
          (rawCandidate !== propType &&
            areTypesEquivalent(typeChecker, rawCandidate, scalarInternalType))
        );
      }
      if (scalarOnly) {
        return false;
      }

      // B. Runtime class / Type<T> / EntityClass<T>
      const instanceType = extractConstructedInstanceType(
        typeChecker,
        exprType,
        tsExpr,
      );
      if (instanceType) {
        if (
          hasClassSymbol(instanceType) &&
          hasClassSymbol(propType) &&
          instanceType.symbol !== propType.symbol
        ) {
          return false;
        }
        return areTypesEquivalent(typeChecker, propType, instanceType);
      }

      // C. TypeScript enum or GraphQL enum object map
      return matchesEnumObjectType(
        typeChecker,
        exprNode,
        exprType,
        propType,
        tsExpr,
        tsTarget,
      );
    };

    const isTypeOnlySymbol = (node?: TSESTree.Node): boolean => {
      if (!node || !checker || !esTreeNodeToTSNodeMap) {
        return false;
      }
      const sym = resolveAliasedSymbol(
        checker,
        esTreeNodeToTSNodeMap.get(node),
      );
      return sym !== undefined && !isSymbolFlagSet(sym, ts.SymbolFlags.Value);
    };

    const graphqlModules = ["@nestjs/graphql", "@nest-boot/graphql"];
    const jsonModule = "graphql-type-json";
    const scalarModules = (name: string) =>
      name === "GraphQLJSONObject" ? jsonModule : graphqlModules;
    const scalarBinding = (name: string): string =>
      ["Int", "Float", "ID", "GraphQLJSONObject"].includes(name)
        ? getLocalImportBinding(
            source,
            scalarModules(name),
            name,
            importLocation,
            filename,
          )
        : name;
    const typeBinding = (info: TypeInfo) =>
      info.scalarExpression ??
      (info.isCustomType
        ? (info.typeName ?? "")
        : scalarBinding(info.typeName ?? ""));
    const fieldBinding = () =>
      getLocalImportBinding(
        source,
        graphqlModules,
        "Field",
        importLocation,
        filename,
      );
    const decoratorName = (name: TSESTree.Node) =>
      getImportedName(source, graphqlModules, name, filename);

    const findRootVariable = (node: TSESTree.Node) => {
      const identifier =
        node.type === AST_NODE_TYPES.MemberExpression ? node.object : node;
      return ASTUtils.isIdentifier(identifier)
        ? ASTUtils.findVariable(source.getScope(identifier), identifier)
        : null;
    };

    const hasResolvedBinding = (node: TSESTree.Node) =>
      findRootVariable(node) !== null;

    const hasDeclaredBinding = (node: TSESTree.Node) =>
      (findRootVariable(node)?.defs.length ?? 0) > 0;

    const ensureImports = (
      fixer: RuleFixer,
      info: TypeInfo,
      includeField = true,
    ): RuleFix[] => {
      const expected =
        info.isCustomType || info.scalarExpression ? "" : (info.typeName ?? "");
      const names = [
        ...(includeField ? ["Field"] : []),
        ...(["Int", "Float", "ID"].includes(expected) ? [expected] : []),
      ];
      const fixes = ensureNamedImportFixes(
        fixer,
        source,
        graphqlModules,
        names,
        true,
        importLocation,
        filename,
      );
      if (expected === "GraphQLJSONObject") {
        fixes.push(
          ...ensureNamedImportFixes(
            fixer,
            source,
            jsonModule,
            [expected],
            true,
            importLocation,
            filename,
          ),
        );
      }
      return fixes;
    };

    const getExpectedNullableOption = (
      info: TypeInfo,
    ): ExpectedNullableOption => {
      const isGraphqlList = info.isArray && !info.isWholeValueScalar;
      if (isGraphqlList && info.isItemsNullable) {
        return info.isNullable ? "itemsAndList" : "items";
      }
      return info.isNullable ? true : null;
    };

    const formatNullableOption = (
      option: ExpectedNullableOption,
    ): string | null => {
      if (option === true) {
        return "nullable: true";
      }
      if (option !== null) {
        return `nullable: "${option}"`;
      }
      return null;
    };

    const parseNullableOption = (
      callExpr: TSESTree.CallExpression,
    ): ExpectedNullableOption | "invalid" => {
      const optionsArg =
        callExpr.arguments[0]?.type === AST_NODE_TYPES.ObjectExpression
          ? callExpr.arguments[0]
          : callExpr.arguments[1]?.type === AST_NODE_TYPES.ObjectExpression
            ? callExpr.arguments[1]
            : null;
      if (!optionsArg) {
        return null;
      }
      const prop = optionsArg.properties.findLast(
        (item) =>
          item.type === AST_NODE_TYPES.Property &&
          !item.computed &&
          ASTUtils.getPropertyName(item) === "nullable",
      );
      if (prop?.type !== AST_NODE_TYPES.Property) {
        return null;
      }
      if (prop.value.type === AST_NODE_TYPES.Literal) {
        if (prop.value.value === false) {
          return null;
        }
        if (
          prop.value.value === true ||
          prop.value.value === "items" ||
          prop.value.value === "itemsAndList"
        ) {
          return prop.value.value;
        }
      }
      return "invalid";
    };

    const addFieldDecorator = (
      fixer: RuleFixer,
      property: TSESTree.PropertyDefinition,
      info: TypeInfo,
    ): RuleFix[] => {
      const typeName = typeBinding(info);
      const typeExpr =
        info.isArray && !info.isWholeValueScalar
          ? `() => [${typeName}]`
          : `() => ${typeName}`;
      const formattedNullable = formatNullableOption(
        getExpectedNullableOption(info),
      );
      const optionsExpr = formattedNullable ? `, { ${formattedNullable} }` : "";
      const newDecoratorText = `@${fieldBinding()}(${typeExpr}${optionsExpr})`;

      return [
        ...ensureImports(fixer, info),
        fixer.insertTextBefore(property, `${newDecoratorText}\n  `),
      ];
    };

    const fixWithTypeInfo = (
      fixer: RuleFixer,
      fieldDecorator: TSESTree.Decorator,
      info: TypeInfo,
    ): RuleFix[] => {
      const typeName = typeBinding(info);
      const typeExpr =
        info.isArray && !info.isWholeValueScalar
          ? `() => [${typeName}]`
          : `() => ${typeName}`;
      const expectedNullableText = formatNullableOption(
        getExpectedNullableOption(info),
      );

      // Extract existing config options (except nullable)
      const callExpr = fieldDecorator.expression;
      const existingOptions: string[] = [];

      // Check if there is an existing config object
      let optionsArg: TSESTree.ObjectExpression | null = null;
      if (
        callExpr.type === AST_NODE_TYPES.CallExpression &&
        callExpr.arguments.length > 0
      ) {
        if (callExpr.arguments[0]?.type === AST_NODE_TYPES.ObjectExpression) {
          optionsArg = callExpr.arguments[0];
        } else if (
          callExpr.arguments[1]?.type === AST_NODE_TYPES.ObjectExpression
        ) {
          optionsArg = callExpr.arguments[1];
        }
      }

      let hasNullableProperty = false;
      if (optionsArg) {
        optionsArg.properties.forEach((prop: TSESTree.ObjectLiteralElement) => {
          if (prop.type === AST_NODE_TYPES.SpreadElement) {
            existingOptions.push(source.getText(prop));
            return;
          }
          if (!prop.computed && ASTUtils.getPropertyName(prop) === "nullable") {
            hasNullableProperty = true;
            if (expectedNullableText) {
              existingOptions.push(expectedNullableText);
            }
          } else {
            existingOptions.push(source.getText(prop));
          }
        });
      }

      if (expectedNullableText && !hasNullableProperty) {
        existingOptions.unshift(expectedNullableText);
      }

      const optionsExpr =
        existingOptions.length > 0 ? `, { ${existingOptions.join(", ")} }` : "";
      const existingField =
        callExpr.type === AST_NODE_TYPES.CallExpression &&
        hasResolvedBinding(callExpr.callee) &&
        !isTypeOnlyImportReference(source, callExpr.callee)
          ? source.getText(callExpr.callee)
          : null;
      const newDecoratorText = `@${existingField ?? fieldBinding()}(${typeExpr}${optionsExpr})`;

      return [
        ...ensureImports(fixer, info, existingField === null),
        fixer.replaceText(fieldDecorator, newDecoratorText),
      ];
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
        const modelImportRefs = node.decorators.flatMap((decorator) =>
          decorator.expression.type === AST_NODE_TYPES.CallExpression &&
          decoratorName(decorator.expression.callee) !== null &&
          isTypeOnlyImportReference(source, decorator.expression.callee)
            ? [decorator.expression.callee]
            : [],
        );
        if (modelImportRefs.length > 0) {
          context.report({
            node,
            messageId: "alignFieldDecoratorWithTsType",
            fix: (fixer) =>
              promoteTypeImportFixes(fixer, source, modelImportRefs),
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

          let foundDecoratorName: string | null = null;
          let foundBehavior: DecoratorBehavior | null = null;

          for (const decorator of member.decorators) {
            if (decorator.expression.type === AST_NODE_TYPES.CallExpression) {
              const callee = decorator.expression.callee;
              const name =
                getImportedName(
                  source,
                  [...graphqlModules, ...ormModules],
                  callee,
                  filename,
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

          if (foundBehavior === "ignore") {
            return;
          }

          const fieldDecorator = member.decorators.find(
            (decorator) =>
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decoratorName(decorator.expression.callee) === "Field",
          );

          if (foundBehavior === "remove" && fieldDecorator) {
            context.report({
              node: fieldDecorator,
              messageId: "removeFieldDecorator",
              data: {
                decoratorName: foundDecoratorName ?? "unknown",
              },
              fix: (fixer) => {
                const decoratorStart = fieldDecorator.range[0];
                const decoratorEnd = fieldDecorator.range[1];
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

          if (foundBehavior === "remove") {
            return;
          }

          const typeInfo = computeTypeInfo(member);
          if (!typeInfo?.typeName) {
            return;
          }

          if (!fieldDecorator) {
            if (
              typeInfo.isCustomType &&
              (typeInfo.unautofixableCustomType ||
                isTypeOnlySymbol(typeInfo.typeReference))
            ) {
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
              });
              return;
            }
            if (
              typeInfo.typeReference &&
              isTypeOnlyImportReference(source, typeInfo.typeReference)
            ) {
              const customRef = typeInfo.typeReference;
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
                fix: (fixer) =>
                  promoteTypeImportFixes(fixer, source, [customRef]),
              });
              return;
            }
            context.report({
              node: member,
              messageId: "alignFieldDecoratorWithTsType",
              fix: (fixer) => addFieldDecorator(fixer, member, typeInfo),
            });
            return;
          }

          const callExpr = fieldDecorator.expression;
          if (callExpr.type !== AST_NODE_TYPES.CallExpression) {
            return;
          }

          let needReport = true;
          let scalarReference: TSESTree.Node | null = null;
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

            const effectiveScalarName =
              typeInfo.compatibleScalar ??
              (typeInfo.isCustomType ? null : typeInfo.typeName);
            const isNumberType = effectiveScalarName === "Float";
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
              ? getImportedName(
                  source,
                  scalarModules(effectiveScalarName ?? typeInfo.typeName),
                  scalarNode,
                  filename,
                )
              : null;
            const isValidNumberType =
              isNumberType &&
              !!explicitScalar &&
              ["Int", "Float"].includes(explicitScalar) &&
              typeInfo.isArray === bodyIsArray;
            if (isValidNumberType) {
              typeInfo.typeName = explicitScalar;
              typeInfo.isCustomType = false;
              typeInfo.unautofixableCustomType = false;
            }
            const compatiblePrimitive =
              typeInfo.compatibleScalar === "String" ||
              typeInfo.compatibleScalar === "Boolean"
                ? typeInfo.compatibleScalar
                : null;
            const isValidCompatiblePrimitive =
              compatiblePrimitive !== null &&
              scalarNode?.type === AST_NODE_TYPES.Identifier &&
              scalarNode.name === compatiblePrimitive &&
              !hasDeclaredBinding(scalarNode) &&
              typeInfo.isArray === bodyIsArray;
            if (compatiblePrimitive !== null && isValidCompatiblePrimitive) {
              typeInfo.typeName = compatiblePrimitive;
              typeInfo.isCustomType = false;
              typeInfo.unautofixableCustomType = false;
            }
            const isValidScalar =
              !typeInfo.isCustomType &&
              !!explicitScalar &&
              ["Int", "Float", "ID", "GraphQLJSONObject"].includes(
                explicitScalar,
              ) &&
              explicitScalar === typeInfo.typeName &&
              typeInfo.isArray === bodyIsArray;
            if (
              isValidScalar &&
              scalarNode &&
              hasResolvedBinding(scalarNode) &&
              !isTypeOnlyImportReference(source, scalarNode)
            ) {
              typeInfo.scalarExpression = source.getText(scalarNode);
            }

            let typeMatches =
              !typeInfo.unautofixableCustomType &&
              (calleeText === expectedTypeText ||
                isValidNumberType ||
                isValidCompatiblePrimitive ||
                isValidScalar);

            const formatScalarExpression = (node: TSESTree.Node) =>
              node.type === AST_NODE_TYPES.SequenceExpression
                ? `(${source.getText(node)})`
                : source.getText(node);
            const isIdField =
              !typeInfo.isCustomType && typeInfo.typeName === "ID";
            if (
              !typeMatches &&
              scalarNode &&
              (typeInfo.targetTypeNode || typeInfo.resolvedTargetTsType) &&
              typeInfo.isArray === bodyIsArray &&
              matchesGraphqlReturnType(
                scalarNode,
                typeInfo.targetTypeNode,
                isIdField,
                typeInfo.resolvedTargetTsType,
                typeInfo.resolvedRawItemTsType,
              )
            ) {
              typeMatches = true;
              isSemanticMatch = true;
              typeInfo.scalarExpression = formatScalarExpression(scalarNode);
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
              typeInfo.scalarExpression = formatScalarExpression(scalarNode);
            }

            const currentNullable = parseNullableOption(callExpr);
            const expectedNullable = getExpectedNullableOption(typeInfo);
            if (typeMatches && currentNullable === expectedNullable) {
              needReport = false;
            }
          }

          if (
            scalarReference !== null &&
            isTypeOnlyImportReference(source, scalarReference) &&
            (isSemanticMatch || (!needReport && typeInfo.isCustomType))
          ) {
            const ref = scalarReference;
            context.report({
              node: member,
              messageId: "alignFieldDecoratorWithTsType",
              fix: (fixer) => promoteTypeImportFixes(fixer, source, [ref]),
            });
            return;
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
                    filename,
                  ) &&
                  !hasNamedImport(
                    source,
                    modules,
                    typeInfo.typeName,
                    true,
                    importLocation,
                    filename,
                  )));
            const typeOnlyField =
              isTypeOnlyImportReference(source, callExpr.callee) ||
              (hasNamedImport(
                source,
                graphqlModules,
                "Field",
                false,
                importLocation,
                filename,
              ) &&
                !hasNamedImport(
                  source,
                  graphqlModules,
                  "Field",
                  true,
                  importLocation,
                  filename,
                ));
            if (!typeOnlyScalar && !typeOnlyField) {
              return;
            }
          }

          if (!typeInfo.scalarExpression) {
            if (
              typeInfo.isCustomType &&
              (typeInfo.unautofixableCustomType ||
                isTypeOnlySymbol(typeInfo.typeReference))
            ) {
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
              });
              return;
            }
            if (
              typeInfo.typeReference &&
              isTypeOnlyImportReference(source, typeInfo.typeReference)
            ) {
              const customRef = typeInfo.typeReference;
              context.report({
                node: member,
                messageId: "alignFieldDecoratorWithTsType",
                fix: (fixer) =>
                  promoteTypeImportFixes(fixer, source, [customRef]),
              });
              return;
            }
          }

          context.report({
            node: member,
            messageId: "alignFieldDecoratorWithTsType",
            fix: (fixer) => fixWithTypeInfo(fixer, fieldDecorator, typeInfo),
          });
        });
      },
    };
  },
});

import {
  AST_NODE_TYPES,
  ESLintUtils,
  TSESTree,
} from "@typescript-eslint/utils";
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
  isEnum: boolean; // Whether the type is an enum
  propertyType: string | null; // MikroORM type such as t.text, t.bigint, etc.
  arrayElementTypeName?: string | null; // Type name of array elements (for special validation)
}

export default createRule<
  [],
  | "alignPropertyDecoratorWithTsType"
  | "alignSearchablePropertyOptions"
  | "removePropertyDecorator"
  | "useEnumDecorator"
  | "useOptTypeForInitializedProperty"
  | "removeOptTypeForNonInitializedProperty"
>({
  name: "database/entity-property-config-from-types",
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
      alignSearchablePropertyOptions:
        "@SearchableProperty should infer its entity type from the class, align nullable and omit type, index, onCreate and onUpdate.",
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
    let importLocation: TSESTree.Node = source.ast;
    const coreModule = "@mikro-orm/core";
    const decoratorsModule = "@mikro-orm/decorators/legacy";
    const fullTextModules = [
      "@mikro-orm/sql",
      "@mikro-orm/postgresql",
      "@mikro-orm/pglite",
    ];
    const coreName = (local: TSESTree.Node) =>
      importedBindingName(source, coreModule, local);
    const decoratorModules = [
      decoratorsModule,
      "@nest-boot/database",
      "@nest-boot/database-crypt",
      "@nest-boot/database-hash",
    ];
    const decoratorName = (local: TSESTree.Node) =>
      importedBindingName(source, decoratorModules, local);
    const importEdits = (
      modules: string | readonly string[],
      names: readonly string[],
      value = true,
    ) => namedImportEdits(source, modules, names, value, importLocation);
    const hasImport = (
      modules: string | readonly string[],
      name: string,
      value = true,
    ) => hasNamedImport(source, modules, name, value, importLocation);
    const coreBinding = (name: string) =>
      namedImportBinding(source, coreModule, name, importLocation);
    const decoratorBinding = (name: string) =>
      namedImportBinding(source, decoratorsModule, name, importLocation);
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    // Check if the type is a runtime enum (excluding pure type-only aliases)
    const isEnumType = (node: TSESTree.Node): boolean => {
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const rawSym =
          ts.isTypeReferenceNode(tsNode) && ts.isIdentifier(tsNode.typeName)
            ? checker.getSymbolAtLocation(tsNode.typeName)
            : checker.getSymbolAtLocation(tsNode);
        const sym =
          rawSym && rawSym.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(rawSym)
            : rawSym;
        if (sym && (sym.flags & ts.SymbolFlags.Value) === 0) {
          return false;
        }
        const type = checker.getTypeAtLocation(tsNode);

        if ((type.symbol?.flags ?? 0) & ts.SymbolFlags.Enum) {
          return true;
        }

        if (type.isUnion()) {
          return type.types.some((t) => {
            const flags = t.symbol?.flags ?? 0;
            return Boolean(
              flags & ts.SymbolFlags.EnumMember || flags & ts.SymbolFlags.Enum,
            );
          });
        }

        return false;
      } catch {
        return false;
      }
    };

    const getPropertyType = (typeName: string | null): string | null => {
      if (!typeName) {
        return null;
      }

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
        case "BigInt":
        case "bigint":
          return "t.bigint"; // Default to t.bigint
        case "Date":
          return "t.datetime"; // Default to t.datetime
        case "GraphQLJSONObject":
        case "Record":
          return "t.json";
        default:
          return null;
      }
    };

    const resolveStringLiteralValue = (node?: TSESTree.Node): string | null => {
      if (!node) {
        return null;
      }
      if (
        node.type === AST_NODE_TYPES.Literal &&
        typeof node.value === "string"
      ) {
        return node.value;
      }
      try {
        const tsArg = parserServices.esTreeNodeToTSNodeMap.get(node);
        const argType = checker.getTypeAtLocation(tsArg);
        if (argType.isStringLiteral()) {
          return argType.value;
        }
      } catch {
        // Leave value unresolved if type lookup fails.
      }
      return null;
    };

    const resolveColumnTypeSpec = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
    ): {
      canonical: string | null;
      isNew: boolean;
      hasModeArg: boolean;
      mode: string | null;
      firstArg?: TSESTree.Node;
      isFullText: boolean;
    } => {
      if (!typeNode || !typeConfig) {
        return {
          canonical: null,
          isNew: false,
          hasModeArg: false,
          mode: null,
          isFullText: false,
        };
      }

      const isNew = typeNode.type === AST_NODE_TYPES.NewExpression;
      const target = isNew ? typeNode.callee : typeNode;
      const firstArg = isNew ? typeNode.arguments.at(0) : undefined;
      let isExplicitUndefined = false;
      if (firstArg) {
        try {
          const argType = checker.getTypeAtLocation(
            parserServices.esTreeNodeToTSNodeMap.get(firstArg),
          );
          isExplicitUndefined = argType.flags === ts.TypeFlags.Undefined;
        } catch {
          // Leave unresolved if type lookup fails.
        }
      }
      const hasModeArg = firstArg !== undefined && !isExplicitUndefined;
      const mode = hasModeArg ? resolveStringLiteralValue(firstArg) : null;

      if (
        importedBindingName(source, fullTextModules, target) === "FullTextType"
      ) {
        return {
          canonical: "FullTextType",
          isNew,
          hasModeArg,
          mode,
          firstArg,
          isFullText: true,
        };
      }

      if (
        target.type === AST_NODE_TYPES.MemberExpression &&
        !target.computed &&
        target.property.type === AST_NODE_TYPES.Identifier &&
        coreName(target.object) === "t"
      ) {
        return {
          canonical: `t.${target.property.name}`,
          isNew,
          hasModeArg,
          mode,
          firstArg,
          isFullText: false,
        };
      }

      const coreIdent = coreName(target);
      if (coreIdent) {
        return {
          canonical: coreIdent,
          isNew,
          hasModeArg,
          mode,
          firstArg,
          isFullText: false,
        };
      }

      if (target.type === AST_NODE_TYPES.Identifier) {
        return {
          canonical: target.name,
          isNew,
          hasModeArg,
          mode,
          firstArg,
          isFullText: false,
        };
      }

      if (
        target.type === AST_NODE_TYPES.MemberExpression &&
        !target.computed &&
        target.property.type === AST_NODE_TYPES.Identifier &&
        target.property.name === "VectorType"
      ) {
        return {
          canonical: "VectorType",
          isNew,
          hasModeArg,
          mode,
          firstArg,
          isFullText: false,
        };
      }

      return {
        canonical: typeConfig,
        isNew,
        hasModeArg,
        mode,
        firstArg,
        isFullText: false,
      };
    };

    const resolveEffectiveDecimalMode = (
      spec: ReturnType<typeof resolveColumnTypeSpec>,
      runtimeType?: { present: boolean; value: string | null },
    ): { mode: string | null; isDynamic: boolean } => {
      if (spec.isNew && spec.hasModeArg) {
        return { mode: spec.mode, isDynamic: spec.mode === null };
      }
      if (runtimeType?.present) {
        return {
          mode: runtimeType.value,
          isDynamic: runtimeType.value === null,
        };
      }
      return { mode: spec.isNew ? "string" : null, isDynamic: false };
    };

    const isValidStringType = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
      runtimeType?: { present: boolean; value: string | null },
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      if (!spec.canonical) {
        return false;
      }
      if (spec.isFullText) {
        return true;
      }

      const stringTypes = new Set([
        "t.string",
        "t.text",
        "t.uuid",
        "t.character",
        "t.date",
        "t.time",
        "StringType",
        "TextType",
        "UuidType",
        "CharacterType",
        "DateType",
        "TimeType",
      ]);
      if (stringTypes.has(spec.canonical)) {
        return true;
      }

      if (spec.canonical === "t.decimal" || spec.canonical === "DecimalType") {
        // MikroORM DecimalType hydrates via (this.mode ?? this.prop?.runtimeType ?? "string")
        const effective = resolveEffectiveDecimalMode(spec, runtimeType);
        return (
          effective.isDynamic ||
          effective.mode === null ||
          effective.mode === "string"
        );
      }

      if (spec.canonical === "t.bigint" || spec.canonical === "BigIntType") {
        // Bare t.bigint / BigIntType is allowed; instantiated form must use "string" mode (or an unresolved dynamic mode)
        return (
          !spec.isNew ||
          spec.mode === "string" ||
          (spec.hasModeArg && spec.mode === null)
        );
      }

      return false;
    };

    const isValidNumberType = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
      runtimeType?: { present: boolean; value: string | null },
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      if (!spec.canonical) {
        return false;
      }

      const numberTypes = new Set([
        "t.integer",
        "t.smallint",
        "t.tinyint",
        "t.mediumint",
        "t.float",
        "t.double",
        "IntegerType",
        "SmallIntType",
        "TinyIntType",
        "MediumIntType",
        "FloatType",
        "DoubleType",
      ]);
      if (numberTypes.has(spec.canonical)) {
        return true;
      }

      if (spec.canonical === "t.decimal" || spec.canonical === "DecimalType") {
        const effective = resolveEffectiveDecimalMode(spec, runtimeType);
        return (
          effective.isDynamic ||
          (!spec.isNew && effective.mode === null) ||
          effective.mode === "number"
        );
      }

      if (spec.canonical === "t.bigint" || spec.canonical === "BigIntType") {
        return (
          !spec.isNew ||
          spec.mode === "number" ||
          (spec.hasModeArg && spec.mode === null)
        );
      }

      return false;
    };

    const isValidBigIntType = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      if (spec.canonical !== "t.bigint" && spec.canonical !== "BigIntType") {
        return false;
      }
      // BigIntType defaults to "bigint" mode; preserve dynamic modes that cannot be statically disproven
      return (
        !spec.isNew ||
        !spec.hasModeArg ||
        spec.mode === null ||
        spec.mode === "bigint"
      );
    };

    const isConverterCompatibleWithElement = (
      converterNode: TSESTree.Node,
      elementTypeName: "number" | "string",
    ): boolean => {
      try {
        const tsArg = parserServices.esTreeNodeToTSNodeMap.get(converterNode);
        const argType = checker.getTypeAtLocation(tsArg);
        const signatures = checker.getSignaturesOfType(
          argType,
          ts.SignatureKind.Call,
        );
        if (signatures.length === 0) {
          return true;
        }
        const expectedFlag =
          elementTypeName === "number"
            ? ts.TypeFlags.NumberLike
            : ts.TypeFlags.StringLike;
        const matchesExpectedType = (type: ts.Type): boolean => {
          if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
            return true;
          }
          if (type.isUnion()) {
            return (
              type.types.length > 0 && type.types.every(matchesExpectedType)
            );
          }
          return (type.flags & expectedFlag) !== 0;
        };
        return signatures.some((signature) =>
          matchesExpectedType(signature.getReturnType()),
        );
      } catch {
        return true;
      }
    };

    const isValidArrayType = (
      elementTypeName: string | null | undefined,
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      if (!spec.canonical) {
        return false;
      }
      if (spec.canonical === "t.json" || spec.canonical === "JsonType") {
        return true;
      }
      if (elementTypeName === "number" && spec.canonical === "VectorType") {
        return true;
      }
      if (spec.canonical === "t.array" || spec.canonical === "ArrayType") {
        if (!spec.isNew) {
          return true;
        }
        if (elementTypeName === "number") {
          return (
            spec.firstArg !== undefined &&
            isConverterCompatibleWithElement(spec.firstArg, "number")
          );
        }
        if (elementTypeName === "string") {
          return (
            spec.firstArg === undefined ||
            isConverterCompatibleWithElement(spec.firstArg, "string")
          );
        }
      }
      return false;
    };

    const isValidDateType = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      if (!spec.canonical) {
        return false;
      }
      if (
        spec.canonical === "t.datetime" ||
        spec.canonical === "DateTimeType"
      ) {
        return true;
      }
      // Preserve legacy bare t.date / t.time usage on Date fields, but reject DateType/TimeType constructors that hydrate to strings
      return (
        !spec.isNew &&
        (spec.canonical === "t.date" || spec.canonical === "t.time")
      );
    };

    const isValidBooleanType = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      return spec.canonical === "t.boolean" || spec.canonical === "BooleanType";
    };

    const isValidJsonType = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      return spec.canonical === "t.json" || spec.canonical === "JsonType";
    };

    const isJsonSerializableType = (
      member: ts.Type,
      visited = new Set<ts.Type>(),
      allowUndefined = false,
      allowDynamic = false,
    ): boolean => {
      if (visited.has(member)) {
        return true;
      }
      if (member.isUnion()) {
        return (
          member.types.length > 0 &&
          member.types.every((item) =>
            isJsonSerializableType(item, visited, allowUndefined, allowDynamic),
          )
        );
      }
      if (
        allowDynamic &&
        member.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)
      ) {
        return true;
      }
      if (allowUndefined && member.flags & ts.TypeFlags.Undefined) {
        return true;
      }
      if (
        member.flags &
        (ts.TypeFlags.BigIntLike |
          ts.TypeFlags.ESSymbolLike |
          ts.TypeFlags.Void |
          ts.TypeFlags.Undefined |
          ts.TypeFlags.Never)
      ) {
        return false;
      }
      if (
        member.flags &
        (ts.TypeFlags.StringLike |
          ts.TypeFlags.NumberLike |
          ts.TypeFlags.BooleanLike |
          ts.TypeFlags.Null |
          ts.TypeFlags.NonPrimitive)
      ) {
        return true;
      }
      if (member.flags & ts.TypeFlags.Object) {
        if (
          checker.getSignaturesOfType(member, ts.SignatureKind.Call).length > 0
        ) {
          return false;
        }
        if (
          [
            "Date",
            "RegExp",
            "Map",
            "Set",
            "WeakMap",
            "WeakSet",
            "Promise",
            "Uint8Array",
            "Buffer",
            "Function",
          ].includes(member.symbol?.name ?? "")
        ) {
          return false;
        }

        visited.add(member);
        if (checker.isTupleType(member)) {
          return checker
            .getTypeArguments(member as ts.TypeReference)
            .every((item) =>
              isJsonSerializableType(item, visited, false, true),
            );
        }
        if (
          checker.isArrayType(member) ||
          member.symbol?.name === "ReadonlyArray"
        ) {
          const elemType =
            checker.getTypeArguments(member as ts.TypeReference)[0] ??
            checker.getIndexTypeOfType(member, ts.IndexKind.Number);
          return elemType
            ? isJsonSerializableType(elemType, visited, false, true)
            : true;
        }

        const stringIndexType = checker.getIndexTypeOfType(
          member,
          ts.IndexKind.String,
        );
        if (
          stringIndexType &&
          !isJsonSerializableType(stringIndexType, visited, false, true)
        ) {
          return false;
        }
        const numberIndexType = checker.getIndexTypeOfType(
          member,
          ts.IndexKind.Number,
        );
        if (
          numberIndexType &&
          !isJsonSerializableType(numberIndexType, visited, false, true)
        ) {
          return false;
        }
        for (const prop of checker.getPropertiesOfType(member)) {
          const propType = checker.getTypeOfSymbol(prop);
          const isOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
          if (!isJsonSerializableType(propType, visited, isOptional, true)) {
            return false;
          }
        }
        return true;
      }
      return false;
    };

    const hasResolvedNullishType = (node: TSESTree.TypeNode): boolean => {
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!ts.isTypeNode(tsNode)) {
          return false;
        }
        const resolved = checker.getTypeFromTypeNode(tsNode);
        if (resolved.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) {
          return true;
        }
        return (
          resolved.isUnion() &&
          resolved.types.some(
            (member) =>
              (member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) !==
              0,
          )
        );
      } catch {
        return false;
      }
    };

    const classifyScalarTsType = (
      type: ts.Type,
    ): "string" | "number" | "boolean" | "bigint" | null => {
      if (type.isUnion()) {
        if (type.types.length === 0) {
          return null;
        }
        if (
          type.types.every(
            (member) => (member.flags & ts.TypeFlags.StringLike) !== 0,
          )
        ) {
          return "string";
        }
        if (
          type.types.every(
            (member) => (member.flags & ts.TypeFlags.NumberLike) !== 0,
          )
        ) {
          return "number";
        }
        if (
          type.types.every(
            (member) => (member.flags & ts.TypeFlags.BooleanLike) !== 0,
          )
        ) {
          return "boolean";
        }
        if (
          type.types.every(
            (member) => (member.flags & ts.TypeFlags.BigIntLike) !== 0,
          )
        ) {
          return "bigint";
        }
        return null;
      }
      if (type.flags & ts.TypeFlags.StringLike) {
        return "string";
      }
      if (type.flags & ts.TypeFlags.NumberLike) {
        return "number";
      }
      if (type.flags & ts.TypeFlags.BooleanLike) {
        return "boolean";
      }
      if (type.flags & ts.TypeFlags.BigIntLike) {
        return "bigint";
      }
      return null;
    };

    const classifyArrayElementTsType = (
      elemType: ts.Type,
    ): {
      propertyType: string | null;
      arrayElementTypeName?: string;
      unsupportedUnion?: boolean;
    } => {
      const elemKind = classifyScalarTsType(elemType);
      if (elemKind === "string" || elemKind === "number") {
        return { propertyType: "t.array", arrayElementTypeName: elemKind };
      }
      if (elemKind === "boolean") {
        return { propertyType: "t.json", arrayElementTypeName: "boolean" };
      }
      if (elemKind === "bigint") {
        return { propertyType: null, unsupportedUnion: true };
      }
      return isJsonSerializableType(elemType)
        ? { propertyType: "t.json" }
        : { propertyType: null, unsupportedUnion: true };
    };

    const inferPropertyTypeFromResolvedTsType = (
      node: TSESTree.TypeNode,
    ): {
      propertyType: string | null;
      arrayElementTypeName?: string;
      unsupportedUnion?: boolean;
    } => {
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!ts.isTypeNode(tsNode)) {
          return { propertyType: null };
        }
        const resolved = checker.getNonNullableType(
          checker.getTypeFromTypeNode(tsNode),
        );
        if (
          resolved.flags &
          (ts.TypeFlags.Any |
            ts.TypeFlags.Unknown |
            ts.TypeFlags.Never |
            ts.TypeFlags.Void)
        ) {
          return { propertyType: null };
        }
        const scalarKind = classifyScalarTsType(resolved);
        if (scalarKind !== null) {
          return { propertyType: getPropertyType(scalarKind) };
        }
        if (resolved.isUnion()) {
          if (resolved.types.length === 0) {
            return { propertyType: null };
          }
          // Heterogeneous JSON-serializable union (e.g. string | boolean | number | object) requires JSON storage;
          // unions with non-JSON-serializable members (e.g. string | bigint, string | bigint[], boolean | Date) require an explicit custom Type.
          return resolved.types.every((member) =>
            isJsonSerializableType(member),
          )
            ? { propertyType: "t.json" }
            : { propertyType: null, unsupportedUnion: true };
        }
        // Resolved array / ReadonlyArray type aliases (e.g. type Tags = readonly string[] or readonly ("a" | "b")[])
        if (
          checker.isArrayType(resolved) ||
          resolved.symbol?.name === "ReadonlyArray"
        ) {
          const elemType =
            checker.getTypeArguments(resolved as ts.TypeReference)[0] ??
            checker.getIndexTypeOfType(resolved, ts.IndexKind.Number);
          if (!elemType) {
            return { propertyType: null };
          }
          return classifyArrayElementTsType(elemType);
        }
        // Plain non-class object/interface/tuple types (excluding classes, arrays, built-in objects)
        if (
          resolved.flags & ts.TypeFlags.Object &&
          !(resolved.symbol && resolved.symbol.flags & ts.SymbolFlags.Class) &&
          ![
            "Date",
            "RegExp",
            "Map",
            "Set",
            "Promise",
            "Array",
            "ReadonlyArray",
            "Uint8Array",
            "Buffer",
          ].includes(resolved.symbol?.name ?? "") &&
          (checker.isTupleType(resolved) ||
            checker.getPropertiesOfType(resolved).length > 0 ||
            checker.getIndexInfosOfType(resolved).length > 0) &&
          isJsonSerializableType(resolved)
        ) {
          return { propertyType: "t.json" };
        }
        return { propertyType: null };
      } catch {
        return { propertyType: null };
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

    const isCollectionType = (node: TSESTree.TypeNode): boolean => {
      return (
        node.type === AST_NODE_TYPES.TSTypeReference &&
        coreName(node.typeName) === "Collection"
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
        coreName(typeNode.typeName) === "Opt"
      );
    };

    const hasOptImport = () => hasImport(coreModule, "Opt", false);
    const hasEnumImport = () => hasImport(decoratorsModule, "Enum");

    const addOptImport = (): RuleFix[] =>
      importEdits(coreModule, ["Opt"], false);
    const addEnumImport = (): RuleFix[] =>
      importEdits(decoratorsModule, ["Enum"]);
    const addPropertyDecoratorImports = (info: TypeInfo): RuleFix[] => [
      ...importEdits(decoratorsModule, ["Property"]),
      ...(info.propertyType?.startsWith("t.")
        ? importEdits(coreModule, ["t"])
        : []),
    ];

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

      // Unwrap outer null/undefined and nested Ref<T>/Opt<T> wrappers
      while (baseTypeNode) {
        if (baseTypeNode.type === AST_NODE_TYPES.TSUnionType) {
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
          continue;
        }
        if (
          baseTypeNode.type === AST_NODE_TYPES.TSTypeReference &&
          (coreName(baseTypeNode.typeName) === "Ref" ||
            coreName(baseTypeNode.typeName) === "Opt")
        ) {
          const inner = baseTypeNode.typeArguments?.params[0] ?? null;
          if (!inner || inner === baseTypeNode) {
            break;
          }
          baseTypeNode = inner;
          continue;
        }
        break;
      }

      // Skip Collection<T> types (these should be handled by OneToMany etc. decorators)
      if (baseTypeNode && isCollectionType(baseTypeNode)) {
        return null;
      }

      // Carry nullability declared inside aliased types (e.g. type Progress = string | number | null)
      if (!isNullable && baseTypeNode && hasResolvedNullishType(baseTypeNode)) {
        isNullable = true;
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
          if (typeOf === "boolean") {
            return {
              typeName: "boolean",
              isArray,
              isNullable,
              isEnum: false,
              propertyType: isArray ? "t.json" : getPropertyType("boolean"),
              arrayElementTypeName: isArray ? "boolean" : undefined,
            };
          }
          if (typeOf === "number") {
            return {
              typeName: "number",
              isArray,
              isNullable,
              isEnum: false,
              propertyType: isArray ? "t.array" : getPropertyType("number"),
              arrayElementTypeName: isArray ? "number" : undefined,
            };
          }
          if (typeOf === "string") {
            return {
              typeName: "string",
              isArray,
              isNullable,
              isEnum: false,
              propertyType: isArray ? "t.array" : getPropertyType("string"),
              arrayElementTypeName: isArray ? "string" : undefined,
            };
          }
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
      if (targetTypeNode.type === AST_NODE_TYPES.TSBigIntKeyword) {
        // MikroORM's default t.array returns string elements without a custom converter;
        // do not infer bare t.array for bigint[].
        if (isArray) {
          return null;
        }
        return {
          typeName: "bigint",
          isArray,
          isNullable,
          isEnum: false,
          propertyType: getPropertyType("bigint"),
          arrayElementTypeName: undefined,
        };
      }

      // Inline literal types (e.g. "open" | "closed", 0 | 1, true, 1n) when not an array
      if (!isArray && targetTypeNode.type === AST_NODE_TYPES.TSLiteralType) {
        const lit = targetTypeNode.literal;
        const litKind =
          lit.type === AST_NODE_TYPES.TemplateLiteral
            ? "string"
            : lit.type === AST_NODE_TYPES.Literal
              ? typeof lit.value
              : lit.type === AST_NODE_TYPES.UnaryExpression &&
                  lit.operator === "-" &&
                  lit.argument.type === AST_NODE_TYPES.Literal
                ? typeof lit.argument.value
                : null;
        if (
          litKind === "string" ||
          litKind === "number" ||
          litKind === "boolean" ||
          litKind === "bigint"
        ) {
          return {
            typeName: litKind,
            isArray: false,
            isNullable,
            isEnum: false,
            propertyType: getPropertyType(litKind),
          };
        }
      }

      // Identifier (class/custom type) or complex array element (e.g. readonly Tag[], ("a" | "b")[], (string | null)[])
      const ident = getIdentifierName(targetTypeNode);
      if (isArray) {
        if (ident === "String" || ident === "Number") {
          const elemName = ident.toLowerCase();
          return {
            typeName: ident,
            isArray: true,
            isNullable,
            isEnum: false,
            propertyType: "t.array",
            arrayElementTypeName: elemName,
          };
        }
        if (ident === "Boolean") {
          return {
            typeName: ident,
            isArray: true,
            isNullable,
            isEnum: false,
            propertyType: "t.json",
            arrayElementTypeName: "boolean",
          };
        }
        if (ident === "BigInt") {
          return null;
        }
        if (ident && isEnum) {
          return {
            typeName: ident,
            isArray: true,
            isNullable,
            isEnum: true,
            propertyType: "t.json",
            arrayElementTypeName: ident,
          };
        }
        const tsElemNode =
          parserServices.esTreeNodeToTSNodeMap.get(targetTypeNode);
        if (ts.isTypeNode(tsElemNode)) {
          const elemType = checker.getTypeFromTypeNode(tsElemNode);
          if (
            (elemType.flags &
              (ts.TypeFlags.Any |
                ts.TypeFlags.Unknown |
                ts.TypeFlags.Never |
                ts.TypeFlags.Void)) ===
            0
          ) {
            const elemInfo = classifyArrayElementTsType(elemType);
            if (elemInfo.unsupportedUnion) {
              return null;
            }
            return {
              typeName: ident ?? elemInfo.arrayElementTypeName ?? "json",
              isArray: true,
              isNullable,
              isEnum: false,
              propertyType: elemInfo.propertyType,
              arrayElementTypeName: elemInfo.arrayElementTypeName ?? ident,
            };
          }
        }
        if (ident) {
          return {
            typeName: ident,
            isArray: true,
            isNullable,
            isEnum: false,
            propertyType: "t.json",
            arrayElementTypeName: ident,
          };
        }
        return null;
      }

      if (ident) {
        const directPropertyType = getPropertyType(ident);
        const resolvedInfo =
          directPropertyType === null && !isEnum
            ? inferPropertyTypeFromResolvedTsType(targetTypeNode)
            : { propertyType: directPropertyType };
        if (resolvedInfo.unsupportedUnion) {
          return null;
        }
        return {
          typeName: ident,
          isArray: resolvedInfo.arrayElementTypeName !== undefined,
          isNullable,
          isEnum,
          propertyType: resolvedInfo.propertyType,
          arrayElementTypeName: resolvedInfo.arrayElementTypeName,
        };
      }

      // Inline object literal, tuple, or intersection types (e.g. { count: number }, [number, string], A & B)
      if (
        targetTypeNode.type === AST_NODE_TYPES.TSTypeLiteral ||
        targetTypeNode.type === AST_NODE_TYPES.TSTupleType ||
        targetTypeNode.type === AST_NODE_TYPES.TSIntersectionType
      ) {
        const resolvedInfo =
          inferPropertyTypeFromResolvedTsType(targetTypeNode);
        if (resolvedInfo.unsupportedUnion || !resolvedInfo.propertyType) {
          return null;
        }
        return {
          typeName: "json",
          isArray: false,
          isNullable,
          isEnum: false,
          propertyType: resolvedInfo.propertyType,
        };
      }

      return null;
    };

    // Wrap type with Opt<T>
    const wrapWithOpt = (typeString: string): string => {
      return `${coreBinding("Opt")}<${typeString}>`;
    };

    const buildEnumDecorator = (
      info: TypeInfo,
      otherProps: { key: string; value: string }[] = [],
      existingItems?: string | null,
    ): string => {
      const options: string[] = [];

      if (existingItems) {
        options.push(`items: ${existingItems}`);
      } else if (info.typeName) {
        options.push(`items: () => ${info.typeName}`);
      }

      if (info.isArray && !otherProps.some((prop) => prop.key === "array")) {
        options.push("array: true");
      }

      for (const prop of otherProps) {
        options.push(`${prop.key}: ${prop.value}`);
      }

      if (info.isNullable) {
        options.push("nullable: true");
      }

      if (options.length === 0) {
        return `@${decoratorBinding("Enum")}()`;
      }

      return `@${decoratorBinding("Enum")}({ ${options.join(", ")} })`;
    };

    const buildPropertyDecorator = (
      info: TypeInfo,
      otherProps: { key: string; value: string }[] = [],
      decoratorName = "Property",
      customReference?: string,
    ): string => {
      const binding =
        customReference ??
        (["Property", "PrimaryKey"].includes(decoratorName)
          ? decoratorBinding(decoratorName)
          : decoratorName);
      const options: string[] = [];

      // If there is a propertyType configuration, add type
      if (info.propertyType) {
        options.push(
          `type: ${info.propertyType.replace(/^t\./, `${coreBinding("t")}.`)}`,
        );
      }

      // Add other properties (keeping original order)
      for (const prop of otherProps) {
        options.push(`${prop.key}: ${prop.value}`);
      }

      if (info.isNullable) {
        options.push("nullable: true");
      }

      if (options.length === 0) {
        return `@${binding}()`;
      }

      return `@${binding}({ ${options.join(", ")} })`;
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
        typeNode?: TSESTree.Node;
        runtimeType?: { present: boolean; value: string | null };
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
        isValidStringType(
          currentConfig.type,
          currentConfig.typeNode,
          currentConfig.runtimeType,
        )
      ) {
        // Keep valid string type config
        finalInfo.propertyType = currentConfig.type;
      } else if (
        (info.propertyType === "t.float" ||
          info.propertyType === "t.integer") &&
        isValidNumberType(
          currentConfig.type,
          currentConfig.typeNode,
          currentConfig.runtimeType,
        )
      ) {
        // Keep valid number type config
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.bigint" &&
        isValidBigIntType(currentConfig.type, currentConfig.typeNode)
      ) {
        // Keep valid bigint type config
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.datetime" &&
        isValidDateType(currentConfig.type, currentConfig.typeNode)
      ) {
        // Keep valid Date type config
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.boolean" &&
        isValidBooleanType(currentConfig.type, currentConfig.typeNode)
      ) {
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.array" &&
        isValidArrayType(
          info.arrayElementTypeName,
          currentConfig.type,
          currentConfig.typeNode,
        )
      ) {
        // Keep valid array type config (t.array, VectorType, ArrayType, or explicit t.json)
        finalInfo.propertyType = currentConfig.type;
      } else if (
        (info.propertyType === "t.json" || info.propertyType === null) &&
        isValidJsonType(currentConfig.type, currentConfig.typeNode)
      ) {
        finalInfo.propertyType = currentConfig.type;
      }

      // Keep other property configs
      const newDecoratorText = buildPropertyDecorator(
        finalInfo,
        currentConfig.otherProps,
        decoratorName,
        !["Property", "PrimaryKey"].includes(decoratorName) &&
          propertyDecorator.expression.type === AST_NODE_TYPES.CallExpression
          ? source.getText(propertyDecorator.expression.callee)
          : undefined,
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
      return node.decorators.some(
        (decorator) =>
          decorator.expression.type === AST_NODE_TYPES.CallExpression &&
          decoratorName(decorator.expression.callee) === "Entity",
      );
    };

    const parsePropertyDecorator = (
      decorator: TSESTree.Decorator,
    ): {
      type: string | null;
      typeNode?: TSESTree.Node;
      runtimeType?: { present: boolean; value: string | null };
      nullable: boolean;
      otherProps: { key: string; value: string }[];
      typeReference?: TSESTree.Node;
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
      let typeNode: TSESTree.Node | undefined;
      let runtimeType: { present: boolean; value: string | null } | undefined;
      let typeReference: TSESTree.Node | undefined;
      let nullable = false;
      const otherProps: { key: string; value: string }[] = [];

      for (const prop of firstArg.properties) {
        if (prop.type !== AST_NODE_TYPES.Property) {
          continue;
        }
        if (prop.key.type !== AST_NODE_TYPES.Identifier || !prop.key.name) {
          continue;
        }

        if (prop.key.name === "type") {
          typeNode = prop.value;
          type = source.getText(prop.value);
          if (
            prop.value.type === AST_NODE_TYPES.MemberExpression &&
            !prop.value.computed &&
            prop.value.property.type === AST_NODE_TYPES.Identifier &&
            coreName(prop.value.object) === "t"
          ) {
            type = `t.${prop.value.property.name}`;
            typeReference = prop.value.object;
          } else if (
            prop.value.type === AST_NODE_TYPES.NewExpression &&
            prop.value.callee.type === AST_NODE_TYPES.MemberExpression &&
            !prop.value.callee.computed &&
            prop.value.callee.property.type === AST_NODE_TYPES.Identifier &&
            coreName(prop.value.callee.object) === "t"
          ) {
            typeReference = prop.value.callee.object;
          } else {
            const reference =
              prop.value.type === AST_NODE_TYPES.NewExpression
                ? prop.value.callee
                : prop.value;
            if (
              importedBindingName(source, fullTextModules, reference) ===
                "FullTextType" ||
              coreName(reference) !== null
            ) {
              typeReference = reference;
            }
          }
        } else if (prop.key.name === "nullable") {
          if (
            prop.value.type === AST_NODE_TYPES.Literal &&
            prop.value.value === true
          ) {
            nullable = true;
          }
        } else {
          if (prop.key.name === "runtimeType") {
            runtimeType = {
              present: true,
              value: resolveStringLiteralValue(prop.value),
            };
          }
          // Keep all other properties
          otherProps.push({
            key: prop.key.name,
            value: source.getText(prop.value),
          });
        }
      }

      return {
        type,
        typeNode,
        runtimeType,
        nullable,
        otherProps,
        typeReference,
      };
    };

    const parseEnumDecorator = (
      decorator: TSESTree.Decorator,
    ): {
      items: string | null;
      nullable: boolean;
      otherProps: { key: string; value: string }[];
    } => {
      const callExpr = decorator.expression;
      if (
        callExpr.type !== AST_NODE_TYPES.CallExpression ||
        callExpr.arguments.length === 0
      ) {
        return { items: null, nullable: false, otherProps: [] };
      }

      const firstArg = callExpr.arguments[0];
      if (firstArg.type !== AST_NODE_TYPES.ObjectExpression) {
        return { items: null, nullable: false, otherProps: [] };
      }

      let items: string | null = null;
      let nullable = false;
      const otherProps: { key: string; value: string }[] = [];

      for (const prop of firstArg.properties) {
        if (prop.type !== AST_NODE_TYPES.Property) {
          continue;
        }
        if (prop.key.type !== AST_NODE_TYPES.Identifier || !prop.key.name) {
          continue;
        }

        if (prop.key.name === "items") {
          items = source.getText(prop.value);
        } else if (prop.key.name === "nullable") {
          if (
            prop.value.type === AST_NODE_TYPES.Literal &&
            prop.value.value === true
          ) {
            nullable = true;
          }
        } else {
          otherProps.push({
            key: prop.key.name,
            value: source.getText(prop.value),
          });
        }
      }

      return { items, nullable, otherProps };
    };

    // Check if the file uses the Opt type but hasn't imported it
    const checkOptUsageWithoutImport = (node: TSESTree.ClassDeclaration) => {
      const annotations = node.body.body.flatMap((member) =>
        member.type === AST_NODE_TYPES.PropertyDefinition &&
        member.typeAnnotation
          ? [member.typeAnnotation]
          : [],
      );
      const missingOpt = (source.scopeManager?.scopes ?? [])
        .flatMap((scope) => scope.references)
        .filter(
          (reference) =>
            !reference.resolved &&
            reference.identifier.name === "Opt" &&
            reference.identifier.parent.type ===
              AST_NODE_TYPES.TSTypeReference &&
            annotations.some(
              (annotation) =>
                annotation.range[0] <= reference.identifier.range[0] &&
                annotation.range[1] >= reference.identifier.range[1],
            ),
        )
        .map((reference) => reference.identifier);

      if (missingOpt.length > 0) {
        context.report({
          node,
          messageId: "useOptTypeForInitializedProperty",
          fix: (fixer) => [
            ...addOptImport(),
            ...missingOpt.map((identifier) =>
              fixer.replaceText(identifier, coreBinding("Opt")),
            ),
          ],
        });
      }
    };

    return {
      ClassDeclaration(node) {
        if (!isEntityClass(node)) {
          return;
        }
        importLocation = node;
        const runtimeReferences: TSESTree.Node[] = [
          ...node.decorators,
          ...node.body.body.flatMap((member) =>
            "decorators" in member ? member.decorators : [],
          ),
        ].flatMap((decorator) =>
          decorator.expression.type === AST_NODE_TYPES.CallExpression &&
          decoratorName(decorator.expression.callee) !== null
            ? [decorator.expression.callee]
            : [],
        );
        for (const member of node.body.body) {
          if (member.type !== AST_NODE_TYPES.PropertyDefinition) {
            continue;
          }
          for (const decorator of member.decorators) {
            if (
              decorator.expression.type !== AST_NODE_TYPES.CallExpression ||
              decoratorName(decorator.expression.callee) === null
            ) {
              continue;
            }
            const reference = parsePropertyDecorator(decorator).typeReference;
            if (reference) {
              runtimeReferences.push(reference);
            }
          }
        }
        const promotions = promoteImportReferences(source, runtimeReferences);
        if (promotions.length) {
          context.report({
            node,
            messageId: "alignPropertyDecoratorWithTsType",
            fix: () => promotions,
          });
          return;
        }

        // First check if Opt is used but not imported
        checkOptUsageWithoutImport(node);

        node.body.body.forEach((member: TSESTree.ClassElement) => {
          if (member.type !== AST_NODE_TYPES.PropertyDefinition) {
            return;
          }

          const searchableDecorator = member.decorators.find(
            (
              decorator,
            ): decorator is TSESTree.Decorator & {
              expression: TSESTree.CallExpression;
            } =>
              decorator.expression.type === AST_NODE_TYPES.CallExpression &&
              decoratorName(decorator.expression.callee) ===
                "SearchableProperty",
          );

          // Check relation decorators (OneToOne, OneToMany, ManyToOne, ManyToMany)
          const hasRelationDecorator = member.decorators?.some(
            (decorator: TSESTree.Decorator) => {
              if (decorator.expression.type === AST_NODE_TYPES.CallExpression) {
                const name = decoratorName(decorator.expression.callee);
                return [
                  "OneToOne",
                  "OneToMany",
                  "ManyToOne",
                  "ManyToMany",
                ].includes(name ?? "");
              }
              return false;
            },
          );

          // If there are relation decorators, skip checking (these properties don't need @Property)
          if (hasRelationDecorator) {
            return;
          }

          // Property-like decorators (decorators that need type checking)
          const propertyLikeDecorators = [
            "Property",
            "PrimaryKey",
            "EncryptedProperty",
            "HashedProperty",
          ];

          // Find property-like decorator
          const propertyLikeDecorator =
            searchableDecorator ??
            member.decorators.find((decorator: TSESTree.Decorator) => {
              if (decorator.expression.type === AST_NODE_TYPES.CallExpression) {
                return propertyLikeDecorators.includes(
                  decoratorName(decorator.expression.callee) ?? "",
                );
              }
              return false;
            });

          // Get decorator name
          const getDecoratorName = (
            decorator: TSESTree.Decorator,
          ): string | null => {
            if (decorator.expression.type === AST_NODE_TYPES.CallExpression) {
              return decoratorName(decorator.expression.callee);
            }
            return null;
          };

          // Check @Enum decorator
          const enumDecorator = member.decorators?.find(
            (decorator: TSESTree.Decorator) => {
              return (
                decorator.expression.type === AST_NODE_TYPES.CallExpression &&
                decoratorName(decorator.expression.callee) === "Enum"
              );
            },
          );

          // Use property-like decorator
          const propertyDecorator = propertyLikeDecorator;
          const currentDecoratorName = propertyDecorator
            ? getDecoratorName(propertyDecorator)
            : null;

          const typeInfo = computeTypeInfo(member);

          if (!typeInfo?.typeName) {
            return;
          }

          // Check initializer and Opt<T> type match
          const hasInitializer = member.value !== null;
          const isOptWrapped = isWrappedWithOpt(member);

          // Check if the initializer is null

          const isInitializedToNull =
            hasInitializer &&
            member.value?.type === AST_NODE_TYPES.Literal &&
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
                    const importFix = addOptImport();
                    fixes.push(...importFix);
                  }

                  return fixes;
                },
              });
            } else if (member.value) {
              // No type annotation, infer type from initializer
              let inferredType: string | null = null;

              if (member.value.type === AST_NODE_TYPES.Literal) {
                const valueType = typeof member.value.value;
                if (valueType === "boolean") {
                  inferredType = "boolean";
                } else if (valueType === "number") {
                  inferredType = "number";
                } else if (valueType === "string") {
                  inferredType = "string";
                }
              } else if (member.value.type === AST_NODE_TYPES.ArrayExpression) {
                // Empty array [] case, need to infer type from @Property decorator
                inferredType = "unknown[]";
              } else if (member.value.type === AST_NODE_TYPES.NewExpression) {
                // new Date() case
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
                      const importFix = addOptImport();
                      fixes.push(...importFix);
                    }

                    return fixes;
                  },
                });
              }
            }
          }

          if (searchableDecorator) {
            const call = searchableDecorator.expression;
            const typeArguments = call.typeArguments;
            const argument = call.arguments.at(0);
            if (argument?.type !== AST_NODE_TYPES.ObjectExpression) {
              if (typeArguments) {
                context.report({
                  node: searchableDecorator,
                  messageId: "alignSearchablePropertyOptions",
                  fix: (fixer) => fixer.remove(typeArguments),
                });
              }
              return;
            }
            const optionName = (
              option: TSESTree.Property | TSESTree.SpreadElement,
            ) => {
              if (option.type !== AST_NODE_TYPES.Property) {
                return undefined;
              }
              if (
                !option.computed &&
                option.key.type === AST_NODE_TYPES.Identifier
              ) {
                return option.key.name;
              }
              return option.key.type === AST_NODE_TYPES.Literal &&
                typeof option.key.value === "string"
                ? option.key.value
                : undefined;
            };
            const managed = new Set(["type", "index", "onCreate", "onUpdate"]);
            const nullableOption = argument.properties.findLast(
              (option) => optionName(option) === "nullable",
            );
            const nullable =
              nullableOption?.type === AST_NODE_TYPES.Property &&
              nullableOption.value.type === AST_NODE_TYPES.Literal &&
              nullableOption.value.value === true;
            const hasManaged = argument.properties.some((option) =>
              managed.has(optionName(option) ?? ""),
            );
            const alignOptions = hasManaged || nullable !== typeInfo.isNullable;
            if (typeArguments || alignOptions) {
              context.report({
                node: searchableDecorator,
                messageId: "alignSearchablePropertyOptions",
                fix: (fixer) => {
                  const fixes: RuleFix[] = [];
                  if (typeArguments) {
                    fixes.push(fixer.remove(typeArguments));
                  }
                  if (!alignOptions) {
                    return fixes;
                  }
                  const options = argument.properties
                    .filter(
                      (option) =>
                        !managed.has(optionName(option) ?? "") &&
                        optionName(option) !== "nullable",
                    )
                    .map((option) => source.getText(option));
                  if (typeInfo.isNullable) {
                    options.push("nullable: true");
                  }
                  fixes.push(
                    fixer.replaceText(argument, `{ ${options.join(", ")} }`),
                  );
                  return fixes;
                },
              });
            }
            return;
          }

          // If there is an @Enum decorator, check its configuration regardless of whether the type is recognized as enum
          if (enumDecorator) {
            const enumConfig = parseEnumDecorator(enumDecorator);
            const missingArrayOption =
              typeInfo.isArray &&
              !enumConfig.otherProps.some((prop) => prop.key === "array");

            // Check if nullable or array configuration matches the TypeScript type
            if (
              enumConfig.nullable !== typeInfo.isNullable ||
              missingArrayOption ||
              (enumDecorator.expression.type ===
                AST_NODE_TYPES.CallExpression &&
                isTypeOnlyImportReference(
                  source,
                  enumDecorator.expression.callee,
                ))
            ) {
              const expectedEnumText = buildEnumDecorator(
                typeInfo,
                enumConfig.otherProps,
                enumConfig.items,
              );
              context.report({
                node: enumDecorator,
                messageId: "alignPropertyDecoratorWithTsType",
                fix: (fixer) => {
                  return [
                    ...addEnumImport(),
                    fixer.replaceTextRange(
                      enumDecorator.range,
                      expectedEnumText,
                    ),
                  ];
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
                  const decoratorFix = fixer.replaceTextRange(
                    propertyDecorator.range,
                    newDecoratorText,
                  );
                  const importFix = hasEnumImport() ? null : addEnumImport();

                  return importFix
                    ? [...importFix, decoratorFix]
                    : decoratorFix;
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
                const decoratorFix = fixer.insertTextBeforeRange(
                  member.range,
                  newDecoratorText + "\n  ",
                );
                const importFix = hasEnumImport() ? null : addEnumImport();

                return importFix ? [...importFix, decoratorFix] : decoratorFix;
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
                const decoratorFixes = applyFixes(
                  fixer,
                  addPropertyDecorator(member, typeInfo),
                );
                const importFix = addPropertyDecoratorImports(typeInfo);

                return [...importFix, ...decoratorFixes];
              },
            });
            return;
          }

          // Shared options must be made explicit before their type settings can be aligned.
          const propertyCall = propertyDecorator.expression;
          if (
            currentDecoratorName === "Property" &&
            propertyCall.type === AST_NODE_TYPES.CallExpression &&
            propertyCall.arguments.some(
              (argument) =>
                argument.type === AST_NODE_TYPES.SpreadElement ||
                (argument.type === AST_NODE_TYPES.ObjectExpression &&
                  argument.properties.some(
                    (option) => option.type === AST_NODE_TYPES.SpreadElement,
                  )),
            )
          ) {
            if (propertyCall.typeArguments) {
              const typeArguments = propertyCall.typeArguments;
              context.report({
                node: propertyDecorator,
                messageId: "alignPropertyDecoratorWithTsType",
                fix: (fixer) => fixer.remove(typeArguments),
              });
            }
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

          const typeArguments =
            currentDecoratorName === "Property" &&
            propertyCall.type === AST_NODE_TYPES.CallExpression
              ? propertyCall.typeArguments
              : undefined;
          let needReport =
            (propertyDecorator.expression.type ===
              AST_NODE_TYPES.CallExpression &&
              isTypeOnlyImportReference(
                source,
                propertyDecorator.expression.callee,
              )) ||
            (currentConfig.typeReference !== undefined &&
              isTypeOnlyImportReference(source, currentConfig.typeReference));

          // Check type configuration
          if (expectedType && currentConfig.type !== expectedType) {
            // For string type, accept multiple valid configurations
            if (
              expectedType === "t.string" &&
              isValidStringType(
                currentConfig.type,
                currentConfig.typeNode,
                currentConfig.runtimeType,
              )
            ) {
              // Current config is a valid string type configuration, no modification needed
            } else if (
              (expectedType === "t.float" || expectedType === "t.integer") &&
              isValidNumberType(
                currentConfig.type,
                currentConfig.typeNode,
                currentConfig.runtimeType,
              )
            ) {
              // Current config is a valid number type configuration, no modification needed
            } else if (
              expectedType === "t.bigint" &&
              isValidBigIntType(currentConfig.type, currentConfig.typeNode)
            ) {
              // Current config is a valid bigint type configuration, no modification needed
            } else if (
              expectedType === "t.boolean" &&
              isValidBooleanType(currentConfig.type, currentConfig.typeNode)
            ) {
              // Current config is a valid boolean type configuration, no modification needed
            } else if (
              expectedType === "t.datetime" &&
              isValidDateType(currentConfig.type, currentConfig.typeNode)
            ) {
              // Current config is a valid Date type configuration, no modification needed
            } else if (
              expectedType === "t.array" &&
              isValidArrayType(
                typeInfo.arrayElementTypeName,
                currentConfig.type,
                currentConfig.typeNode,
              )
            ) {
              // Current config is a valid array type configuration (t.array, VectorType, ArrayType, or explicit t.json)
            } else if (expectedType === "t.json") {
              // For t.json type (Record, heterogeneous unions, or custom type arrays)
              if (isValidJsonType(currentConfig.type, currentConfig.typeNode)) {
                // t.json config is correct, no modification needed
              } else {
                needReport = true;
              }
            } else {
              needReport = true;
            }
          } else if (
            !expectedType &&
            currentConfig.type &&
            !isValidJsonType(currentConfig.type, currentConfig.typeNode)
          ) {
            // If type is not needed (and not explicit JSON storage) but currently has one, needs correction
            needReport = true;
          }

          // Check nullable configuration
          if (currentConfig.nullable !== typeInfo.isNullable) {
            needReport = true;
          }

          if (!needReport) {
            if (typeArguments) {
              context.report({
                node: propertyDecorator,
                messageId: "alignPropertyDecoratorWithTsType",
                fix: (fixer) => fixer.remove(typeArguments),
              });
            }
            return;
          }

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
              const usesTypes = fixes.some((fix) =>
                fix.text.includes(`${coreBinding("t")}.`),
              );
              return [
                ...applyFixes(fixer, fixes),
                ...(currentDecoratorName !== null &&
                ["Property", "PrimaryKey"].includes(currentDecoratorName)
                  ? importEdits(decoratorsModule, [currentDecoratorName])
                  : []),
                ...(usesTypes ? importEdits(coreModule, ["t"]) : []),
              ];
            },
          });
        });
      },
    };
  },
});

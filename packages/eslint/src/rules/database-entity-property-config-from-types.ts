import {
  AST_NODE_TYPES,
  ASTUtils,
  ESLintUtils,
  TSESTree,
} from "@typescript-eslint/utils";
import type { RuleFix, RuleFixer } from "@typescript-eslint/utils/ts-eslint";
import {
  intersectionConstituents,
  isIntersectionType,
  isSymbolFlagSet,
  isTypeFlagSet,
  isTypeReference,
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
  isEnum: boolean;
  propertyType: string | null;
  arrayElementTypeName?: string | null;
  typeReference?: TSESTree.Node;
}

interface RawPropertyEntry {
  key: string | null;
  raw: string;
}

export default createRule<
  [],
  | "alignPropertyDecoratorWithTsType"
  | "alignSearchablePropertyOptions"
  | "useEnumDecorator"
  | "useOptTypeForInitializedProperty"
>({
  name: "database-entity-property-config-from-types",
  meta: {
    type: "problem",
    docs: {
      description:
        "enforce @Property and @Enum decorator configuration from TypeScript types and require Opt<T> on initialized properties",
      recommended: true,
      requiresTypeChecking: true,
    },
    fixable: "code",
    schema: [],
    messages: {
      alignPropertyDecoratorWithTsType:
        "@Property decorator should align with the TypeScript type (type and nullable).",
      alignSearchablePropertyOptions:
        "@SearchableProperty should infer its entity type from the class, align nullable and omit type, index, onCreate and onUpdate.",
      useEnumDecorator:
        "Enum types should use @Enum decorator instead of @Property decorator.",
      useOptTypeForInitializedProperty:
        "Properties with non-null initializers should use the Opt<T> type wrapper.",
    },
  },
  create(context) {
    const source = context.sourceCode;
    const filename = context.filename;
    let importLocation: TSESTree.Node = source.ast;
    const coreModule = "@mikro-orm/core";
    const decoratorsModule = "@mikro-orm/decorators/legacy";
    const fullTextModules = [
      "@mikro-orm/sql",
      "@mikro-orm/postgresql",
      "@mikro-orm/pglite",
    ];
    const coreName = (local: TSESTree.Node) =>
      getImportedName(source, coreModule, local, filename);
    const decoratorModules = [
      decoratorsModule,
      "@nest-boot/database",
      "@nest-boot/database-crypt",
      "@nest-boot/database-hash",
    ];
    const decoratorName = (local: TSESTree.Node) =>
      getImportedName(source, decoratorModules, local, filename);
    const importFixes = (
      fixer: RuleFixer,
      modules: string | readonly string[],
      names: readonly string[],
      value = true,
    ) =>
      ensureNamedImportFixes(
        fixer,
        source,
        modules,
        names,
        value,
        importLocation,
        filename,
      );
    const hasImport = (
      modules: string | readonly string[],
      name: string,
      value = true,
    ) => hasNamedImport(source, modules, name, value, importLocation, filename);
    const coreBinding = (name: string) =>
      getLocalImportBinding(source, coreModule, name, importLocation, filename);
    const decoratorBinding = (name: string) =>
      getLocalImportBinding(
        source,
        decoratorsModule,
        name,
        importLocation,
        filename,
      );
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    const isNullishTypeNode = ASTUtils.isNodeOfTypes([
      AST_NODE_TYPES.TSNullKeyword,
      AST_NODE_TYPES.TSUndefinedKeyword,
    ]);

    // Check if the type is a runtime enum (excluding const enums and pure type-only aliases)
    const isEnumType = (node: TSESTree.Node): boolean => {
      try {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        const rawSym =
          ts.isTypeReferenceNode(tsNode) && ts.isIdentifier(tsNode.typeName)
            ? checker.getSymbolAtLocation(tsNode.typeName)
            : checker.getSymbolAtLocation(tsNode);
        const sym =
          rawSym && isSymbolFlagSet(rawSym, ts.SymbolFlags.Alias)
            ? checker.getAliasedSymbol(rawSym)
            : rawSym;
        if (
          sym &&
          (!isSymbolFlagSet(sym, ts.SymbolFlags.Value) ||
            isSymbolFlagSet(sym, ts.SymbolFlags.ConstEnum))
        ) {
          return false;
        }
        const type = checker.getTypeAtLocation(tsNode);
        return unionConstituents(type).some((part) => {
          const partSym = part.symbol;
          if (!partSym || isSymbolFlagSet(partSym, ts.SymbolFlags.ConstEnum)) {
            return false;
          }
          const isConstEnumMember = partSym.declarations?.some((decl) => {
            if (!ts.isEnumMember(decl)) {
              return false;
            }
            const enumSym = checker.getSymbolAtLocation(decl.parent.name);
            return Boolean(
              enumSym && isSymbolFlagSet(enumSym, ts.SymbolFlags.ConstEnum),
            );
          });
          if (isConstEnumMember) {
            return false;
          }
          return isSymbolFlagSet(
            partSym,
            ts.SymbolFlags.Enum | ts.SymbolFlags.EnumMember,
          );
        });
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

    const isStaticUndefined = (node: TSESTree.Node): boolean => {
      const evaluated = ASTUtils.getStaticValue(node, source.getScope(node));
      if (evaluated !== null) {
        return evaluated.value === undefined;
      }
      try {
        const argType = checker.getTypeAtLocation(
          parserServices.esTreeNodeToTSNodeMap.get(node),
        );
        return (
          isTypeFlagSet(argType, ts.TypeFlags.Undefined) && !argType.isUnion()
        );
      } catch {
        return false;
      }
    };

    const resolveStringLiteralValue = (node?: TSESTree.Node): string | null => {
      if (!node) {
        return null;
      }
      const evaluated = ASTUtils.getStaticValue(node, source.getScope(node));
      if (evaluated !== null) {
        return typeof evaluated.value === "string" ? evaluated.value : null;
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
      const hasModeArg = firstArg !== undefined && !isStaticUndefined(firstArg);
      const mode = hasModeArg ? resolveStringLiteralValue(firstArg) : null;

      if (
        getImportedName(source, fullTextModules, target, filename) ===
        "FullTextType"
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
        coreName(target.object) === "t"
      ) {
        const memberName = ASTUtils.getPropertyName(target);
        if (memberName) {
          return {
            canonical: `t.${memberName}`,
            isNew,
            hasModeArg,
            mode,
            firstArg,
            isFullText: false,
          };
        }
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

      if (ASTUtils.isIdentifier(target)) {
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
        ASTUtils.getPropertyName(target) === "VectorType"
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
      return { mode: null, isDynamic: false };
    };

    const isValidBigIntMode = (
      spec: ReturnType<typeof resolveColumnTypeSpec>,
      expectedMode: "string" | "number" | "bigint",
      runtimeType?: { present: boolean; value: string | null },
    ): boolean => {
      if (runtimeType?.present) {
        if (runtimeType.value === null) {
          return true;
        }
        const normalized = runtimeType.value.toLowerCase();
        if (["string", "number", "bigint"].includes(normalized)) {
          return normalized === expectedMode;
        }
      }
      if (expectedMode === "bigint") {
        return (
          !spec.isNew ||
          !spec.hasModeArg ||
          spec.mode === null ||
          spec.mode === "bigint"
        );
      }
      return (
        !spec.isNew ||
        spec.mode === expectedMode ||
        (spec.hasModeArg && spec.mode === null)
      );
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
        return isValidBigIntMode(spec, "string", runtimeType);
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
          effective.mode === null ||
          effective.mode === "number"
        );
      }

      if (spec.canonical === "t.bigint" || spec.canonical === "BigIntType") {
        return isValidBigIntMode(spec, "number", runtimeType);
      }

      return false;
    };

    const isValidBigIntType = (
      typeConfig: string | null,
      typeNode?: TSESTree.Node,
      runtimeType?: { present: boolean; value: string | null },
    ): boolean => {
      const spec = resolveColumnTypeSpec(typeConfig, typeNode);
      if (spec.canonical !== "t.bigint" && spec.canonical !== "BigIntType") {
        return false;
      }
      return isValidBigIntMode(spec, "bigint", runtimeType);
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
          const parts = unionConstituents(type);
          return (
            parts.length > 0 &&
            parts.every((part) =>
              isTypeFlagSet(
                part,
                ts.TypeFlags.Any | ts.TypeFlags.Unknown | expectedFlag,
              ),
            )
          );
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
      const literalType = resolveStringLiteralValue(typeNode);
      if (elementTypeName === "number" && literalType === "number[]") {
        return true;
      }
      if (elementTypeName === "string" && literalType === "string[]") {
        return true;
      }
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
      if (isIntersectionType(member)) {
        if (
          checker.getSignaturesOfType(member, ts.SignatureKind.Call).length > 0
        ) {
          return false;
        }
        visited.add(member);
        const parts = intersectionConstituents(member);
        return (
          parts.length > 0 &&
          parts.every((item) =>
            isJsonSerializableType(item, visited, allowUndefined, allowDynamic),
          )
        );
      }
      if (
        allowDynamic &&
        isTypeFlagSet(member, ts.TypeFlags.Any | ts.TypeFlags.Unknown)
      ) {
        return true;
      }
      if (allowUndefined && isTypeFlagSet(member, ts.TypeFlags.Undefined)) {
        return true;
      }
      if (
        isTypeFlagSet(
          member,
          ts.TypeFlags.BigIntLike |
            ts.TypeFlags.ESSymbolLike |
            ts.TypeFlags.Void |
            ts.TypeFlags.Undefined |
            ts.TypeFlags.Never,
        )
      ) {
        return false;
      }
      if (
        isTypeFlagSet(
          member,
          ts.TypeFlags.StringLike |
            ts.TypeFlags.NumberLike |
            ts.TypeFlags.BooleanLike |
            ts.TypeFlags.Null |
            ts.TypeFlags.NonPrimitive,
        )
      ) {
        return true;
      }
      if (isTypeFlagSet(member, ts.TypeFlags.Object)) {
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
          return (
            isTypeReference(member) ? checker.getTypeArguments(member) : []
          ).every((item) => isJsonSerializableType(item, visited, false, true));
        }
        if (
          checker.isArrayType(member) ||
          member.symbol?.name === "ReadonlyArray"
        ) {
          const elemType =
            (isTypeReference(member)
              ? checker.getTypeArguments(member)[0]
              : undefined) ??
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
          const isOptional = isSymbolFlagSet(prop, ts.SymbolFlags.Optional);
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
        return unionConstituents(resolved).some((member) =>
          isTypeFlagSet(member, ts.TypeFlags.Null | ts.TypeFlags.Undefined),
        );
      } catch {
        return false;
      }
    };

    const classifyScalarTsType = (
      type: ts.Type,
    ): "string" | "number" | "boolean" | "bigint" | null => {
      const parts = unionConstituents(type);
      if (parts.length === 0) {
        return null;
      }
      const isHomogeneous = (flag: ts.TypeFlags) =>
        parts.every((member) => isTypeFlagSet(member, flag));
      if (isHomogeneous(ts.TypeFlags.StringLike)) {
        return "string";
      }
      if (isHomogeneous(ts.TypeFlags.NumberLike)) {
        return "number";
      }
      if (isHomogeneous(ts.TypeFlags.BooleanLike)) {
        return "boolean";
      }
      if (isHomogeneous(ts.TypeFlags.BigIntLike)) {
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
          isTypeFlagSet(
            resolved,
            ts.TypeFlags.Any |
              ts.TypeFlags.Unknown |
              ts.TypeFlags.Never |
              ts.TypeFlags.Void,
          )
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
            (isTypeReference(resolved)
              ? checker.getTypeArguments(resolved)[0]
              : undefined) ??
            checker.getIndexTypeOfType(resolved, ts.IndexKind.Number);
          if (!elemType) {
            return { propertyType: null };
          }
          return classifyArrayElementTsType(elemType);
        }
        const isPlainObjectConstituent = (part: ts.Type): boolean =>
          isTypeFlagSet(part, ts.TypeFlags.Object) &&
          !(
            part.symbol && isSymbolFlagSet(part.symbol, ts.SymbolFlags.Class)
          ) &&
          checker.getSignaturesOfType(part, ts.SignatureKind.Call).length ===
            0 &&
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
            "Function",
          ].includes(part.symbol?.name ?? "");
        if (isIntersectionType(resolved)) {
          const parts = intersectionConstituents(resolved);
          if (
            parts.length > 0 &&
            parts.every(isPlainObjectConstituent) &&
            (checker.getPropertiesOfType(resolved).length > 0 ||
              checker.getIndexInfosOfType(resolved).length > 0)
          ) {
            return isJsonSerializableType(resolved)
              ? { propertyType: "t.json" }
              : { propertyType: null, unsupportedUnion: true };
          }
          return { propertyType: null };
        }
        // Plain non-class object/interface/tuple types (excluding classes, arrays, built-in objects)
        if (
          isPlainObjectConstituent(resolved) &&
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

    const addOptImport = (fixer: RuleFixer): RuleFix[] =>
      importFixes(fixer, coreModule, ["Opt"], false);
    const addEnumImport = (fixer: RuleFixer): RuleFix[] =>
      importFixes(fixer, decoratorsModule, ["Enum"]);
    const addPropertyDecoratorImports = (
      fixer: RuleFixer,
      info: TypeInfo,
    ): RuleFix[] => [
      ...importFixes(fixer, decoratorsModule, ["Property"]),
      ...(info.propertyType?.startsWith("t.")
        ? importFixes(fixer, coreModule, ["t"])
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
          if (baseTypeNode.types.some(isNullishTypeNode)) {
            isNullable = true;
          }
          const nonNullish = baseTypeNode.types.filter(
            (member) => !isNullishTypeNode(member),
          );
          if (nonNullish.length === 0) {
            baseTypeNode = null;
            break;
          }
          if (nonNullish.length === 1) {
            baseTypeNode = nonNullish[0];
            continue;
          }
          break;
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
            typeReference:
              targetTypeNode.type === AST_NODE_TYPES.TSTypeReference
                ? targetTypeNode.typeName
                : undefined,
          };
        }
        const tsElemNode =
          parserServices.esTreeNodeToTSNodeMap.get(targetTypeNode);
        if (ts.isTypeNode(tsElemNode)) {
          const elemType = checker.getTypeFromTypeNode(tsElemNode);
          if (
            !isTypeFlagSet(
              elemType,
              ts.TypeFlags.Any |
                ts.TypeFlags.Unknown |
                ts.TypeFlags.Never |
                ts.TypeFlags.Void,
            )
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
          typeReference:
            isEnum && targetTypeNode.type === AST_NODE_TYPES.TSTypeReference
              ? targetTypeNode.typeName
              : undefined,
        };
      }

      // Inline union, object literal, tuple, or intersection types
      if (
        targetTypeNode.type === AST_NODE_TYPES.TSUnionType ||
        targetTypeNode.type === AST_NODE_TYPES.TSTypeLiteral ||
        targetTypeNode.type === AST_NODE_TYPES.TSTupleType ||
        targetTypeNode.type === AST_NODE_TYPES.TSIntersectionType
      ) {
        if (isEnum) {
          return null;
        }
        const resolvedInfo =
          inferPropertyTypeFromResolvedTsType(targetTypeNode);
        if (resolvedInfo.unsupportedUnion || !resolvedInfo.propertyType) {
          return null;
        }
        return {
          typeName:
            resolvedInfo.arrayElementTypeName ?? resolvedInfo.propertyType,
          isArray: resolvedInfo.arrayElementTypeName !== undefined,
          isNullable,
          isEnum: false,
          propertyType: resolvedInfo.propertyType,
          arrayElementTypeName: resolvedInfo.arrayElementTypeName,
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
      otherProps: RawPropertyEntry[] = [],
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
        options.push(prop.raw);
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
      otherProps: RawPropertyEntry[] = [],
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

      // Add other properties verbatim (keeping original order, shorthands, computed keys, and spreads)
      for (const prop of otherProps) {
        options.push(prop.raw);
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
      fixer: RuleFixer,
      property: TSESTree.PropertyDefinition,
      info: TypeInfo,
    ): RuleFix => {
      const newDecoratorText = buildPropertyDecorator(info);
      return fixer.insertTextBefore(property, `${newDecoratorText}\n  `);
    };

    const resolveAlignedDecoratorText = (
      propertyDecorator: TSESTree.Decorator,
      info: TypeInfo,
      currentConfig: {
        type: string | null;
        typeNode?: TSESTree.Node;
        runtimeType?: { present: boolean; value: string | null };
        nullable: boolean;
        otherProps: RawPropertyEntry[];
      },
      decoratorName = "Property",
    ): string => {
      const finalInfo = { ...info };

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
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.bigint" &&
        isValidBigIntType(
          currentConfig.type,
          currentConfig.typeNode,
          currentConfig.runtimeType,
        )
      ) {
        finalInfo.propertyType = currentConfig.type;
      } else if (
        info.propertyType === "t.datetime" &&
        isValidDateType(currentConfig.type, currentConfig.typeNode)
      ) {
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
        finalInfo.propertyType = currentConfig.type;
      } else if (
        (info.propertyType === "t.json" || info.propertyType === null) &&
        isValidJsonType(currentConfig.type, currentConfig.typeNode)
      ) {
        finalInfo.propertyType = currentConfig.type;
      }

      return buildPropertyDecorator(
        finalInfo,
        currentConfig.otherProps,
        decoratorName,
        !["Property", "PrimaryKey"].includes(decoratorName) &&
          propertyDecorator.expression.type === AST_NODE_TYPES.CallExpression
          ? source.getText(propertyDecorator.expression.callee)
          : undefined,
      );
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
      otherProps: RawPropertyEntry[];
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
      const otherProps: RawPropertyEntry[] = [];

      for (const prop of firstArg.properties) {
        if (prop.type === AST_NODE_TYPES.SpreadElement) {
          otherProps.push({ key: null, raw: source.getText(prop) });
          continue;
        }
        const key = ASTUtils.getPropertyName(prop, source.getScope(prop));

        if (key === "type") {
          typeNode = prop.value;
          type = source.getText(prop.value);
          const memberProp =
            prop.value.type === AST_NODE_TYPES.MemberExpression &&
            !prop.value.computed &&
            coreName(prop.value.object) === "t"
              ? ASTUtils.getPropertyName(prop.value)
              : null;
          if (
            memberProp &&
            prop.value.type === AST_NODE_TYPES.MemberExpression
          ) {
            type = `t.${memberProp}`;
            typeReference = prop.value.object;
          } else if (
            prop.value.type === AST_NODE_TYPES.NewExpression &&
            prop.value.callee.type === AST_NODE_TYPES.MemberExpression &&
            !prop.value.callee.computed &&
            ASTUtils.getPropertyName(prop.value.callee) !== null &&
            coreName(prop.value.callee.object) === "t"
          ) {
            typeReference = prop.value.callee.object;
          } else {
            const reference =
              prop.value.type === AST_NODE_TYPES.NewExpression
                ? prop.value.callee
                : prop.value;
            if (
              getImportedName(source, fullTextModules, reference, filename) ===
                "FullTextType" ||
              coreName(reference) !== null
            ) {
              typeReference = reference;
            }
          }
        } else if (key === "nullable") {
          if (
            prop.value.type === AST_NODE_TYPES.Literal &&
            prop.value.value === true
          ) {
            nullable = true;
          }
        } else {
          if (key === "runtimeType" && !isStaticUndefined(prop.value)) {
            runtimeType = {
              present: true,
              value: resolveStringLiteralValue(prop.value),
            };
          }
          otherProps.push({
            key,
            raw: source.getText(prop),
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
      otherProps: RawPropertyEntry[];
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
      const otherProps: RawPropertyEntry[] = [];

      for (const prop of firstArg.properties) {
        if (prop.type === AST_NODE_TYPES.SpreadElement) {
          otherProps.push({ key: null, raw: source.getText(prop) });
          continue;
        }
        const key = ASTUtils.getPropertyName(prop, source.getScope(prop));

        if (key === "items") {
          items = source.getText(prop.value);
        } else if (key === "nullable") {
          if (
            prop.value.type === AST_NODE_TYPES.Literal &&
            prop.value.value === true
          ) {
            nullable = true;
          }
        } else {
          otherProps.push({
            key,
            raw: source.getText(prop),
          });
        }
      }

      return { items, nullable, otherProps };
    };

    // Check if the file uses the Opt type but hasn't imported it
    const checkOptUsageWithoutImport = (node: TSESTree.ClassDeclaration) => {
      const annotations = node.body.body
        .filter(ASTUtils.isNodeOfType(AST_NODE_TYPES.PropertyDefinition))
        .flatMap((member) =>
          member.typeAnnotation ? [member.typeAnnotation] : [],
        );
      const missingOpt = (source.scopeManager?.globalScope?.through ?? [])
        .filter(
          (reference) =>
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
            ...addOptImport(fixer),
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
        const typeOnlyRefs = runtimeReferences.filter((ref) =>
          isTypeOnlyImportReference(source, ref),
        );
        if (typeOnlyRefs.length > 0) {
          context.report({
            node,
            messageId: "alignPropertyDecoratorWithTsType",
            fix: (fixer) => promoteTypeImportFixes(fixer, source, typeOnlyRefs),
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
                fix: (fixer) => [
                  fixer.replaceText(typeAnnotation, wrappedType),
                  ...(needsImport ? addOptImport(fixer) : []),
                ],
              });
            } else if (member.value) {
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
                inferredType = "unknown[]";
              } else if (member.value.type === AST_NODE_TYPES.NewExpression) {
                if (member.value.callee.type === AST_NODE_TYPES.Identifier) {
                  inferredType = member.value.callee.name;
                }
              }

              if (inferredType) {
                const wrappedType = wrapWithOpt(inferredType);
                const propertyName = member.key;

                context.report({
                  node: member,
                  messageId: "useOptTypeForInitializedProperty",
                  fix: (fixer) => [
                    fixer.insertTextAfter(propertyName, `: ${wrappedType}`),
                    ...(needsImport ? addOptImport(fixer) : []),
                  ],
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
            const optionName = (option: TSESTree.ObjectLiteralElement) =>
              option.type === AST_NODE_TYPES.Property
                ? ASTUtils.getPropertyName(option)
                : null;
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
            const enumCall = enumDecorator.expression;
            if (
              enumCall.type === AST_NODE_TYPES.CallExpression &&
              enumCall.arguments.some(
                (argument) =>
                  argument.type === AST_NODE_TYPES.SpreadElement ||
                  (argument.type === AST_NODE_TYPES.ObjectExpression &&
                    argument.properties.some(
                      (option) => option.type === AST_NODE_TYPES.SpreadElement,
                    )),
              )
            ) {
              if (isTypeOnlyImportReference(source, enumCall.callee)) {
                context.report({
                  node: enumDecorator,
                  messageId: "alignPropertyDecoratorWithTsType",
                  fix: (fixer) =>
                    promoteTypeImportFixes(fixer, source, [enumCall.callee]),
                });
              }
              return;
            }
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
                fix: (fixer) => [
                  ...addEnumImport(fixer),
                  fixer.replaceText(enumDecorator, expectedEnumText),
                ],
              });
            }
            // Properties with @Enum decorator do not need @Property decorator
            return;
          }

          // If it's an enum type but doesn't have @Enum decorator
          if (typeInfo.isEnum) {
            const enumRefFixes = (fixer: RuleFixer): RuleFix[] =>
              typeInfo.typeReference &&
              isTypeOnlyImportReference(source, typeInfo.typeReference)
                ? promoteTypeImportFixes(fixer, source, [
                    typeInfo.typeReference,
                  ])
                : [];
            if (propertyDecorator) {
              const propCall = propertyDecorator.expression;
              const canCarryOptions =
                currentDecoratorName === "Property" &&
                propCall.type === AST_NODE_TYPES.CallExpression &&
                propCall.arguments.length <= 1 &&
                (propCall.arguments.length === 0 ||
                  (propCall.arguments[0].type ===
                    AST_NODE_TYPES.ObjectExpression &&
                    !propCall.arguments[0].properties.some(
                      (option) => option.type === AST_NODE_TYPES.SpreadElement,
                    )));
              const carriedProps = canCarryOptions
                ? parsePropertyDecorator(propertyDecorator).otherProps.filter(
                    (prop) =>
                      prop.key !== "runtimeType" && prop.key !== "items",
                  )
                : [];
              context.report({
                node: propertyDecorator,
                messageId: "useEnumDecorator",
                fix: canCarryOptions
                  ? (fixer) => {
                      const newDecoratorText = buildEnumDecorator(
                        typeInfo,
                        carriedProps,
                      );
                      return [
                        ...(hasEnumImport() ? [] : addEnumImport(fixer)),
                        ...enumRefFixes(fixer),
                        fixer.replaceText(propertyDecorator, newDecoratorText),
                      ];
                    }
                  : undefined,
              });
              return;
            }

            context.report({
              node: member,
              messageId: "useEnumDecorator",
              fix: (fixer) => {
                const newDecoratorText = buildEnumDecorator(typeInfo);
                return [
                  ...(hasEnumImport() ? [] : addEnumImport(fixer)),
                  ...enumRefFixes(fixer),
                  fixer.insertTextBefore(member, `${newDecoratorText}\n  `),
                ];
              },
            });
            return;
          }

          // Non-enum type: if no @Property decorator, add one
          if (!propertyDecorator) {
            context.report({
              node: member,
              messageId: "alignPropertyDecoratorWithTsType",
              fix: (fixer) => [
                ...addPropertyDecoratorImports(fixer, typeInfo),
                addPropertyDecorator(fixer, member, typeInfo),
              ],
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
              isValidBigIntType(
                currentConfig.type,
                currentConfig.typeNode,
                currentConfig.runtimeType,
              )
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
              const newDecoratorText = resolveAlignedDecoratorText(
                propertyDecorator,
                typeInfo,
                currentConfig,
                currentDecoratorName ?? "Property",
              );
              const usesTypes = newDecoratorText.includes(
                `${coreBinding("t")}.`,
              );
              return [
                fixer.replaceText(propertyDecorator, newDecoratorText),
                ...(currentDecoratorName !== null &&
                ["Property", "PrimaryKey"].includes(currentDecoratorName)
                  ? importFixes(fixer, decoratorsModule, [currentDecoratorName])
                  : []),
                ...(usesTypes ? importFixes(fixer, coreModule, ["t"]) : []),
              ];
            },
          });
        });
      },
    };
  },
});

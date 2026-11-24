import { Extensions, type ReturnTypeFunc } from "@nestjs/graphql";
import {
  getNullableType,
  type GraphQLSchema,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
} from "graphql/index.js";

const RETURN_TYPE_FOR_COMPLEXITY = "nestBootReturnTypeForComplexity";

/**
 * Records a return type for default complexity after field metadata is merged.
 * @param typeFn - The field's explicit GraphQL return type function, if supplied.
 * @returns The field metadata decorator.
 */
export function defaultComplexityForField(
  typeFn?: ReturnTypeFunc,
): PropertyDecorator & MethodDecorator {
  return (
    target: object,
    key: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    const getReturnType =
      typeFn ??
      (() =>
        Reflect.getMetadata(
          descriptor?.value ? "design:returntype" : "design:type",
          target,
          key,
        ) as unknown);
    Extensions({ [RETURN_TYPE_FOR_COMPLEXITY]: getReturnType })(target, key);
  };
}

/**
 * Adds defaults to the field complexity metadata used by standard estimators.
 * @param schema - The schema with merged field and resolver metadata.
 */
export function applyDefaultFieldComplexity(schema: GraphQLSchema): void {
  for (const type of Object.values(schema.getTypeMap())) {
    if (
      !isObjectType(type) &&
      !isInterfaceType(type) &&
      !isInputObjectType(type)
    ) {
      continue;
    }

    for (const field of Object.values(type.getFields())) {
      const { [RETURN_TYPE_FOR_COMPLEXITY]: typeFn, ...extensions } =
        field.extensions;
      if (typeof typeFn !== "function") {
        continue;
      }

      if (
        extensions.complexity === undefined &&
        isObjectType(getNullableType(field.type))
      ) {
        const target: unknown = typeFn();
        if (typeof target === "function" && "complexity" in target) {
          const { complexity } = target;
          if (
            typeof complexity === "number" ||
            typeof complexity === "function"
          ) {
            extensions.complexity = complexity;
          }
        }
      }
      field.extensions = extensions;
    }
  }
}

import {
  Extensions,
  ObjectType as NestObjectType,
  type ObjectTypeOptions,
} from "@nestjs/graphql";

/** GraphQL object type extension containing the default complexity for fields returning it. */
export const DEFAULT_FIELD_COMPLEXITY = "defaultFieldComplexity";

/**
 * Registers a GraphQL object type and publishes its static complexity as a field default.
 * @param nameOrOptions - The GraphQL type name or options.
 * @param options - The type options when a name is supplied.
 * @returns The class decorator.
 */
export const ObjectType: typeof NestObjectType = (
  nameOrOptions?: string | ObjectTypeOptions,
  options?: ObjectTypeOptions,
) => {
  const decorate =
    typeof nameOrOptions === "string"
      ? NestObjectType(nameOrOptions, options)
      : NestObjectType(nameOrOptions ?? {});

  return (target) => {
    const complexity = "complexity" in target ? target.complexity : undefined;
    if (typeof complexity === "number" || typeof complexity === "function") {
      Extensions({ [DEFAULT_FIELD_COMPLEXITY]: complexity })(target);
    }
    decorate(target);
  };
};

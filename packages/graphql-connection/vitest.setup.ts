import { vi } from "vitest";

vi.mock("@nest-boot/graphql", async () => {
  const [
    { Args },
    { Field },
    { InputType },
    { Mutation },
    { ObjectType },
    { Query },
    { ResolveField },
    { Resolver },
    { registerEnumType },
    { Float, ID, Int },
    { ArgsType },
  ] = await Promise.all([
    import("@nestjs/graphql/dist/decorators/args.decorator.js"),
    import("@nestjs/graphql/dist/decorators/field.decorator.js"),
    import("@nestjs/graphql/dist/decorators/input-type.decorator.js"),
    import("@nestjs/graphql/dist/decorators/mutation.decorator.js"),
    import("@nestjs/graphql/dist/decorators/object-type.decorator.js"),
    import("@nestjs/graphql/dist/decorators/query.decorator.js"),
    import("@nestjs/graphql/dist/decorators/resolve-field.decorator.js"),
    import("@nestjs/graphql/dist/decorators/resolver.decorator.js"),
    import("@nestjs/graphql/dist/type-factories/register-enum-type.factory.js"),
    import("@nestjs/graphql/dist/scalars/index.js"),
    import("../graphql/src/decorators/args-type.decorator.js"),
  ]);

  return {
    Args,
    ArgsType,
    Field,
    Float,
    ID,
    InputType,
    Int,
    Mutation,
    ObjectType,
    Query,
    registerEnumType,
    ResolveField,
    Resolver,
  };
});

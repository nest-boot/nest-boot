import {
  Field as NestField,
  Mutation as NestMutation,
  Query as NestQuery,
  ResolveField as NestResolveField,
} from "@nestjs/graphql";
import { expectTypeOf } from "vitest";

import {
  defineComplexity,
  Field,
  ID,
  Int,
  Mutation,
  Query,
  ResolveField,
} from "./index.js";

class Book {
  title!: string;
}

describe("decorator complexity types", () => {
  it("uses the original NestJS decorators at runtime", () => {
    expect(Query).toBe(NestQuery);
    expect(Mutation).toBe(NestMutation);
    expect(ResolveField).toBe(NestResolveField);
    expect(Field).toBe(NestField);
  });

  it("defines reusable complexity callbacks with inferred result types", () => {
    const callback = () => 1;
    expect(defineComplexity(Book, callback)).toBe(callback);

    const bookComplexity = defineComplexity(
      Book,
      ({ childComplexity, resolved }) => {
        expectTypeOf(resolved?.result).toEqualTypeOf<Book | null | undefined>();
        return resolved ? 1 : 1 + childComplexity;
      },
    );
    Query(() => Book, { complexity: bookComplexity });

    const booksComplexity = defineComplexity([Book], ({ resolved }) => {
      expectTypeOf(resolved?.result).toEqualTypeOf<Book[] | null | undefined>();
      return resolved?.result?.length ?? 1;
    });
    ResolveField(() => [Book], { complexity: booksComplexity });

    defineComplexity(ID, ({ resolved }) => {
      expectTypeOf(resolved?.result).toBeUnknown();
      return 1;
    });
  });

  it("infers result types from GraphQL return type functions", () => {
    Query(() => Book, {
      complexity: ({ resolved }) => {
        expectTypeOf(resolved?.result).toEqualTypeOf<Book | null | undefined>();
        return 1;
      },
    });
    ResolveField("books", () => [Book], {
      complexity: ({ resolved }) => {
        expectTypeOf(resolved?.result).toEqualTypeOf<
          Book[] | null | undefined
        >();
        return 1;
      },
    });
    Mutation(() => Int, {
      complexity: ({ resolved }) => {
        expectTypeOf(resolved?.result).toBeUnknown();
        return 1;
      },
    });
    Field(() => String, {
      complexity: ({ resolved }) => {
        expectTypeOf(resolved?.result).toEqualTypeOf<
          InstanceType<StringConstructor> | null | undefined
        >();
        return 1;
      },
    });
  });

  it("preserves native field default values for GraphQL scalar types", () => {
    Field(() => ID, {
      defaultValue: 123,
      complexity: ({ resolved }) => {
        expectTypeOf(resolved?.result).toBeUnknown();
        return 1;
      },
    });
    Field(() => [ID], { defaultValue: [123] });
  });

  it("supports options-only overloads with an unknown result", () => {
    ResolveField({
      complexity: ({ resolved }) => {
        expectTypeOf(resolved?.result).toEqualTypeOf<unknown>();
        return 1;
      },
    });
    Field({
      complexity: ({ resolved }) => {
        expectTypeOf(resolved?.result).toEqualTypeOf<unknown>();
        return 1;
      },
    });
    ResolveField("books", { complexity: 0 });
    Query("books");
    Mutation();
    Field();
  });
});

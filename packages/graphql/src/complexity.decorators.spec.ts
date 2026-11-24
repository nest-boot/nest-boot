import { Test } from "@nestjs/testing";
import { expectTypeOf } from "vitest";

import { applyDefaultFieldComplexity } from "./field-complexity-defaults.js";
import {
  defineComplexity,
  Extensions,
  Field,
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  ID,
  Int,
  Mutation,
  ObjectType,
  Query,
  ResolveField,
  Resolver,
} from "./index.js";

class Book {
  title!: string;
}

@ObjectType()
class PricedBook {
  static readonly complexity = 5;

  @Field(() => String)
  title!: string;
}

@Resolver()
class PricedBookResolver {
  @Query(() => PricedBook)
  @Extensions({ catalog: "books" })
  pricedBook(): PricedBook {
    return { title: "Book" };
  }
}

describe("decorator complexity metadata", () => {
  it("preserves field extensions when resolving a static complexity default", async () => {
    const module = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();

    try {
      const schema = await module
        .get(GraphQLSchemaFactory)
        .create([PricedBookResolver]);

      applyDefaultFieldComplexity(schema);

      expect(schema.getQueryType()?.getFields().pricedBook.extensions).toEqual({
        catalog: "books",
        complexity: 5,
      });
    } finally {
      await module.close();
    }
  });
});

describe("decorator complexity types", () => {
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

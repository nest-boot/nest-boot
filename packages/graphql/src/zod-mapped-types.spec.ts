import { toZodSchema, ZodField, ZodPartialType } from "@nest-boot/validator";
import { Field, InputType, PartialType } from "@nestjs/graphql";
import { z } from "zod";

describe("GraphQL Zod mapped types", () => {
  it("preserves validation metadata through GraphQL PartialType", () => {
    @InputType()
    class CreateUserInput {
      @Field(() => String)
      @ZodField(z.string().min(1))
      name!: string;
    }

    @InputType()
    class UpdateUserInput extends ZodPartialType(
      CreateUserInput,
      PartialType,
    ) {}

    const schema = toZodSchema(UpdateUserInput);
    type Output = z.infer<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<{ name?: string }>();
    expect(schema.parse({})).toEqual({});
    expect(schema.safeParse({ name: "" }).success).toBe(false);
  });
});

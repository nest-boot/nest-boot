import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from "@nestjs/mapped-types";
import { z } from "zod";

import {
  toZodSchema,
  ZodField,
  ZodIntersectionType,
  ZodObject,
  ZodOmitType,
  ZodPartialType,
  ZodPickType,
  ZodValidationPipe,
} from "../index.js";
describe("Zod mapped types", () => {
  class UserDto {
    @ZodField(z.string().min(1))
    name!: string;
    @ZodField(z.number().int())
    age!: number;
  }
  it("makes fields optional through Nest PartialType", () => {
    class UpdateUserDto extends ZodPartialType(UserDto, PartialType) {}
    const schema = toZodSchema(UpdateUserDto);
    type Output = z.infer<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<{
      name?: string;
      age?: number;
    }>();
    expect(schema.parse({})).toEqual({});
    expect(schema.parse({ name: "User" })).toEqual({ name: "User" });
  });
  it("selects fields through Nest PickType and OmitType", () => {
    class NamedUserDto extends ZodPickType(UserDto, ["name"], PickType) {}
    class AgelessUserDto extends ZodOmitType(UserDto, ["age"], OmitType) {}
    expect(toZodSchema(NamedUserDto).parse({ name: "User", age: 42 })).toEqual({
      name: "User",
    });
    expect(
      toZodSchema(AgelessUserDto).parse({ name: "User", age: 42 }),
    ).toEqual({ name: "User" });
  });
  it("combines fields through Nest IntersectionType", () => {
    class EnabledDto {
      @ZodField(z.boolean())
      enabled!: boolean;
    }
    class CombinedDto extends ZodIntersectionType(
      UserDto,
      EnabledDto,
      IntersectionType,
    ) {}
    expect(
      toZodSchema(CombinedDto).parse({
        name: "User",
        age: 42,
        enabled: true,
      }),
    ).toEqual({ name: "User", age: 42, enabled: true });
  });
  it("supports standalone mapped classes without a Nest factory", () => {
    class LazyDto {
      @ZodField((z) => z.string().min(1))
      value!: string;
    }
    class EnabledDto {
      @ZodField(z.boolean())
      enabled!: boolean;
    }
    const PartialDto = ZodPartialType(LazyDto);
    const PickedDto = ZodPickType(UserDto, ["name"]);
    const OmittedDto = ZodOmitType(UserDto, ["age"]);
    const CombinedDto = ZodIntersectionType(UserDto, EnabledDto);
    expect(toZodSchema(PartialDto).parse({})).toEqual({});
    expect(toZodSchema(PickedDto).parse({ name: "User" })).toEqual({
      name: "User",
    });
    expect(toZodSchema(OmittedDto).parse({ name: "User" })).toEqual({
      name: "User",
    });
    expect(
      toZodSchema(CombinedDto).parse({
        name: "User",
        age: 42,
        enabled: true,
      }),
    ).toEqual({ name: "User", age: 42, enabled: true });
  });
  it("creates schemas for mapped DTOs whose resulting shape is empty", async () => {
    const EmptyPickedDto = ZodPickType(UserDto, []);
    const EmptyOmittedDto = ZodOmitType(UserDto, ["name", "age"]);
    const pipe = new ZodValidationPipe();
    expect(toZodSchema(EmptyPickedDto).parse({ extra: true })).toEqual({});
    expect(toZodSchema(EmptyOmittedDto).parse({ extra: true })).toEqual({});
    await expect(
      pipe.transform(
        { extra: true },
        { type: "body", metatype: EmptyPickedDto },
      ),
    ).resolves.toEqual({});
  });
  it("uses the second DTO's type and schema for intersection collisions", () => {
    class TextDto {
      @ZodField(z.string())
      value!: string;
    }
    class NumericDto {
      @ZodField(z.number())
      value!: number;
    }
    const CombinedDto = ZodIntersectionType(TextDto, NumericDto);
    const schema = toZodSchema(CombinedDto);
    type Output = z.infer<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<{
      value: number;
    }>();
    expect(schema.parse({ value: 42 })).toEqual({ value: 42 });
    expect(schema.safeParse({ value: "42" }).success).toBe(false);
  });
  it("preserves unknown-key policy without copying object refinements", () => {
    @ZodObject({
      unknownKeys: "strict",
      configure: (schema) =>
        schema.refine(
          (value) => typeof value.name === "string" && value.name.length > 0,
        ),
    })
    class StrictUserDto extends UserDto {}
    const PartialDto = ZodPartialType(StrictUserDto);
    expect(toZodSchema(PartialDto).safeParse({ extra: true }).success).toBe(
      false,
    );
    expect(toZodSchema(PartialDto).parse({})).toEqual({});
  });
});

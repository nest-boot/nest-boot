import { BadRequestException } from "@nestjs/common";
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from "@nestjs/mapped-types";
import { Test } from "@nestjs/testing";
import { z } from "zod";

import {
  getZodSchema,
  toZodSchema,
  ZOD_VALIDATION_PIPE_OPTIONS,
  ZodField,
  ZodIntersectionType,
  ZodObject,
  ZodOmitType,
  ZodPartialType,
  ZodPickType,
  ZodValidationException,
  ZodValidationPipe,
} from "./index.js";

describe("decorated Zod schemas", () => {
  it("supports direct schemas and factories that receive z", () => {
    class UserDto {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- verifies Zod's chained email schema is accepted
      @ZodField(z.string().email())
      email!: string;

      // eslint-disable-next-line @typescript-eslint/no-deprecated -- verifies the factory receives Zod
      @ZodField((z) => z.string().email())
      backupEmail!: string;

      @ZodField((z) =>
        z
          .string()
          .min(8)
          .transform((value) => value.trim()),
      )
      password!: string;
    }

    const schema = toZodSchema(UserDto);
    type User = z.infer<typeof schema>;
    expectTypeOf<User>().toEqualTypeOf<UserDto>();

    const user: User = schema.parse({
      email: "user@example.com",
      backupEmail: "backup@example.com",
      password: " 12345678 ",
    });

    expect(user).toEqual({
      email: "user@example.com",
      backupEmail: "backup@example.com",
      password: "12345678",
    });
  });

  it("inherits fields and lets child decorators override them", () => {
    class BaseDto {
      @ZodField(z.string())
      value!: string;
    }

    class ChildDto extends BaseDto {
      @ZodField(z.string().min(3))
      declare value: string;

      @ZodField(z.boolean())
      enabled!: boolean;
    }

    expect(
      toZodSchema(ChildDto).parse({ value: "yes", enabled: true }),
    ).toEqual({
      value: "yes",
      enabled: true,
    });
  });

  it("defers schema factories to support recursive DTOs", () => {
    const factory = vi.fn(() => z.string());

    class LazyDto {
      @ZodField(factory)
      value!: string;
    }

    const lazySchema = toZodSchema(LazyDto);
    expect(factory).not.toHaveBeenCalled();
    expect(lazySchema.parse({ value: "first" })).toEqual({ value: "first" });
    expect(lazySchema.parse({ value: "second" })).toEqual({ value: "second" });
    expect(factory).toHaveBeenCalledTimes(1);

    class TreeDto {
      @ZodField(z.string())
      name!: string;

      @ZodField(() => toZodSchema(TreeDto).array())
      children!: TreeDto[];
    }

    expect(
      toZodSchema(TreeDto).parse({
        name: "root",
        children: [{ name: "child", children: [] }],
      }),
    ).toEqual({
      name: "root",
      children: [{ name: "child", children: [] }],
    });
  });

  it("validates fields named __proto__ without invoking its legacy setter", () => {
    class PrototypeDto {}

    ZodField(z.string())(PrototypeDto.prototype, "__proto__");
    const schema = toZodSchema(PrototypeDto);

    expect(schema.safeParse(JSON.parse('{"__proto__":"valid"}')).success).toBe(
      true,
    );
    expect(schema.safeParse(JSON.parse('{"__proto__":123}')).success).toBe(
      false,
    );
  });

  it("excludes instance methods from the inferred DTO output", () => {
    class MethodDto {
      @ZodField(z.string())
      value!: string;

      format(): string {
        return this.value.toUpperCase();
      }
    }

    const schema = toZodSchema(MethodDto);
    type Output = z.infer<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<{ value: string }>();
    expect(schema.parse({ value: "test" })).toEqual({ value: "test" });
  });

  it("keeps undecorated data properties in the static type only", () => {
    class UserDto {
      @ZodField(z.email())
      email!: string;

      nickname!: string;
    }

    const schema = toZodSchema(UserDto);
    type Output = z.infer<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<{
      email: string;
      nickname: string;
    }>();

    expect(
      schema.parse({ email: "user@example.com", nickname: "User" }),
    ).toEqual({ email: "user@example.com" });
  });

  it("preserves optional DTO properties in the inferred output", () => {
    class WorkspaceDto {
      @ZodField(z.string().optional())
      workspaceId?: string;

      @ZodField(z.union([z.string(), z.undefined()]))
      requiredValue!: string | undefined;
    }

    const schema = toZodSchema(WorkspaceDto);
    type Output = z.infer<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<{
      workspaceId?: string;
      requiredValue: string | undefined;
    }>();

    expect(schema.parse({ requiredValue: undefined })).toEqual({
      requiredValue: undefined,
    });
  });

  it("returns undefined for classes without Zod metadata", () => {
    class PlainDto {}

    expect(getZodSchema(PlainDto)).toBeUndefined();
    expect(() => toZodSchema(PlainDto)).toThrow(
      "PlainDto has no ZodField or ZodObject metadata",
    );
  });

  it("uses ZodObject for empty DTOs and object-level configuration", () => {
    @ZodObject({ unknownKeys: "strict" })
    class EmptyDto {}

    expect(toZodSchema(EmptyDto).safeParse({ extra: true }).success).toBe(
      false,
    );

    @ZodObject({
      configure: (schema) =>
        schema.refine((value) => value.password === value.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        }),
    })
    class PasswordDto {
      @ZodField(z.string().min(8))
      password!: string;

      @ZodField(z.string())
      confirmPassword!: string;
    }

    const result = toZodSchema(PasswordDto).safeParse({
      password: "12345678",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }

    @ZodObject({ unknownKeys: "passthrough" })
    class PassthroughDto {
      @ZodField(z.string())
      value!: string;
    }

    expect(
      toZodSchema(PassthroughDto).parse({ value: "known", extra: true }),
    ).toEqual({ value: "known", extra: true });
  });

  it("rejects symbol properties", () => {
    expect(() => {
      ZodField(z.string())({}, Symbol("value"));
    }).toThrow("ZodField does not support symbol properties");
  });
});

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

  it("preserves object options through mapped types", () => {
    @ZodObject({
      unknownKeys: "strict",
      configure: (schema) =>
        schema.refine((value) => value.name !== "blocked", {
          message: "Blocked name",
          path: ["name"],
        }),
    })
    class StrictUserDto extends UserDto {}

    const PartialDto = ZodPartialType(StrictUserDto);

    expect(toZodSchema(PartialDto).safeParse({ extra: true }).success).toBe(
      false,
    );
    expect(toZodSchema(PartialDto).safeParse({ name: "blocked" }).success).toBe(
      false,
    );
  });
});

describe("ZodValidationPipe", () => {
  it("can be constructed through Nest dependency injection", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ZodValidationPipe],
    }).compile();

    expect(moduleRef.get(ZodValidationPipe)).toBeInstanceOf(ZodValidationPipe);
    await moduleRef.close();
  });

  it("accepts options through its explicit injection token", async () => {
    const customError = new BadRequestException("Injected error");
    const moduleRef = await Test.createTestingModule({
      providers: [
        ZodValidationPipe,
        {
          provide: ZOD_VALIDATION_PIPE_OPTIONS,
          useValue: {
            createValidationException: () => customError,
          },
        },
      ],
    }).compile();

    class UserDto {
      @ZodField(z.email())
      email!: string;
    }

    await expect(
      moduleRef
        .get(ZodValidationPipe)
        .transform({ email: "invalid" }, { type: "body", metatype: UserDto }),
    ).rejects.toBe(customError);
    await moduleRef.close();
  });

  it("parses decorated DTOs and passes unregistered values through", async () => {
    class QueryDto {
      @ZodField((z) => z.coerce.number().int().positive())
      page!: number;
    }

    class PlainDto {}

    const pipe = new ZodValidationPipe();

    await expect(
      pipe.transform({ page: "2" }, { type: "query", metatype: QueryDto }),
    ).resolves.toEqual({ page: 2 });
    await expect(
      pipe.transform({ untouched: true }, { type: "body", metatype: PlainDto }),
    ).resolves.toEqual({ untouched: true });
    await expect(
      pipe.transform({ untouched: true }, { type: "custom" }),
    ).resolves.toEqual({ untouched: true });
  });

  it("supports async Zod refinements", async () => {
    class AsyncDto {
      @ZodField((z) =>
        z
          .string()
          .refine(async (value) => await Promise.resolve(value === "valid")),
      )
      value!: string;
    }

    const pipe = new ZodValidationPipe();

    await expect(
      pipe.transform({ value: "valid" }, { type: "body", metatype: AsyncDto }),
    ).resolves.toEqual({ value: "valid" });
  });

  it("throws a sanitized ZodValidationException by default", async () => {
    class UserDto {
      @ZodField(z.email())
      email!: string;
    }

    const pipe = new ZodValidationPipe();

    try {
      await pipe.transform(
        { email: "private invalid value" },
        { type: "body", metatype: UserDto },
      );
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ZodValidationException);
      const exception = error as ZodValidationException;
      expect(exception.getZodError()).toBeInstanceOf(z.ZodError);
      expect(exception.getResponse()).toEqual({
        statusCode: 400,
        message: "Validation failed",
        error: "Bad Request",
        validationErrors: [
          {
            code: "invalid_format",
            field: ["email"],
            message: "Invalid email address",
          },
        ],
      });
      expect(JSON.stringify(exception.getResponse())).not.toContain(
        "private invalid value",
      );
    }
  });

  it("serializes symbol segments without exposing input values", () => {
    const exception = new ZodValidationException(
      new z.ZodError([
        {
          code: "custom",
          path: [Symbol("field")],
          message: "Invalid field",
        },
      ]),
    );

    expect(exception.getResponse()).toMatchObject({
      validationErrors: [
        {
          code: "custom",
          field: ["Symbol(field)"],
          message: "Invalid field",
        },
      ],
    });
  });

  it("supports custom exception factories", async () => {
    class UserDto {
      @ZodField(z.email())
      email!: string;
    }

    const pipe = new ZodValidationPipe({
      createValidationException: () => new BadRequestException("Custom error"),
    });

    await expect(
      pipe.transform({ email: "invalid" }, { type: "body", metatype: UserDto }),
    ).rejects.toMatchObject({ message: "Custom error" });
  });
});

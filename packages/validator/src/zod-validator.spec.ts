import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

import {
  getZodSchema,
  toZodSchema,
  ZodField,
  ZodObject,
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

describe("ZodValidationPipe", () => {
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

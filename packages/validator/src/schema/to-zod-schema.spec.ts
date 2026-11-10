import { z } from "zod";

import { getZodSchema, toZodSchema, ZodField, ZodObject } from "../index.js";
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
  it("rejects fields named __proto__", () => {
    class PrototypeDto {}
    expect(() => {
      ZodField(z.string())(PrototypeDto.prototype, "__proto__");
    }).toThrow("ZodField does not support the __proto__ property");
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
    expectTypeOf<Output>().toEqualTypeOf<{
      value: string;
    }>();
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
  it("preserves null and undefined-only DTO properties in the inferred output", () => {
    class NullableDto {
      @ZodField(z.null())
      value!: null;
      @ZodField(z.undefined().optional())
      optional?: undefined;
    }
    const schema = toZodSchema(NullableDto);
    type Output = z.infer<typeof schema>;
    expectTypeOf<Output>().toEqualTypeOf<{
      value: null;
      optional?: undefined;
    }>();
    expect(schema.parse({ value: null })).toEqual({ value: null });
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
    const safeOutput = toZodSchema(PassthroughDto).parse(
      JSON.parse('{"value":"known","__proto__":{},"extra":true}'),
    );
    expect(safeOutput).toEqual({ value: "known", extra: true });
    expect(Object.getPrototypeOf(safeOutput)).toBe(Object.prototype);
    expect(Object.hasOwn(safeOutput, "__proto__")).toBe(false);
  });
  it("rejects symbol properties", () => {
    expect(() => {
      ZodField(z.string())({}, Symbol("value"));
    }).toThrow("ZodField does not support symbol properties");
  });
});

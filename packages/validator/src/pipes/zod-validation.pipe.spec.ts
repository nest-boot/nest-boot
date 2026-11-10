import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { z } from "zod";

import {
  ZOD_VALIDATION_PIPE_OPTIONS,
  ZodField,
  ZodValidationException,
  ZodValidationPipe,
} from "../index.js";
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

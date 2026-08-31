import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { GraphQLError } from "graphql";

import { GraphQLExceptionFilter } from "./graphql.exception-filter.js";

function createHost(type: "graphql" | "http") {
  return {
    getType: vi.fn(() => type),
  } as unknown as ArgumentsHost;
}

describe("GraphQLExceptionFilter", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("should return GraphQL errors unchanged", async () => {
    const { filter } = await createFilter();
    const error = new GraphQLError("already graphql");

    expect(filter.transform(error)).toBe(error);
  });

  it("should transform HTTP exceptions with string responses", async () => {
    const { filter } = await createFilter();

    const error = filter.transform(
      new HttpException("bad input", HttpStatus.BAD_REQUEST),
    );

    expect(error.message).toBe("bad input");
    expect(error.extensions).toMatchObject({
      code: "BAD_REQUEST",
      stack: expect.any(String),
    });
  });

  it("should transform HTTP exceptions with object responses", async () => {
    const { filter } = await createFilter();

    expect(
      filter.transform(new BadRequestException({ reason: "bad reason" })),
    ).toMatchObject({
      message: "bad reason",
      extensions: {
        code: "BAD_REQUEST",
        stack: expect.any(String),
      },
    });
    expect(filter.transform(new BadRequestException({}))).toMatchObject({
      message: "INTERNAL_SERVER_ERROR",
      extensions: {
        code: "BAD_REQUEST",
      },
    });
  });

  it("should hide internal errors in production", async () => {
    process.env.NODE_ENV = "production";
    const { filter } = await createFilter();

    expect(
      filter.transform(new InternalServerErrorException("secret")),
    ).toMatchObject({
      message: "Internal server error",
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
      },
    });
    expect(filter.transform(new Error("secret"))).toMatchObject({
      message: "Internal server error",
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  });

  it("should log and return transformed errors for GraphQL contexts", async () => {
    const { errorLog, filter } = await createFilter();

    const result = filter.catch(new Error("boom"), createHost("graphql"));

    expect(result).toBeInstanceOf(GraphQLError);
    expect(errorLog).toHaveBeenCalledWith("boom", {
      err: result,
    });
  });

  it("should log and delegate HTTP contexts to the base exception filter", async () => {
    const { errorLog, filter } = await createFilter();
    const baseCatch = vi
      .spyOn(BaseExceptionFilter.prototype, "catch")
      .mockImplementation(() => undefined);
    const error = new Error("http boom");
    const host = createHost("http");

    expect(filter.catch(error, host)).toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith("http boom", {
      err: error,
    });
    expect(baseCatch).toHaveBeenCalledWith(error, host);
  });
});

async function createFilter() {
  const errorLog = vi.fn();
  const moduleRef = await Test.createTestingModule({
    providers: [
      GraphQLExceptionFilter,
      {
        provide: Logger,
        useValue: {
          error: errorLog,
        },
      },
    ],
  }).compile();

  return {
    errorLog,
    filter: moduleRef.get(GraphQLExceptionFilter),
  };
}

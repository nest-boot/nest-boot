import Redis from "ioredis";

import {
  GraphQLRateLimitDriver,
  MemoryGraphQLRateLimitDriver,
  RedisGraphQLRateLimitDriver,
} from "../../src/drivers";
import { GraphQLRateLimitOptions } from "../../src/interfaces";
import { createGraphQLRateLimitDriver } from "../../src/utils/create-driver.util";

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    defineCommand: jest.fn(),
    quit: jest.fn(),
  })),
}));

describe("createGraphQLRateLimitDriver", () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const options: GraphQLRateLimitOptions = {
    maxComplexity: 1000,
    defaultComplexity: 0,
    keyPrefix: "graphql-rate-limit",
    restoreRate: 50,
    maximumAvailable: 1000,
    getId: () => "client",
  };

  afterEach(() => {
    jest.clearAllMocks();
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  it("uses memory when REDIS_URL is absent", () => {
    delete process.env.REDIS_URL;

    expect(createGraphQLRateLimitDriver(options)).toBeInstanceOf(
      MemoryGraphQLRateLimitDriver,
    );
    expect(Redis).not.toHaveBeenCalled();
  });

  it("uses Redis when REDIS_URL is present", () => {
    process.env.REDIS_URL = "rediss://user:pass@redis.local:6380/2";

    expect(createGraphQLRateLimitDriver(options)).toBeInstanceOf(
      RedisGraphQLRateLimitDriver,
    );
    expect(Redis).toHaveBeenCalledWith({
      host: "redis.local",
      port: 6380,
      db: 2,
      username: "user",
      password: "pass",
      tls: {},
    });
  });

  it("lets an explicit custom driver override REDIS_URL", () => {
    process.env.REDIS_URL = "redis://redis.local";
    const driver = {
      update: jest.fn(),
      close: jest.fn(),
    } as unknown as GraphQLRateLimitDriver;

    expect(createGraphQLRateLimitDriver({ ...options, driver })).toBe(driver);
    expect(Redis).not.toHaveBeenCalled();
  });
});

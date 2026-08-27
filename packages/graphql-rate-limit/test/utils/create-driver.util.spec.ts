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
  const originalEnvironment = process.env;
  const options: GraphQLRateLimitOptions = {
    maxComplexity: 1000,
    defaultComplexity: 0,
    keyPrefix: "graphql-rate-limit",
    restoreRate: 50,
    maximumAvailable: 1000,
    getId: () => "client",
  };

  beforeEach(() => {
    process.env = Object.fromEntries(
      Object.entries(originalEnvironment).filter(
        ([key]) => !key.startsWith("REDIS_"),
      ),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("uses memory when Redis environment configuration is absent", () => {
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

  it.each([
    ["REDIS_URL", "redis://redis.local"],
    ["REDIS_HOST", "redis.local"],
  ])("uses Redis when %s is present", (name, value) => {
    process.env[name] = value;

    expect(createGraphQLRateLimitDriver(options)).toBeInstanceOf(
      RedisGraphQLRateLimitDriver,
    );
    expect(Redis).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["REDIS_PORT", "6380"],
    ["REDIS_DB", "2"],
    ["REDIS_DATABASE", "2"],
    ["REDIS_USER", "user"],
    ["REDIS_USERNAME", "user"],
    ["REDIS_PASS", "pass"],
    ["REDIS_PASSWORD", "pass"],
    ["REDIS_TLS", "true"],
  ])(
    "uses memory when only supplemental variable %s is present",
    (name, value) => {
      process.env[name] = value;

      expect(createGraphQLRateLimitDriver(options)).toBeInstanceOf(
        MemoryGraphQLRateLimitDriver,
      );
      expect(Redis).not.toHaveBeenCalled();
    },
  );

  it("loads individual Redis variables and aliases", () => {
    process.env.REDIS_HOST = "redis.local";
    process.env.REDIS_PORT = "6380";
    process.env.REDIS_DATABASE = "4";
    process.env.REDIS_USERNAME = "aliased-user";
    process.env.REDIS_PASSWORD = "aliased-pass";
    process.env.REDIS_TLS = "true";

    createGraphQLRateLimitDriver(options);

    expect(Redis).toHaveBeenCalledWith({
      host: "redis.local",
      port: 6380,
      db: 4,
      username: "aliased-user",
      password: "aliased-pass",
      tls: {},
    });
  });

  it("lets REDIS_URL take precedence over individual Redis variables", () => {
    process.env.REDIS_URL = "redis://url-user:url-pass@url.redis:6380/3";
    process.env.REDIS_HOST = "ignored.redis";
    process.env.REDIS_PORT = "6379";

    createGraphQLRateLimitDriver(options);

    expect(Redis).toHaveBeenCalledWith({
      host: "url.redis",
      port: 6380,
      db: 3,
      username: "url-user",
      password: "url-pass",
    });
  });

  it("lets an explicit custom driver override Redis environment config", () => {
    process.env.REDIS_HOST = "redis.local";
    const driver = {
      update: jest.fn(),
      close: jest.fn(),
    } as unknown as GraphQLRateLimitDriver;

    expect(createGraphQLRateLimitDriver({ ...options, driver })).toBe(driver);
    expect(Redis).not.toHaveBeenCalled();
  });
});

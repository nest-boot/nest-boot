import { Redis } from "ioredis";

import {
  GraphQLRateLimitDriver,
  MemoryGraphQLRateLimitDriver,
  RedisGraphQLRateLimitDriver,
} from "../../src/drivers/index.js";
import { GraphQLRateLimitOptions } from "../../src/interfaces/index.js";
import { createGraphQLRateLimitDriver } from "../../src/utils/create-driver.util.js";

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(function RedisMock() {
    return {
      defineCommand: vi.fn(),
      quit: vi.fn(),
    };
  }),
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
    process.env = { ...originalEnvironment };
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    process.env.REDIS_URL =
      "rediss://user%40example.com:p%40ss%2Fword@redis.local:6380/2";

    expect(createGraphQLRateLimitDriver(options)).toBeInstanceOf(
      RedisGraphQLRateLimitDriver,
    );
    expect(Redis).toHaveBeenCalledWith({
      host: "redis.local",
      port: 6380,
      db: 2,
      username: "user@example.com",
      password: "p@ss/word",
      tls: {},
    });
  });

  it("strips brackets from an IPv6 Redis URL hostname", () => {
    process.env.REDIS_URL = "redis://[2001:db8::1]:6379/0";

    createGraphQLRateLimitDriver(options);

    expect(Redis).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "2001:db8::1",
        port: 6379,
      }),
    );
  });

  it("uses Redis when connection options are provided without endpoint env", () => {
    const connection = {
      host: "configured.redis",
      port: 6380,
    };

    expect(
      createGraphQLRateLimitDriver({ ...options, connection }),
    ).toBeInstanceOf(RedisGraphQLRateLimitDriver);
    expect(Redis).toHaveBeenCalledWith(expect.objectContaining(connection));
  });

  it("lets an explicit custom driver override Redis environment config", () => {
    process.env.REDIS_URL = "redis://redis.local";
    const driver = {
      update: vi.fn(),
      close: vi.fn(),
    } as unknown as GraphQLRateLimitDriver;

    expect(createGraphQLRateLimitDriver({ ...options, driver })).toBe(driver);
    expect(Redis).not.toHaveBeenCalled();
  });
});

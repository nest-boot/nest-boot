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

  it("uses memory when no shared client or connection is configured", () => {
    expect(createGraphQLRateLimitDriver(options)).toBeInstanceOf(
      MemoryGraphQLRateLimitDriver,
    );
    expect(Redis).not.toHaveBeenCalled();
  });

  it("reuses the shared client without creating or closing a connection", async () => {
    const redis = {
      defineCommand: vi.fn(),
      quit: vi.fn(),
    };
    process.env.REDIS_URL = "invalid-url";

    const driver = createGraphQLRateLimitDriver(
      options,
      redis as unknown as Redis,
    );
    expect(driver).toBeInstanceOf(RedisGraphQLRateLimitDriver);
    expect(redis.defineCommand).toHaveBeenCalledTimes(1);
    expect(Redis).not.toHaveBeenCalled();
    await driver.close();
    expect(redis.quit).not.toHaveBeenCalled();
  });

  it("does not select Redis from REDIS_URL without a shared client", () => {
    process.env.REDIS_URL = "invalid-url";

    expect(createGraphQLRateLimitDriver(options)).toBeInstanceOf(
      MemoryGraphQLRateLimitDriver,
    );
    expect(Redis).not.toHaveBeenCalled();
  });

  it("lets explicit connection options override the shared client without merging env", async () => {
    const connection = {
      host: "configured.redis",
      port: 6380,
    };
    const redis = {
      defineCommand: vi.fn(),
      quit: vi.fn(),
    };
    process.env.REDIS_URL = "redis://env.redis:6379/5";

    const driver = createGraphQLRateLimitDriver(
      { ...options, connection },
      redis as unknown as Redis,
    );
    expect(driver).toBeInstanceOf(RedisGraphQLRateLimitDriver);
    expect(Redis).toHaveBeenCalledWith(connection);
    expect(redis.defineCommand).not.toHaveBeenCalled();
    await driver.close();
    const client = vi.mocked(Redis).mock.results[0].value as {
      quit: ReturnType<typeof vi.fn>;
    };
    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(redis.quit).not.toHaveBeenCalled();
  });

  it("lets an explicit custom driver override the shared client and connection", () => {
    const redis = { defineCommand: vi.fn() };
    const driver = {
      update: vi.fn(),
      close: vi.fn(),
    } as unknown as GraphQLRateLimitDriver;

    expect(
      createGraphQLRateLimitDriver(
        { ...options, driver, connection: {} },
        redis as unknown as Redis,
      ),
    ).toBe(driver);
    expect(Redis).not.toHaveBeenCalled();
    expect(redis.defineCommand).not.toHaveBeenCalled();
  });
});

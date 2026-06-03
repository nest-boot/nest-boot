import { MODULE_METADATA } from "@nestjs/common/constants";

const mockRedisInstance = {
  quit: jest.fn(),
};
const mockRedis = jest.fn(() => mockRedisInstance);

jest.mock("ioredis", () => ({
  __esModule: true,
  default: mockRedis,
}));
jest.mock("./utils/load-config-from-env.util", () => ({
  loadConfigFromEnv: jest.fn(() => ({
    host: "redis.local",
  })),
}));

import { RedisModule } from "./redis.module";
import { MODULE_OPTIONS_TOKEN } from "./redis.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

interface RedisProvider {
  provide: unknown;
  useFactory: (options: unknown) => unknown;
}

describe("RedisModule", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register synchronous and asynchronous options", () => {
    const options = {
      host: "custom.redis",
    };
    const dynamicModule = RedisModule.register(options);
    const useFactory = () => options;
    const asyncModule = RedisModule.registerAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(RedisModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
    expect(asyncModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });

  it("should create Redis clients from env config merged with options", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      RedisModule,
    ) as RedisProvider[];
    const redisProvider = providers.find(
      (provider) => provider.provide === mockRedis,
    );

    expect(redisProvider).toBeDefined();
    expect(
      redisProvider?.useFactory({
        db: 1,
      }),
    ).toBe(mockRedisInstance);
    expect(loadConfigFromEnv).toHaveBeenCalledTimes(1);
    expect(mockRedis).toHaveBeenCalledWith({
      db: 1,
      host: "redis.local",
    });
  });

  it("should close Redis on application shutdown", async () => {
    const module = new RedisModule(mockRedisInstance as never);

    await module.onApplicationShutdown();

    expect(mockRedisInstance.quit).toHaveBeenCalledTimes(1);
  });
});

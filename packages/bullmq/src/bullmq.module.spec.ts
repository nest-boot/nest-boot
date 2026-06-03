import { MODULE_METADATA } from "@nestjs/common/constants";

let mockForRootAsyncOptions: any;
const mockBaseBullModule = {
  forRootAsync: jest.fn((options) => {
    mockForRootAsyncOptions = options;
    return {
      module: class BaseRootModule {},
    };
  }),
  registerQueue: jest.fn(),
  registerQueueAsync: jest.fn(),
};

jest.mock("@nestjs/bullmq", () => ({
  BullModule: mockBaseBullModule,
  QueueEventsListener: class QueueEventsListener {},
}));

import { BullModule } from "./bullmq.module";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "./bullmq.module-definition";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

jest.mock("./utils/load-config-from-env.util", () => ({
  loadConfigFromEnv: jest.fn(() => ({
    host: "redis.local",
  })),
}));

interface BullOptionsProvider {
  provide: unknown;
  useFactory: (options: unknown) => unknown;
}

describe("BullModule", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register synchronous and asynchronous options", () => {
    const options = {
      connection: {
        host: "redis.local",
      },
    };
    const dynamicModule = BullModule.forRoot(options);
    const useFactory = () => options;
    const asyncModule = BullModule.forRootAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(BullModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        {
          provide: BASE_MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
      ]),
    );
    expect(asyncModule.providers).toEqual(
      expect.arrayContaining([
        {
          inject: [],
          provide: BASE_MODULE_OPTIONS_TOKEN,
          useFactory,
        },
      ]),
    );
  });

  it("should provide empty options when base options are missing", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      BullModule,
    ) as BullOptionsProvider[];
    const optionsProvider = providers.find(
      (provider) => provider.provide === MODULE_OPTIONS_TOKEN,
    );

    expect(optionsProvider).toBeDefined();
    expect(optionsProvider?.useFactory(undefined)).toEqual({});
    expect(
      optionsProvider?.useFactory({
        prefix: "jobs",
      }),
    ).toEqual({
      prefix: "jobs",
    });
  });

  it("should merge module options with environment Redis config", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, BullModule);

    expect(mockForRootAsyncOptions).toEqual(
      expect.objectContaining({
        inject: [MODULE_OPTIONS_TOKEN],
      }),
    );

    expect(
      mockForRootAsyncOptions.useFactory({
        prefix: "jobs",
      }),
    ).toEqual({
      connection: {
        host: "redis.local",
      },
      prefix: "jobs",
    });
    expect(
      mockForRootAsyncOptions.useFactory({
        connection: {
          host: "custom.redis",
        },
      }),
    ).toEqual({
      connection: {
        host: "custom.redis",
      },
    });
    expect(loadConfigFromEnv).toHaveBeenCalledTimes(1);
    expect(imports).toEqual([
      {
        module: expect.any(Function),
      },
    ]);
  });

  it("should delegate queue registration to the base Bull module", () => {
    const queueModule = {
      module: class QueueModule {},
    };
    const asyncQueueModule = {
      module: class AsyncQueueModule {},
    };
    mockBaseBullModule.registerQueue.mockReturnValue(queueModule);
    mockBaseBullModule.registerQueueAsync.mockReturnValue(asyncQueueModule);

    expect(BullModule.registerQueue({ name: "email" })).toBe(queueModule);
    expect(
      BullModule.registerQueueAsync({
        name: "email",
        useFactory: () => ({}),
      }),
    ).toBe(asyncQueueModule);
  });
});

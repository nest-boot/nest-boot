import { MODULE_METADATA } from "@nestjs/common/constants";
import { DiscoveryModule } from "@nestjs/core";

const { mockBaseQueueModule, mockState } = vi.hoisted(() => {
  const mockState = {
    forRootAsyncOptions: undefined as any,
  };
  const mockBaseQueueModule = {
    forRootAsync: vi.fn((options) => {
      mockState.forRootAsyncOptions = options;
      return {
        module: class BaseRootModule {},
      };
    }),
    registerQueue: vi.fn(),
    registerQueueAsync: vi.fn(),
  };

  return { mockBaseQueueModule, mockState };
});

vi.mock("@nestjs/bullmq", () => ({
  BullModule: mockBaseQueueModule,
  QueueEventsListener: class QueueEventsListener {},
}));

import { QueueModule } from "./queue.module.js";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "./queue.module-definition.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";

vi.mock("./utils/load-config-from-env.util.js", () => ({
  loadConfigFromEnv: vi.fn(() => ({
    host: "redis.local",
  })),
}));

interface BullOptionsProvider {
  provide: unknown;
  useFactory: (options: unknown) => unknown;
}

describe("QueueModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register synchronous and asynchronous options", () => {
    const options = {
      connection: {
        host: "redis.local",
      },
    };
    const dynamicModule = QueueModule.forRoot(options);
    const useFactory = () => options;
    const asyncModule = QueueModule.forRootAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(QueueModule);
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
      QueueModule,
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
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, QueueModule);

    expect(mockState.forRootAsyncOptions).toEqual(
      expect.objectContaining({
        inject: [MODULE_OPTIONS_TOKEN],
      }),
    );

    expect(
      mockState.forRootAsyncOptions.useFactory({
        prefix: "jobs",
      }),
    ).toEqual({
      connection: {
        host: "redis.local",
      },
      prefix: "jobs",
    });
    expect(
      mockState.forRootAsyncOptions.useFactory({
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
      DiscoveryModule,
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
    mockBaseQueueModule.registerQueue.mockReturnValue(queueModule);
    mockBaseQueueModule.registerQueueAsync.mockReturnValue(asyncQueueModule);

    expect(QueueModule.registerQueue({ name: "email" })).toBe(queueModule);
    expect(
      QueueModule.registerQueueAsync({
        name: "email",
        useFactory: () => ({}),
      }),
    ).toBe(asyncQueueModule);
  });
});

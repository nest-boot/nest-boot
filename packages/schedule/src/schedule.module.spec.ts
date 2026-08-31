import { Logger } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { DiscoveryModule } from "@nestjs/core";

const { mockProcessor, mockQueueModule, mockRegisterQueueAsync, mockState } =
  vi.hoisted(() => {
    const mockState = {
      registerQueueAsyncOptions: undefined as any,
    };
    const mockQueueModule = {
      module: class QueueModule {},
    };
    const mockRegisterQueueAsync = vi.fn((options) => {
      mockState.registerQueueAsyncOptions = options;
      return mockQueueModule;
    });
    const mockProcessorDecorator = vi.fn();
    const mockProcessor = vi.fn(() => mockProcessorDecorator);

    return {
      mockProcessor,
      mockQueueModule,
      mockRegisterQueueAsync,
      mockState,
    };
  });

vi.mock("@nest-boot/bullmq", () => ({
  BullModule: {
    registerQueueAsync: mockRegisterQueueAsync,
  },
  InjectQueue: vi.fn(() => vi.fn()),
  Processor: mockProcessor,
  WorkerHost: class WorkerHost {
    worker = {
      concurrency: 1,
      run: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

import { ScheduleModule } from "./schedule.module.js";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "./schedule.module-definition.js";
import { ScheduleProcessor } from "./schedule.processor.js";
import { ScheduleRegistry } from "./schedule.registry.js";

describe("ScheduleModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should expose configurable root registrations", () => {
    const options = {
      concurrency: 3,
    };
    const useFactory = () => options;

    const dynamicModule = ScheduleModule.forRoot(options);
    const asyncModule = ScheduleModule.forRootAsync({
      useFactory,
    });

    expect(dynamicModule.module).toBe(ScheduleModule);
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

  it("should provide options, queue registration, and schedule services", () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      ScheduleModule,
    );
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      ScheduleModule,
    );
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      ScheduleModule,
    );
    const optionsProvider = providers.find(
      (provider: any) => provider.provide === MODULE_OPTIONS_TOKEN,
    );

    expect(imports).toEqual([DiscoveryModule, mockQueueModule]);
    expect(providers).toEqual(
      expect.arrayContaining([Logger, ScheduleRegistry, ScheduleProcessor]),
    );
    expect(exports).toEqual([MODULE_OPTIONS_TOKEN]);
    expect(optionsProvider.useFactory(undefined)).toEqual({});
    expect(
      optionsProvider.useFactory({
        autorun: false,
      }),
    ).toEqual({
      autorun: false,
    });
  });

  it("should register the schedule queue from module options", () => {
    expect(mockState.registerQueueAsyncOptions).toEqual(
      expect.objectContaining({
        inject: [MODULE_OPTIONS_TOKEN],
        name: "schedule",
      }),
    );
    expect(
      mockState.registerQueueAsyncOptions.useFactory({
        concurrency: 2,
      }),
    ).toEqual({
      concurrency: 2,
    });
  });
});

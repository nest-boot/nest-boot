import { Logger } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { DiscoveryModule } from "@nestjs/core";

vi.mock("@nest-boot/queue", () => ({
  QueueFactory: class QueueFactory {},
  Queue: vi.fn(() => vi.fn()),
  BaseQueue: class BaseQueue {},
  Processor: vi.fn(() => vi.fn()),
  BaseProcessor: class BaseProcessor {},
}));
import { QueueFactory } from "@nest-boot/queue";

import { ScheduleModule } from "./schedule.module.js";
import {
  BASE_MODULE_OPTIONS_TOKEN,
  MODULE_OPTIONS_TOKEN,
} from "./schedule.module-definition.js";
import { ScheduleProcessor } from "./schedule.processor.js";
import { ScheduleQueue } from "./schedule.queue.js";
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

    expect(imports).toEqual([DiscoveryModule]);
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

  it("creates the schedule queue from module options", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      ScheduleModule,
    );
    const provider = providers.find(
      (value: any) => value.provide === ScheduleQueue,
    );
    const queue = {};
    const factory = { create: vi.fn(() => queue) };
    expect(provider.inject).toEqual([QueueFactory, MODULE_OPTIONS_TOKEN]);
    expect(
      provider.useFactory(factory, {
        connection: { schema: "schedule_test" },
        concurrency: 2,
        autorun: false,
      }),
    ).toBe(queue);
    expect(factory.create).toHaveBeenCalledWith(ScheduleQueue, {
      connection: { schema: "schedule_test" },
    });
  });
});

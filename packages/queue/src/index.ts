export { OnQueueEvent } from "./on-queue-event.decorator.js";
export { OnWorkerEvent } from "./on-worker-event.decorator.js";
export { type NestWorkerOptions, Processor } from "./processor.decorator.js";
export { QueueModule } from "./queue.module.js";
export { QueueHealthIndicator } from "./queue-health.indicator.js";
export * from "./queue-module-options.interface.js";
export type {
  BullModuleExtraOptions,
  BullQueueAdvancedProcessor,
  BullQueueAdvancedSeparateProcessor,
  BullQueueProcessor,
  BullQueueProcessorCallback,
  BullQueueSeparateProcessor,
  BullRootModuleOptions,
  OnQueueEventMetadata,
  OnWorkerEventMetadata,
  ProcessorOptions,
  QueueEventsListenerOptions,
  RegisterFlowProducerAsyncOptions,
  RegisterFlowProducerOptions,
  RegisterFlowProducerOptionsFactory,
  RegisterQueueAsyncOptions,
  RegisterQueueOptions,
  RegisterQueueOptionsFactory,
  SharedBullAsyncConfiguration,
  SharedBullConfigurationFactory,
} from "@nestjs/bullmq";
export {
  BULL_CONFIG_DEFAULT_TOKEN,
  BullRegistrar,
  getFlowProducerOptionsToken,
  getFlowProducerToken,
  getQueueOptionsToken,
  getQueueToken,
  getSharedConfigToken,
  InjectFlowProducer,
  InjectQueue,
  JOB_REF,
  ProcessorDecoratorService,
  QueueEventsHost,
  QueueEventsListener,
  WorkerHost,
} from "@nestjs/bullmq";

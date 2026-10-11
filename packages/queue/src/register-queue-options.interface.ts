import type {
  RegisterQueueAsyncOptions as BaseRegisterQueueAsyncOptions,
  RegisterQueueOptions as BaseRegisterQueueOptions,
} from "@nestjs/bullmq";
import type { Type } from "@nestjs/common";

/** Options for registering a queue and optional job persistence. */
export interface RegisterQueueOptions extends BaseRegisterQueueOptions {
  /** Opt into persistence when globally enabled. Defaults to false; requires DatabaseModule and Job metadata. */
  persist?: boolean;
}

/** Factory for queue options, including the persistence setting. */
export interface RegisterQueueOptionsFactory {
  /**
   * Builds the queue options.
   * @returns Queue configuration with optional persistence.
   */
  createRegisterQueueOptions():
    | RegisterQueueOptions
    | Promise<RegisterQueueOptions>;
}

/** Async registration; set persist in the resolved queue options. */
export interface RegisterQueueAsyncOptions extends Omit<
  BaseRegisterQueueAsyncOptions,
  "useFactory" | "useClass" | "useExisting"
> {
  useExisting?: Type<RegisterQueueOptionsFactory>;
  useClass?: Type<RegisterQueueOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => RegisterQueueOptions | Promise<RegisterQueueOptions>;
}

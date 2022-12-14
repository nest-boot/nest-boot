import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from "@nestjs/common";
import { RedisOptions } from "ioredis";

import { Redis } from "./redis";

export type RedisModuleOptions = RedisOptions;

export interface RedisModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<RedisModuleOptions> | RedisModuleOptions;
}

@Module({})
export class RedisModule {
  static register(options?: RedisModuleOptions): DynamicModule {
    const providers = [
      {
        provide: Redis,
        useValue: new Redis(options ?? { host: "localhost", port: 6379 }),
      },
    ];

    return {
      module: RedisModule,
      providers: [...providers],
      exports: [...providers],
    };
  }

  static registerAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: RedisModule,
      imports: options.imports,
      providers: [...providers],
      exports: [...providers],
    };
  }

  private static createAsyncProviders(
    options: RedisModuleAsyncOptions
  ): Provider[] {
    return [
      {
        provide: Redis,
        inject: options.inject ?? [],
        useFactory: async (...args) =>
          new Redis(await options.useFactory(...args)),
      },
    ];
  }
}

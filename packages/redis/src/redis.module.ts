import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from "@nestjs/common";
import IORedis from "ioredis";

import { Redis } from "./redis";

export interface RedisModuleOptions extends IORedis.RedisOptions {}

export interface RedisModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<RedisModuleOptions> | RedisModuleOptions;
}

@Module({})
export class RedisModule {
  static register(options?: RedisModuleOptions): DynamicModule {
    const providers = [
      {
        provide: Redis,
        useValue: new Redis(options),
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
        inject: options.inject || [],
        useFactory: options.useFactory,
      },
    ];
  }
}

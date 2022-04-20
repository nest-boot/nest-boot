import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { SearchCommand } from "./commands/search.command";
import { SearchEngine } from "./engines/search.engine";
import { SearchEngineInterface } from "./interfaces/search-engine.interface";
import { SearchQueue } from "./queues/search.queue";

export interface SearchModuleOptions {
  engine?: SearchEngineInterface;
}

export interface SearchModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<SearchModuleOptions> | SearchModuleOptions;
}

@Module({})
export class SearchModule {
  static register(options?: SearchModuleOptions): DynamicModule {
    const providers = [
      {
        provide: SearchEngine,
        useValue: options?.engine,
      },
    ];

    return {
      global: true,
      module: SearchModule,
      imports: [DiscoveryModule],
      providers: [SearchQueue, SearchCommand, ...providers],
      exports: [SearchQueue, ...providers],
    };
  }

  static registerAsync(options: SearchModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: SearchModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers: [SearchQueue, SearchCommand, ...providers],
      exports: [SearchQueue, ...providers],
    };
  }

  private static createAsyncProviders(
    options: SearchModuleAsyncOptions
  ): Provider[] {
    return [
      {
        provide: SearchEngine,
        inject: options.inject || [],
        useFactory: async (...args) =>
          (await options.useFactory(...args))?.engine,
      },
    ];
  }
}
